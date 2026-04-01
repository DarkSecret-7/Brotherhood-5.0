"""
Snapshot service layer - Business logic for snapshot operations.
Orchestrates CRUD operations and handles business rules.
"""
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from uuid import UUID
from typing import List, Optional
from .. import crud, schemas, models, utils

class SnapshotService:
    
    @staticmethod
    def create_snapshot(db: Session, snapshot_data: schemas.GraphSnapshotCreate) -> schemas.GraphSnapshotRead:
        """Create a new snapshot with all business logic"""
        
        # Resolve creator and base graph references
        creator_id = None
        if snapshot_data.created_by:
            user = crud.users.get_user_by_uuid(db, snapshot_data.created_by.user_uuid)
            if user:
                creator_id = user.id

        # Create the snapshot record
        db_snapshot = crud.snapshots.create_snapshot_record(
            db=db,
            version_label=snapshot_data.version_label,
            is_public=snapshot_data.is_public if hasattr(snapshot_data, 'is_public') else False
        )

        # Use relationships for base snapshot
        if snapshot_data.base_uuid:
            base = crud.snapshots.get_snapshot_by_uuid(db, snapshot_data.base_uuid)
            if base:
                db_snapshot.base_uuid = base.public_uuid
                db_snapshot.base_snapshot = base

        # Create the graph authorship and check if user exists
        if creator_id and crud.users.get_user_by_uuid(db, snapshot_data.created_by.user_uuid):
            crud.snapshots.create_authorship_record(
                db=db,
                graph_id=db_snapshot.id,
                user_id=creator_id
            )

        # Populate nodes, domains, and redirects
        SnapshotService._populate_snapshot_data(db, db_snapshot.id, snapshot_data)
        
        db.commit()
        db.refresh(db_snapshot)
        
        # Ensure datetime fields are valid for Pydantic
        if db_snapshot.last_updated is None:
            db_snapshot.last_updated = db_snapshot.created_at

        return SnapshotService._convert_to_read_schema(db_snapshot)

    @staticmethod
    def update_snapshot(db: Session, snapshot_uuid: UUID, snapshot_data: schemas.GraphSnapshotUpdate) -> schemas.GraphSnapshotRead:
        """Update snapshot with delta processing - only updates changed items"""
        db_snapshot = crud.snapshots.get_snapshot_by_uuid(db, snapshot_uuid)
        if not db_snapshot:
            raise ValueError("Snapshot not found")
        
        db_snapshot.last_updated = datetime.now(timezone.utc)
        
        # Check if any nodes/domains have the updated/deleted flags
        has_delta_flags = any(
            getattr(n, 'updated', False) or getattr(n, 'deleted', False)
            for n in (snapshot_data.nodes or [])
        ) or any(
            getattr(d, 'updated', False) or getattr(d, 'deleted', False)
            for d in (snapshot_data.domains or [])
        )
        
        if not snapshot_data.metadata_only:
            if has_delta_flags:
                # Use delta processing - only update changed items
                SnapshotService._populate_snapshot_data_delta(db, db_snapshot.id, snapshot_data)
            else:
                # Fallback to full repopulate for backward compatibility
                # or when no delta flags are present (e.g., import, full overwrite)
                crud.snapshots.clear_snapshot_nodes(db, db_snapshot.id)
                crud.snapshots.clear_snapshot_domains(db, db_snapshot.id)
                crud.snapshots.clear_snapshot_redirects(db, db_snapshot.id)
                SnapshotService._populate_snapshot_data(db, db_snapshot.id, snapshot_data)
        
        # Update metadata if provided
        update_data = {}
        if snapshot_data.is_public is not None:
            update_data['is_public'] = snapshot_data.is_public
        if snapshot_data.version_label is not None:
            update_data['version_label'] = snapshot_data.version_label
        
        if update_data:
            crud.snapshots.update_snapshot_record(db, db_snapshot.id, **update_data)
        
        db.commit()
        db.refresh(db_snapshot)

        return SnapshotService._convert_to_read_schema(db_snapshot)

    @staticmethod
    def get_public_snapshot(db: Session, snapshot_uuid: UUID) -> schemas.GraphSnapshotRead:
        """Get public snapshot with business logic"""
        snapshot = crud.snapshots.get_snapshot_by_uuid(db, snapshot_uuid)
        if not snapshot:
            raise ValueError("Snapshot not found")
        if not snapshot.is_public:
            raise ValueError("Snapshot is not public")
        
        return SnapshotService._convert_to_read_schema(snapshot)

    @staticmethod
    def get_user_accessible_snapshots(db: Session, user_id: int, skip: int = 0, limit: int = 100) -> List[schemas.GraphSnapshotRead]:
        """Get snapshots user has access to with business logic"""
        snapshots = crud.snapshots.get_snapshots_paginated(db, skip=skip, limit=limit)
        # Filter to only show snapshots user has access to
        accessible_snapshots = []
        for snapshot in snapshots:
            if SnapshotService.check_snapshot_authorization(db, snapshot.public_uuid, user_id, "read"):
                accessible_snapshots.append(SnapshotService._convert_to_read_schema(snapshot))
        return accessible_snapshots

    @staticmethod
    def get_public_snapshots(db: Session, skip: int = 0, limit: int = 100) -> List[schemas.GraphSnapshotRead]:
        """Get public snapshots with business logic"""
        snapshots = crud.snapshots.get_public_snapshots(db, skip=skip, limit=limit)
        return [SnapshotService._convert_to_read_schema(snapshot) for snapshot in snapshots]

    @staticmethod
    def delete_snapshot(db: Session, snapshot_uuid: UUID) -> bool:
        """Delete snapshot with business logic"""
        return crud.snapshots.delete_snapshot_by_uuid(db, snapshot_uuid)

    @staticmethod
    def get_snapshot_with_action(db: Session, snapshot_uuid: UUID, user_id: int, action: str) -> schemas.GraphSnapshotRead:
        """Get snapshot with authorization based on action
        
        Actions:
        - "read": Read-only access
        - "fetch": Read for editing (registered users only)
        - "write": Update/overwrite access (authors only)
        - "delete": Delete access (authors only)
        """
        if not SnapshotService.check_snapshot_authorization(db, snapshot_uuid, user_id, action):
            raise ValueError(f"Not authorized to '{action}' this snapshot")
        
        snapshot = crud.snapshots.get_snapshot_by_uuid(db, snapshot_uuid)
        if not snapshot:
            raise ValueError("Snapshot not found")
        
        return SnapshotService._convert_to_read_schema(snapshot)

    @staticmethod
    def check_snapshot_authorization(db: Session, snapshot_uuid: UUID, user_id: int, action: str) -> bool:
        """Check if user is authorized to perform action on snapshot
        
        Actions:
        - "read": Read-only access (always allowed for public snapshots)
        - "fetch": Read for editing (only for registered users)
        - "write": Update/overwrite operations (authorship check)
        - "delete": Delete operations (authorship check)
        """
        # This is business logic - check if user is author or has access
        snapshot = crud.snapshots.get_snapshot_by_uuid(db, snapshot_uuid)
        if not snapshot:
            return False
            
        # If action is read, always allow
        if action == "read":
            return True
            
        # "fetch" action - read for editing (only for registered users)
        if action == "fetch":
            # Must be a registered user (user_id > 0)
            return user_id is not None and user_id > 0
            
        # "write" and "delete" actions - require authorship
        if action in ["write", "delete"]:
            # If there is no author (open-access), allow
            authors = crud.access_control.get_authorship_by_graph(db, snapshot.id)
            if not authors:
                return True
            authorship = crud.access_control.get_authorship_by_graph_and_user(db, snapshot.id, user_id)
            return authorship is not None
            
        # Unknown action
        return False

    @staticmethod
    def _populate_snapshot_data(db: Session, snapshot_id: int, snapshot_data):
        """Populate snapshot with nodes, domains, and redirects - business logic"""
        # --- Domains ---
        domain_objs = []
        domain_local_id_to_obj = {}

        for d_data in snapshot_data.domains or []:
            # Create domain objects without adding to session yet
            db_domain = models.Domain(
                snapshot_id=snapshot_id,
                local_id=d_data.local_id,
                title=d_data.title,
                description=d_data.description,
            )
            domain_objs.append(db_domain)
            domain_local_id_to_obj[d_data.local_id] = db_domain
            if hasattr(d_data, 'id') and d_data.id is not None:
                # Store old ID mapping for parent relationships
                domain_local_id_to_obj[f"old_{d_data.id}"] = db_domain

        # Bulk create domains first to get IDs
        crud.snapshots.bulk_create_domains(db, domain_objs)

        # Handle parent relationships after all domains are created and have IDs
        for i, d_data in enumerate(snapshot_data.domains or []):
            if d_data.parent_id is not None:
                # Find parent domain by local_id
                parent_domain = domain_local_id_to_obj.get(d_data.parent_id)
                if parent_domain:
                    # Use SQLAlchemy relationship assignment
                    domain_objs[i].parent = parent_domain

        # --- Nodes ---
        db_nodes = []
        
        for node_data in snapshot_data.nodes:
            # Get actual database domain_id from the mapping (domains already created with IDs)
            domain_db_id = None
            if node_data.domain_id is not None:
                domain_obj = domain_local_id_to_obj.get(node_data.domain_id)
                if domain_obj:
                    domain_db_id = domain_obj.id
            
            # Create node objects without adding to session yet
            db_node = models.Node(
                snapshot_id=snapshot_id,
                local_id=node_data.local_id,
                title=node_data.title,
                description=node_data.description,
                prerequisite=node_data.prerequisite,
                mentions=node_data.mentions,
                assessable=node_data.assessable,
                domain_id=domain_db_id,
                x=node_data.x,
                y=node_data.y
            )
            db_nodes.append(db_node)

        crud.snapshots.bulk_create_nodes(db, db_nodes)

        # --- Redirects (part of snapshot data) ---
        if snapshot_data.redirects:
            db_redirects = []
            for redirect in snapshot_data.redirects:
                # Create redirect objects without adding to session yet
                db_redirect = models.NodeRedirect(
                    snapshot_id=snapshot_id,
                    source_node_uuid=redirect.source_node_uuid,
                    target_node_uuid=redirect.target_node_uuid
                )
                db_redirects.append(db_redirect)
            
            crud.snapshots.bulk_create_redirects(db, db_redirects)

    @staticmethod
    def _populate_snapshot_data_delta(db: Session, snapshot_id: int, snapshot_data):
        """Populate snapshot with delta updates - only process changed items"""
        
        # --- Domains Delta Processing ---
        domain_local_id_to_obj = {}
        
        for d_data in snapshot_data.domains or []:
            local_id = d_data.local_id
            
            if getattr(d_data, 'deleted', False):
                # Delete domain and cascade to nodes
                crud.snapshots.delete_domain_by_local_id(db, snapshot_id, local_id)
                continue
            
            if getattr(d_data, 'updated', False):
                # Check if domain exists
                existing_domain = crud.snapshots.get_domain_by_local_id(db, snapshot_id, local_id)
                
                if existing_domain:
                    # Update existing domain
                    crud.snapshots.update_domain_record(
                        db, existing_domain,
                        title=d_data.title,
                        description=d_data.description
                        # parent_id handled separately below
                    )
                    domain_local_id_to_obj[local_id] = existing_domain
                else:
                    # Create new domain
                    db_domain = models.Domain(
                        snapshot_id=snapshot_id,
                        local_id=local_id,
                        title=d_data.title,
                        description=d_data.description
                    )
                    crud.snapshots.create_domain_record(db, db_domain)
                    domain_local_id_to_obj[local_id] = db_domain
            else:
                # Unchanged - just load for reference
                existing_domain = crud.snapshots.get_domain_by_local_id(db, snapshot_id, local_id)
                if existing_domain:
                    domain_local_id_to_obj[local_id] = existing_domain
        
        # Handle parent relationships for all domains (updated or not)
        for d_data in snapshot_data.domains or []:
            if not getattr(d_data, 'deleted', False) and d_data.parent_id is not None:
                parent_domain = domain_local_id_to_obj.get(d_data.parent_id)
                current_domain = domain_local_id_to_obj.get(d_data.local_id)
                if parent_domain and current_domain:
                    current_domain.parent = parent_domain
        
        # --- Nodes Delta Processing ---
        for node_data in snapshot_data.nodes:
            local_id = node_data.local_id
            
            if getattr(node_data, 'deleted', False):
                # Delete node - source fragments cascade delete via SQLAlchemy
                crud.snapshots.delete_node_by_local_id(db, snapshot_id, local_id)
                continue
            
            # Get domain database ID from local_id
            domain_db_id = None
            if node_data.domain_id is not None:
                domain_obj = domain_local_id_to_obj.get(node_data.domain_id)
                if domain_obj:
                    domain_db_id = domain_obj.id
            
            if getattr(node_data, 'updated', False):
                existing_node = crud.snapshots.get_node_by_local_id(db, snapshot_id, local_id)
                
                if existing_node:
                    # Process individual source updates (only if node is updated)
                    SnapshotService._process_source_updates(db, existing_node, node_data.source_items or [])
                    
                    # Update node fields
                    crud.snapshots.update_node_record(
                        db, existing_node,
                        title=node_data.title,
                        description=node_data.description,
                        prerequisite=node_data.prerequisite,
                        mentions=node_data.mentions,
                        assessable=node_data.assessable,
                        domain_id=domain_db_id,
                        x=node_data.x,
                        y=node_data.y
                    )
                else:
                    # Create new node
                    db_node = models.Node(
                        snapshot_id=snapshot_id,
                        local_id=local_id,
                        title=node_data.title,
                        description=node_data.description,
                        prerequisite=node_data.prerequisite,
                        mentions=node_data.mentions,
                        assessable=node_data.assessable,
                        domain_id=domain_db_id,
                        x=node_data.x,
                        y=node_data.y
                    )
                    crud.snapshots.create_node_record(db, db_node)
                    db.flush()  # Need to flush to get the node.id for source fragments
                    
                    # Create source fragments for new node
                    SnapshotService._create_source_fragments(db, db_node, node_data.source_items or [])
            # Note: Sources are only processed when node is marked as updated.
            # Frontend must mark node as dirty when modifying sources.

    @staticmethod
    def _process_source_updates(db: Session, db_node: models.Node, source_items: list):
        """Process individual source updates - only update changed sources using UUIDs"""
        from ..crud import bibliography as bib_crud
        from ..utils import generate_hash
        
        # Build mapping of UUID -> source fragment for this node
        existing_by_uuid = {}
        for sf in db_node.source_frags:
            if sf.public_uuid:
                existing_by_uuid[str(sf.public_uuid)] = sf
        
        # Track which sources to keep (not deleted)
        sources_to_keep = set()
        
        for src in source_items:
            source_uuid = getattr(src, 'source_uuid', None)
            
            # Handle explicit deletion
            if getattr(src, 'deleted', False):
                if source_uuid and str(source_uuid) in existing_by_uuid:
                    existing_frag = existing_by_uuid[str(source_uuid)]
                    crud.snapshots.delete_source_fragment(db, existing_frag.id)
                continue
            
            # Skip sources not marked as updated (no changes)
            if not getattr(src, 'updated', False):
                continue
            
            existing_frag = None
            
            # Try to find by UUID if provided
            if source_uuid:
                existing_frag = existing_by_uuid.get(str(source_uuid))
            
            # Find or create bibliography
            bib = bib_crud.get_bibliography_by_hash(db, getattr(src, 'public_hash', None))
            if not bib:
                bib = bib_crud.create_bibliography_record(
                    db,
                    title=src.title,
                    author=getattr(src, 'author', None),
                    year=getattr(src, 'year', None),
                    bib_type=getattr(src, 'bib_type', 'PDF'),
                    url=getattr(src, 'url', None),
                    public_hash=getattr(src, 'public_hash', None) or generate_hash()
                )
            
            if existing_frag:
                # Update existing source fragment
                crud.snapshots.update_source_fragment(
                    db,
                    existing_frag,
                    bib_id=bib.id,
                    fragment_start=getattr(src, 'fragment_start', None),
                    fragment_end=getattr(src, 'fragment_end', None)
                )
                sources_to_keep.add(existing_frag.id)
            else:
                # Create new source fragment (UUID auto-generated by DB)
                new_frag = crud.snapshots.create_source_fragment(
                    db,
                    node_id=db_node.id,
                    bib_id=bib.id,
                    fragment_start=getattr(src, 'fragment_start', None),
                    fragment_end=getattr(src, 'fragment_end', None)
                )
                db.flush()
                sources_to_keep.add(new_frag.id)

    @staticmethod
    def _create_source_fragments(db: Session, db_node: models.Node, source_items: list):
        """Create source fragments for a node"""
        from ..crud import bibliography as bib_crud
        from ..utils import generate_hash
        
        for src in source_items:
            # Find or create bibliography
            bib = bib_crud.get_bibliography_by_hash(db, getattr(src, 'public_hash', None))
            if not bib:
                bib = bib_crud.create_bibliography_record(
                    db,
                    title=src.title,
                    author=getattr(src, 'author', None),
                    year=getattr(src, 'year', None),
                    bib_type=getattr(src, 'bib_type', 'PDF'),
                    url=getattr(src, 'url', None),
                    public_hash=getattr(src, 'public_hash', None) or generate_hash()
                )
            
            # Create source fragment
            bib_crud.create_source_fragment_record(
                db,
                node_id=db_node.id,
                bib_id=bib.id,
                fragment_start=getattr(src, 'fragment_start', None),
                fragment_end=getattr(src, 'fragment_end', None)
            )

    @staticmethod
    def _convert_to_read_schema(db_snapshot) -> schemas.GraphSnapshotRead:
        """Convert database model to read schema - business logic"""
        # Build mapping of domain db_id -> local_id for node domain_id conversion
        domain_db_id_to_local = {}
        for domain in db_snapshot.domains:
            domain_db_id_to_local[domain.id] = domain.local_id
        
        # Convert nodes to read schemas
        nodes = []
        for node in db_snapshot.nodes:
            # Convert database domain_id to local_id for frontend
            domain_local_id = None
            if node.domain_id is not None:
                domain_local_id = domain_db_id_to_local.get(node.domain_id)
            
            # Convert source fragments to SourceRead with source_uuid
            source_items = []
            for sf in node.source_frags:
                source_items.append(schemas.SourceRead(
                    snapshot_uuid=db_snapshot.public_uuid,
                    node_id=node.local_id,
                    fragment_start=sf.fragment_start,
                    fragment_end=sf.fragment_end,
                    source_uuid=sf.public_uuid,
                    bib_hash=sf.bibliography.public_hash,
                    title=sf.bibliography.title,
                    author=sf.bibliography.author,
                    year=sf.bibliography.year,
                    bib_type=sf.bibliography.bib_type,
                    url=sf.bibliography.url,
                ))
            
            nodes.append(schemas.NodeRead(
                local_id=node.local_id,
                title=node.title,
                description=node.description,
                prerequisite=node.prerequisite,
                mentions=node.mentions,
                domain_id=domain_local_id,
                x=node.x,
                y=node.y,
                assessable=node.assessable,
                source_items=source_items
            ))
        
        # Convert domains to read schemas
        domains = []
        for domain in db_snapshot.domains:
            domains.append(schemas.DomainRead(
                local_id=domain.local_id,
                title=domain.title,
                description=domain.description,
                parent_id=domain.parent_id
            ))
        
        # Convert redirects to read schemas
        redirects = []
        for redirect in db_snapshot.redirects:
            redirects.append(schemas.NodeRedirectRead(
                snapshot_uuid=db_snapshot.public_uuid,
                old_local_id=redirect.old_local_id,
                new_local_id=redirect.new_local_id
            ))
        
        return schemas.GraphSnapshotRead(
            public_uuid=db_snapshot.public_uuid,
            base_uuid=db_snapshot.base_uuid,
            version_label=db_snapshot.version_label,
            is_public=db_snapshot.is_public,
            created_at=db_snapshot.created_at,
            last_updated=db_snapshot.last_updated,
            authors=[schemas.UserRead(user_uuid=author.public_uuid, username=author.username) for author in db_snapshot.authors_ref],
            nodes=nodes,
            domains=domains,
            redirects=redirects,
            node_count=len(nodes),
            assessable_node_count=len([n for n in nodes if n.assessable])
        )
