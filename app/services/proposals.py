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
Proposal service layer - Business logic for proposal operations.
Orchestrates CRUD operations and handles business rules.
"""
from sqlalchemy.orm import Session
from typing import List, Union
from datetime import datetime, timezone

from app import services
from .. import crud, schemas, models
from ..utils import utils
from uuid import UUID

class ProposalService:
    
    @staticmethod
    def get_proposal(db: Session, public_hash: str, user_uuid: UUID = None) -> schemas.ProposalRead:
        """Get proposal by hash with assembled consensus"""
        db_proposal = crud.proposals.get_proposal_by_hash(db, public_hash)
        if not db_proposal:
            return None
        return ProposalService._convert_to_read_schema(db, db_proposal, include_votes=True)

    @staticmethod
    def get_user_proposals(db: Session, user_uuid: UUID, pending_only: bool = False, skip: int = 0, limit: int = 100) -> List[schemas.ProposalRead]:
        """Get proposals for a user (only sent)"""
        filters = {"proposer_uuid": user_uuid}
        if pending_only:
            filters["proposal_status"] = "Pending"
        db_proposals = crud.proposals.get_proposals_by_kwargs(db, skip=skip, limit=limit, **filters)
        return [ProposalService._convert_to_read_schema(db, p, include_votes=True) for p in db_proposals]

    @staticmethod
    def _convert_to_read_schema(db: Session, db_proposal: models.GraphProposal, include_votes: bool = False) -> schemas.ProposalRead:
        """Convert database model to read schema with assembled consensus and labels"""
        proposal = schemas.ProposalRead(
            public_hash=db_proposal.public_hash,
            proposal_time=db_proposal.proposal_time,
            proposal_type=db_proposal.proposal_type,
            proposal_status=db_proposal.proposal_status,
            graph_uuid=db_proposal.graph_uuid,
            proposer_uuid=db_proposal.proposer_uuid,
            target_user_uuid=db_proposal.target_user_uuid,
            target_graph_uuid=db_proposal.target_graph_uuid
        )

        if db_proposal.graph:
            proposal.graph_label = db_proposal.graph.version_label

        if db_proposal.target_graph:
            proposal.target_graph_label = db_proposal.target_graph.version_label

        if db_proposal.proposer:
            proposal.proposer_username = db_proposal.proposer.username

        if db_proposal.target_user:
            proposal.target_username = db_proposal.target_user.username

        if not include_votes:
            return proposal

        proposal.consensus, proposal.votes = ProposalService.get_consensus(db, proposal)

        return proposal

    @staticmethod
    def get_consensus(db: Session, proposal: schemas.ProposalRead) -> tuple[schemas.Consensus, dict]:
        """Get consensus and consents for a proposal"""
        consents = crud.proposals.get_consents_by_proposal_hash(db, proposal.public_hash)
        author_count = len(crud.access_control.get_authorship_by_graph_uuid(db, proposal.graph_uuid))

        votes = {}
        for c in consents:
            votes[c.user_uuid] = c.user_vote

        yes_count = sum(1 for c in consents if c.user_vote == 1)
        no_count = sum(1 for c in consents if c.user_vote == -1)

        consensus = schemas.Consensus(
            yes_count=yes_count,
            no_count=no_count,
            remaining_votes=author_count - yes_count - no_count
        )

        return consensus, votes

    @staticmethod
    def get_proposals_for_graph(db: Session, graph_uuid: UUID, pending_only: bool = False, skip: int = 0, limit: int = 100) -> List[schemas.ProposalRead]:
        """Get proposals for a specific graph with consensus and user consent"""
        filters = {"graph_uuid": graph_uuid}
        if pending_only:
            filters["proposal_status"] = "Pending"
        db_proposals = crud.proposals.get_proposals_by_kwargs(db, skip=skip, limit=limit, **filters)
        return [ProposalService._convert_to_read_schema(db, proposal, include_votes=True) for proposal in db_proposals]

    @staticmethod
    def create_proposal(db: Session, proposal_data: schemas.ProposalCreate) -> schemas.ProposalRead:
        """Create proposal with business logic"""

        # Get datetime manually for hash generation
        proposal_time = datetime.now(timezone.utc)
        string_data = (
            f"proposal:{proposal_data.proposal_type}:{proposal_data.graph_uuid}:"
            f"{proposal_data.proposer_uuid}:{proposal_time.isoformat()}"
        )
        if proposal_data.target_graph_uuid:
            string_data += f":{proposal_data.target_graph_uuid}"
        if proposal_data.target_user_uuid:
            string_data += f":{proposal_data.target_user_uuid}"
        public_hash = utils.generate_hash(string_data)

        # Get ids for graph, proposer, target user, and target graph
        graph_id = crud.snapshots.get_snapshot_by_uuid(db, proposal_data.graph_uuid).id
        proposer_id = crud.users.get_user_by_uuid(db, proposal_data.proposer_uuid).id
        target_user_id = crud.users.get_user_by_uuid(db, proposal_data.target_user_uuid).id if proposal_data.target_user_uuid else None
        target_graph_id = crud.snapshots.get_snapshot_by_uuid(db, proposal_data.target_graph_uuid).id if proposal_data.target_graph_uuid else None
        
        db_proposal = crud.proposals.create_proposal_record(
            db=db,
            public_hash=public_hash,
            proposal_type=proposal_data.proposal_type,
            graph_id=graph_id,
            proposer_id=proposer_id,
            target_user_id=target_user_id,
            target_graph_id=target_graph_id,
            graph_uuid=proposal_data.graph_uuid,
            proposer_uuid=proposal_data.proposer_uuid,
            target_user_uuid=proposal_data.target_user_uuid,
            target_graph_uuid=proposal_data.target_graph_uuid,
            proposal_time=proposal_time
        )
        
        db.commit()
        db.refresh(db_proposal)
        return ProposalService._convert_to_read_schema(db, db_proposal, include_votes=False)

    @staticmethod
    def update_proposal_status(db: Session, proposal_hash: str, status: str) -> schemas.ProposalRead:
        """Update proposal status with business logic"""
        db_proposal = crud.proposals.get_proposal_by_hash(db, proposal_hash)
        if not db_proposal:
            raise ValueError("Proposal not found")
            
        crud.proposals.update_proposal_record(db, db_proposal.id, proposal_status=status)
        
        db.commit()
        db.refresh(db_proposal)
        return ProposalService._convert_to_read_schema(db, db_proposal, include_votes=True)

    @staticmethod
    def delete_proposal(db: Session, public_hash: str) -> bool:
        """Delete proposal with business logic"""
        return crud.proposals.delete_proposal_by_hash(db, public_hash)

    @staticmethod
    def _convert_consent_to_read_schema(db_consent: models.ProposalConsent) -> schemas.ProposalConsentRead:
        """Convert database model to consent read schema"""
        return schemas.ProposalConsentRead(
            proposal_hash=db_consent.proposal_hash,
            user_uuid=db_consent.user_uuid,
            consent_date=db_consent.consent_date,
            user_vote=db_consent.user_vote
        )

    @staticmethod
    def create_consent(db: Session, consent_data: schemas.ProposalConsentCreate) -> schemas.ProposalConsentRead:
        """Create a consent record for a proposal"""
        db_proposal = crud.proposals.get_proposal_by_hash(db, consent_data.proposal_hash)
        if not db_proposal:
            raise ValueError("Proposal not found")
            
        user_id = crud.users.get_user_by_uuid(db, consent_data.user_uuid).id

        # Create consent record via CRUD
        db_consent = models.ProposalConsent(
            proposal_id=db_proposal.id,
            proposal_hash=consent_data.proposal_hash,
            user_id=user_id,
            user_uuid=consent_data.user_uuid,
            user_vote=consent_data.user_vote
        )
        db.add(db_consent)
        db.flush()
        db.commit()
        db.refresh(db_consent)
        return ProposalService._convert_consent_to_read_schema(db_consent)

    @staticmethod
    def respond_to_proposal(db: Session, response: schemas.ProposalConsentCreate) -> dict:
        """Process a response to a proposal with all business logic"""

        # Get proposal
        proposal = crud.proposals.get_proposal_by_hash(db, response.proposal_hash)
        if not proposal:
            raise ValueError("Proposal not found")

        # Check if proposal is still pending
        if proposal.proposal_status != "Pending":
            raise ValueError("Proposal is no longer pending")

        # Only authors of the same graph who have not already responded, can respond
        consensus = ProposalService.get_consensus(db, proposal)
        authors = services.authorship.AuthorshipService.get_snapshot_authors(db, proposal.graph_uuid)
        if response.user_uuid not in [author.user_uuid for author in authors]:
            raise ValueError("User is not an author of this graph")
        if response.user_uuid in consensus[1].keys():
            raise ValueError("User has already responded to this proposal")

        # Create consent record
        consent = ProposalService.create_consent(db, response)

        # Execute action depending on proposal_type and consensus
        print(consensus[0], consensus[0].remaining_votes, consensus[0].yes_count, consensus[0].no_count)
        if consensus[0].remaining_votes < 1:
            # Only execute when no remaining votes and majority, otherwise mark as rejected, might expand logic later
            if  consensus[0].yes_count > consensus[0].no_count:
                try:
                    ProposalService.execute_proposal(db, proposal)
                    return {"success": True, "message": "Response Recorded and Proposal executed"}
                except ValueError as e:
                    raise ValueError(f"Error executing proposal: {e}")
            else:
                ProposalService.update_proposal_status(db, proposal.public_hash, "Rejected")
                return {"success": True, "message": "Reponse Recorded and Proposal rejected"}

        db.commit()

        return {"success": True, "message": "Response recorded", "response": consent}

    @staticmethod
    def execute_proposal(db: Session, proposal: schemas.ProposalRead) -> bool:
        """Execute a proposal with business logic"""
        if proposal.proposal_type == "Join":
            services.authorship.AuthorshipService.add_author(db, proposal.graph_uuid, proposal.proposer_uuid)
        
        if proposal.proposal_type == "Invite":
            services.authorship.AuthorshipService.send_authorship_invitation(db, proposal.graph_uuid, proposal.proposer_uuid, proposal.target_user_uuid)

        if proposal.proposal_type == "Remove":
            services.authorship.AuthorshipService.remove_author(db, proposal.graph_uuid, proposal.target_user_uuid)

        if proposal.proposal_type == "Delete":
            crud.snapshots.delete_snapshot_by_uuid(db, proposal.graph_uuid)

        return ProposalService.update_proposal_status(db, proposal.public_hash, "Executed")

    @staticmethod
    def get_consensus(db: Session, proposal: schemas.ProposalBase) -> tuple[schemas.Consensus, dict]:
        """
        Get the current consensus for a proposal
        Ignores initiator and target user's votes and in calculation of remaining votes
        """
        consents = crud.proposals.get_consents_by_proposal_hash(db, proposal.public_hash)

        authors = services.authorship.AuthorshipService.get_snapshot_authors(db, proposal.graph_uuid)
        relevant_parties = [author.user_uuid for author in authors if author.user_uuid not in [proposal.proposer_uuid, proposal.target_user_uuid]]
        if consents:
            votes = {consent.user_uuid: consent.user_vote for consent in consents if consent.user_uuid in relevant_parties}
        else:
            votes = {}
        
        yes_count = sum(1 for vote in votes.values() if vote == 1)
        no_count = sum(1 for vote in votes.values() if vote == -1)
        abstain_count = sum(1 for vote in votes.values() if vote == 0)
        remaining_votes = len(relevant_parties) - yes_count - no_count - abstain_count

        consensus = schemas.Consensus(yes_count=yes_count, no_count=no_count, abstain_count=abstain_count, remaining_votes=remaining_votes)
        return consensus, votes

    @staticmethod
    def get_join_request_with_auth(db: Session, proposal_hash: str, user_uuid: UUID) -> schemas.JoinRequestRead:
        """
        Get a specific join request by hash with authentication
        """
        proposal = ProposalService.get_proposal_with_auth(db, proposal_hash, user_uuid)
        
        # Change shape to JoinRequestRead format and explicitly strip consensus
        join_request = schemas.JoinRequestRead(
            public_hash=proposal.public_hash,
            graph_uuid=proposal.graph_uuid,
            requestor_uuid=proposal.proposer_uuid,
            created_at=proposal.proposal_time,
            proposal_status=proposal.proposal_status,
            graph_label=proposal.graph_label,
            requestor_username=proposal.proposer_username,
        )
        return join_request

    @staticmethod
    def get_join_requests_by_user(db: Session, requestor_uuid: UUID, pending_only: bool = False, skip: int = 0, limit: int = 100) -> List[schemas.JoinRequestRead]:
        """
        Get all join requests for a specific user
        """
        filters = {"proposer_uuid": requestor_uuid, "proposal_type": "Join"}
        if pending_only:
            filters["proposal_status"] = "Pending"
        requests = crud.proposals.get_proposals_by_kwargs(db, skip=skip, limit=limit, **filters)
        
        if not requests:
            return []

        return [schemas.JoinRequestRead(
            public_hash=r.public_hash,
            graph_uuid=r.graph_uuid,
            requestor_uuid=r.proposer_uuid,
            created_at=r.proposal_time,
            proposal_status=r.proposal_status,
            graph_label=r.graph.version_label,
            requestor_username=r.proposer.username,
        ) for r in requests]

    # Refactored 1/3: join moved to POST /snapshots/{uuid}/authors/join in app/api/authorship.py
    # Refactored 2/3: invite moved to POST /snapshots/{uuid}/authors/invite in app/api/authorship.py
    # Refactored 3/3: remove moved to DELETE /snapshots/{uuid}/authors/{user_uuid} in app/api/authorship.py

    @staticmethod
    def get_join_requests_for_graph(db: Session, graph_uuid: UUID, requestor_uuid: UUID) -> List[schemas.JoinRequestRead]:
        """
        Get all past join requests a specific user has made to a specific graph
        Past rejected requests are also included
        """
        join_requests = crud.proposals.get_proposals_by_kwargs(db, proposal_type="Join", proposer_uuid=requestor_uuid, graph_uuid=graph_uuid, target_user_uuid=None, target_graph_uuid=None)
        if not join_requests:
            return []
        
        return [schemas.JoinRequestRead(
            public_hash=join_request.public_hash,
            graph_uuid=join_request.graph_uuid,
            requestor_uuid=join_request.proposer_uuid,
            created_at=join_request.proposal_time,
            proposal_status=join_request.proposal_status,
            graph_label=join_request.graph.version_label,
            requestor_username=join_request.proposer.username,
        ) for join_request in join_requests]

    @staticmethod
    def get_proposals_for_authored_graphs(db: Session, user_uuid: UUID, pending_only: bool = False, skip: int = 0, limit: int = 100) -> List[schemas.ProposalRead]:
        """Get all proposals for graphs where user is an author"""
        # Get all graphs user is author of
        authorships = crud.access_control.get_authorships_by_user_uuid(db, user_uuid)
        graph_uuids = list(set(a.graph_uuid for a in authorships))

        all_proposals = []
        for graph_uuid in graph_uuids:
            filters = {"graph_uuid": graph_uuid}
            if pending_only:
                filters["proposal_status"] = "Pending"
            db_proposals = crud.proposals.get_proposals_by_kwargs(db, skip=skip, limit=limit, **filters)
            for p in db_proposals:
                all_proposals.append(ProposalService._convert_to_read_schema(db, p, include_votes=True))

        return all_proposals

    @staticmethod
    def get_received_invitations(db: Session, user_uuid: UUID, skip: int = 0, limit: int = 100) -> List[schemas.AuthorshipInvitationRead]:
        """Get authorship invitations received by a user"""
        filters = {"recipient_uuid": user_uuid}
        db_invitations = crud.proposals.get_authorship_invitations_by_kwargs(
            db, skip=skip, limit=limit, **filters
        )
        
        if not db_invitations:
            return []
        
        return [schemas.AuthorshipInvitationRead(
            public_hash=inv.public_hash,
            graph_uuid=inv.graph_uuid,
            initiator_uuid=inv.initiator_uuid,
            recipient_uuid=inv.recipient_uuid,
            created_at=inv.created_at,
            invitation_status=inv.invitation_status,
            graph_label=inv.graph.version_label,
            initiator_username=inv.initiator.username,
            recipient_username=inv.recipient.username,
        ) for inv in db_invitations]

    @staticmethod
    def get_invitation_with_auth(db: Session, invitation_hash: str, user_uuid: UUID) -> schemas.AuthorshipInvitationRead:
        """
        Get a single AuthorshipInvitation by hash with recipient-only auth check.
        Slim schema: no consensus (does not apply to direct invitations).
        """
        inv = crud.proposals.get_authorship_invitation_by_kwargs(db, public_hash=invitation_hash)
        if not inv:
            raise ValueError("Invitation not found")
        if inv.recipient_uuid != user_uuid:
            raise ValueError("Not authorized to view this invitation")
        return schemas.AuthorshipInvitationRead(
            public_hash=inv.public_hash,
            graph_uuid=inv.graph_uuid,
            initiator_uuid=inv.initiator_uuid,
            recipient_uuid=inv.recipient_uuid,
            created_at=inv.created_at,
            invitation_status=inv.invitation_status,
            graph_label=inv.graph.version_label,
            initiator_username=inv.initiator.username,
            recipient_username=inv.recipient.username,
        )

    @staticmethod
    def get_proposal_with_auth(db: Session, proposal_hash: str, user_uuid: UUID) -> schemas.ProposalRead:
        """Get proposal by hash with authorization check for graph authors"""
        db_proposal = crud.proposals.get_proposal_by_hash(db, proposal_hash)
        if not db_proposal:
            return ValueError("Proposal not found")
        
        # Check if user is an author of the graph
        authors = crud.access_control.get_authorship_by_graph_uuid(db, db_proposal.graph_uuid)
        author_uuids = [a.user_uuid for a in authors]
        
        if user_uuid not in author_uuids and user_uuid != db_proposal.proposer_uuid:
            raise ValueError("Not authorized to view this proposal")
        
        # Only include votes and consensus for authors
        return ProposalService._convert_to_read_schema(db, db_proposal, include_votes=user_uuid in author_uuids)

    @staticmethod
    def get_proposals_for_graph_with_auth(db: Session, graph_uuid: UUID, user_uuid: UUID, pending_only: bool = False, skip: int = 0, limit: int = 100) -> List[schemas.ProposalRead]:
        """Get proposals for a graph with authorization check"""
        # Check if user is an author of the graph
        authors = crud.access_control.get_authorship_by_graph_uuid(db, graph_uuid)
        author_uuids = [a.user_uuid for a in authors]
        
        if user_uuid not in author_uuids:
            raise ValueError("Not authorized to view proposals for this graph")
        
        return ProposalService.get_proposals_for_graph(db, graph_uuid, pending_only, skip, limit)

    @staticmethod
    def delete_proposal_with_auth(db: Session, proposal_hash: str, user_uuid: UUID) -> bool:
        """Delete proposal with authorization check - only proposer can delete pending proposals"""
        db_proposal = crud.proposals.get_proposal_by_hash(db, proposal_hash)
        if not db_proposal:
            raise ValueError("Proposal not found")
        
        if db_proposal.proposer_uuid != user_uuid:
            raise ValueError("Only the proposer can delete a proposal")
        
        if db_proposal.proposal_status != "Pending":
            raise ValueError("Cannot delete a proposal that is no longer pending")
        
        return ProposalService.delete_proposal(db, proposal_hash)
