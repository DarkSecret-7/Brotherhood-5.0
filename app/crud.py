from sqlalchemy.orm import Session
from sqlalchemy import func
from . import models, schemas

def create_snapshot(db: Session, snapshot_data: schemas.GraphSnapshotCreate):
    # Create the snapshot container
    db_snapshot = models.GraphSnapshot(
        version_label=snapshot_data.version_label,
        base_graph=snapshot_data.base_graph,
        created_by=snapshot_data.created_by
    )
    db.add(db_snapshot)
    db.commit()
    db.refresh(db_snapshot)

    _populate_snapshot_data(db, db_snapshot, snapshot_data)
    
    # Return with nodes populated
    db.refresh(db_snapshot)
    
    # Manually attach node_count (computed field)
    # Using setattr to ensure it exists on the object for Pydantic
    node_count = len(snapshot_data.nodes)
    setattr(db_snapshot, 'node_count', node_count)
    
    # Ensure datetime fields are valid for Pydantic
    if db_snapshot.last_updated is None:
        db_snapshot.last_updated = db_snapshot.created_at
        
    return db_snapshot

def update_snapshot(db: Session, db_snapshot: models.GraphSnapshot, snapshot_data: schemas.GraphSnapshotCreate):
    # Update snapshot metadata
    # version_label is NOT updated on overwrite (it's the same graph)
    
    # Base Graph Logic:
    # 1. If user is overwriting the SAME graph (snapshot_data.base_graph == db_snapshot.version_label), 
    #    we keep the existing base_graph (do NOT update it to point to itself).
    # 2. If user is overwriting a graph with content FROM ANOTHER graph (snapshot_data.base_graph != db_snapshot.version_label),
    #    we update the base_graph to reflect the new source.
    
    if snapshot_data.base_graph and snapshot_data.base_graph != db_snapshot.version_label:
        db_snapshot.base_graph = snapshot_data.base_graph
    # Else: base_graph remains unchanged (prevents self-reference loop)
        
    # CRITICAL: created_by is NEVER updated during overwrite to preserve original authorship,
    # even if the current value is 'Unknown' or null.
    
    # Explicitly update last_updated in case metadata didn't change but nodes/domains did
    db_snapshot.last_updated = func.now()
    
    # Clear existing nodes and domains
    # Using delete(synchronize_session=False) for better performance and to avoid session issues
    
    # First delete associated sources to avoid ForeignKeyViolation
    # Get all node IDs for this snapshot
    node_ids_query = db.query(models.Node.id).filter(models.Node.snapshot_id == db_snapshot.id)
    # Delete sources where node_id is in the list of node IDs
    db.query(models.Source).filter(models.Source.node_id.in_(node_ids_query)).delete(synchronize_session=False)
    
    # Now delete nodes
    db.query(models.Node).filter(models.Node.snapshot_id == db_snapshot.id).delete(synchronize_session=False)
    db.query(models.Domain).filter(models.Domain.snapshot_id == db_snapshot.id).delete(synchronize_session=False)

    db.commit()
    
    # Re-populate
    _populate_snapshot_data(db, db_snapshot, snapshot_data)
    
    db.commit()
    db.refresh(db_snapshot)
    
    # Manually attach node_count
    node_count = len(snapshot_data.nodes)
    setattr(db_snapshot, 'node_count', node_count)
    
    # Ensure datetime fields are valid
    if db_snapshot.last_updated is None:
        db_snapshot.last_updated = db_snapshot.created_at
        
    return db_snapshot

def _populate_snapshot_data(db: Session, db_snapshot: models.GraphSnapshot, snapshot_data: schemas.GraphSnapshotCreate):
    # Create all domains linked to this snapshot
    domain_mapping = {} # local_id -> db_id
    if snapshot_data.domains:
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
            sources=None, # Deprecated: Legacy sources are migrated to Source table
            domain_id=resolved_domain_id
        )
        
        # Track existing URLs to prevent duplicates
        existing_urls = set()
        if hasattr(node_data, 'source_items') and node_data.source_items:
            for item in node_data.source_items:
                if item.url:
                    existing_urls.add(item.url)

        # Migrate legacy sources string to Source objects
        if node_data.sources:
            legacy_urls = [u.strip() for u in node_data.sources.split(',') if u.strip()]
            for url in legacy_urls:
                # Skip if already present in source_items
                if url in existing_urls:
                    continue
                
                # Basic type detection
                s_type = "PDF" if url.lower().endswith('.pdf') else "Other"
                
                legacy_source = models.Source(
                    title=url, # Use URL as title
                    author=None,
                    year=None,
                    source_type=s_type,
                    url=url,
                    fragment_start=None,
                    fragment_end=None
                )
                db_node.source_items.append(legacy_source)
                existing_urls.add(url) # Prevent duplicates within legacy list too
        
        # Populate new source items
        if hasattr(node_data, 'source_items') and node_data.source_items:
            for source_data in node_data.source_items:
                db_source = models.Source(
                    title=source_data.title,
                    author=source_data.author,
                    year=source_data.year,
                    source_type=source_data.source_type,
                    url=source_data.url,
                    fragment_start=source_data.fragment_start,
                    fragment_end=source_data.fragment_end
                )
                db_node.source_items.append(db_source)
                
        db_nodes.append(db_node)
    
    db.add_all(db_nodes)
    db.commit()

def get_snapshots(db: Session, skip: int = 0, limit: int = 100):
    # Fetch snapshots
    snapshots = db.query(models.GraphSnapshot).order_by(models.GraphSnapshot.created_at.desc()).offset(skip).limit(limit).all()
    
    # Annotate with node count
    results = []
    for s in snapshots:
        count = db.query(func.count(models.Node.id)).filter(models.Node.snapshot_id == s.id).scalar()
        
        # Ensure dates are JSON serializable and handle potential None values
        # Fallback to created_at if last_updated is somehow null
        created_at = s.created_at
        last_updated = s.last_updated if s.last_updated else s.created_at
        
        results.append({
            "id": s.id,
            "created_at": created_at,
            "last_updated": last_updated,
            "version_label": s.version_label,
            "base_graph": s.base_graph,
            "created_by": s.created_by,
            "node_count": count
        })
    return results

def get_snapshot(db: Session, snapshot_id: int):
    snapshot = db.query(models.GraphSnapshot).filter(models.GraphSnapshot.id == snapshot_id).first()
    if snapshot:
        # Populate computed field
        count = db.query(func.count(models.Node.id)).filter(models.Node.snapshot_id == snapshot.id).scalar()
        snapshot.node_count = count
        # Ensure last_updated is not null for serialization
        if snapshot.last_updated is None:
            snapshot.last_updated = snapshot.created_at
    return snapshot

def delete_snapshot(db: Session, snapshot_id: int):
    snapshot = db.query(models.GraphSnapshot).filter(models.GraphSnapshot.id == snapshot_id).first()
    if snapshot:
        db.delete(snapshot)
        db.commit()
        return True
    return False

def get_snapshot_by_label(db: Session, label: str):
    snapshot = db.query(models.GraphSnapshot).filter(models.GraphSnapshot.version_label == label).first()
    if snapshot and snapshot.last_updated is None:
        snapshot.last_updated = snapshot.created_at
    return snapshot

def delete_snapshot_by_label(db: Session, label: str):
    snapshot = get_snapshot_by_label(db, label)
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
