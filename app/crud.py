# THIS FILE IS DEPRECATED   ------------------------

from datetime import datetime, timezone
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from uuid import UUID
from . import models, schemas, utils

# The frontend sends dict files, which we convert to JSONB on the backend

# --- Snapshot CRUD ---

def create_snapshot(db: Session, snapshot_data: schemas.GraphSnapshotCreate):
    # Resolve creator and base graph references
    creator_id = None
    if snapshot_data.created_by:
        user = db.query(models.User).filter(models.User.public_uuid == snapshot_data.created_by.user_uuid).first()
        if user:
            creator_id = user.id
            
    base_uuid = None
    base_snapshot_id = None
    if snapshot_data.base_uuid:
        base = db.query(models.GraphSnapshot).filter(models.GraphSnapshot.public_uuid == snapshot_data.base_uuid).first()
        if base:
            base_uuid = base.public_uuid
            base_snapshot_id = base.id

    # Create the snapshot container - a read schema
    db_snapshot = schemas.GraphSnapshotRead(
        base_uuid=base_uuid,
        base_snapshot_id=base_snapshot_id,
        version_label=snapshot_data.version_label
    )

    db.add(db_snapshot)
    db.flush()              # Flush to get the snapshot ID before authorship

    # Create the graph authorship
    if creator_id:
        db_authorship = models.GraphAuthorship(
            graph_id=db_snapshot.id,
            user_id=creator_id
        )
        db.add(db_authorship)
        db.flush()

    # Populate nodes, domains, and redirects before commit
    _populate_snapshot_data(db, db_snapshot, snapshot_data)
    _populate_redirect_data(db, db_snapshot, snapshot_data)
    
    db.commit()
    db.refresh(db_snapshot)
    
    # Ensure datetime fields are valid for Pydantic
    if db_snapshot.last_updated is None:
        db_snapshot.last_updated = db_snapshot.created_at

    return db_snapshot

def update_snapshot(db: Session, snapshot_uuid: UUID, snapshot_data: schemas.GraphSnapshotUpdate):
    db_snapshot = get_snapshot(db, snapshot_uuid)
            
    # ONLY OVERWRITE - extra logic is handled by frontend
    
    # base graph does NOT change
        
    # CRITICAL: authors do NOT change
    
    # Explicitly update last_updated in case metadata didn't change but nodes/domains did
    db_snapshot.last_updated = func.now()
    
    # Clear existing nodes and domains
    # Using delete(synchronize_session=False) for better performance and to avoid session issues
    # Source Fragments are deleted automatically in cascade

    db.query(models.Node).filter(models.Node.snapshot_id == db_snapshot.id).delete(synchronize_session=False)
    db.query(models.Domain).filter(models.Domain.snapshot_id == db_snapshot.id).delete(synchronize_session=False)
    db.flush()
    
    # Re-populate
    _populate_snapshot_data(db, db_snapshot, snapshot_data)
    _populate_redirect_data(db, db_snapshot, snapshot_data)
    
    db.commit()
    db.refresh(db_snapshot)

    # Metadata (is_public, version_label)
    if snapshot_data.is_public is not None:
        db_snapshot.is_public = snapshot_data.is_public
    if snapshot_data.version_label is not None:
        db_snapshot.version_label = snapshot_data.version_label
    
    return read_snapshot(db, db_snapshot.uuid)

def read_snapshot(db: Session, snapshot_uuid: UUID):
    # Return a GraphSnapshotRead object
    db_snapshot = db.query(models.GraphSnapshot).filter(models.GraphSnapshot.public_uuid == snapshot_uuid).first()
    if not db_snapshot:
        return None
    
    return schemas.GraphSnapshotRead(
        public_uuid=db_snapshot.public_uuid,
        base_uuid=db_snapshot.base_uuid,
        version_label=db_snapshot.version_label,
        is_public=db_snapshot.is_public,
        created_at=db_snapshot.created_at,
        last_updated=db_snapshot.last_updated
    )

def _populate_snapshot_data(db: Session, db_snapshot: models.GraphSnapshot, snapshot_data: schemas.GraphSnapshotCreate):
    # --- Domains ---
    domain_objs = {}
    domain_old_id_mapping = {}

    for d_data in snapshot_data.domains or []:
        db_domain = models.Domain(
            snapshot_id=db_snapshot.id,
            local_id=d_data.local_id,
            title=d_data.title,
            description=d_data.description,
        )
        domain_objs[d_data.local_id] = db_domain
        if hasattr(d_data, 'id') and d_data.id is not None:
            domain_old_id_mapping[d_data.id] = db_domain

        # parent nodes using relationship
        if d_data.parent_id is not None:
            parent_domain = domain_old_id_mapping.get(d_data.parent_id) or domain_objs.get(d_data.parent_id)
            if parent_domain:
                db_domain.parent = parent_domain

    db.add_all(domain_objs.values())
    db.flush()  # assign IDs

    # --- Nodes ---
    db_nodes = []
    
    for node_data in snapshot_data.nodes:
        db_node = models.Node(
            snapshot_id=db_snapshot.id,
            local_id=node_data.local_id,
            title=node_data.title,
            description=node_data.description,
            prerequisite=node_data.prerequisite,
            mentions=node_data.mentions,
            assessable=node_data.assessable,
            x=node_data.x,
            y=node_data.y
        )

        if node_data.domain_id is not None:
            db_node.domain = domain_objs.get(node_data.domain_id)  # assign relationship

        # --- Handle Bibliographies and SourceFragments ---
        for src in getattr(node_data, 'source_items', []):
            # 1. Find or create bibliography
            bib_data = schemas.BibliographyCreate(
                    title=src.title,
                    author=src.author,
                    year=src.year,
                    bib_type=src.bib_type,
                    url=src.url
                )
            if not src.source_hash or src.public_hash is None:
                db_bib = create_bibliography(db, bib_data)
            else:    
                db_bib = get_bibliography(db, src.public_hash)
                if not db_bib:          # if hash returned None, create new
                    db_bib = create_bibliography(db, bib_data)

            # 2. Create SourceFragment linked to node and bibliography
            db_frag = models.SourceFragment(
                fragment_start=src.fragment_start,
                fragment_end=src.fragment_end
            )
            db_node.source_frags.append(db_frag)
            db_frag.bibliography = db_bib

            db.add(db_bib)
            db.flush()  # no assignment needed, relationship handles it

        db_nodes.append(db_node)

    db.add_all(db_nodes)
    db.flush()  # assign IDs

def _populate_redirect_data(db: Session, db_snapshot: models.GraphSnapshot, snapshot_data: schemas.GraphSnapshotCreate):
    if snapshot_data.redirects:
        db_redirects = []
        for redirect in snapshot_data.redirects:
            # Redirect Validation is handled in endpoints
            db_redirect = models.NodeRedirect(
                snapshot_id=db_snapshot.id,
                old_local_id=redirect.old_local_id,
                new_local_id=redirect.new_local_id
            )
            db_redirect.snapshot = db_snapshot

            db_redirects.append(db_redirect)
        db.add_all(db_redirects)
        db.commit()

def get_snapshot(db: Session, snapshot_uuid: UUID):
    snapshot = db.query(models.GraphSnapshot).options(
        # Eager load relationships
        joinedload(models.GraphSnapshot.nodes),
        joinedload(models.GraphSnapshot.domains),
        joinedload(models.GraphSnapshot.redirects)
    ).filter(models.GraphSnapshot.public_uuid == snapshot_uuid).first()
    if snapshot:
        # Populate computed field
        count = db.query(func.count(models.Node.id)).filter(models.Node.snapshot_id == snapshot.id).scalar()
        snapshot.node_count = count
        
        assessable_count = db.query(func.count(models.Node.id)).filter(models.Node.snapshot_id == snapshot.id, models.Node.assessable == True).scalar()
        snapshot.assessable_node_count = assessable_count
        
    return snapshot

def delete_snapshot(db: Session, snapshot_uuid: UUID):
    snapshot = get_snapshot(db, snapshot_uuid)
    if snapshot:
        db.delete(snapshot)
        db.commit()
        return True
    return False

def get_snapshot_by_label(db: Session, graphLabel: str):    # deprecated, ALWAYS use UUIDs
    snapshot = db.query(models.GraphSnapshot).options(
        # Eager load relationships
        joinedload(models.GraphSnapshot.nodes),
        joinedload(models.GraphSnapshot.domains),
        joinedload(models.GraphSnapshot.redirects)
    ).filter(models.GraphSnapshot.version_label == graphLabel).first()
    if snapshot:
        # Populate computed field
        count = db.query(func.count(models.Node.id)).filter(models.Node.snapshot_id == snapshot.id).scalar()
        snapshot.node_count = count
        
        assessable_count = db.query(func.count(models.Node.id)).filter(models.Node.snapshot_id == snapshot.id, models.Node.assessable == True).scalar()
        snapshot.assessable_node_count = assessable_count
        
    return snapshot

def delete_snapshot_by_label(db: Session, graphLabel: str): # deprecated, ALWAYS use UUIDs
    snapshot = get_snapshot_by_label(db, graphLabel)
    if snapshot:
        db.delete(snapshot)
        db.commit()
        return True
    return False

def get_snapshots(db: Session, skip: int = 0, limit: int = 100):
    """Get all snapshots with pagination"""
    return db.query(models.GraphSnapshot).offset(skip).limit(limit).all()

def get_public_snapshots(db: Session, skip: int = 0, limit: int = 100):
    """Get only public snapshots with pagination"""
    return db.query(models.GraphSnapshot).filter(models.GraphSnapshot.is_public == True).offset(skip).limit(limit).all()

# --- User CRUD ---

def get_user(db: Session, user_uuid: UUID):
    return db.query(models.User).filter(models.User.public_uuid == user_uuid).first()

def get_user_by_id(db: Session, user_id: int):
    return db.query(models.User).filter(models.User.id == user_id).first()

def get_user_by_username(db: Session, username: str):       # deprecated, ALWAYS use UUIDs
    return db.query(models.User).filter(models.User.username == username).first()

def create_user(db: Session, user: schemas.UserCreate):
    # frontend sends plain password, backend hashes it
    hashed_password = utils.get_password_hash(user.password)
    db_user = models.User(username=user.username, hashed_password=hashed_password)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

def update_user(db: Session, db_user: models.User, user_update: schemas.UserProfileUpdate):
    update_data = user_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        # NEVER change UUID
        if key == "user_uuid":
            continue
        
        # Only update if value has changed
        if value != getattr(db_user, key):
            setattr(db_user, key, value)
    
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

def delete_user(db:Session, user_uuid:UUID):
    user = db.query(models.User).filter(models.User.public_uuid == user_uuid).first()
    if (user):
        db.delete(user)
        db.commit()
        return True
    return False

def delete_user_by_username(db: Session, username: str):     # deprecated, ALWAYS use UUIDs
    user = db.query(models.User).filter(models.User.username == username).first()
    if user:
        db.delete(user)
        db.commit()
        return True
    return False

# --- Invitation CRUD ---           # temporary Admin-only features

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

def delete_invitation(db: Session, code: str):
    invitation = db.query(models.Invitation).filter(models.Invitation.code == code).first()
    if invitation:
        db.delete(invitation)
        db.commit()
        return True
    return False

# --- Bibliography CRUD ---

def get_bibliography(db: Session, public_hash: str):
    return db.query(models.Bibliography).filter(models.Bibliography.public_hash == public_hash).first()

def create_bibliography(db: Session, bibliography_data: schemas.BibliographyCreate):
    # Generate public hash
    string_data = bibliography_data.title + bibliography_data.author + str(bibliography_data.year) + bibliography_data.bib_type + bibliography_data.url
    public_hash = utils.generate_hash(string_data)

    db_bibliography = models.Bibliography(
        public_hash=public_hash,
        title=bibliography_data.title,
        author=bibliography_data.author,
        year=bibliography_data.year,
        bib_type=bibliography_data.bib_type,
        url=bibliography_data.url
    )

    db.add(db_bibliography)
    db.commit()
    db.refresh(db_bibliography)
    return db_bibliography

def delete_bibliography(db: Session, public_hash: str):
    bibliography = db.query(models.Bibliography).filter(models.Bibliography.public_hash == public_hash).first()
    if bibliography:
        db.delete(bibliography)
        db.commit()
        return True
    return False

# --- Assessment & Capability CRUD ---

def get_capability(db: Session, public_hash: str):
    return db.query(models.Capability).filter(models.Capability.public_hash == public_hash).first()

def create_capability(db: Session, capability_data: schemas.CapabilityCreate):
    # Convert Assessment objects to dictionaries and UUIDs to strings for JSON serialization
    assessed_nodes_data = []
    for assessment in capability_data.assessed_nodes:
        assessment_dict = assessment.model_dump() if hasattr(assessment, 'model_dump') else assessment.dict()
        # Convert UUIDs to strings for JSON serialization
        if 'snapshot_uuid' in assessment_dict:
            assessment_dict['snapshot_uuid'] = str(assessment_dict['snapshot_uuid'])
        assessed_nodes_data.append(assessment_dict)

    # generate public hash - use the raw data for hashing, not the Json wrapper
    string_data = str(capability_data.user_uuid) + str(capability_data.snapshot_uuid) + capability_data.assessment_name + capability_data.assessment_type + capability_data.assessment_version + str(assessed_nodes_data)
    public_hash = utils.generate_hash(string_data)

    db_capability = models.Capability(
        public_hash=public_hash,
        user_uuid=capability_data.user_uuid,
        graph_uuid=capability_data.snapshot_uuid,
        assessment_name=capability_data.assessment_name,
        assessment_type=capability_data.assessment_type,
        assessment_version=capability_data.assessment_version,
        assessed_nodes=assessed_nodes_data
    )
    
    # Set relationships - SQLAlchemy will handle the ID fields
    graph_snapshot = get_snapshot(db, capability_data.snapshot_uuid)
    user = get_user(db, capability_data.user_uuid)
    if graph_snapshot:
        db_capability.graph = graph_snapshot
    if user:
        db_capability.user = user

    db.add(db_capability)
    db.commit()
    db.refresh(db_capability)
    return db_capability

def delete_capability(db: Session, capability_data: schemas.CapabilityRead):
    db_capability = get_capability(db, capability_data.public_hash)
    if db_capability:
        db.delete(db_capability)
        db.commit()
        return True
    return False

# --- Proposal CRUD ---

def get_proposal(db: Session, public_hash: str):
    return db.query(models.GraphProposal).filter(models.GraphProposal.public_hash == public_hash).first()

def create_proposal(db: Session, proposal_data: schemas.ProposalCreate):
    # Generate public hash
    string_data = proposal_data.proposal_type + str(proposal_data.graph_uuid) + str(proposal_data.proposer_uuid) + str(proposal_data.target_user_uuid) + str(proposal_data.target_graph_uuid)
    public_hash = utils.generate_hash(string_data)

    db_proposal = models.GraphProposal(
        public_hash=public_hash,
        proposal_type=proposal_data.proposal_type,
        proposer_uuid=proposal_data.proposer_uuid,
        target_user_uuid=proposal_data.target_user_uuid,
        graph_uuid=proposal_data.graph_uuid,
        target_graph_uuid=proposal_data.target_graph_uuid
    )
    
    # Set relationships
    proposer = get_user(db, proposal_data.proposer_uuid)
    target_user = get_user(db, proposal_data.target_user_uuid)
    graph = get_snapshot(db, proposal_data.graph_uuid)
    
    if proposer:
        db_proposal.proposer = proposer
    if target_user and target_user != proposer:
        db_proposal.target_user = target_user
    if graph:
        db_proposal.graph = graph
    if proposal_data.target_graph_uuid and proposal_data.target_graph_uuid != proposal_data.graph_uuid:
        target_graph = get_snapshot(db, proposal_data.target_graph_uuid)
        if target_graph:
            db_proposal.target_graph = target_graph
    
    db.add(db_proposal)
    db.commit()
    db.refresh(db_proposal)
    return db_proposal

def delete_proposal(db: Session, public_hash: str):
    """Delete a proposal by public hash"""
    proposal = get_proposal_by_hash(db, public_hash)
    if proposal:
        db.delete(proposal)
        db.commit()
        return True
    return False

def update_proposal_status(db: Session, proposal_hash: str, status: str):
    """Update proposal status"""
    proposal = get_proposal(db, proposal_hash)
    if proposal:
        proposal.proposal_status = status
        db.commit()
        db.refresh(proposal)
        return proposal
    return None

def get_user_proposals(db: Session, user_uuid: UUID, skip: int = 0, limit: int = 100, proposal_type: str=None):
    """Get all proposals for a user (both sent and received), optionally filtered by proposal type"""
    user = get_user(db, user_uuid)
    if not user:
        return []
    
    # Get proposals where user is either proposer or target
    query = db.query(models.GraphProposal).filter(
        ((models.GraphProposal.proposer_id == user.id) |
        (models.GraphProposal.target_user_id == user.id))
    )
    
    # Add proposal_type filter if provided
    if proposal_type is not None:
        query = query.filter(models.GraphProposal.proposal_type == proposal_type)
    
    proposals = query.offset(skip).limit(limit).all()
    
    return proposals

def get_graph_proposals(db: Session, graph_uuid: UUID, proposal_type: str=None):
    """Get all proposals for a graph, optionally filtered by proposal type"""
    query = db.query(models.GraphProposal).filter(models.GraphProposal.graph_uuid == graph_uuid)
    
    # Add proposal_type filter if provided
    if proposal_type is not None:
        query = query.filter(models.GraphProposal.proposal_type == proposal_type)
    
    return query.all()

# --- Proposal Consents ---

def create_proposal_consent(db: Session, consent_data: schemas.ProposalConsentCreate):
    """Create a proposal consent record"""
    proposal = get_proposal(db, consent_data.proposal_hash)
    user = get_user(db, consent_data.user_uuid)
    
    if not proposal or not user:
        raise ValueError("Invalid proposal hash or user UUID")
    
    # Check if consent already exists
    existing = db.query(models.ProposalConsent).filter(
        models.ProposalConsent.proposal_id == proposal.id,
        models.ProposalConsent.user_id == user.id
    ).first()
    
    if existing:
        return existing
    
    db_consent = models.ProposalConsent(
        proposal_id=proposal.id,
        proposal_hash=consent_data.proposal_hash,
        user_id=user.id,
        user_uuid=consent_data.user_uuid,
        user_vote=consent_data.user_vote
    )
    
    db.add(db_consent)
    db.commit()
    db.refresh(db_consent)
    return db_consent

# --- Authorship CRUD ---

def get_snapshot_authors(db: Session, snapshot_uuid: UUID):
    """Get database rows for snapshot authors"""
    snapshot = get_snapshot(db, snapshot_uuid)
    if not snapshot:
        return []
    
    return db.query(models.GraphAuthorship).filter(models.GraphAuthorship.graph_id == snapshot.id).all()

def check_snapshot_authorization(db: Session, snapshot_uuid: UUID, current_user_id: int, action: str = "read"):
    """Check if user has authorization to perform action on snapshot"""
    snapshot = get_snapshot(db, snapshot_uuid)
    if not snapshot:
        return False
    
    # eg of action = "read" (for reading, does NOT require being user), "fetch" (for curating, requires being user), "update" (for overwriting, authors only), "delete" (for deleting, authors only)
    # If action is read, allow anyone
    if action == "read":
        return True
    
    # Check if user is an author (using database rows)
    authors = get_snapshot_authors(db, snapshot_uuid)
    
    # If there are no authors, it's open access - anyone can read/write
    if not authors:
        return True
    
    author_ids = {author.user_id for author in authors}
    
    if current_user_id in author_ids:
        return True
    
    # Additional authorization logic can be added here
    return False

def create_graph_authorship(db: Session, authorship_data: schemas.GraphAuthorshipCreate):
    """Create a new graph authorship"""
    # Get snapshot and user
    snapshot = get_snapshot(db, authorship_data.graph_uuid)
    user = get_user(db, authorship_data.user_uuid)
    
    if not snapshot or not user:
        raise ValueError("Invalid snapshot or user UUID")
    
    # Check if authorship already exists
    existing = db.query(models.GraphAuthorship).filter(
        models.GraphAuthorship.graph_id == snapshot.id,
        models.GraphAuthorship.user_id == user.id
    ).first()
    
    if existing:
        return existing
    
    db_authorship = models.GraphAuthorship(
        graph_id=snapshot.id,
        user_id=user.id,
        role=authorship_data.role or "Curator"
    )
    
    db.add(db_authorship)
    db.commit()
    db.refresh(db_authorship)
    return db_authorship

def delete_graph_authorship(db: Session, graph_uuid: UUID, user_uuid: UUID):
    """Delete a graph authorship"""
    snapshot = get_snapshot(db, graph_uuid)
    user = get_user(db, user_uuid)
    
    if not snapshot or not user:
        return False
    
    authorship = db.query(models.GraphAuthorship).filter(
        models.GraphAuthorship.graph_id == snapshot.id,
        models.GraphAuthorship.user_id == user.id
    ).first()
    
    if authorship:
        db.delete(authorship)
        db.commit()
        return True
    return False