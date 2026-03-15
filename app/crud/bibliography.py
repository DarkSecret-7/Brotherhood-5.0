"""
Pure CRUD operations for Bibliography model.
No business logic - only raw database operations.
"""
from sqlalchemy.orm import Session
from .. import models

def get_bibliography_by_hash(db: Session, public_hash: str):
    """Get bibliography by public_hash"""
    return db.query(models.Bibliography).filter(models.Bibliography.public_hash == public_hash).first()

def create_bibliography_record(db: Session, **kwargs):
    """Create a new bibliography record with provided fields"""
    db_bibliography = models.Bibliography(**kwargs)
    db.add(db_bibliography)
    db.flush()
    return db_bibliography

def delete_bibliography_by_hash(db: Session, public_hash: str):
    """Delete bibliography by public_hash"""
    bibliography = get_bibliography_by_hash(db, public_hash)
    if bibliography:
        db.delete(bibliography)
        db.commit()
        return True
    return False
