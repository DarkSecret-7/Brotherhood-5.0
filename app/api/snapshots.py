"""
Snapshot CRUD endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import UUID
from .. import services, schemas, models, database
from .auth import get_current_user

router = APIRouter()

@router.post("/snapshots", response_model=schemas.GraphSnapshotRead)
def create_snapshot(snapshot: schemas.GraphSnapshotCreate, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    return services.snapshots.SnapshotService.create_snapshot(db=db, snapshot_data=snapshot)

@router.get("/snapshots", response_model=List[schemas.GraphSnapshotRead])
def read_snapshots(skip: int = 0, limit: int = 100, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    return services.snapshots.SnapshotService.get_user_accessible_snapshots(db, current_user.id, skip=skip, limit=limit)

@router.get("/public/snapshots", response_model=List[schemas.GraphSnapshotRead])
def read_public_snapshots(skip: int = 0, limit: int = 100, db: Session = Depends(database.get_db)):
    return services.snapshots.SnapshotService.get_public_snapshots(db, skip=skip, limit=limit)

@router.get("/snapshots/{snapshot_uuid}", response_model=schemas.GraphSnapshotRead)
def get_snapshot(
    snapshot_uuid: UUID, 
    action: str = "read",  # Default to read-only
    db: Session = Depends(database.get_db), 
    current_user: models.User = Depends(get_current_user)
):
    """
    Get snapshot with specified action:
    - "read": Read-only access (always allowed)
    - "fetch": Read for editing (registered users only) 
    - "write": Update/overwrite access (authors only)
    - "delete": Delete access (authors only)
    """
    user_id = current_user.id if current_user else None
    return services.snapshots.SnapshotService.get_snapshot_with_action(db, snapshot_uuid, user_id, action)

@router.get("/public/snapshots/{snapshot_uuid}", response_model=schemas.GraphSnapshotRead)
def read_public_snapshot(snapshot_uuid: UUID, db: Session = Depends(database.get_db)):
    return services.snapshots.SnapshotService.get_public_snapshot(db, snapshot_uuid)

# Legacy endpoints for backward compatibility
@router.get("/snapshots/{snapshot_uuid}/read", response_model=schemas.GraphSnapshotRead)
def get_snapshot_legacy(snapshot_uuid: UUID, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    """Legacy endpoint - use GET /snapshots/{uuid}?action=read instead"""
    user_id = current_user.id if current_user else None
    return services.snapshots.SnapshotService.get_snapshot_with_action(db, snapshot_uuid, user_id, "read")

@router.patch("/snapshots/{snapshot_uuid}", response_model=schemas.GraphSnapshotRead)
def update_snapshot(
    snapshot_uuid: UUID, 
    update_data: schemas.GraphSnapshotUpdate, 
    db: Session = Depends(database.get_db), 
    current_user: models.User = Depends(get_current_user)
):
    """Update snapshot - requires 'write' action authorization"""
    user_id = current_user.id if current_user else None
    # Check write authorization before updating
    if not services.snapshots.SnapshotService.check_snapshot_authorization(db, snapshot_uuid, user_id, "write"):
        raise HTTPException(status_code=403, detail="Not authorized to update this snapshot")
    
    return services.snapshots.SnapshotService.update_snapshot(db, snapshot_uuid, update_data)

@router.delete("/snapshots/{snapshot_uuid}")
def delete_snapshot(snapshot_uuid: UUID, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    """Delete snapshot - requires 'delete' action authorization"""
    user_id = current_user.id if current_user else None
    # Check delete authorization before deleting
    if not services.snapshots.SnapshotService.check_snapshot_authorization(db, snapshot_uuid, user_id, "delete"):
        raise HTTPException(status_code=403, detail="Not authorized to delete this snapshot")
    
    success = services.snapshots.SnapshotService.delete_snapshot(db, snapshot_uuid)
    if not success:
        raise HTTPException(status_code=404, detail="Snapshot not found")
    
    return {"message": "Snapshot deleted successfully"}
