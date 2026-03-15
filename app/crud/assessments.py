"""
Pure CRUD operations for Capability/Assessment model.
No business logic - only raw database operations.
"""
from sqlalchemy.orm import Session
from .. import models

def get_capability_by_hash(db: Session, public_hash: str):
    """Get capability by public_hash"""
    return db.query(models.Capability).filter(models.Capability.public_hash == public_hash).first()

def get_latest_capability_by_user_and_graph(db: Session, user_id: int, graph_uuid: str, assessment_name: str):
    """Get latest capability by user, graph, and assessment name"""
    return db.query(models.Capability).filter(
        models.Capability.user_uuid == graph_uuid,  # This should be user_id, need to check model
        models.Capability.graph_uuid == graph_uuid,
        models.Capability.assessment_name == assessment_name
    ).order_by(models.Capability.created_at.desc()).first()

def create_capability_record(db: Session, **kwargs):
    """Create a new capability record with provided fields"""
    db_capability = models.Capability(**kwargs)
    db.add(db_capability)
    db.flush()
    return db_capability

def update_capability_record(db: Session, capability_id: int, **kwargs):
    """Update capability record with provided fields"""
    db.query(models.Capability).filter(
        models.Capability.id == capability_id
    ).update(kwargs)
    db.flush()

def delete_capability_by_hash(db: Session, public_hash: str):
    """Delete capability by public_hash"""
    capability = get_capability_by_hash(db, public_hash)
    if capability:
        db.delete(capability)
        db.commit()
        return True
    return False
