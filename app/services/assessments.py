"""
Assessment service layer - Business logic for assessment operations.
Orchestrates CRUD operations and handles business rules.
"""
from sqlalchemy.orm import Session
from typing import Optional
from .. import crud, schemas, models, utils

class AssessmentService:
    
    @staticmethod
    def create_capability(db: Session, capability_data: schemas.CapabilityCreate) -> models.Capability:
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
        
        # Generate public hash - business logic
        string_data = str(capability_data.user_uuid) + str(capability_data.snapshot_uuid) + str(assessed_nodes_data)
        public_hash = utils.generate_hash(string_data)
        
        # Get user_id and graph_id from UUIDs
        user = crud.users.get_user_by_uuid(db, capability_data.user_uuid)
        snapshot = crud.snapshots.get_snapshot_by_uuid(db, capability_data.snapshot_uuid)
        
        user_id = user.id if user else None
        graph_id = snapshot.id if snapshot else None
        
        db_capability = crud.assessments.create_capability_record(
            db=db,
            public_hash=public_hash,
            user_uuid=capability_data.user_uuid,
            graph_uuid=capability_data.snapshot_uuid,  # Use snapshot_uuid as graph_uuid
            user_id=user_id,
            graph_id=graph_id,
            assessment_name=capability_data.assessment_name,
            assessment_type=capability_data.assessment_type,
            assessment_version=capability_data.assessment_version,
            assessed_nodes=assessed_nodes_data
        )
        
        db.commit()
        db.refresh(db_capability)
        return db_capability

    @staticmethod
    def delete_capability(db: Session, capability_data: schemas.CapabilityRead) -> bool:
        """Delete capability with business logic"""
        return crud.assessments.delete_capability_by_hash(db, capability_data.public_hash)

    @staticmethod
    def get_capability(db: Session, public_hash: str) -> models.Capability:
        """Get capability by hash"""
        return crud.assessments.get_capability_by_hash(db, public_hash)

    @staticmethod
    def get_latest_capability(db: Session, user_id: int, assessment_name: str, graph_label: str) -> Optional[models.Capability]:
        """Get latest capability by user, assessment name, and graph label"""
        # For now, we'll use a simple approach - this would need the actual graph UUID
        return crud.assessments.get_latest_capability_by_user_and_graph(db, user_id, graph_label, assessment_name)
