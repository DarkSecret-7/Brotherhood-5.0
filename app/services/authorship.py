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
        """Get all authors for a snapshot using UUID - faster direct query"""
        return crud.access_control.get_authorship_by_graph_uuid(db, snapshot_uuid)

    @staticmethod
    def add_author(db: Session, snapshot_uuid: UUID, user_uuid: UUID, role: str = "Curator") -> Optional[models.GraphAuthorship]:
        """Add an author to a snapshot"""
        existing = crud.access_control.get_authorship_by_graph_uuid_and_user_uuid(db, snapshot_uuid, user_uuid)
        if existing:
            raise ValueError("User is already an author")

        snapshot = crud.snapshots.get_snapshot_by_uuid(db, snapshot_uuid)
        if not snapshot:
            raise ValueError("Snapshot not found")

        # Get user
        user = crud.users.get_user_by_uuid(db, user_uuid)
        if not user:
            raise ValueError("User not found")
        # Get authorship
        authorship = crud.access_control.create_authorship_record(
            db=db,
            graph_id=snapshot.id,
            graph_uuid=snapshot_uuid,
            user_id=user.id,
            user_uuid=user_uuid,
            role=role
        )
        db.commit()
        db.refresh(authorship)
        return authorship

    @staticmethod
    def remove_author(db: Session, snapshot_uuid: UUID, user_uuid: UUID) -> bool:
        """Remove an author from a snapshot"""
        authors = crud.access_control.get_authorship_by_graph_uuid(db, snapshot_uuid)
        if len(authors) <= 1:
            raise ValueError("Cannot remove the last author")

        existing = crud.access_control.get_authorship_by_graph_uuid_and_user_uuid(db, snapshot_uuid, user_uuid)
        if not existing:
            raise ValueError("User is not an author")

        # Delete authorship
        return crud.access_control.delete_authorship_by_uuid(db, snapshot_uuid, user_uuid)

    @staticmethod
    def check_authorization(db: Session, snapshot_uuid: UUID, user_id: int, action: str) -> bool:
        """Check if user is authorized to perform action on snapshot"""
        from .snapshots import SnapshotService
        return SnapshotService.check_snapshot_authorization(db, snapshot_uuid, user_id, action)
