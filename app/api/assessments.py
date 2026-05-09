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

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from .. import services, schemas, database, models
from uuid import UUID

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
from .auth import get_current_user

@router.post("/capabilities", response_model=schemas.CapabilityRead)
def create_capability(
    capability: schemas.CapabilityCreate,
    db: Session = Depends(database.get_db)
):
    """
    Generic endpoint to save any type of assessment/capability.
    Expects metadata and flexible evaluation data (assessed_nodes).
    """
    return services.assessments.AssessmentService.create_capability(db, capability_data=capability)

@router.post("/self-assessment", response_model=schemas.CapabilityRead)
def perform_self_assessment(
    request: schemas.SelfAssessmentRequest,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Perform a self-assessment using the service layer
    """
    # 1. Fetch graph data
    snapshot = services.snapshots.SnapshotService.get_public_snapshot(db, snapshot_uuid=request.graph_uuid)    
    if not snapshot:
        raise HTTPException(status_code=404, detail="Graph not found")
    
    return services.assessments.AssessmentService.perform_self_assessment(db, request, current_user)

@router.get("/self-assessment/{graph_uuid}/latest", response_model=Optional[schemas.CapabilityRead])
def get_latest_self_assessment(
    graph_uuid: UUID,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user)
):
    # Fetch latest capability via service layer
    latest = services.assessments.AssessmentService.get_latest_capability(
        db,
        user_uuid=current_user.public_uuid,
        graph_uuid=graph_uuid,
        assessment_name=sa_logic.ASSESSMENT_NAME
    )
    return latest

@router.delete("/self-assessment/{graph_uuid}/delete")
def delete_self_assessment(
    graph_uuid: UUID,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user)
):
    # Delete all capabilities for this user and graph_uuid via services layer
    services.assessments.AssessmentService.delete_capabilities_by_user_and_graph(
        db,
        user_uuid=current_user.public_uuid,
        graph_uuid=graph_uuid,
        assessment_name=sa_logic.ASSESSMENT_NAME
    )

    return True