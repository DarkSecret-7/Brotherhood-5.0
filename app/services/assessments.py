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
Assessment service layer - Business logic for assessment operations.
Orchestrates CRUD operations and handles business rules.
"""
from datetime import datetime
from sqlalchemy.orm import Session
from typing import Optional
from .. import crud, schemas, models
from ..utils import utils
from uuid import UUID

# Import self-assessment module (located in root)
try:
    from self_assessment import assessment as sa_logic, models as sa_models
except ImportError:
    import sys
    import os
    sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
    from self_assessment import assessment as sa_logic, models as sa_models

class AssessmentService:

    @staticmethod
    def _convert_to_read_schema(db_capability: models.Capability) -> schemas.CapabilityRead:
        """Convert database model to read schema"""
        return schemas.CapabilityRead(
            public_hash=db_capability.public_hash,
            snapshot_uuid=db_capability.graph_uuid,
            user_uuid=db_capability.user_uuid,
            assessment_name=db_capability.assessment_name,
            assessment_type=db_capability.assessment_type,
            assessment_version=db_capability.assessment_version,
            assessment_date=db_capability.assessment_date,
            assessed_nodes=[
                schemas.Assessment(
                    snapshot_uuid=a["snapshot_uuid"],
                    node_id=a["node_id"],
                    evaluation=a["evaluation"]
                ) for a in db_capability.assessed_nodes
            ]
        )

    @staticmethod
    def perform_self_assessment(db: Session, request: schemas.SelfAssessmentRequest, user: models.User) -> schemas.CapabilityRead:
        # Get graph from database
        graph = crud.snapshots.get_snapshot_by_uuid(db, request.graph_uuid)
        if not graph:
            raise ValueError("Graph not found")
        
        # 1. Format proof inputs for SelfAssessment module
        proof = [
            sa_models.ProofInput(node_id=pi.node_id, value=pi.value)
            for pi in request.proof_inputs
        ]
        
        # 2. Call assessment module logic
        # The sa_logic now handles the graph SQLAlchemy model and user model directly
        capability_obj = sa_logic.perform_assessment(
            graph_data=graph,
            proof_inputs=proof,
            user_reference=user
        )

        # 3. Format assessed nodes for the database (using our schema)
        assessed_nodes = [
            schemas.Assessment(
                snapshot_uuid=capability_obj.graph_uuid,
                node_id=n.node_id,
                evaluation={"value": n.evaluation}
            ) for n in capability_obj.assessed_nodes
        ]
        
        # 4. Create new capability record and return as schema
        return AssessmentService.create_capability(
            db,
            capability_data=schemas.CapabilityCreate(
                user_uuid=user.public_uuid,
                snapshot_uuid=capability_obj.graph_uuid,
                assessment_name=capability_obj.assessment_name,
                assessment_type=capability_obj.assessment_type,
                assessment_version=capability_obj.version,
                assessed_nodes=assessed_nodes
            )
        )

    @staticmethod
    def create_capability(db: Session, capability_data: schemas.CapabilityCreate) -> schemas.CapabilityRead:
        """Create capability with business logic"""
        # Convert Assessment objects to dictionaries and UUIDs to strings for JSON serialization
        assessed_nodes_data = []
        for assessment in capability_data.assessed_nodes:
            assessment_dict = {
                "snapshot_uuid": str(assessment.snapshot_uuid),
                "node_id": assessment.node_id,
                "evaluation": assessment.evaluation
            }
            assessed_nodes_data.append(assessment_dict)
        
        # Get user_id and graph_id from UUIDs
        user = crud.users.get_user_by_uuid(db, capability_data.user_uuid)
        snapshot = crud.snapshots.get_snapshot_by_uuid(db, capability_data.snapshot_uuid)
        
        if not user or not snapshot:
            raise ValueError("User or Graph not found for capability creation")

        # Generate public hash - business logic
        # Using a deterministic combination of user_id, graph_id, and data
        assessment_date = datetime.now()
        string_data = f"{user.public_uuid}-{snapshot.public_uuid}-{capability_data.assessment_name}-{capability_data.assessment_type}-{capability_data.assessment_version}-{assessed_nodes_data}-{assessment_date}"
        public_hash = utils.generate_hash(string_data)
        
        db_capability = crud.assessments.create_capability_record(
            db=db,
            public_hash=public_hash,
            user_uuid=capability_data.user_uuid,
            graph_uuid=capability_data.snapshot_uuid,
            user_id=user.id,
            graph_id=snapshot.id,
            assessment_name=capability_data.assessment_name,
            assessment_type=capability_data.assessment_type,
            assessment_version=capability_data.assessment_version,
            assessment_date=assessment_date,        # Assessment date generated here to match the time in generated hash
            assessed_nodes=assessed_nodes_data
        )
        
        db.commit()
        db.refresh(db_capability)
        return AssessmentService._convert_to_read_schema(db_capability)

    @staticmethod
    def delete_capability(db: Session, capability_data: schemas.CapabilityRead) -> bool:
        """Delete capability with business logic"""
        return crud.assessments.delete_capability_by_hash(db, capability_data.public_hash)

    @staticmethod
    def delete_capabilities_by_user_and_graph(db: Session, user_uuid: str, graph_uuid: UUID, assessment_name: str) -> None:
        """Delete all capabilities for a user, assessment name, and graph label"""
        # Get IDs form UUIDs
        user_id = crud.users.get_user_by_uuid(db, user_uuid).id
        graph_id = crud.snapshots.get_snapshot_by_uuid(db, graph_uuid).id
        crud.assessments.delete_capabilities_by_user_and_graph(db, user_id, graph_id, assessment_name)

    @staticmethod
    def get_capability(db: Session, public_hash: str) -> schemas.CapabilityRead:
        """Get capability by hash"""
        db_capability = crud.assessments.get_capability_by_hash(db, public_hash)
        if not db_capability:
            return None
        return AssessmentService._convert_to_read_schema(db_capability)

    @staticmethod
    def get_latest_capability(db: Session, user_uuid: UUID, graph_uuid: UUID, assessment_name: str) -> Optional[schemas.CapabilityRead]:
        """Get latest capability by user, assessment name, and graph label"""
        # Get IDs form UUIDs
        user_id = crud.users.get_user_by_uuid(db, user_uuid).id
        graph_id = crud.snapshots.get_snapshot_by_uuid(db, graph_uuid).id

        db_capability = crud.assessments.get_latest_capability_by_user_and_graph(db, user_id, graph_id, assessment_name)

        if not db_capability:
            return None

        return AssessmentService._convert_to_read_schema(db_capability)
