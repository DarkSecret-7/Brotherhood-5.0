# This file is part of The Brotherhood Project
#
# Copyright (C) 2026  The Brotherhood Project Developers
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program.  If not, see <https://www.gnu.org/licenses/>.

"""
Snapshot service layer - Business logic for snapshot operations.
Orchestrates CRUD operations and handles business rules.
"""
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from uuid import UUID
from typing import List, Union
from .. import crud, schemas, models

class SnapshotService:

    @staticmethod
    def _extract_metadata(db: Session, snapshot_uuid: UUID) -> schemas.GraphSnapshotMeta:
        snapshot = crud.snapshots.get_snapshot_by_uuid(db, snapshot_uuid)
        authors = [schemas.UserRead(
            user_uuid=author.public_uuid,
            username=author.username,
            is_active=author.is_active,
            created_at=author.created_at
        ) for author in snapshot.authors_ref]
        return schemas.GraphSnapshotMeta(
            public_uuid=snapshot.public_uuid,
            version_label=snapshot.version_label,
            created_at=snapshot.created_at,
            last_updated=snapshot.last_updated,
            is_public=snapshot.is_public,
            authors=authors,
            node_count=len(snapshot.nodes),
            assessable_node_count=len([n for n in snapshot.nodes if n.assessable])
        )
    
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
    def get_user_accessible_snapshots(db: Session, user_uuid: UUID, action: str = "read", skip: int = 0, limit: int = 100) -> List[schemas.GraphSnapshotRead]:
        """Get snapshots user has access to with business logic"""
        snapshots = crud.snapshots.get_snapshots_paginated(db, skip=skip, limit=limit)
        # Filter to only show snapshots user has access to based on action
        accessible_snapshots = []
        for snapshot in snapshots:
            if SnapshotService.check_snapshot_authorization(db, snapshot.public_uuid, user_uuid, action):
                accessible_snapshots.append(SnapshotService._convert_to_read_schema(snapshot))
        return accessible_snapshots

    @staticmethod
    def get_public_snapshots(db: Session, skip: int = 0, limit: int = 100) -> List[schemas.GraphSnapshotRead]:
        """Get public snapshots with business logic"""
        snapshots = crud.snapshots.get_public_snapshots(db, skip=skip, limit=limit)
        return [SnapshotService._convert_to_read_schema(snapshot) for snapshot in snapshots]

    @staticmethod
    def get_snapshots(
        db: Session,
        user_uuid: UUID = None,
        public_only: bool = False,
        action: str = "read",
        metadata_only: bool = True,
        skip: int = 0,
        limit: int = 100
    ) -> Union[List[schemas.GraphSnapshotMeta], List[schemas.GraphSnapshotRead]]:
        """
        Unified method to get snapshots with proper business logic.
        Handles public vs user-accessible and metadata vs full data.
        """
        if public_only and action == "read":
            snapshots = SnapshotService.get_public_snapshots(db, skip=skip, limit=limit)
        elif user_uuid:
            snapshots = SnapshotService.get_user_accessible_snapshots(db, user_uuid, action=action, skip=skip, limit=limit)
        else:
            raise ValueError("User authentication required for non-public snapshots")
        
        if metadata_only:
            return [SnapshotService._extract_metadata(db, s.public_uuid) for s in snapshots]
        
        return snapshots

    @staticmethod
    def get_snapshot(
        db: Session,
        snapshot_uuid: UUID,
        user_uuid: UUID = None,
        public: bool = False,
        action: str = "read",
        metadata_only: bool = False
    ) -> Union[schemas.GraphSnapshotMeta, schemas.GraphSnapshotRead]:
        """
        Unified method to get a single snapshot with proper business logic.
        Handles public vs authorized and metadata vs full data.
        """
        if public and action == "read":
            snapshot = SnapshotService.get_public_snapshot(db, snapshot_uuid)
        elif user_uuid:
            snapshot = SnapshotService.get_snapshot_with_action(db, snapshot_uuid, user_uuid, action)
        else:
            raise ValueError("User authentication required for non-public snapshots")
        
        if metadata_only:
            return SnapshotService._extract_metadata(db, snapshot_uuid)
        
        return snapshot

    @staticmethod
    def delete_snapshot(db: Session, snapshot_uuid: UUID) -> bool:
        """Delete snapshot with business logic"""
        return crud.snapshots.delete_snapshot_by_uuid(db, snapshot_uuid)

    @staticmethod
    def export_snapshot(db: Session, snapshot_uuid: UUID) -> dict:
        """Export snapshot data for download as .knw file"""
        snapshot = crud.snapshots.get_snapshot_by_uuid(db, snapshot_uuid)
        if not snapshot:
            raise ValueError("Snapshot not found")
        
        # Convert to read schema for export
        snapshot_data = SnapshotService._convert_to_read_schema(snapshot)
        
        # Convert to dict for JSON serialization
        # Note: is_public is intentionally excluded as it's site-specific
        return {
            'public_uuid': str(snapshot_data.public_uuid),
            'base_uuid': str(snapshot_data.base_uuid) if snapshot_data.base_uuid else None,
            'version_label': snapshot_data.version_label,
            'created_at': snapshot_data.created_at.isoformat() if snapshot_data.created_at else None,
            'last_updated': snapshot_data.last_updated.isoformat() if snapshot_data.last_updated else None,
            'authors': [
                {
                    'user_uuid': str(author.user_uuid),
                    'username': author.username
                } for author in (snapshot_data.authors or [])
            ],
            'nodes': [
                {
                    'local_id': node.local_id,
                    'title': node.title,
                    'description': node.description,
                    'prerequisite': node.prerequisite,
                    'mentions': node.mentions,
                    'domain_id': node.domain_id,
                    'x': node.x,
                    'y': node.y,
                    'assessable': node.assessable,
                    'source_items': [
                        {
                            'title': src.title,
                            'bib_type': src.bib_type,
                            'author': src.author,
                            'year': src.year,
                            'url': src.url,
                            'fragment_start': src.fragment_start,
                            'fragment_end': src.fragment_end,
                            'bib_hash': src.bib_hash,        # The exported file receives the public_hash of the bibliography as bib_hash according to SourceRead schema
                            'source_uuid': str(src.source_uuid) if src.source_uuid else None
                        } for src in (node.source_items or [])
                    ]
                } for node in snapshot_data.nodes
            ],
            'domains': [
                {
                    'local_id': domain.local_id,
                    'title': domain.title,
                    'description': domain.description,
                    'parent_id': domain.parent_id
                } for domain in snapshot_data.domains
            ],
            'redirects': [
                {
                    'old_local_id': redirect.old_local_id,
                    'new_local_id': redirect.new_local_id
                } for redirect in (snapshot_data.redirects or [])
            ]
        }

    @staticmethod
    def import_snapshot(db: Session, import_data: dict, current_user: models.User, overwrite: bool = False, target_uuid: UUID = None) -> schemas.GraphSnapshotRead:
        """Import snapshot from .knw file data"""
        from ..utils import clean_import_data, handle_redirects_import
        from datetime import datetime
        
        # Clean the import data (remove read-only and site-specific fields)
        cleaned_data = clean_import_data(import_data)
        
        # Handle redirects format conversion if needed
        cleaned_data = handle_redirects_import(cleaned_data)
        
        # Parse timestamps if present
        imported_created_at = None
        imported_last_updated = None
        if cleaned_data.get('created_at'):
            try:
                imported_created_at = datetime.fromisoformat(cleaned_data['created_at'].replace('Z', '+00:00'))
            except (ValueError, AttributeError):
                pass
        if cleaned_data.get('last_updated'):
            try:
                imported_last_updated = datetime.fromisoformat(cleaned_data['last_updated'].replace('Z', '+00:00'))
            except (ValueError, AttributeError):
                pass
        
        # Check if a snapshot with this UUID already exists
        # If target_uuid is provided, search for overwrite target first
        # If not, simply use uuid on the import file
        existing_snapshot = None
        import_uuid = cleaned_data.get('public_uuid')
        if target_uuid:
            try:
                existing_snapshot = crud.snapshots.get_snapshot_by_uuid(db, UUID(target_uuid))
            except (ValueError, TypeError):
                pass
        elif import_uuid:
            try:
                existing_snapshot = crud.snapshots.get_snapshot_by_uuid(db, UUID(import_uuid))
            except (ValueError, TypeError):
                pass  # Invalid UUID format
        
        # If overwrite is requested and snapshot exists, update it
        if overwrite and existing_snapshot:
            # Check write authorization
            if not SnapshotService.check_snapshot_authorization(db, existing_snapshot.public_uuid, current_user.id if current_user else None, "write"):
                raise ValueError("Not authorized to overwrite this snapshot")
            
            # Build update data (is_public is NOT imported - site-specific)
            update_data = schemas.GraphSnapshotUpdate(
                version_label=cleaned_data.get('version_label'),
                nodes=[
                    schemas.NodeCreate(
                        local_id=node.get('local_id'),
                        title=node.get('title'),
                        description=node.get('description'),
                        prerequisite=node.get('prerequisite'),
                        mentions=node.get('mentions'),
                        domain_id=node.get('domain_id'),
                        x=node.get('x'),
                        y=node.get('y'),
                        assessable=node.get('assessable', False),
                        source_items=[
                            schemas.SourceCreate(
                                title=src.get('title'),
                                bib_type=src.get('bib_type', 'Other'),
                                author=src.get('author'),
                                year=src.get('year'),
                                url=src.get('url'),
                                fragment_start=src.get('fragment_start'),
                                fragment_end=src.get('fragment_end'),
                                snapshot_uuid=existing_snapshot.public_uuid,
                                node_id=node.get('local_id'),
                                #public_hash=node.get('bib_hash'),
                                source_uuid=src.get('source_uuid')
                            ) for src in (node.get('source_items') or [])
                        ]
                    ) for node in cleaned_data.get('nodes', [])
                ],
                domains=[
                    schemas.DomainCreate(
                        local_id=domain.get('local_id'),
                        title=domain.get('title'),
                        description=domain.get('description'),
                        parent_id=domain.get('parent_id'),
                        snapshot_uuid=existing_snapshot.public_uuid
                    ) for domain in cleaned_data.get('domains', [])
                ],
                redirects=[
                    schemas.NodeRedirectBase(
                        snapshot_uuid=existing_snapshot.public_uuid,
                        old_local_id=redirect.get('old_local_id'),
                        new_local_id=redirect.get('new_local_id')
                    ) for redirect in cleaned_data.get('redirects', [])
                ] if cleaned_data.get('redirects') else None,
                overwrite=True,
                metadata_only=False
            )
            
            result = SnapshotService.update_snapshot(db, existing_snapshot.public_uuid, update_data)
            
            return result
        else:
            # Create new snapshot (is_public defaults to False - not imported)
            create_data = schemas.GraphSnapshotCreate(
                version_label=cleaned_data.get('version_label'),
                base_uuid=cleaned_data.get('base_uuid'),
                nodes=[
                    schemas.NodeCreate(
                        local_id=node.get('local_id'),
                        title=node.get('title'),
                        description=node.get('description'),
                        prerequisite=node.get('prerequisite'),
                        mentions=node.get('mentions'),
                        domain_id=node.get('domain_id'),
                        x=node.get('x'),
                        y=node.get('y'),
                        assessable=node.get('assessable', False),
                        source_items=[
                            schemas.SourceCreate(
                                title=src.get('title'),
                                bib_type=src.get('bib_type', 'Other'),
                                author=src.get('author'),
                                year=src.get('year'),
                                url=src.get('url'),
                                fragment_start=src.get('fragment_start'),
                                fragment_end=src.get('fragment_end'),
                                snapshot_uuid=import_data.get('public_uuid'),  # Will be replaced by backend
                                node_id=node.get('local_id'),
                                #public_hash=node.get('bib_hash'),  # Will be generated by backend
                                source_uuid=src.get('source_uuid')
                            ) for src in (node.get('source_items') or [])
                        ]
                    ) for node in cleaned_data.get('nodes', [])
                ],
                domains=[
                    schemas.DomainCreate(
                        local_id=domain.get('local_id'),
                        title=domain.get('title'),
                        description=domain.get('description'),
                        parent_id=domain.get('parent_id')
                    ) for domain in cleaned_data.get('domains', [])
                ],
                redirects=[
                    schemas.NodeRedirectBase(
                        snapshot_uuid=import_data.get('public_uuid'),  # Will be replaced by backend
                        old_local_id=redirect.get('old_local_id'),
                        new_local_id=redirect.get('new_local_id')
                    ) for redirect in cleaned_data.get('redirects', [])
                ] if cleaned_data.get('redirects') else None,
                created_by=schemas.UserRead(user_uuid=current_user.public_uuid, username=current_user.username) if current_user else None
            )
            
            result = SnapshotService.create_snapshot(db=db, snapshot_data=create_data)
            
            # Restore timestamps if they were in the import
            if imported_created_at or imported_last_updated:
                new_snapshot = crud.snapshots.get_snapshot_by_uuid(db, result.public_uuid)
                if new_snapshot:
                    new_snapshot.created_at = imported_created_at or new_snapshot.created_at
                    new_snapshot.last_updated = imported_last_updated or new_snapshot.last_updated
                    db.commit()
                    db.refresh(new_snapshot)
                    result = SnapshotService._convert_to_read_schema(new_snapshot)
            
            return result

    @staticmethod
    def get_snapshot_with_action(db: Session, snapshot_uuid: UUID, user_uuid: UUID, action: str) -> schemas.GraphSnapshotRead:
        """Get snapshot with authorization based on action
        
        Actions:
        - "read": Read-only access
        - "fetch": Read for editing (registered users only)
        - "write": Update/overwrite access (authors only)
        - "assess": Assessment access (requires bookmark)
        - "learn": Learning access (requires bookmark)
        """
        if not SnapshotService.check_snapshot_authorization(db, snapshot_uuid, user_uuid, action):
            raise ValueError(f"Not authorized to '{action}' this snapshot")
        
        snapshot = crud.snapshots.get_snapshot_by_uuid(db, snapshot_uuid)
        if not snapshot:
            raise ValueError("Snapshot not found")
        
        return SnapshotService._convert_to_read_schema(snapshot)

    @staticmethod
    def check_snapshot_authorization(db: Session, snapshot_uuid: UUID, user_uuid: UUID, action: str) -> bool:
        """Check if user is authorized to perform action on snapshot
        
        Actions:
        - "read": Read-only access (always allowed for public snapshots)
        - "fetch": Read for editing (only for registered users)
        - "write": Update/overwrite operations (authorship check)
        - "delete": Delete operations (authorship check)
        - "assess": Assessment access (requires bookmark)
        - "learn": Learning access (requires bookmark)
        """
        # This is business logic - check if user is author or has access
        snapshot = crud.snapshots.get_snapshot_by_uuid(db, snapshot_uuid)
        if not snapshot:
            return False
            
        # If action is read, always allow
        if action == "read":
            return True
        
        # Convert user_uuid to user_id for CRUD calls
        user = crud.users.get_user_by_uuid(db, user_uuid)
        if not user:
            return False
        user_id = user.id
        
        # "fetch" action - read for editing (only for registered users)
        if action == "fetch":
            # Must be a registered user (user_id > 0)
            return user_id is not None and user_id > 0
        
        # "assess" and "learn" action - requires bookmark
        if action in ["assess", "learn"]:
            # Must be a registered user with bookmark
            if user_id <= 0:
                return False
            # Check if user has bookmarked this graph
            bookmark = crud.bookmarks.get_bookmark(db, user_id=user_id, graph_id=snapshot.id)
            return bookmark is not None
        
        # "write" and "delete" actions - require authorship
        if action in ["write", "delete"]:
            # If there is no author (open-access), allow
            authors = crud.access_control.get_authorship_by_graph(db, snapshot.id)
            if not authors:
                return True
            authorship = crud.access_control.get_authorship_by_graph_and_user(db, snapshot.id, user_id)
            return authorship is not None
        
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
                    db_domain = crud.snapshots.create_domain_record(
                        db,
                        snapshot_id=snapshot_id,
                        local_id=local_id,
                        title=d_data.title,
                        description=d_data.description
                    )
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
                    db_node = crud.snapshots.create_node_record(db,
                        snapshot_id=snapshot_id,
                        local_id=local_id,
                        title=node_data.title,
                        description=node_data.description,
                        prerequisite=node_data.prerequisite,
                        mentions=node_data.mentions,
                        assessable=node_data.assessable,
                        domain_id=domain_db_id,
                        x=node_data.x,
                        y=node_data.y)
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
                # Try to find by title/author/year to avoid duplicates
                bib = bib_crud.get_bibliography_by_details(
                    db,
                    title=src.title,
                    author=getattr(src, 'author', None),
                    year=getattr(src, 'year', None)
                )
            if not bib:
                # Generate a hash and check if it already exists
                new_hash = getattr(src, 'public_hash', None) or generate_hash(f"{src.title}:{src.author}:{src.year}")
                bib = bib_crud.get_bibliography_by_hash(db, new_hash)
                if not bib:
                    bib = bib_crud.create_bibliography_record(
                        db,
                        title=src.title,
                        author=getattr(src, 'author', None),
                        year=getattr(src, 'year', None),
                        bib_type=getattr(src, 'bib_type', 'PDF'),
                        url=getattr(src, 'url', None),
                        public_hash=new_hash
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
                # Try to find by title/author/year to avoid duplicates
                bib = bib_crud.get_bibliography_by_details(
                    db,
                    title=src.title,
                    author=getattr(src, 'author', None),
                    year=getattr(src, 'year', None)
                )
            if not bib:
                # Generate a hash and check if it already exists
                new_hash = getattr(src, 'public_hash', None) or generate_hash(f"{src.title}:{src.author}:{src.year}")
                bib = bib_crud.get_bibliography_by_hash(db, new_hash)
                if not bib:
                    bib = bib_crud.create_bibliography_record(
                        db,
                        title=src.title,
                        author=getattr(src, 'author', None),
                        year=getattr(src, 'year', None),
                        bib_type=getattr(src, 'bib_type', 'Other'),
                        url=getattr(src, 'url', None),
                        public_hash=new_hash
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
    def _calculate_domain_node_counts(db_snapshot):
        """Calculate node counts for each domain including nested child domains.
        Returns dict: domain_id -> {'node_count': int, 'assessable_count': int}
        """
        # Build domain parent-child relationships
        domain_children = {}  # domain_id -> list of child domain objects
        for domain in db_snapshot.domains:
            if domain.parent_id is not None:
                if domain.parent_id not in domain_children:
                    domain_children[domain.parent_id] = []
                domain_children[domain.parent_id].append(domain)

        def get_descendant_ids(domain_id):
            """Recursively get all descendant domain database IDs"""
            descendant_ids = set()
            children = domain_children.get(domain_id, [])
            for child in children:
                descendant_ids.add(child.id)
                descendant_ids.update(get_descendant_ids(child.id))
            return descendant_ids

        # Calculate counts for each domain
        domain_counts = {}
        for domain in db_snapshot.domains:
            domain_ids_to_count = {domain.id} | get_descendant_ids(domain.id)
            node_count = 0
            assessable_count = 0
            for node in db_snapshot.nodes:
                if node.domain_id in domain_ids_to_count:
                    node_count += 1
                    if node.assessable:
                        assessable_count += 1
            domain_counts[domain.id] = {'node_count': node_count, 'assessable_count': assessable_count}

        return domain_counts

    @staticmethod
    def _convert_to_read_schema(db_snapshot) -> schemas.GraphSnapshotRead:
        """Convert database model to read schema - business logic"""
        # Build mapping of domain db_id -> local_id for node domain_id conversion
        domain_db_id_to_local = {}
        for domain in db_snapshot.domains:
            domain_db_id_to_local[domain.id] = domain.local_id
        
        # Convert nodes to read schemas
        nodes = []
        for node in sorted(db_snapshot.nodes, key=lambda n: n.local_id):
            # Convert database domain_id to local_id for frontend
            domain_local_id = None
            if node.domain_id is not None:
                domain_local_id = domain_db_id_to_local.get(node.domain_id)
            
            # Convert source fragments to SourceRead with source_uuid
            source_items = []
            for sf in node.source_frags:
                source_items.append(schemas.SourceRead(
                    public_uuid=sf.public_uuid,
                    snapshot_uuid=db_snapshot.public_uuid,
                    node_id=node.local_id,
                    fragment_start=sf.fragment_start,
                    fragment_end=sf.fragment_end,
                    source_uuid=sf.public_uuid,
                    bib_hash=sf.bibliography.public_hash,    # Bibliography hash reanamed to bib_hash for frontend use
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
        
        # Calculate node counts for all domains (including nested children)
        domain_counts = SnapshotService._calculate_domain_node_counts(db_snapshot)
        
        # Convert domains to read schemas
        domains = []
        for domain in sorted(db_snapshot.domains, key=lambda d: d.local_id):
            # Convert database parent_id (internal id) to local_id for frontend
            parent_local_id = None
            if domain.parent_id is not None:
                parent_local_id = domain_db_id_to_local.get(domain.parent_id)

            counts = domain_counts.get(domain.id, {'node_count': 0, 'assessable_count': 0})
            domains.append(schemas.DomainRead(
                local_id=domain.local_id,
                title=domain.title,
                description=domain.description,
                parent_id=parent_local_id,
                node_count=counts['node_count'],
                assessable_node_count=counts['assessable_count']
            ))
        
        # Convert redirects to read schemas
        redirects = []
        for redirect in sorted(db_snapshot.redirects, key=lambda r: r.created_at):
            redirects.append(schemas.NodeRedirectRead(
                snapshot_uuid=db_snapshot.public_uuid,
                old_local_id=redirect.old_local_id,
                new_local_id=redirect.new_local_id
            ))

        print(sorted(db_snapshot.authors_ref, key=lambda a: a.created_at))
        authors = [schemas.UserRead(
            user_uuid=author.public_uuid,
            username=author.username)
        for author in sorted(db_snapshot.authors_ref, key=lambda a: a.created_at)]      # Returns author list sorted by join time
        print(authors)
        
        return schemas.GraphSnapshotRead(
            public_uuid=db_snapshot.public_uuid,
            base_uuid=db_snapshot.base_uuid,
            base_graph_label=db_snapshot.base_graph_label,
            version_label=db_snapshot.version_label,
            is_public=db_snapshot.is_public,
            created_at=db_snapshot.created_at,
            last_updated=db_snapshot.last_updated,
            authors=authors,
            nodes=nodes,
            domains=domains,
            redirects=redirects,
            node_count=len(nodes),
            assessable_node_count=len([n for n in nodes if n.assessable])
        )
