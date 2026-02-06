from sqlalchemy.orm import Session
from sqlalchemy import func
from . import models, schemas

def create_snapshot(db: Session, snapshot_data: schemas.GraphSnapshotCreate):
    # Create the snapshot container
    db_snapshot = models.GraphSnapshot(version_label=snapshot_data.version_label)
    db.add(db_snapshot)
    db.commit()
    db.refresh(db_snapshot)

    # Create all domains linked to this snapshot
    # Input domains use local_id for parent references
    domain_mapping = {} # local_id -> db_id
    if snapshot_data.domains:
        # First pass: create domains
        for d_data in snapshot_data.domains:
            db_domain = models.Domain(
                snapshot_id=db_snapshot.id,
                local_id=d_data.local_id,
                title=d_data.title,
                description=d_data.description,
                collapsed=d_data.collapsed
            )
            db.add(db_domain)
            db.commit()
            db.refresh(db_domain)
            domain_mapping[d_data.local_id] = db_domain.id
        
        # Second pass: update parent_id if provided as local_id
        for d_data in snapshot_data.domains:
            if d_data.parent_id is not None and d_data.parent_id in domain_mapping:
                db_domain = db.query(models.Domain).filter(models.Domain.id == domain_mapping[d_data.local_id]).first()
                db_domain.parent_id = domain_mapping[d_data.parent_id]
        db.commit()

    # Create all nodes linked to this snapshot
    db_nodes = []
    for node_data in snapshot_data.nodes:
        resolved_domain_id = None
        if node_data.domain_id is not None and node_data.domain_id in domain_mapping:
            resolved_domain_id = domain_mapping[node_data.domain_id]

        db_node = models.Node(
            snapshot_id=db_snapshot.id,
            local_id=node_data.local_id,
            title=node_data.title,
            description=node_data.description,
            prerequisite=node_data.prerequisite,
            mentions=node_data.mentions,
            sources=node_data.sources,
            domain_id=resolved_domain_id
        )
        db_nodes.append(db_node)
    
    db.add_all(db_nodes)
    db.commit()
    
    # Return with nodes populated
    db.refresh(db_snapshot)
    # Manually attach node_count
    db_snapshot.node_count = len(db_nodes)
    return db_snapshot

def get_snapshots(db: Session, skip: int = 0, limit: int = 100):
    # Fetch snapshots
    snapshots = db.query(models.GraphSnapshot).order_by(models.GraphSnapshot.created_at.desc()).offset(skip).limit(limit).all()
    
    # Annotate with node count
    results = []
    for s in snapshots:
        count = db.query(func.count(models.Node.id)).filter(models.Node.snapshot_id == s.id).scalar()
        results.append({
            "id": s.id,
            "created_at": s.created_at,
            "version_label": s.version_label,
            "node_count": count
        })
    return results

def get_snapshot(db: Session, snapshot_id: int):
    snapshot = db.query(models.GraphSnapshot).filter(models.GraphSnapshot.id == snapshot_id).first()
    if snapshot:
        # Populate computed field
        count = db.query(func.count(models.Node.id)).filter(models.Node.snapshot_id == snapshot.id).scalar()
        snapshot.node_count = count
    return snapshot

def delete_snapshot(db: Session, snapshot_id: int):
    snapshot = db.query(models.GraphSnapshot).filter(models.GraphSnapshot.id == snapshot_id).first()
    if snapshot:
        db.delete(snapshot)
        db.commit()
        return True
    return False

# --- User CRUD ---

def get_user_by_username(db: Session, username: str):
    return db.query(models.User).filter(models.User.username == username).first()

def create_user(db: Session, user: schemas.UserCreate, hashed_password: str):
    db_user = models.User(username=user.username, hashed_password=hashed_password)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

def delete_user_by_username(db: Session, username: str):
    user = db.query(models.User).filter(models.User.username == username).first()
    if user:
        db.delete(user)
        db.commit()
        return True
    return False

# --- Invitation CRUD ---

def get_invitation_by_code(db: Session, code: str):
    return db.query(models.Invitation).filter(models.Invitation.code == code).first()

def use_invitation(db: Session, invitation: models.Invitation):
    invitation.is_used = True
    db.commit()
    db.refresh(invitation)
    return invitation

def create_invitation(db: Session, code: str):
    db_invitation = models.Invitation(code=code)
    db.add(db_invitation)
    db.commit()
    db.refresh(db_invitation)
    return db_invitation

def get_invitations(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Invitation).offset(skip).limit(limit).all()

def delete_invitation(db: Session, code: str):
    invitation = db.query(models.Invitation).filter(models.Invitation.code == code).first()
    if invitation:
        db.delete(invitation)
        db.commit()
        return True
    return False
