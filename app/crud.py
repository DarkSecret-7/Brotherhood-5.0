from datetime import datetime, timezone
from sqlalchemy.orm import Session
from sqlalchemy import func
from . import models, schemas

def create_snapshot(db: Session, snapshot_data: schemas.GraphSnapshotCreate):
    # Resolve creator and base graph references
    creator_id = None
    if snapshot_data.created_by:
        user = db.query(models.User).filter(models.User.username == snapshot_data.created_by).first()
        if user:
            creator_id = user.id
            
    base_graph_id = None
    if snapshot_data.base_graph:
        base = db.query(models.GraphSnapshot).filter(models.GraphSnapshot.version_label == snapshot_data.base_graph).first()
        if base:
            base_graph_id = base.id

    # Create the snapshot container
    db_snapshot = models.GraphSnapshot(
        version_label=snapshot_data.version_label,
        base_graph_id=base_graph_id,
        created_by_id=creator_id,
        is_public=snapshot_data.is_public
    )
    db.add(db_snapshot)
    db.commit()
    db.refresh(db_snapshot)

    _populate_snapshot_data(db, db_snapshot, snapshot_data)
    _populate_redirect_data(db, db_snapshot, snapshot_data)
    
    # Return with nodes populated
    db.refresh(db_snapshot)
    
    # Manually attach node_count (computed field)
    # Using setattr to ensure it exists on the object for Pydantic
    node_count = len(snapshot_data.nodes)
    assessable_node_count = sum(1 for n in snapshot_data.nodes if n.assessable)
    setattr(db_snapshot, 'node_count', node_count)
    setattr(db_snapshot, 'assessable_node_count', assessable_node_count)
    
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
        base = db.query(models.GraphSnapshot).filter(models.GraphSnapshot.version_label == snapshot_data.base_graph).first()
        if base:
            db_snapshot.base_graph_id = base.id
    # Else: base_graph remains unchanged (prevents self-reference loop)
        
    # CRITICAL: created_by is NEVER updated during overwrite to preserve original authorship,
    # even if the current value is 'Unknown' or null.
    
    # Explicitly update last_updated in case metadata didn't change but nodes/domains did
    db_snapshot.last_updated = func.now()
    
    # Clear existing nodes and domains
    # Using delete(synchronize_session=False) for better performance and to avoid session issues
    
    # First delete associated sources to avoid ForeignKeyViolation
    # Fetch IDs first to ensure safe deletion (avoid subquery issues in some contexts)
    node_ids = [r[0] for r in db.query(models.Node.id).filter(models.Node.snapshot_id == db_snapshot.id).all()]
    
    if node_ids:
        # Delete sources where node_id is in the list
        # Using explicit chunks if needed, but for now direct IN clause
        db.query(models.Source).filter(models.Source.node_id.in_(node_ids)).delete(synchronize_session=False)
        db.flush() # Ensure sources are marked for deletion before nodes
    
    # Now delete nodes
    db.query(models.Node).filter(models.Node.snapshot_id == db_snapshot.id).delete(synchronize_session=False)
    db.query(models.Domain).filter(models.Domain.snapshot_id == db_snapshot.id).delete(synchronize_session=False)
    db.query(models.NodeRedirect).filter(models.NodeRedirect.snapshot_id == db_snapshot.id).delete(synchronize_session=False)


    db.commit()
    
    # Re-populate
    _populate_snapshot_data(db, db_snapshot, snapshot_data)
    _populate_redirect_data(db, db_snapshot, snapshot_data)
    
    db.commit()
    db.refresh(db_snapshot)
    
    # Manually attach node_count
    node_count = len(snapshot_data.nodes)
    assessable_node_count = sum(1 for n in snapshot_data.nodes if n.assessable)
    setattr(db_snapshot, 'node_count', node_count)
    setattr(db_snapshot, 'assessable_node_count', assessable_node_count)
    
    # Ensure datetime fields are valid
    if db_snapshot.last_updated is None:
        db_snapshot.last_updated = db_snapshot.created_at
        
    return db_snapshot

def update_snapshot_metadata(db: Session, db_snapshot: models.GraphSnapshot, snapshot_update: schemas.GraphSnapshotUpdate):
    if snapshot_update.version_label is not None:
        db_snapshot.version_label = snapshot_update.version_label
    
    if snapshot_update.is_public is not None:
        db_snapshot.is_public = snapshot_update.is_public
    
    db_snapshot.last_updated = func.now()
    db.commit()
    db.refresh(db_snapshot)
    
    # Re-fetch node count for consistency
    node_count = db.query(func.count(models.Node.id)).filter(models.Node.snapshot_id == db_snapshot.id).scalar()
    setattr(db_snapshot, 'node_count', node_count)
    
    return db_snapshot

def _populate_snapshot_data(db: Session, db_snapshot: models.GraphSnapshot, snapshot_data: schemas.GraphSnapshotCreate):
    # Create all domains linked to this snapshot
    domain_mapping = {} # local_id -> db_id (for local_id based references)
    domain_old_id_mapping = {} # old_db_id -> db_id (for db_id based references from import)
    
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
            if hasattr(d_data, 'id') and d_data.id is not None:
                domain_old_id_mapping[d_data.id] = db_domain.id
        
        # Second pass to link parent/child domains
        for d_data in snapshot_data.domains:
            if d_data.parent_id is not None:
                parent_db_id = None
                
                # Try to resolve parent via old DB ID (priority for imports)
                if d_data.parent_id in domain_old_id_mapping:
                    parent_db_id = domain_old_id_mapping[d_data.parent_id]
                # Fallback to local_id resolution
                elif d_data.parent_id in domain_mapping:
                    parent_db_id = domain_mapping[d_data.parent_id]
                
                if parent_db_id:
                    # We need to update the newly created domain with the parent ID
                    # We can find it via local_id mapping
                    current_db_id = domain_mapping.get(d_data.local_id)
                    if current_db_id:
                        db_domain = db.query(models.Domain).filter(models.Domain.id == current_db_id).first()
                        if db_domain:
                            db_domain.parent_id = parent_db_id
                            db.add(db_domain)
        db.commit()

    # Create all nodes linked to this snapshot
    db_nodes = []
    for node_data in snapshot_data.nodes:
        resolved_domain_id = None
        
        if node_data.domain_id is not None:
            # Try to resolve via old DB ID (priority for imports)
            if node_data.domain_id in domain_old_id_mapping:
                resolved_domain_id = domain_old_id_mapping[node_data.domain_id]
            # Fallback to local_id resolution
            elif node_data.domain_id in domain_mapping:
                resolved_domain_id = domain_mapping[node_data.domain_id]

        db_node = models.Node(
            snapshot_id=db_snapshot.id,
            local_id=node_data.local_id,
            title=node_data.title,
            description=node_data.description,
            prerequisite=node_data.prerequisite,
            mentions=node_data.mentions,
            domain_id=resolved_domain_id,
            assessable=node_data.assessable,
            x=node_data.x,
            y=node_data.y
        )
        
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

def _populate_redirect_data(db: Session, db_snapshot: models.GraphSnapshot, snapshot_data: schemas.GraphSnapshotCreate):
    if snapshot_data.redirects:
        db_redirects = []
        for old_id, new_id in snapshot_data.redirects.items():
            # Only save if new_id exists in the current snapshot's nodes
            # Note: snapshot_data.nodes is a list of NodeCreate objects
            if any(n.local_id == new_id for n in snapshot_data.nodes):
                db_redirect = models.NodeRedirect(
                    snapshot_id=db_snapshot.id,
                    old_local_id=int(old_id),
                    new_local_id=new_id
                )
                db_redirects.append(db_redirect)
        db.add_all(db_redirects)
        db.commit()

def get_snapshots(db: Session, skip: int = 0, limit: int = 100):
    # Fetch snapshots
    snapshots = db.query(models.GraphSnapshot).order_by(models.GraphSnapshot.created_at.desc()).offset(skip).limit(limit).all()
    
    # Annotate with node count
    results = []
    for s in snapshots:
        count = db.query(func.count(models.Node.id)).filter(models.Node.snapshot_id == s.id).scalar()
        assessable_count = db.query(func.count(models.Node.id)).filter(models.Node.snapshot_id == s.id, models.Node.assessable == True).scalar()
        redirect_count = db.query(func.count(models.NodeRedirect.id)).filter(models.NodeRedirect.snapshot_id == s.id).scalar()
        
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
            "node_count": count,
            "assessable_node_count": assessable_count,
            "redirect_count": redirect_count,
            "is_public": s.is_public
        })
    return results

def get_public_snapshots(db: Session, skip: int = 0, limit: int = 100):
    # Fetch public snapshots
    snapshots = db.query(models.GraphSnapshot).filter(models.GraphSnapshot.is_public == True).order_by(models.GraphSnapshot.created_at.desc()).offset(skip).limit(limit).all()
    
    # Annotate with node count
    results = []
    for s in snapshots:
        count = db.query(func.count(models.Node.id)).filter(models.Node.snapshot_id == s.id).scalar()
        assessable_count = db.query(func.count(models.Node.id)).filter(models.Node.snapshot_id == s.id, models.Node.assessable == True).scalar()
        redirect_count = db.query(func.count(models.NodeRedirect.id)).filter(models.NodeRedirect.snapshot_id == s.id).scalar()
        
        created_at = s.created_at
        last_updated = s.last_updated if s.last_updated else s.created_at
        
        results.append({
            "id": s.id,
            "created_at": created_at,
            "last_updated": last_updated,
            "version_label": s.version_label,
            "base_graph": s.base_graph,
            "created_by": s.created_by,
            "node_count": count,
            "assessable_node_count": assessable_count,
            "redirect_count": redirect_count,
            "is_public": s.is_public
        })
    return results

def get_snapshot(db: Session, snapshot_id: int):
    snapshot = db.query(models.GraphSnapshot).filter(models.GraphSnapshot.id == snapshot_id).first()
    if snapshot:
        # Populate computed field
        count = db.query(func.count(models.Node.id)).filter(models.Node.snapshot_id == snapshot.id).scalar()
        snapshot.node_count = count
        
        assessable_count = db.query(func.count(models.Node.id)).filter(models.Node.snapshot_id == snapshot.id, models.Node.assessable == True).scalar()
        snapshot.assessable_node_count = assessable_count
        
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

def get_snapshot_by_label(db: Session, graphLabel: str):
    snapshot = db.query(models.GraphSnapshot).filter(models.GraphSnapshot.version_label == graphLabel).first()
    if snapshot:
        # Populate computed field
        count = db.query(func.count(models.Node.id)).filter(models.Node.snapshot_id == snapshot.id).scalar()
        snapshot.node_count = count
        
        assessable_count = db.query(func.count(models.Node.id)).filter(models.Node.snapshot_id == snapshot.id, models.Node.assessable == True).scalar()
        snapshot.assessable_node_count = assessable_count
        
        # Ensure last_updated is not null for serialization
        if snapshot.last_updated is None:
            snapshot.last_updated = snapshot.created_at
    return snapshot

def delete_snapshot_by_label(db: Session, graphLabel: str):
    snapshot = get_snapshot_by_label(db, graphLabel)
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

def update_user(db: Session, db_user: models.User, user_update: schemas.UserProfileUpdate):
    update_data = user_update.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_user, key, value)
    
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

# --- Assessment & Capability CRUD ---

def search_snapshots(db: Session, query: str, limit: int = 10):
    snapshots = db.query(models.GraphSnapshot).filter(
        models.GraphSnapshot.version_label.ilike(f"%{query}%")
    ).limit(limit).all()
    
    for s in snapshots:
        # Compute node counts for the summary
        count = db.query(func.count(models.Node.id)).filter(models.Node.snapshot_id == s.id).scalar()
        s.node_count = count
        
        assessable_count = db.query(func.count(models.Node.id)).filter(models.Node.snapshot_id == s.id, models.Node.assessable == True).scalar()
        s.assessable_node_count = assessable_count
        
        # Add redirect count for GraphSnapshotSummary
        redirect_count = db.query(func.count(models.NodeRedirect.id)).filter(models.NodeRedirect.snapshot_id == s.id).scalar()
        s.redirect_count = redirect_count
        
        if s.last_updated is None:
            s.last_updated = s.created_at
            
    return snapshots

def create_capability(db: Session, user_id: int, capability_data: schemas.CapabilityCreate):
    # Ensure assessed_nodes are serialized to JSON-compatible format
    assessed_nodes_data = []
    for node in capability_data.assessed_nodes:
        if hasattr(node, "model_dump"):
            assessed_nodes_data.append(node.model_dump())
        elif hasattr(node, "dict"):
            assessed_nodes_data.append(node.dict())
        else:
            assessed_nodes_data.append(node)

    db_capability = models.Capability(
        user_id=user_id,
        assessment_name=capability_data.assessment_name,
        assessment_type=capability_data.assessment_type,
        version=capability_data.version,
        graph_label=capability_data.graph_label,
        assessed_nodes=assessed_nodes_data
    )
    db.add(db_capability)
    db.commit()
    db.refresh(db_capability)
    return db_capability

def update_capability(db: Session, user_id: int, assessment_name: str, db_capability: models.Capability, capability_update: schemas.CapabilityUpdate):
    # Update existing database entry instead of creating a new one
    # 1. Fetch entry
    db_capability = db.query(models.Capability).filter(
        models.Capability.user_id == user_id,
        models.Capability.assessment_name == assessment_name,
        models.Capability.graph_label == capability_update.graph_label
    ).first()
    if not db_capability:
        return None

    # 2. Update fields from the schema and serialize assessed_nodes
    db_capability.assessed_nodes = [node.model_dump() if hasattr(node, "model_dump") else node for node in capability_update.assessed_nodes]

    # 3. Update the assessment_date to now
    db_capability.assessment_date = datetime.now(timezone.utc)
    
    # 4. Commit the transaction (DO NOT add a new row) DOESN'T WORK!!! IT IS CREATING A NEW ROW, WHY???
    db.commit()
    db.refresh(db_capability)
    return db_capability

def delete_capabilities(db: Session, user_id: int, assessment_name: str, graph_label: str):
    db.query(models.Capability).filter(
        models.Capability.user_id == user_id,
        models.Capability.assessment_name == assessment_name,
        models.Capability.graph_label == graph_label
    ).delete()
    db.commit()

def get_latest_capability(db: Session, user_id: int, assessment_name: str, graph_label: str):
    return db.query(models.Capability).filter(
        models.Capability.user_id == user_id,
        models.Capability.assessment_name == assessment_name,
        models.Capability.graph_label == graph_label
    ).order_by(models.Capability.assessment_date.desc()).first()
