"""
Pure CRUD operations for Invitation model.
No business logic - only raw database operations.
"""
from sqlalchemy.orm import Session
from .. import models

def get_invitation_by_code(db: Session, code: str):
    """Get invitation by code"""
    return db.query(models.Invitation).filter(models.Invitation.code == code).first()

def create_invitation_record(db: Session, **kwargs):
    """Create a new invitation record with provided fields"""
    db_invitation = models.Invitation(**kwargs)
    db.add(db_invitation)
    db.flush()
    return db_invitation

def update_invitation_record(db: Session, invitation_id: int, **kwargs):
    """Update invitation record with provided fields"""
    db.query(models.Invitation).filter(models.Invitation.id == invitation_id).update(kwargs)
    db.flush()

def delete_invitation_by_code(db: Session, code: str):
    """Delete invitation by code"""
    invitation = get_invitation_by_code(db, code)
    if invitation:
        db.delete(invitation)
        db.commit()
        return True
    return False
