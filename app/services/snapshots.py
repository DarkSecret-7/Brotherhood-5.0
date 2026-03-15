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
        """Update snapshot with business logic - supports metadata-only updates"""
        db_snapshot = crud.snapshots.get_snapshot_by_uuid(db, snapshot_uuid)
        if not db_snapshot:
            raise ValueError("Snapshot not found")
            
        # Explicitly update last_updated
        db_snapshot.last_updated = datetime.now(timezone.utc)
        
        # Do not repopulate unless metadata_only is False
        if not snapshot_data.metadata_only:
            # Full update behavior - clear and repopulate nodes/domains
            crud.snapshots.clear_snapshot_nodes(db, db_snapshot.id)
            crud.snapshots.clear_snapshot_domains(db, db_snapshot.id)
            crud.snapshots.clear_snapshot_redirects(db, db_snapshot.id)
            
            # Re-populate with new data
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
            # Create node objects without adding to session yet
            db_node = models.Node(
                snapshot_id=snapshot_id,
                local_id=node_data.local_id,
                title=node_data.title,
                description=node_data.description,
                prerequisite=node_data.prerequisite,
                mentions=node_data.mentions,
                assessable=node_data.assessable,
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
    def _convert_to_read_schema(db_snapshot) -> schemas.GraphSnapshotRead:
        """Convert database model to read schema - business logic"""
        # Convert nodes to read schemas
        nodes = []
        for node in db_snapshot.nodes:
            nodes.append(schemas.NodeRead(
                local_id=node.local_id,
                title=node.title,
                description=node.description,
                prerequisite=node.prerequisite,
                mentions=node.mentions,
                x=node.x,
                y=node.y,
                assessable=node.assessable
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
