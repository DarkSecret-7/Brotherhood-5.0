# This file is part of The Brotherhood Project
#
# Copyright (C) 2026  The Brotherhood Project
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
Authorship service layer - Business logic for graph authorship operations.
Orchestrates CRUD operations and handles business rules.
"""
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import UUID
from .. import crud, models

class AuthorshipService:

    @staticmethod
    def get_snapshot_authors(db: Session, snapshot_uuid: UUID) -> List[models.GraphAuthorship]:
        """Get all authors for a snapshot"""
        snapshot = crud.snapshots.get_snapshot_by_uuid(db, snapshot_uuid)
        if not snapshot:
            return []
        return crud.access_control.get_authorship_by_graph(db, snapshot.id)

    @staticmethod
    def add_author(db: Session, snapshot_uuid: UUID, user_uuid: UUID, role: str = "Curator") -> Optional[models.GraphAuthorship]:
        """Add an author to a snapshot"""
        # Get snapshot
        snapshot = crud.snapshots.get_snapshot_by_uuid(db, snapshot_uuid)
        if not snapshot:
            raise ValueError("Snapshot not found")

        # Get user
        user = crud.users.get_user_by_uuid(db, user_uuid)
        if not user:
            raise ValueError("User not found")

        # Check if user is already an author
        existing = crud.access_control.get_authorship_by_graph_and_user(db, snapshot.id, user.id)
        if existing:
            raise ValueError("User is already an author")

        # Create authorship
        authorship = crud.access_control.create_authorship_record(
            db=db,
            graph_id=snapshot.id,
            user_id=user.id,
            role=role
        )
        db.commit()
        db.refresh(authorship)
        return authorship

    @staticmethod
    def remove_author(db: Session, snapshot_uuid: UUID, user_uuid: UUID) -> bool:
        """Remove an author from a snapshot"""
        # Get snapshot
        snapshot = crud.snapshots.get_snapshot_by_uuid(db, snapshot_uuid)
        if not snapshot:
            raise ValueError("Snapshot not found")

        # Get user
        user = crud.users.get_user_by_uuid(db, user_uuid)
        if not user:
            raise ValueError("User not found")

        # Don't allow removing the last author
        authors = crud.access_control.get_authorship_by_graph(db, snapshot.id)
        if len(authors) <= 1:
            raise ValueError("Cannot remove the last author")

        # Check if user is an author
        existing = crud.access_control.get_authorship_by_graph_and_user(db, snapshot.id, user.id)
        if not existing:
            raise ValueError("User is not an author")

        # Delete authorship
        return crud.access_control.delete_authorship_record(db, snapshot.id, user.id)

    @staticmethod
    def check_authorization(db: Session, snapshot_uuid: UUID, user_id: int, action: str) -> bool:
        """Check if user is authorized to perform action on snapshot"""
        from .snapshots import SnapshotService
        return SnapshotService.check_snapshot_authorization(db, snapshot_uuid, user_id, action)
