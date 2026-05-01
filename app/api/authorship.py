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
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from .. import crud, schemas, utils, models, database
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
    snapshot = crud.get_snapshot(db, snapshot_uuid)
    if not snapshot:
        raise HTTPException(status_code=404, detail="Snapshot not found")
    
    # Check if current user can add authors (must be existing author)
    if not crud.check_snapshot_authorization(db, snapshot.public_uuid, current_user.id, "update"):
        raise HTTPException(status_code=403, detail="Not authorized to modify authors")
    
    # Check if target user exists
    target_user = crud.get_user(db, authorship.user_uuid)
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check if user is already an author
    existing_authorship_rows = crud.get_snapshot_authors(db, snapshot.public_uuid)
    existing_user_ids = {author.user_id for author in existing_authorship_rows}
    
    if target_user.id in existing_user_ids:
        raise HTTPException(status_code=400, detail="User is already an author")
    
    # Create authorship
    authorship_data = schemas.GraphAuthorshipCreate(
        graph_uuid=snapshot.public_uuid,
        user_uuid=authorship.user_uuid,
        role=authorship.role or "Curator"
    )
    
    result = crud.create_graph_authorship(db, authorship_data)
    
    # Return proper schema
    return schemas.GraphAuthorshipRead(
        graph_uuid=snapshot.public_uuid,
        user_uuid=authorship.user_uuid,
        username=target_user.username,
        role=result.role,
        created_at=result.created_at
    )

@router.delete("/snapshots/{snapshot_uuid}/authors/{user_uuid}")
def remove_author(
    snapshot_uuid: UUID,
    user_uuid: UUID,
    db: Session = Depends(database.get_db), 
    current_user: models.User = Depends(get_current_user)
):
    """Remove an author from a snapshot"""
    snapshot = crud.get_snapshot(db, snapshot_uuid)
    if not snapshot:
        raise HTTPException(status_code=404, detail="Snapshot not found")
    
    # Check if current user can remove authors (must be existing author)
    if not crud.check_snapshot_authorization(db, snapshot.public_uuid, current_user.id, "update"):
        raise HTTPException(status_code=403, detail="Not authorized to modify authors")
    
    # Check if target user exists and is an author
    target_user = crud.get_user(db, user_uuid)
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Don't allow removing the last author
    authorship_rows = crud.get_snapshot_authors(db, snapshot.public_uuid)
    if len(authorship_rows) <= 1:
        raise HTTPException(status_code=400, detail="Cannot remove the last author")
    
    # Check if user is an author (using database IDs)
    existing_user_ids = {author.user_id for author in authorship_rows}
    if target_user.id not in existing_user_ids:
        raise HTTPException(status_code=404, detail="User is not an author")
    
    success = crud.delete_graph_authorship(db, snapshot.public_uuid, user_uuid)
    if not success:
        raise HTTPException(status_code=404, detail="Authorship not found")
    
    return {"message": "Author removed"}

@router.get("/snapshots/{snapshot_uuid}/authors", response_model=List[schemas.GraphAuthorshipRead])
def get_authors(
    snapshot_uuid: UUID,
    db: Session = Depends(database.get_db), 
    current_user: models.User = Depends(get_current_user)
):
    """Get all authors of a snapshot"""
    snapshot = crud.get_snapshot(db, snapshot_uuid)
    if not snapshot:
        raise HTTPException(status_code=404, detail="Snapshot not found")
    
    # Check if user can view authors
    if not crud.check_snapshot_authorization(db, snapshot.public_uuid, current_user.id, "read"):
        raise HTTPException(status_code=403, detail="Not authorized to view this snapshot")
    
    # Get database rows and convert to schemas
    authorship_rows = crud.get_snapshot_authors(db, snapshot.public_uuid)
    authors = []
    
    for authorship in authorship_rows:
        # Get user details
        user = crud.get_user_by_id(db, authorship.user_id)
        if user:
            authors.append(schemas.GraphAuthorshipRead(
                graph_uuid=snapshot.public_uuid,
                user_uuid=user.public_uuid,
                username=user.username,
                role=authorship.role or "Curator",
                created_at=authorship.created_at
            ))
    
    return authors
