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
from typing import List

from app import services
from .. import crud, schemas, models, utils
from uuid import UUID

class ProposalService:
    
    @staticmethod
    def get_proposal(db: Session, public_hash: str) -> models.GraphProposal:
        """Get proposal by hash"""
        return crud.proposals.get_proposal_by_hash(db, public_hash)

    @staticmethod
    def get_user_proposals(db: Session, user_uuid: UUID, skip: int = 0, limit: int = 100) -> List[models.GraphProposal]:
        """Get proposals for a user (both sent and received)"""
        return crud.proposals.get_user_proposals(db, user_uuid, skip=skip, limit=limit)

    @staticmethod
    def create_proposal(db: Session, proposal_data: schemas.ProposalCreate) -> models.GraphProposal:
        """Create proposal with business logic"""
        # Generate public hash - business logic
        string_data = proposal_data.proposal_type + str(proposal_data.graph_uuid) + str(proposal_data.proposer_uuid)
        if proposal_data.target_graph_uuid:
            string_data += str(proposal_data.target_graph_uuid)
        if proposal_data.target_user_uuid:
            string_data += str(proposal_data.target_user_uuid)
        public_hash = utils.generate_hash(string_data)
        
        db_proposal = crud.proposals.create_proposal_record(
            db=db,
            public_hash=public_hash,
            proposal_type=proposal_data.proposal_type,
            graph_uuid=proposal_data.graph_uuid,
            proposer_uuid=proposal_data.proposer_uuid,
            target_user_uuid=proposal_data.target_user_uuid,
            target_graph_uuid=proposal_data.target_graph_uuid,
            status="pending"
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
            
        crud.proposals.update_proposal_record(db, proposal.id, status=status)
        
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
        # Create consent record via CRUD
        db_consent = models.ProposalConsent(
            proposal_hash=consent_data.proposal_hash,
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
        if proposal.proposal_status != "pending":
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
        # TODO: Implement consensus logic

        db.commit()

        return {"message": "Response recorded", "response": consent}
