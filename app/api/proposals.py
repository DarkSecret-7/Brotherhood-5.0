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
from typing import List, Union
from uuid import UUID
from .. import services, schemas, models, database
from .auth import get_current_user

router = APIRouter()

@router.get("/proposals", response_model=List[schemas.ProposalRead])
def get_proposals(skip: int = 0, limit: int = 100, pending_only: bool = False, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    """Get proposals for the current user (both sent and received)"""
    return services.proposals.ProposalService.get_user_proposals(db, current_user.public_uuid, pending_only=pending_only, skip=skip, limit=limit)

@router.get("/proposals/{graph_uuid}/proposals", response_model=List[schemas.ProposalRead])
def get_proposals_for_graph(graph_uuid: str, pending_only: bool = False, skip: int = 0, limit: int = 100, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    """Get proposals for a specific graph (only for authors)"""

    authors = services.authorship.AuthorshipService.get_snapshot_authors(db, UUID(graph_uuid))
    author_uuids = [author.user_uuid for author in authors]

    if current_user.public_uuid not in author_uuids:
        raise HTTPException(status_code=403, detail="User is not an author of this graph")

    return services.proposals.ProposalService.get_proposals_for_graph(db, UUID(graph_uuid), pending_only, skip=skip, limit=limit)

@router.get("/proposals/{proposal_hash}", response_model=schemas.ProposalRead)
def get_proposal(proposal_hash: str, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    """Get a specific proposal (only for authors)"""
    proposal = services.proposals.ProposalService.get_proposal(db, proposal_hash)
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found")

    # Check if user is involved in this proposal
    authors = services.authorship.AuthorshipService.get_snapshot_authors(db, UUID(graph_uuid))
    author_uuids = [author.user_uuid for author in authors]

    if current_user.public_uuid not in author_uuids:
        raise HTTPException(status_code=403, detail="User is not an author of this graph")

    return proposal

@router.post("/proposals/{proposal_hash}/respond")
def respond_to_proposal(
    proposal_hash: str,
    response: schemas.ProposalConsentCreate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Respond to a proposal (approve/reject)"""
    try:
        result = services.proposals.ProposalService.respond_to_proposal(
            db, response
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

    if proposal.proposal_status != "Pending":
        raise HTTPException(status_code=400, detail="Cannot delete a proposal that is no longer pending")

    success = services.proposals.ProposalService.delete_proposal(db, proposal_hash)
    if success:
        return True
    else:
        raise HTTPException(status_code=404, detail="Proposal not found")

@router.post("/proposals/{graph_uuid}/join")
def join_graph(graph_uuid: str, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    """Request to join a graph as an author"""
    try:
        result = services.proposals.ProposalService.join_graph(
            db, UUID(graph_uuid), current_user.public_uuid
        )
        return result
    except ValueError as e:
        error_msg = str(e).lower()
        if "already an author" in error_msg:
            raise HTTPException(status_code=400, detail=str(e))
        elif "no authors" in error_msg:
            raise HTTPException(status_code=404, detail=str(e))
        elif "pending" in error_msg:
            raise HTTPException(status_code=202, detail=str(e))
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/proposals/{graph_uuid}/invite")
def invite_to_graph(
    graph_uuid: str,
    request: schemas.ProposalCreate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Invite a user to become an author of a graph"""
    try:
        result = services.proposals.ProposalService.invite_to_graph(
            db, UUID(graph_uuid), current_user.public_uuid, request.target_user_uuid
        )
        return result
    except ValueError as e:
        error_msg = str(e).lower()
        if "not an author" in error_msg:
            raise HTTPException(status_code=403, detail=str(e))
        elif "already an author" in error_msg:
            raise HTTPException(status_code=400, detail=str(e))
        elif "pending" in error_msg:
            raise HTTPException(status_code=202, detail=str(e))
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/proposals/{graph_uuid}/remove")
def remove_from_graph(
    graph_uuid: str,
    target_user_uuid: UUID,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Remove a user from a graph as an author"""
    try:
        result = services.proposals.ProposalService.remove_from_graph(
            db, UUID(graph_uuid), current_user.public_uuid, target_user_uuid
        )
        return result
    except ValueError as e:
        error_msg = str(e).lower()
        if "not an author" in error_msg:
            raise HTTPException(status_code=403, detail=str(e))
        elif "already an author" in error_msg:
            raise HTTPException(status_code=400, detail=str(e))
        elif "pending" in error_msg:
            raise HTTPException(status_code=202, detail=str(e))
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/proposals/{graph_uuid}/request", response_model=Union[schemas.JoinRequestRead, None])
def get_join_request_for_graph(graph_uuid: str, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    """
    Only reveal join request to the requestor, if a request exists by the requestor
    NEVER reveal complete proposal details to requestor who is not yet an author of the graph
    """
    return services.proposals.ProposalService.get_join_request_for_graph(db, UUID(graph_uuid), current_user.public_uuid)
