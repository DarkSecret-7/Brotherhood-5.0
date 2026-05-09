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
Authorship management endpoints
TEMPORARY: NEEDS TO BE FIXED
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from .. import services, schemas, models, database
from uuid import UUID
from .auth import get_current_user

router = APIRouter()

@router.post("/snapshots/{snapshot_uuid}/authors", response_model=schemas.GraphAuthorshipRead)
def add_author(
    snapshot_uuid: UUID,
    authorship: schemas.GraphAuthorshipCreate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Add an author to a snapshot"""
    # Check authorization
    if not services.authorship.AuthorshipService.check_authorization(db, snapshot_uuid, current_user.id, "update"):
        raise HTTPException(status_code=403, detail="Not authorized to modify authors")

    try:
        result = services.authorship.AuthorshipService.add_author(
            db, snapshot_uuid, authorship.user_uuid, authorship.role or "Curator"
        )

        # Get user details for response
        user = services.users.UserService.get_user(db, authorship.user_uuid)

        return schemas.GraphAuthorshipRead(
            graph_uuid=snapshot_uuid,
            user_uuid=authorship.user_uuid,
            username=user.username if user.username else "Unknown",
            role=result.role,
            created_at=result.created_at
        )
    except ValueError as e:
        if "not found" in str(e).lower():
            raise HTTPException(status_code=404, detail=str(e))
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/snapshots/{snapshot_uuid}/authors/{user_uuid}")
def remove_author(
    snapshot_uuid: UUID,
    user_uuid: UUID,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Remove an author from a snapshot"""
    # Check authorization
    if not services.authorship.AuthorshipService.check_authorization(db, snapshot_uuid, current_user.id, "update"):
        raise HTTPException(status_code=403, detail="Not authorized to modify authors")

    try:
        success = services.authorship.AuthorshipService.remove_author(db, snapshot_uuid, user_uuid)
        if not success:
            raise HTTPException(status_code=404, detail="Authorship not found")
        return {"message": "Author removed"}
    except ValueError as e:
        if "not found" in str(e).lower():
            raise HTTPException(status_code=404, detail=str(e))
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/snapshots/{snapshot_uuid}/authors", response_model=List[schemas.GraphAuthorshipRead])
def get_authors(
    snapshot_uuid: UUID,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Get all authors of a snapshot"""
    # Check authorization
    if not services.authorship.AuthorshipService.check_authorization(db, snapshot_uuid, current_user.id, "read"):
        raise HTTPException(status_code=403, detail="Not authorized to view this snapshot")

    # Get authors
    authorship_rows = services.authorship.AuthorshipService.get_snapshot_authors(db, snapshot_uuid)
    authors = []

    for authorship in authorship_rows:
        # Get user details
        user = services.users.UserService.get_user_by_id(db, authorship.user_id)
        if user:
            authors.append(schemas.GraphAuthorshipRead(
                graph_uuid=snapshot_uuid,
                user_uuid=user.public_uuid,
                username=user.username,
                role=authorship.role or "Curator",
                created_at=authorship.created_at
            ))

    return authors
