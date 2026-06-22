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
Authorship management endpoints
Step 1 of refactor (DONE): join migrated from app/api/proposals.py to POST /snapshots/{uuid}/authors/join
Step 2 of refactor (DONE): invite migrated from app/api/proposals.py to POST /snapshots/{uuid}/authors/invite
Step 3 of refactor (DONE): remove migrated from app/api/proposals.py to DELETE /snapshots/{uuid}/authors/{user_uuid}

Direct add/remove of authors via HTTP is intentionally not exposed — authors can
only be added or removed through proposal consensus (or, for sole-author snapshots,
through the direct invitation path inside AuthorshipService).
"""
from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from typing import List, Annotated
from .. import services, schemas, models, database
from uuid import UUID
from .auth import get_current_user

router = APIRouter()

@router.post("/snapshots/{snapshot_uuid}/authors/join")
def request_to_join_graph(
    snapshot_uuid: UUID,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Request to join a snapshot as an author. Always creates a Join proposal."""
    try:
        result = services.authorship.AuthorshipService.request_to_join(
            db, snapshot_uuid, current_user.public_uuid
        )
        return result
    except ValueError as e:
        error_msg = str(e).lower()
        if "already an author" in error_msg:
            raise HTTPException(status_code=400, detail=str(e))
        elif "no authors" in error_msg or "not found" in error_msg:
            raise HTTPException(status_code=404, detail=str(e))
        elif "pending invite proposal" in error_msg or "pending invitation" in error_msg:
            raise HTTPException(status_code=409, detail=str(e))
        elif "pending" in error_msg:
            raise HTTPException(status_code=202, detail=str(e))
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/snapshots/{snapshot_uuid}/authors/invite")
def invite_author_to_graph(
    snapshot_uuid: UUID,
    target_user_uuid: Annotated[str, Body(..., embed=True)],
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Invite a user to become an author of a snapshot. Sole author → direct invite; multiple authors → Invite proposal."""
    try:
        result = services.authorship.AuthorshipService.invite_author(
            db, snapshot_uuid, current_user.public_uuid, UUID(target_user_uuid)
        )
        return result
    except ValueError as e:
        error_msg = str(e).lower()
        if "not an author" in error_msg:
            raise HTTPException(status_code=403, detail=str(e))
        elif "already an author" in error_msg or "already invited" in error_msg:
            raise HTTPException(status_code=400, detail=str(e))
        elif "no authors" in error_msg:
            raise HTTPException(status_code=404, detail=str(e))
        elif "pending join request" in error_msg:
            raise HTTPException(status_code=409, detail=str(e))
        elif "pending" in error_msg:
            raise HTTPException(status_code=202, detail=str(e))
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/snapshots/{snapshot_uuid}/authors/{user_uuid}")
def remove_author_from_graph(
    snapshot_uuid: UUID,
    user_uuid: UUID,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Remove a coauthor from a snapshot. Two authors → direct; three or more → Remove proposal."""
    try:
        result = services.authorship.AuthorshipService.remove_coauthor(
            db, snapshot_uuid, current_user.public_uuid, user_uuid
        )
        return result
    except ValueError as e:
        error_msg = str(e).lower()
        if "not an author" in error_msg:
            raise HTTPException(status_code=403, detail=str(e))
        elif "cannot remove self" in error_msg:
            raise HTTPException(status_code=400, detail=str(e))
        elif "only one author" in error_msg:
            raise HTTPException(status_code=400, detail=str(e))
        elif "pending" in error_msg:
            raise HTTPException(status_code=202, detail=str(e))
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/snapshots/{snapshot_uuid}/authors/invitations/{invitation_hash}/respond")
def respond_to_authorship_invitation(
    snapshot_uuid: UUID,
    invitation_hash: str,
    accept: Annotated[bool, Body(..., embed=True)],
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Recipient accepts or rejects an authorship invitation.

    Accept → AuthorshipService.add_author + invitation_status='Accepted'.
    Reject → invitation_status='Rejected'. No authorship change.
    """
    try:
        result = services.authorship.AuthorshipService.respond_to_invitation(
            db, snapshot_uuid, invitation_hash, current_user.public_uuid, accept
        )
        return result
    except ValueError as e:
        error_msg = str(e).lower()
        if "not found" in error_msg:
            raise HTTPException(status_code=404, detail=str(e))
        elif "not authorized" in error_msg or "not belong" in error_msg:
            raise HTTPException(status_code=403, detail=str(e))
        elif "no longer pending" in error_msg:
            raise HTTPException(status_code=400, detail=str(e))
        elif "already an author" in error_msg:
            raise HTTPException(status_code=400, detail=str(e))
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/snapshots/{snapshot_uuid}/authors", response_model=List[schemas.GraphAuthorshipRead])
def get_authors(
    snapshot_uuid: UUID,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Get all authors of a snapshot"""
    # Check authorization
    if not services.authorship.AuthorshipService.check_authorization(db, snapshot_uuid, current_user.public_uuid, "read"):
        raise HTTPException(status_code=403, detail="Not authorized to view this snapshot")

    # Get authors
    authorship_rows = services.authorship.AuthorshipService.get_snapshot_authors(db, snapshot_uuid)
    authors = []

    for authorship in authorship_rows:
        # Get user details
        user = services.users.UserService.get_user_by_uuid(db, authorship.user_uuid)
        if user:
            authors.append(schemas.GraphAuthorshipRead(
                graph_uuid=snapshot_uuid,
                user_uuid=user.public_uuid,
                username=user.username,
                role=authorship.role or "Curator",
                created_at=authorship.created_at
            ))

    return authors
