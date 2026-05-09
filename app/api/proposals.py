# This file is part of The Brotherhood Project
#
# Copyright (C) 2026  The Brotherhood Project
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program.  If not, see <https://www.gnu.org/licenses/>.

"""
Proposal and consent endpoints
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from .. import services, schemas, models, database
from .auth import get_current_user

router = APIRouter()

@router.get("/proposals", response_model=List[schemas.ProposalRead])
def get_proposals(skip: int = 0, limit: int = 100, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    """Get proposals for the current user (both sent and received)"""
    return services.proposals.ProposalService.get_user_proposals(db, current_user.public_uuid, skip=skip, limit=limit)

@router.get("/proposals/{proposal_hash}", response_model=schemas.ProposalRead)
def get_proposal(proposal_hash: str, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    """Get a specific proposal"""
    proposal = services.proposals.ProposalService.get_proposal(db, proposal_hash)
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found")

    # Check if user is involved in this proposal
    if (proposal.proposer_uuid != current_user.public_uuid and
        proposal.target_user_uuid != current_user.public_uuid):
        raise HTTPException(status_code=403, detail="Not authorized to access this proposal")

    return proposal

@router.post("/proposals/{proposal_hash}/respond")
def respond_to_proposal(
    proposal_hash: str,
    response: schemas.ProposalResponse,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Respond to a proposal (approve/reject)"""
    try:
        result = services.proposals.ProposalService.respond_to_proposal(
            db, proposal_hash, current_user.public_uuid, response.approve
        )
        return result
    except ValueError as e:
        error_msg = str(e).lower()
        if "not found" in error_msg:
            raise HTTPException(status_code=404, detail=str(e))
        elif "not authorized" in error_msg or "target user" in error_msg:
            raise HTTPException(status_code=403, detail=str(e))
        elif "no longer pending" in error_msg:
            raise HTTPException(status_code=400, detail=str(e))
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/proposals/{proposal_hash}")
def delete_proposal(proposal_hash: str, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    """Delete a proposal (only proposer can delete pending proposals)"""
    # Get proposal first to check ownership
    proposal = services.proposals.ProposalService.get_proposal(db, proposal_hash)
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found")

    # Only proposer can delete and only if pending
    if proposal.proposer_uuid != current_user.public_uuid:
        raise HTTPException(status_code=403, detail="Only the proposer can delete a proposal")

    if proposal.proposal_status != "pending":
        raise HTTPException(status_code=400, detail="Cannot delete a proposal that is no longer pending")

    success = services.proposals.ProposalService.delete_proposal(db, proposal_hash)
    if not success:
        raise HTTPException(status_code=404, detail="Proposal not found")

    return {"message": "Proposal deleted"}
