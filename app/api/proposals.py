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
Proposal and consent endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from typing import List, Union, Annotated
from uuid import UUID
from .. import services, schemas, models, database
from .auth import get_current_user

router = APIRouter()

# Specific routes FIRST - must be defined before parameterized routes

@router.get("/proposals/authored", response_model=List[schemas.ProposalRead])
def get_proposals_for_authored_graphs(pending_only: bool = False, skip: int = 0, limit: int = 100, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    """Get all proposals for graphs where user is an author"""
    return services.proposals.ProposalService.get_proposals_for_authored_graphs(db, current_user.public_uuid, pending_only=pending_only, skip=skip, limit=limit)

@router.get("/proposals/join_requests", response_model=List[schemas.JoinRequestRead])
def get_all_join_requests(pending_only: bool = False, skip: int = 0, limit: int = 100, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    """Get all join requests for the current user"""
    return services.proposals.ProposalService.get_join_requests_by_user(db, current_user.public_uuid, pending_only=pending_only, skip=skip, limit=limit)

@router.get("/proposals/invitations/received", response_model=List[schemas.AuthorshipInvitationRead])
def get_received_invitations(skip: int = 0, limit: int = 100, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    """Get authorship invitations received by the current user"""
    return services.proposals.ProposalService.get_received_invitations(db, current_user.public_uuid, skip=skip, limit=limit)

# Generic parameterized routes AFTER specific routes
@router.get("/proposals/{graph_uuid}/proposals", response_model=List[schemas.ProposalRead])
def get_proposals_for_graph(graph_uuid: str, pending_only: bool = False, skip: int = 0, limit: int = 100, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    """Get proposals for a specific graph (only for authors)"""
    try:
        return services.proposals.ProposalService.get_proposals_for_graph_with_auth(
            db, UUID(graph_uuid), current_user.public_uuid, pending_only, skip, limit
        )
    except ValueError as e:
        error_msg = str(e).lower()
        if "not authorized" in error_msg:
            raise HTTPException(status_code=403, detail=str(e))
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/proposals/{proposal_hash}", response_model=schemas.ProposalRead)
def get_proposal(proposal_hash: str, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    """Get a specific proposal (only for authors)"""
    try:
        proposal = services.proposals.ProposalService.get_proposal_with_auth(
            db, proposal_hash, current_user.public_uuid
        )
        if not proposal:
            raise HTTPException(status_code=404, detail="Proposal not found")
        return proposal
    except ValueError as e:
        error_msg = str(e).lower()
        if "not authorized" in error_msg:
            raise HTTPException(status_code=403, detail=str(e))
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/proposals/{proposal_hash}/respond")
def respond_to_proposal(
    proposal_hash: str,
    response: schemas.ProposalConsentCreate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Respond to a proposal (approve/reject)"""
    try:
        result = services.proposals.ProposalService.respond_to_proposal(db, response)
        return result
    except ValueError as e:
        error_msg = str(e).lower()
        if "not found" in error_msg:
            raise HTTPException(status_code=404, detail=str(e))
        elif "not authorized" in error_msg or "target user" in error_msg:
            raise HTTPException(status_code=403, detail=str(e))
        elif "no longer pending" in error_msg:
            raise HTTPException(status_code=400, detail=str(e))
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/proposals/{proposal_hash}")
def delete_proposal(proposal_hash: str, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    """Delete a proposal (only proposer can delete pending proposals)"""
    try:
        success = services.proposals.ProposalService.delete_proposal_with_auth(
            db, proposal_hash, current_user.public_uuid
        )
        if success:
            return True
        else:
            raise HTTPException(status_code=404, detail="Proposal not found")
    except ValueError as e:
        error_msg = str(e).lower()
        if "not found" in error_msg:
            raise HTTPException(status_code=404, detail=str(e))
        elif "proposer" in error_msg or "authorized" in error_msg:
            raise HTTPException(status_code=403, detail=str(e))
        elif "pending" in error_msg:
            raise HTTPException(status_code=400, detail=str(e))
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/proposals/{graph_uuid}/request", response_model=Union[schemas.JoinRequestRead, None])
def get_join_request_for_graph(graph_uuid: str, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    """
    Only reveal join request to the requestor, if a request exists by the requestor
    NEVER reveal complete proposal details to requestor who is not yet an author of the graph
    """
    return services.proposals.ProposalService.get_join_request_for_graph(db, UUID(graph_uuid), current_user.public_uuid)

# IMPORTANT: PROPOSALS SHOULD NOT BE AN ENDPOINT DIRECTLY,
# WHETHER WE USE PROPOSALS OR NOT, SHOULD BE JUDGED BY THE INDIVIDUAL SERVICES
# PROPOSALS SHOULD BE STRICTLY READ-ONLY
# KEEP THIS FOR NOW, IN THE FUTURE, WE WILL REVERSE THIS FLOW

@router.post("/proposals/{graph_uuid}/join")
def join_graph(graph_uuid: str, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    """Request to join a graph as an author"""
    try:
        result = services.proposals.ProposalService.join_graph(
            db, UUID(graph_uuid), current_user.public_uuid
        )
        return result
    except ValueError as e:
        error_msg = str(e).lower()
        if "already an author" in error_msg:
            raise HTTPException(status_code=400, detail=str(e))
        elif "no authors" in error_msg:
            raise HTTPException(status_code=404, detail=str(e))
        elif "pending" in error_msg:
            raise HTTPException(status_code=202, detail=str(e))
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/proposals/{graph_uuid}/invite")
def invite_to_graph(
    graph_uuid: str,
    target_user_uuid: Annotated[str, Body(..., embed=True)],
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Invite a user to become an author of a graph"""
    try:
        result = services.proposals.ProposalService.invite_to_graph(
            db, UUID(graph_uuid), current_user.public_uuid, UUID(target_user_uuid)
        )
        return result
    except ValueError as e:
        error_msg = str(e).lower()
        if "not an author" in error_msg:
            raise HTTPException(status_code=403, detail=str(e))
        elif "already an author" in error_msg:
            raise HTTPException(status_code=400, detail=str(e))
        elif "pending" in error_msg:
            raise HTTPException(status_code=202, detail=str(e))
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/proposals/{graph_uuid}/remove")
def remove_from_graph(
    graph_uuid: str,
    target_user_uuid: Annotated[str, Body(..., embed=True)],
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Remove a user from a graph as an author"""
    try:
        result = services.proposals.ProposalService.remove_from_graph(
            db, UUID(graph_uuid), current_user.public_uuid, UUID(target_user_uuid)
        )
        return result
    except ValueError as e:
        error_msg = str(e).lower()
        if "not an author" in error_msg:
            raise HTTPException(status_code=403, detail=str(e))
        elif "already an author" in error_msg:
            raise HTTPException(status_code=400, detail=str(e))
        elif "pending" in error_msg:
            raise HTTPException(status_code=202, detail=str(e))
        raise HTTPException(status_code=400, detail=str(e))
