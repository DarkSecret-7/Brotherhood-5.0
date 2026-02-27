from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from .. import crud, schemas, database, models, utils

# Import self-assessment module (located in root)
try:
    from self_assessment import assessment as sa_logic, models as sa_models
except ImportError:
    import sys
    import os
    sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
    from self_assessment import assessment as sa_logic, models as sa_models

router = APIRouter()

# Reuse get_current_user dependency
from .endpoints import get_current_user

@router.post("/capabilities", response_model=schemas.CapabilityRead)
def create_capability(
    capability: schemas.CapabilityCreate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Generic endpoint to save any type of assessment/capability.
    Expects metadata and flexible evaluation data (assessed_nodes).
    """
    return crud.create_capability(db, user_id=current_user.id, capability_data=capability)

@router.post("/self-assessment", response_model=schemas.CapabilityRead)
def perform_self_assessment(
    request: schemas.SelfAssessmentRequest,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user)
):
    # 1. Fetch graph data
    snapshot = crud.get_snapshot_by_label(db, graphLabel=request.graph_label)    
    if not snapshot:
        raise HTTPException(status_code=404, detail="Graph not found")
    
    # Format graph data for assessment module
    graph_data = {
        "nodes": [
            {
                "local_id": n.local_id,
                "title": n.title,
                "prerequisite": n.prerequisite
            } for n in snapshot.nodes
        ]
    }
    
    # 2. Format proof inputs for SelfAssessmentRequest
    proof = [
        sa_models.ProofInput(node_id=pi.node_id, value=pi.value)
        for pi in request.proof_inputs
    ]
    
    # 3. Call assessment module logic
    capability_obj = sa_logic.perform_assessment(
        graph_data=graph_data,
        graph_label=request.graph_label,
        proof_inputs=proof,
        user_reference=current_user.username
    )

    assessed_nodes = [
        schemas.Assessment(
            node_id=n.node_id,
            evaluation=dict(value=n.evaluation)
        ) for n in capability_obj.assessed_nodes
    ]
    
    # Check if previous capability exists and update or create new
    previous_capability = crud.get_latest_capability(db, user_id=current_user.id, assessment_name=sa_logic.ASSESSMENT_NAME, graph_label=capability_obj.graph_label)
    if previous_capability:
        # Update existing capability
        current_capability = crud.update_capability(
            db,
            user_id=current_user.id,
            assessment_name=capability_obj.assessment_name,
            db_capability=previous_capability, 
            capability_update=schemas.CapabilityUpdate(
                graph_label=capability_obj.graph_label,
                assessed_nodes=assessed_nodes
            )
        )
    else:
        # Create new capability
        current_capability = crud.create_capability(
            db, 
            user_id=current_user.id, 
            capability_data=schemas.CapabilityCreate(
                assessment_name=capability_obj.assessment_name,
                assessment_type=capability_obj.assessment_type,
                version=capability_obj.version,
                graph_label=capability_obj.graph_label,
                assessed_nodes=assessed_nodes
            )
        )
    
    return current_capability

@router.get("/self-assessment/{graph_label}/latest", response_model=Optional[schemas.CapabilityRead])
def get_latest_self_assessment(
    graph_label: str,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user)
):
    # 1. Fetch latest capability for this user and graph_label
    latest = crud.get_latest_capability(db, user_id=current_user.id, assessment_name=sa_logic.ASSESSMENT_NAME, graph_label=graph_label)   
    return latest

@router.delete("/self-assessment/{graph_label}/delete")
def delete_self_assessment(
    graph_label: str,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user)
):
    # 1. Fetch graph data to generate hash
    snapshot = crud.get_snapshot_by_label(db, graphLabel=graph_label)
    if not snapshot:
        raise HTTPException(status_code=404, detail="Graph not found")
    
    graph_data = {
        "nodes": [
            {
                "local_id": n.local_id,
                "title": n.title,
                "prerequisite": n.prerequisite
            } for n in snapshot.nodes
        ]
    }
        
    # 2. Delete all capabilities for this user and graph_label
    crud.delete_capabilities(db, user_id=current_user.id, assessment_name=sa_logic.ASSESSMENT_NAME, graph_label=graph_label)
    
    return {"message": "All self-assessments for this graph have been cleared"}
