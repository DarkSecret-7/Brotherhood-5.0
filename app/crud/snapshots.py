"""
Pure CRUD operations for GraphSnapshot model.
No business logic - only raw database operations.
"""
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from uuid import UUID
from .. import models

def get_snapshot_by_uuid(db: Session, snapshot_uuid: UUID):
    """Get snapshot by public_uuid with relationships loaded"""
    return db.query(models.GraphSnapshot).options(
        joinedload(models.GraphSnapshot.nodes),
        joinedload(models.GraphSnapshot.domains),
        joinedload(models.GraphSnapshot.redirects),
        joinedload(models.GraphSnapshot.authors_ref)
    ).filter(models.GraphSnapshot.public_uuid == snapshot_uuid).first()

def get_snapshot_by_id(db: Session, snapshot_id: int):
    """Get snapshot by primary key"""
    return db.query(models.GraphSnapshot).filter(models.GraphSnapshot.id == snapshot_id).first()

def get_snapshot_by_label(db: Session, version_label: str):
    """Get snapshot by version label"""
    return db.query(models.GraphSnapshot).options(
        joinedload(models.GraphSnapshot.nodes),
        joinedload(models.GraphSnapshot.domains),
        joinedload(models.GraphSnapshot.redirects),
        joinedload(models.GraphSnapshot.authors_ref)
    ).filter(models.GraphSnapshot.version_label == version_label).first()

def create_snapshot_record(db: Session, **kwargs):
    """Create a new snapshot record with provided fields"""
    db_snapshot = models.GraphSnapshot(**kwargs)
    db.add(db_snapshot)
    db.flush()
    return db_snapshot

def update_snapshot_record(db: Session, snapshot_id: int, **kwargs):
    """Update snapshot record with provided fields"""
    db.query(models.GraphSnapshot).filter(
        models.GraphSnapshot.id == snapshot_id
    ).update(kwargs)
    db.flush()

def get_snapshots_paginated(db: Session, skip: int = 0, limit: int = 100):
    """Get all snapshots with pagination"""
    return db.query(models.GraphSnapshot).offset(skip).limit(limit).all()

def get_public_snapshots(db: Session, skip: int = 0, limit: int = 100):
    """Get public snapshots with pagination"""
    return db.query(models.GraphSnapshot).filter(
        models.GraphSnapshot.is_public == True
    ).offset(skip).limit(limit).all()

def delete_snapshot_by_uuid(db: Session, snapshot_uuid: UUID):
    """Delete snapshot by public_uuid"""
    snapshot = get_snapshot_by_uuid(db, snapshot_uuid)
    if snapshot:
        db.delete(snapshot)
        db.commit()
        return True
    return False

def delete_snapshot_by_label(db: Session, version_label: str):
    """Delete snapshot by version label"""
    snapshot = get_snapshot_by_label(db, version_label)
    if snapshot:
        db.delete(snapshot)
        db.commit()
        return True
    return False

def create_authorship_record(db: Session, graph_id: int, user_id: int, role: str = None):
    """Create graph authorship record"""
    db_authorship = models.GraphAuthorship(
        graph_id=graph_id,
        user_id=user_id,
        role=role
    )
    db.add(db_authorship)
    db.flush()
    return db_authorship

def clear_snapshot_nodes(db: Session, snapshot_id: int):
    """Delete all nodes for a snapshot"""
    db.query(models.Node).filter(
        models.Node.snapshot_id == snapshot_id
    ).delete(synchronize_session=False)

def clear_snapshot_domains(db: Session, snapshot_id: int):
    """Delete all domains for a snapshot"""
    db.query(models.Domain).filter(
        models.Domain.snapshot_id == snapshot_id
    ).delete(synchronize_session=False)

def clear_snapshot_redirects(db: Session, snapshot_id: int):
    """Delete all redirects for a snapshot"""
    db.query(models.NodeRedirect).filter(
        models.NodeRedirect.snapshot_id == snapshot_id
    ).delete(synchronize_session=False)

def create_node_record(db: Session, **kwargs):
    """Create a single node record"""
    db_node = models.Node(**kwargs)
    db.add(db_node)
    return db_node

def create_domain_record(db: Session, **kwargs):
    """Create a single domain record"""
    db_domain = models.Domain(**kwargs)
    db.add(db_domain)
    db.flush()  # Need to flush to get the ID for parent relationships
    return db_domain

def create_redirect_record(db: Session, **kwargs):
    """Create a single redirect record"""
    db_redirect = models.NodeRedirect(**kwargs)
    db.add(db_redirect)
    return db_redirect

def bulk_create_nodes(db: Session, nodes: list):
    """Create multiple nodes at once"""
    db.add_all(nodes)
    db.flush()

def bulk_create_domains(db: Session, domains: list):
    """Create multiple domains at once"""
    db.add_all(domains)
    db.flush()

def bulk_create_redirects(db: Session, redirects: list):
    """Create multiple redirects at once"""
    db.add_all(redirects)
    db.commit()
