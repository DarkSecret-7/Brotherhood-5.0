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

from sqlalchemy.orm import Session
from .. import crud, schemas
from uuid import UUID
from . import snapshots

class BookmarkService:

    @staticmethod
    def get_user_bookmarks(db: Session, user_uuid: UUID) -> list[schemas.BookmarkRead]:
        user_id = crud.users.get_user_by_uuid(db, user_uuid).id
        bookmarks = crud.bookmarks.get_bookmarks(db, user_id=user_id)
        result = []
        for bookmark in bookmarks:
            graph_meta = snapshots.SnapshotService._extract_metadata(db, bookmark.graph_uuid)
            bookmark_read = schemas.BookmarkRead(
                graph_uuid=bookmark.graph_uuid,
                user_uuid=bookmark.user_uuid,
                created_at=bookmark.created_at,
                graph_meta=graph_meta
            )
            result.append(bookmark_read)
        return result

    @staticmethod
    def add_bookmark(db: Session, user_uuid: UUID, graph_uuid: UUID):
        # Get database IDs from UUIDs
        user_id = crud.users.get_user_by_uuid(db, user_uuid).id
        graph_id = crud.snapshots.get_snapshot_by_uuid(db, graph_uuid).id

        # Check if bookmark already exists
        bookmark = crud.bookmarks.get_bookmark(db, user_id=user_id, graph_id=graph_id)
        if not bookmark:
            bookmark = crud.bookmarks.create_bookmark(db, user_id=user_id, graph_id=graph_id)

        graph_meta = snapshots.SnapshotService._extract_metadata(db, bookmark.graph_uuid)
        return schemas.BookmarkRead(
            graph_uuid=bookmark.graph_uuid,
            user_uuid=bookmark.user_uuid,
            created_at=bookmark.created_at,
            graph_meta=graph_meta
        )

    @staticmethod
    def remove_bookmark(db: Session, user_uuid: UUID, graph_uuid: UUID):
        # Get database IDs from UUIDs
        user_id = crud.users.get_user_by_uuid(db, user_uuid).id
        graph_id = crud.snapshots.get_snapshot_by_uuid(db, graph_uuid).id
        return crud.bookmarks.delete_bookmark(db, user_id=user_id, graph_id=graph_id)
