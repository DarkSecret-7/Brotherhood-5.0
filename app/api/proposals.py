"""
Proposal and consent endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from .. import services, schemas, utils, models, database
from uuid import UUID
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
    proposal = crud.get_proposal(db, proposal_hash)
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found")
    
    # Only target user can respond
    if proposal.target_user_uuid != current_user.public_uuid:
        raise HTTPException(status_code=403, detail="Only the target user can respond to this proposal")
    
    # Check if proposal is still pending
    if proposal.proposal_status != "Pending":
        raise HTTPException(status_code=400, detail="Proposal is no longer pending")
    
    # Create consent record
    consent_data = schemas.ProposalConsentCreate(
        proposal_hash=proposal_hash,
        user_uuid=current_user.public_uuid,
        user_vote=1 if response.approve else -1  # 1 for approve, -1 for reject
    )
    
    consent = crud.create_proposal_consent(db, consent_data)
    
    # Update proposal status based on response
    if response.approve:
        # For delete proposals, execute the deletion if approved
        if proposal.proposal_type == "Delete":
            snapshot = crud.get_snapshot(db, proposal.graph_uuid)
            if snapshot:
                crud.delete_snapshot(db, snapshot.public_uuid)
                crud.update_proposal_status(db, proposal_hash, "Approved")
        else:
            crud.update_proposal_status(db, proposal_hash, "Approved")
    else:
        crud.update_proposal_status(db, proposal_hash, "Rejected")
    
    return {"message": "Response recorded", "consent_id": consent.id}

@router.delete("/proposals/{proposal_hash}")
def delete_proposal(proposal_hash: str, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    """Delete a proposal (only proposer can delete pending proposals)"""
    proposal = crud.get_proposal(db, proposal_hash)
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found")
    
    # Only proposer can delete and only if pending
    if proposal.proposer_uuid != current_user.public_uuid:
        raise HTTPException(status_code=403, detail="Only the proposer can delete a proposal")
    
    if proposal.proposal_status != "Pending":
        raise HTTPException(status_code=400, detail="Cannot delete a proposal that is no longer pending")
    
    success = crud.delete_proposal(db, proposal_hash)
    if not success:
        raise HTTPException(status_code=404, detail="Proposal not found")
    
    return {"message": "Proposal deleted"}
