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
Authorship service layer - Business logic for graph authorship operations.
Orchestrates CRUD operations and handles business rules.
"""
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import UUID
from .. import crud, services, schemas, models

class AuthorshipService:

    @staticmethod
    def _convert_to_read_schema(db_authorship: models.GraphAuthorship, username: str = None) -> schemas.GraphAuthorshipRead:
        """Convert database model to read schema"""
        return schemas.GraphAuthorshipRead(
            graph_uuid=db_authorship.graph_uuid,
            user_uuid=db_authorship.user_uuid,
            role=db_authorship.role,
            username=username,
            created_at=db_authorship.created_at
        )

    def _convert_to_read_schema_invitation(db_invitation: models.AuthorshipInvitation, initiator_username: str = None, recipient_username: str = None) -> schemas.AuthorshipInvitationRead:
        """Convert database model to read schema for invitation"""
        return schemas.AuthorshipInvitationRead(
            public_hash=db_invitation.public_hash,
            graph_uuid=db_invitation.graph_uuid,
            initiator_uuid=db_invitation.initiator_uuid,
            recipient_uuid=db_invitation.recipient_uuid,
            created_at=db_invitation.created_at,
            invitation_status=db_invitation.invitation_status,
            initiator_username=initiator_username,
            recipient_username= recipient_username,
        )

    @staticmethod
    def get_snapshot_authors(db: Session, snapshot_uuid: UUID) -> List[schemas.GraphAuthorshipRead]:
        """Get all authors for a snapshot using UUID"""
        db_authors = crud.access_control.get_authorship_by_graph_uuid(db, snapshot_uuid)
        result = []
        for auth in db_authors:
            user = crud.users.get_user_by_uuid(db, auth.user_uuid)
            username = user.username if user else None
            result.append(AuthorshipService._convert_to_read_schema(auth, username))
        return result

    @staticmethod
    def add_author(db: Session, snapshot_uuid: UUID, user_uuid: UUID, role: str = "Curator") -> schemas.GraphAuthorshipRead:
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

        db_authorship = crud.access_control.create_authorship_record(
            db=db,
            graph_id=snapshot.id,
            graph_uuid=snapshot_uuid,
            user_id=user.id,
            user_uuid=user_uuid,
            role=role
        )
        db.commit()
        db.refresh(db_authorship)
        return AuthorshipService._convert_to_read_schema(db_authorship, user.username)

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

    def send_authorship_invitation(db: Session, snapshot_uuid: UUID, inviter_uuid: UUID, target_user_uuid: UUID) -> dict:
        """Send an authorship invitation to a user"""

        # Fetch details from database
        inviter = crud.users.get_user_by_uuid(db, inviter_uuid)
        if not inviter:
            raise ValueError("Inviter not found")
        target_user = crud.users.get_user_by_uuid(db, target_user_uuid)
        if not target_user:
            raise ValueError("Target user not found")
        snapshot = crud.snapshots.get_snapshot_by_uuid(db, snapshot_uuid)
        if not snapshot:
            raise ValueError("Snapshot not found")

        # Compute public_hash deterministically. The created_at timestamp is
        # encoded so that multiple invitations between the same parties
        # (e.g. after decline → re-invite) remain uniquely identifiable.
        # The same timestamp is persisted as the row's created_at so that
        # the hash and the row always agree.
        from datetime import datetime, timezone
        from ..utils.utils import generate_hash
        invitation_time = datetime.now(timezone.utc)
        string_data = (
            f"invitation:{snapshot_uuid}:{inviter_uuid}:"
            f"{target_user_uuid}:{invitation_time.isoformat()}"
        )
        public_hash = generate_hash(string_data)

        invitation = crud.proposals.create_authorship_invitation_record(
            db=db,
            public_hash=public_hash,
            created_at=invitation_time,
            graph_id=snapshot.id,
            graph_uuid=snapshot_uuid,
            initiator_id=inviter.id,
            initiator_uuid=inviter_uuid,
            recipient_id=target_user.id,
            recipient_uuid=target_user_uuid,
            invitation_status='Pending',
        )
        db.commit()
        db.refresh(invitation)
        return AuthorshipService._convert_to_read_schema_invitation(invitation, inviter.username, target_user.username)

    @staticmethod
    def respond_to_invitation(
        db: Session,
        snapshot_uuid: UUID,
        invitation_hash: str,
        recipient_uuid: UUID,
        accept: bool,
    ) -> dict:
        """
        Recipient accepts or rejects an authorship invitation.

        Authorization: only the original recipient can respond,
        and only while the invitation is still 'Pending'.
        """
        invitation = crud.proposals.get_authorship_invitation_by_kwargs(
            db, public_hash=invitation_hash
        )
        if not invitation:
            raise ValueError("Invitation not found")
        if invitation.graph_uuid != snapshot_uuid:
            raise ValueError("Invitation does not belong to this snapshot")
        if invitation.recipient_uuid != recipient_uuid:
            raise ValueError("Not authorized to respond to this invitation")
        if invitation.invitation_status != "Pending":
            raise ValueError("Invitation is no longer pending")

        if accept:
            # Defensive check: do not double-add if user is somehow already an author
            authors = AuthorshipService.get_snapshot_authors(db, snapshot_uuid)
            if recipient_uuid in [a.user_uuid for a in authors]:
                raise ValueError("User is already an author of this graph")
            AuthorshipService.add_author(
                db, snapshot_uuid, recipient_uuid, "Curator"
            )
            crud.proposals.update_authorship_invitation_record(
                db, invitation.id, invitation_status="Accepted"
            )
            db.commit()
            return {"success": True, "invitation_status": "Accepted", "direct": True}
        else:
            crud.proposals.update_authorship_invitation_record(
                db, invitation.id, invitation_status="Rejected"
            )
            db.commit()
            return {"success": True, "invitation_status": "Rejected", "direct": False}

    @staticmethod
    def invite_author(db: Session, snapshot_uuid: UUID, inviter_uuid: UUID, target_user_uuid: UUID) -> dict:
        """
        Invite a user to become an author of a snapshot.

        Decision boundary:
          - Sole author: no consensus is meaningful (the inviter is the only voter),
            so a direct AuthorshipInvitation is created for the target to accept.
          - Multiple authors: create an Invite proposal. Consensus is then handled
            by ProposalService.respond_to_proposal, which on approval calls
            AuthorshipService.send_authorship_invitation to execute.

        Collision policy (refuse with a distinct error and status code):
          - Pending Join proposal from target              → "pending join request"
          - Pending direct AuthorshipInvitation for target → "already invited"
          - Pending Invite proposal for (inviter, target)  → "already pending" (duplicate)
        """

        authors = AuthorshipService.get_snapshot_authors(db, snapshot_uuid)
        author_uuids = [author.user_uuid for author in authors]
        if inviter_uuid not in author_uuids:
            raise ValueError("User is not an author of this graph")
        if target_user_uuid in author_uuids:
            raise ValueError("Target user is already an author of this graph")
        if len(authors) == 0:
            raise ValueError("Graph has no authors")

        # Cross-pipeline collision: target has a pending Join proposal for this snapshot
        existing_join_proposal = crud.proposals.get_proposal_by_kwargs(
            db,
            proposal_status="Pending",
            proposal_type="Join",
            proposer_uuid=target_user_uuid,
            graph_uuid=snapshot_uuid,
            target_user_uuid=None,
            target_graph_uuid=None,
        )
        if existing_join_proposal:
            raise ValueError("Target user has a pending join request for this graph")

        # Existing same-pipeline duplicate: pending direct AuthorshipInvitation for target
        existing_invitation = crud.proposals.get_authorship_invitations_by_kwargs(
            db,
            graph_uuid=snapshot_uuid,
            recipient_uuid=target_user_uuid,
            invitation_status='Pending',
        )
        if existing_invitation:
            raise ValueError("Target user is already invited to this graph")

        # Existing same-pipeline duplicate: pending Invite proposal for this (inviter, target)
        existing_proposal = crud.proposals.get_proposal_by_kwargs(
            db,
            proposal_status="Pending",
            proposal_type="Invite",
            proposer_uuid=inviter_uuid,
            graph_uuid=snapshot_uuid,
            target_user_uuid=target_user_uuid,
            target_graph_uuid=None,
        )
        if existing_proposal:
            raise ValueError("A proposal to invite target user is already pending")

        if len(authors) == 1:
            AuthorshipService.send_authorship_invitation(db, snapshot_uuid, inviter_uuid, target_user_uuid)
            return {"success": True, "direct": True}

        # Multiple authors — create Invite proposal and let consensus flow handle it
        proposal_data = schemas.ProposalCreate(
            proposal_type="Invite",
            graph_uuid=snapshot_uuid,
            proposer_uuid=inviter_uuid,
            target_user_uuid=target_user_uuid,
        )
        proposal = services.proposals.ProposalService.create_proposal(db, proposal_data)
        return {"success": True, "direct": False, "proposal_hash": proposal.public_hash}

    @staticmethod
    def request_to_join(db: Session, snapshot_uuid: UUID, user_uuid: UUID) -> dict:
        """
        Request to join a snapshot as an author.
        Always creates a Join proposal — a non-author cannot self-authorize,
        so direct execution is impossible for this action.

        Collision policy (refuse with a distinct error and status code):
          - Pending Invite proposal targeting this user  → "pending invite proposal"
          - Pending AuthorshipInvitation for user → "pending invitation"
          - Pending Join proposal from the same user     → "already pending" (duplicate)
        """
        from .proposals import ProposalService

        snapshot = crud.snapshots.get_snapshot_by_uuid(db, snapshot_uuid)
        if not snapshot:
            raise ValueError("Graph not found")

        authors = AuthorshipService.get_snapshot_authors(db, snapshot_uuid)
        author_uuids = [author.user_uuid for author in authors]
        if user_uuid in author_uuids:
            raise ValueError("User is already an author of this graph")

        if len(authors) == 0:
            raise ValueError("Graph has no authors")

        # Cross-pipeline collision: any Invite proposal already targets this user
        existing_invite_proposals = crud.proposals.get_proposals_by_kwargs(
            db,
            proposal_status="Pending",
            proposal_type="Invite",
            graph_uuid=snapshot_uuid,
            target_user_uuid=user_uuid,
        )
        if existing_invite_proposals:
            raise ValueError("You have a pending invite proposal for this graph")

        # Cross-pipeline collision: any direct AuthorshipInvitation is open for this user
        existing_invitations = crud.proposals.get_authorship_invitations_by_kwargs(
            db,
            graph_uuid=snapshot_uuid,
            recipient_uuid=user_uuid,
            invitation_status='Pending',
        )
        if existing_invitations:
            raise ValueError("You have a pending invitation to this graph")

        # Same-pipeline duplicate: this user already has a pending Join proposal
        existing_proposal = crud.proposals.get_proposal_by_kwargs(
            db,
            proposal_status="Pending",
            proposal_type="Join",
            proposer_uuid=user_uuid,
            graph_uuid=snapshot_uuid,
            target_user_uuid=None,
            target_graph_uuid=None,
        )
        if existing_proposal:
            raise ValueError("A proposal to request joining graph is already pending")

        proposal_data = schemas.ProposalCreate(
            proposal_type="Join",
            graph_uuid=snapshot_uuid,
            proposer_uuid=user_uuid,
        )
        proposal = ProposalService.create_proposal(db, proposal_data)
        return {"success": True, "proposal_hash": proposal.public_hash}

    @staticmethod
    def remove_coauthor(db: Session, snapshot_uuid: UUID, proposer_uuid: UUID, target_author_uuid: UUID) -> dict:
        """
        Request removal of a coauthor from a snapshot.

        Decision boundary:
          - Sole author: refused outright (cannot leave the graph orphaned).
          - Exactly two authors: no consensus is meaningful (proposer and
            target are the only relevant parties, and the proposer's intent
            is the only signal that matters). Execute directly via the
            remove_author primitive; the proposer becomes the sole author.
          - Three or more authors: create a Remove proposal. Consensus is
            then handled by ProposalService.respond_to_proposal, which on
            approval calls AuthorshipService.remove_author to execute.

        Removing oneself is never permitted via this action — a user who
        wishes to leave must coordinate with their coauthors via a Remove
        proposal (or be removed by a coauthor).
        """
        authors = AuthorshipService.get_snapshot_authors(db, snapshot_uuid)

        author_uuids = [author.user_uuid for author in authors]
        if proposer_uuid not in author_uuids:
            raise ValueError("User is not an author of this graph")
        if proposer_uuid == target_author_uuid:
            raise ValueError("Cannot remove self")
        if target_author_uuid not in author_uuids:
            raise ValueError("Target author is not an author of this graph")

        if len(authors) == 1:
            raise ValueError("Graph has only one author, cannot remove")

        if len(authors) == 2:
            # Two-author branch — no consensus possible, execute directly
            AuthorshipService.remove_author(db, snapshot_uuid, target_author_uuid)
            return {"success": True, "direct": True}

        # Multi-author branch — create Remove proposal and let consensus handle it
        existing_proposal = crud.proposals.get_proposal_by_kwargs(
            db,
            proposal_status="Pending",
            proposal_type="Remove",
            proposer_uuid=proposer_uuid,
            graph_uuid=snapshot_uuid,
            target_user_uuid=target_author_uuid,
            target_graph_uuid=None,
        )
        if existing_proposal:
            raise ValueError("A proposal to remove target author is already pending")

        proposal_data = schemas.ProposalCreate(
            proposal_type="Remove",
            graph_uuid=snapshot_uuid,
            proposer_uuid=proposer_uuid,
            target_user_uuid=target_author_uuid,
        )
        proposal = services.proposals.ProposalService.create_proposal(db, proposal_data)
        return {"success": True, "direct": False, "proposal_hash": proposal.public_hash}

    @staticmethod
    def check_authorization(db: Session, snapshot_uuid: UUID, user_uuid: UUID, action: str) -> bool:
        """Check if user is authorized to perform action on snapshot"""
        from .snapshots import SnapshotService
        return SnapshotService.check_snapshot_authorization(db, snapshot_uuid, user_uuid, action)
