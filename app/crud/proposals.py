"""
Pure CRUD operations for GraphProposal model.
No business logic - only raw database operations.
"""
from sqlalchemy.orm import Session
from .. import models

def get_proposal_by_hash(db: Session, public_hash: str):
    """Get proposal by public_hash"""
    return db.query(models.GraphProposal).filter(models.GraphProposal.public_hash == public_hash).first()

def get_user_proposals(db: Session, user_uuid: str, skip: int = 0, limit: int = 100):
    """Get proposals for a user (both sent and received)"""
    return db.query(models.GraphProposal).filter(
        (models.GraphProposal.proposer_uuid == user_uuid) | 
        (models.GraphProposal.target_user_uuid == user_uuid)
    ).offset(skip).limit(limit).all()

def create_proposal_record(db: Session, **kwargs):
    """Create a new proposal record with provided fields"""
    db_proposal = models.GraphProposal(**kwargs)
    db.add(db_proposal)
    db.flush()
    return db_proposal

def update_proposal_record(db: Session, proposal_id: int, **kwargs):
    """Update proposal record with provided fields"""
    db.query(models.GraphProposal).filter(
        models.GraphProposal.id == proposal_id
    ).update(kwargs)
    db.flush()

def delete_proposal_by_hash(db: Session, public_hash: str):
    """Delete proposal by public_hash"""
    proposal = get_proposal_by_hash(db, public_hash)
    if proposal:
        db.delete(proposal)
        db.commit()
        return True
    return False
