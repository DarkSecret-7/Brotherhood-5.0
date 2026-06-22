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

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID
from .. import services, schemas, database, models
from .auth import get_current_user

router = APIRouter()

@router.get("/bookmarks", response_model=List[schemas.BookmarkRead])
def get_bookmarks(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user)
):
    return services.bookmarks.BookmarkService.get_user_bookmarks(db, user_uuid=current_user.public_uuid)

@router.post("/bookmarks", response_model=schemas.BookmarkRead)
def add_bookmark(
    bookmark: schemas.BookmarkCreate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user)
):
    return services.bookmarks.BookmarkService.add_bookmark(db, user_uuid=current_user.public_uuid, graph_uuid=bookmark.graph_uuid)

@router.delete("/bookmarks/{graph_uuid}")
def remove_bookmark(
    graph_uuid: UUID,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user)
):
    success = services.bookmarks.BookmarkService.remove_bookmark(db, user_uuid=current_user.public_uuid, graph_uuid=graph_uuid)
    if not success:
        raise HTTPException(status_code=404, detail="Bookmark not found")
    return {"message": "Bookmark removed successfully"}
