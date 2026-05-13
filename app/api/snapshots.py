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
Snapshot CRUD endpoints
"""
import json
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from typing import List, Union
from uuid import UUID
from .. import services, schemas, models, database
from .auth import get_current_user

router = APIRouter()

@router.post("/snapshots", response_model=schemas.GraphSnapshotRead)
def create_snapshot(snapshot: schemas.GraphSnapshotCreate, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    return services.snapshots.SnapshotService.create_snapshot(db=db, snapshot_data=snapshot)

@router.get("/snapshots", response_model=Union[List[schemas.GraphSnapshotRead], List[schemas.GraphSnapshotMeta]])
def read_snapshots(
    skip: int = 0,
    limit: int = 100,
    public_only: bool = True,
    action: str = "read",
    metadata_only: bool = True,
    db: Session = Depends(database.get_db)
    # current_user moved to internal to support no auth for public graphs
):
    """
    Get snapshots list - unified bulk endpoint
    - public_only=true: Returns only public snapshots (no auth required)
    - public_only=false (default): Returns user accessible snapshots
    - action: "read" | "fetch" | "assess" - authorization level required
    - metadata_only=true: Returns only metadata (lightweight)
    """

    if public_only:
        snapshots = services.snapshots.SnapshotService.get_public_snapshots(db, skip=skip, limit=limit)
    else:
        current_user = get_current_user()
        user_id = current_user.id if current_user else None

        snapshots = services.snapshots.SnapshotService.get_user_accessible_snapshots(db, user_id, action=action, skip=skip, limit=limit)

    if metadata_only:
        # Return only metadata fields
        return [services.snapshots.SnapshotService._extract_metadata(db, s.public_uuid) for s in snapshots]

    return snapshots

@router.get("/snapshots/{snapshot_uuid}", response_model=Union[schemas.GraphSnapshotRead, schemas.GraphSnapshotMeta])
def get_snapshot(
    snapshot_uuid: UUID,
    action: str = "read",
    public: bool = True,
    metadata_only: bool = False,
    db: Session = Depends(database.get_db),
    # current_user moved to internal to support no auth for public graphs
):
    """
    Get single snapshot - unified endpoint
    - action: "read" | "fetch" | "assess"
    - public=true: Skip auth, return public snapshot
    - metadata_only=true: Return only metadata fields
    """

    if public:
        snapshot = services.snapshots.SnapshotService.get_public_snapshot(db, snapshot_uuid)
    else:
        current_user = get_current_user()
        user_id = current_user.id if current_user else None

        snapshot = services.snapshots.SnapshotService.get_snapshot_with_action(db, snapshot_uuid, user_id, action)

    if metadata_only:
        return services.snapshots.SnapshotService._extract_metadata(db, snapshot_uuid)

    return snapshot

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


@router.get("/snapshots/{snapshot_uuid}/export")
def export_snapshot(
    snapshot_uuid: UUID,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Export snapshot as .knw file - requires 'read' action authorization"""
    user_id = current_user.id if current_user else None
    
    # Check read authorization
    if not services.snapshots.SnapshotService.check_snapshot_authorization(db, snapshot_uuid, user_id, "read"):
        raise HTTPException(status_code=403, detail="Not authorized to export this snapshot")
    
    try:
        # Get snapshot data for export
        snapshot_data = services.snapshots.SnapshotService.export_snapshot(db, snapshot_uuid)
        
        # Create export file
        from ..utils import create_export_file
        graph_label = snapshot_data.get('version_label') or f"graph_{snapshot_uuid}"
        return create_export_file(snapshot_data, graph_label)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/snapshots/import", response_model=schemas.GraphSnapshotRead)
def import_snapshot(
    file: UploadFile = File(...),
    overwrite: bool = False,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Import snapshot from .knw file"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    # Validate file extension
    from ..utils import validate_import_file, parse_import_content
    if not validate_import_file(file.filename):
        raise HTTPException(status_code=400, detail="Invalid file format. Only .knw files are allowed.")
    
    try:
        # Read and parse file content
        content = file.file.read()
        import_data = parse_import_content(content)
        
        # Import the snapshot
        result = services.snapshots.SnapshotService.import_snapshot(
            db=db,
            import_data=import_data,
            current_user=current_user,
            overwrite=overwrite
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON content in file")
