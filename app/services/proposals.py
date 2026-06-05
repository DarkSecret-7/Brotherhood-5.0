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
Proposal service layer - Business logic for proposal operations.
Orchestrates CRUD operations and handles business rules.
"""
from sqlalchemy.orm import Session
from typing import List, Union
from datetime import datetime, timezone

from app import services
from .. import crud, schemas, models, utils
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
        """Get proposals for a user (both sent and received)"""
        db_proposals = crud.proposals.get_user_proposals(db, user_uuid, pending_only, skip=skip, limit=limit)
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
        author_count = len(crud.access_control.get_authorship_by_graph(db, proposal.graph_id))

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
        db_proposals = crud.proposals.get_proposals_by_graph_uuid(db, graph_uuid, pending_only, skip=skip, limit=limit)
        return [ProposalService._convert_to_read_schema(db, proposal, include_votes=True) for proposal in db_proposals]

    @staticmethod
    def create_proposal(db: Session, proposal_data: schemas.ProposalCreate) -> models.GraphProposal:
        """Create proposal with business logic"""

        # Get datetime manually for hash generation
        proposal_time = datetime.now(timezone.utc)
        string_data = proposal_data.proposal_type + str(proposal_data.graph_uuid) + str(proposal_data.proposer_uuid) + str(proposal_time)
        if proposal_data.target_graph_uuid:
            string_data += str(proposal_data.target_graph_uuid)
        if proposal_data.target_user_uuid:
            string_data += str(proposal_data.target_user_uuid)
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
        return db_proposal

    @staticmethod
    def update_proposal_status(db: Session, proposal_hash: str, status: str) -> models.GraphProposal:
        """Update proposal status with business logic"""
        proposal = crud.proposals.get_proposal_by_hash(db, proposal_hash)
        if not proposal:
            raise ValueError("Proposal not found")
            
        crud.proposals.update_proposal_record(db, proposal.id, proposal_status=status)
        
        db.commit()
        db.refresh(proposal)
        return proposal

    @staticmethod
    def delete_proposal(db: Session, public_hash: str) -> bool:
        """Delete proposal with business logic"""
        return crud.proposals.delete_proposal_by_hash(db, public_hash)

    @staticmethod
    def create_consent(db: Session, consent_data: schemas.ProposalConsentCreate) -> models.ProposalConsent:
        """Create a consent record for a proposal"""
        # Get relevant details
        proposal_id = crud.proposals.get_proposal_by_hash(db, consent_data.proposal_hash).id
        user_id = crud.users.get_user_by_uuid(db, consent_data.user_uuid).id

        # Create consent record via CRUD
        db_consent = models.ProposalConsent(
            proposal_id=proposal_id,
            proposal_hash=consent_data.proposal_hash,
            user_id=user_id,
            user_uuid=consent_data.user_uuid,
            user_vote=consent_data.user_vote
        )
        db.add(db_consent)
        db.flush()
        return db_consent

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
        authors = services.authorship.AuthorshipService.get_snapshot_authors(db, proposal.graph_uuid)
        if response.user_uuid not in [author.user_uuid for author in authors]:
            raise ValueError("User is not an author of this graph")
        if response.user_uuid in [consent.user_uuid for consent in proposal.consents]:
            raise ValueError("User has already responded to this proposal")

        # Create consent record
        consent = ProposalService.create_consent(db, response)

        # Execute action depending on proposal_type and consensus
        consensus = ProposalService.get_consensus(db, proposal)[0]      # Get only consensus
        print(consensus, consensus.remaining_votes, consensus.yes_count, consensus.no_count)
        if consensus.remaining_votes < 1:
            # Only execute when no remaining votes and majority, otherwise mark as rejected, might expand logic later
            if  consensus.yes_count > consensus.no_count:
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
            services.authorship.AuthorshipService.add_author(db, proposal.target_graph_uuid, proposal.target_user_uuid)

        if proposal.proposal_type == "Remove":
            services.authorship.AuthorshipService.remove_author(db, proposal.graph_uuid, proposal.target_user_uuid)

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
    def join_graph(db: Session, graph_uuid: UUID, user_uuid: UUID) -> dict:
        """
        Request to join a graph as an author.
        Creates a Join proposal targeting the graph's authors.
        """
        authors = services.authorship.AuthorshipService.get_snapshot_authors(db, graph_uuid)

        author_uuids = [author.user_uuid for author in authors]
        if user_uuid in author_uuids:
            raise ValueError("User is already an author of this graph")

        if len(authors) == 0:
            raise ValueError("Graph has no authors")

        # Check for existing Join proposal
        existing_proposal = crud.proposals.get_proposal_by_kwargs(db, proposal_status="Pending", proposal_type="Join", proposer_uuid=user_uuid, graph_uuid=graph_uuid, target_user_uuid=None, target_graph_uuid=None)
        if existing_proposal:
            raise ValueError("A proposal to request joining graph is already pending")

        proposal_data = schemas.ProposalCreate(
            proposal_type="Join",
            graph_uuid=graph_uuid,
            proposer_uuid=user_uuid
        )

        proposal = ProposalService.create_proposal(db, proposal_data)

        return {"success": True, "proposal_hash": proposal.public_hash}

    @staticmethod
    def invite_to_graph(db: Session, graph_uuid: UUID, inviter_uuid: UUID, target_user_uuid: UUID) -> dict:
        """
        Invite a user to become an author of a graph.
        If the inviter is the sole author, execute directly.
        If there are multiple authors, create an Invite proposal.
        """
        authors = services.authorship.AuthorshipService.get_snapshot_authors(db, graph_uuid)

        author_uuids = [author.user_uuid for author in authors]
        if inviter_uuid not in author_uuids:
            raise ValueError("User is not an author of this graph")

        if target_user_uuid in author_uuids:
            raise ValueError("Target user is already an author of this graph")

        if len(authors) == 0:
            raise ValueError("Graph has no authors")

        # Check for existing Invite proposal
        existing_proposal = crud.proposals.get_proposal_by_kwargs(db, proposal_status="Pending", proposal_type="Invite", proposer_uuid=inviter_uuid, graph_uuid=graph_uuid, target_user_uuid=target_user_uuid, target_graph_uuid=None)
        if existing_proposal:
            raise ValueError("A proposal to invite target user is already pending")

        if len(authors) == 1:
            # Skip proposal creation if only one author

            snapshot = crud.snapshots.get_snapshot_by_uuid(db, graph_uuid)
            inviter = crud.users.get_user_by_uuid(db, inviter_uuid)
            target_user = crud.users.get_user_by_uuid(db, target_user_uuid)

            invitation = crud.invitations.create_authorship_invitation_record(
                db=db,
                graph_id=snapshot.id,
                graph_uuid=graph_uuid,
                initiator_id=inviter.id,
                initiator_uuid=inviter_uuid,
                recipient_id=target_user.id,
                recipient_uuid=target_user_uuid,
                answered=False
            )
            db.commit()
            return {"success": True, "direct": True}

        proposal_data = schemas.ProposalCreate(
            proposal_type="Invite",
            graph_uuid=graph_uuid,
            proposer_uuid=inviter_uuid,
            target_user_uuid=target_user_uuid
        )

        proposal = ProposalService.create_proposal(db, proposal_data)

        return {"success": True, "direct": False, "proposal_hash": proposal.public_hash}

    @staticmethod
    def remove_from_graph(db: Session, graph_uuid: UUID, proposer_uuid: UUID, target_author_uuid: UUID) -> dict:
        """
        Remove an author from a graph.
        If the proposer is the sole relevant party, execute directly.
        If there are other relevant parties, create a Remove proposal.
        """
        if proposer_uuid == target_author_uuid:
            raise ValueError("Cannot remove self")

        authors = services.authorship.AuthorshipService.get_snapshot_authors(db, graph_uuid)

        author_uuids = [author.user_uuid for author in authors]
        if proposer_uuid not in author_uuids:
            raise ValueError("User is not an author of this graph")

        if target_author_uuid not in author_uuids:
            raise ValueError("Target author is not an author of this graph")

        if len(authors) == 1:
            raise ValueError("Graph has only one author, cannot remove")

        if len(authors) == 2:
            # Skip proposal creation if only two authors
            services.authorship.AuthorshipService.remove_author(db, graph_uuid, target_author_uuid)
            return {"success": True, "direct": True}

        # Check for existing Remove proposal
        existing_proposal = crud.proposals.get_proposal_by_kwargs(db, proposal_status="Pending", proposal_type="Remove", proposer_uuid=proposer_uuid, graph_uuid=graph_uuid, target_user_uuid=target_author_uuid, target_graph_uuid=None)
        if existing_proposal:
            raise ValueError("A proposal to remove target author is already pending")

        proposal_data = schemas.ProposalCreate(
            proposal_type="Remove",
            graph_uuid=graph_uuid,
            proposer_uuid=proposer_uuid,
            target_user_uuid=target_author_uuid
        )

        proposal = ProposalService.create_proposal(db, proposal_data)

        return {"success": True, "direct": False, "proposal_hash": proposal.public_hash}

    @staticmethod
    def get_join_request_for_graph(db: Session, graph_uuid: UUID, requestor_uuid: UUID) -> Union[schemas.JoinRequestRead, None]:
        """
        Get join request for a specific graph by a specific user
        """
        join_request = crud.proposals.get_proposal_by_kwargs(db, proposal_type="Join", proposer_uuid=requestor_uuid, graph_uuid=graph_uuid, target_user_uuid=None, target_graph_uuid=None)
        if not join_request:
            return None

        return schemas.JoinRequestRead(
            public_hash=join_request.public_hash,
            graph_uuid=join_request.graph_uuid,
            requestor_uuid=join_request.proposer_uuid,
            created_at=join_request.proposal_time,
            proposal_status=join_request.proposal_status,
            graph_label=join_request.graph.version_label,
            requestor_username=join_request.proposer.username,
        )
