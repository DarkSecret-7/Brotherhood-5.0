from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from fastapi.responses import StreamingResponse
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from typing import List
from datetime import timedelta
import json
import io
from .. import crud, schemas, database, utils, models

router = APIRouter()

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")

async def get_current_user(db: Session = Depends(database.get_db), token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        from jose import jwt, JWTError
        payload = jwt.decode(token, utils.SECRET_KEY, algorithms=[utils.ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
        token_data = schemas.TokenData(username=username)
    except JWTError:
        raise credentials_exception
    user = crud.get_user_by_username(db, username=token_data.username)
    if user is None:
        raise credentials_exception
    return user

# --- Auth Endpoints ---

@router.post("/auth/signup", response_model=schemas.UserRead)
def signup(user: schemas.UserCreate, db: Session = Depends(database.get_db)):
    # Check if user already exists
    db_user = crud.get_user_by_username(db, username=user.username)
    if db_user:
        raise HTTPException(status_code=400, detail="Username already registered")
    
    # Check invitation code
    db_invitation = crud.get_invitation_by_code(db, code=user.invitation_code)
    if not db_invitation or db_invitation.is_used:
        raise HTTPException(status_code=400, detail="Invalid or used invitation code")
    
    # Create user
    hashed_password = utils.get_password_hash(user.password)
    new_user = crud.create_user(db, user=user, hashed_password=hashed_password)
    
    # Mark invitation as used
    crud.use_invitation(db, db_invitation)
    
    return new_user

@router.post("/auth/login", response_model=schemas.Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(database.get_db)):
    try:
        user = crud.get_user_by_username(db, username=form_data.username)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect username or password",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        try:
            is_valid = utils.verify_password(form_data.password, user.hashed_password)
        except Exception as e:
            print(f"ERROR: Password verification failed: {e}")
            raise HTTPException(status_code=500, detail="Internal error during password verification")

        if not is_valid:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect username or password",
                headers={"WWW-Authenticate": "Bearer"},
            )
            
        access_token_expires = timedelta(minutes=utils.ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = utils.create_access_token(
            data={"sub": user.username}, expires_delta=access_token_expires
        )
        return {"access_token": access_token, "token_type": "bearer"}
    except HTTPException:
        raise
    except Exception as e:
        print(f"CRITICAL: Login error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

# --- Utility Endpoints (for dev/setup) ---

@router.post("/auth/invitations", response_model=schemas.InvitationRead)
def create_invitation(invitation: schemas.InvitationCreate, db: Session = Depends(database.get_db)):
    # This should ideally be protected, but for now we need a way to create the first invitation
    return crud.create_invitation(db, code=invitation.code)

# --- Protected Endpoints ---

@router.get("/health")
def health_check():
    return {"status": "healthy"}

@router.post("/draft/simplify-prerequisites", response_model=schemas.PrerequisiteSimplifyResponse)
def simplify_prerequisites(request: schemas.PrerequisiteSimplifyRequest, current_user: models.User = Depends(get_current_user)):
    # 1. Build nodes_deps mapping from the provided context
    nodes_deps = {}
    if request.context_nodes:
        for node in request.context_nodes:
            if request.current_node_id and node.local_id == request.current_node_id:
                continue
            nodes_deps[node.local_id] = utils.extract_ids(node.prerequisite)
    
    # 2. Compute reachability
    reachability = utils.get_reachability(nodes_deps)
    
    # 3. Simplify using the tree-based parser
    simplified = utils.simplify_expression(request.expression, reachability)
    
    # Extract redundant IDs
    old_ids = set(utils.extract_ids(request.expression))
    new_ids = set(utils.extract_ids(simplified))
    redundant_ids = list(old_ids - new_ids)
    
    return {
        "simplified_expression": simplified,
        "redundant_ids": redundant_ids
    }

@router.post("/snapshots", response_model=schemas.GraphSnapshotRead)
def create_snapshot(snapshot: schemas.GraphSnapshotCreate, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    # Set created_by to current user for the payload
    snapshot.created_by = current_user.username
    
    # Overwrite Logic:
    # 1. If name (version_label) is provided, check if it exists.
    # 2. If it exists AND overwrite=True, update it.
    # 3. If it exists AND overwrite=False, we return 400 with a specific message for the UI to handle.
    
    if snapshot.version_label:
        existing = crud.get_snapshot_by_label(db, snapshot.version_label)
        if existing:
            # Check ownership before even checking overwrite flag
            # CRITICAL: If the graph has a specific creator (not Unknown/None), 
            # ONLY that creator can overwrite it.
            if existing.created_by and existing.created_by != "Unknown":
                if existing.created_by != current_user.username:
                    raise HTTPException(
                        status_code=403, 
                        detail=f"Permission denied: This graph belongs to '{existing.created_by}'. Please save as a new version."
                    )

            if snapshot.overwrite:
                # User explicitly wants to overwrite because the name matches
                return crud.update_snapshot(db=db, db_snapshot=existing, snapshot_data=snapshot)
            else:
                # Name exists but overwrite not confirmed yet. 
                # Provide specific detail for the UI confirmation dialog.
                raise HTTPException(
                    status_code=400, 
                    detail=f"Confirm overwrite of existing graph '{snapshot.version_label}'"
                )

    return crud.create_snapshot(db=db, snapshot_data=snapshot)

@router.get("/snapshots", response_model=List[schemas.GraphSnapshotSummary])
def list_snapshots(skip: int = 0, limit: int = 100, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    return crud.get_snapshots(db=db, skip=skip, limit=limit)

@router.get("/snapshots/{snapshot_id}", response_model=schemas.GraphSnapshotRead)
def get_snapshot(snapshot_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    try:
        snapshot = crud.get_snapshot(db=db, snapshot_id=snapshot_id)
        if snapshot is None:
            raise HTTPException(status_code=404, detail="Snapshot not found")
        return snapshot
    except Exception as e:
        raise HTTPException(status_code=500, detail="Internal Server Error")

@router.delete("/snapshots/{snapshot_id}")
def delete_snapshot(snapshot_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    # Check ownership
    snapshot = crud.get_snapshot(db, snapshot_id)
    if not snapshot:
        raise HTTPException(status_code=404, detail="Snapshot not found")
        
    # Only allow deletion if the user is the creator
    # If created_by is None or "Unknown" (legacy), we allow deletion (Open Access)
    if snapshot.created_by and snapshot.created_by != "Unknown" and snapshot.created_by != current_user.username:
        raise HTTPException(status_code=403, detail="Not authorized to delete this snapshot")

    success = crud.delete_snapshot(db, snapshot_id)
    if not success:
        raise HTTPException(status_code=404, detail="Snapshot not found")
    return {"message": "Snapshot deleted"}

@router.get("/snapshots/{snapshot_id}/export")
def export_snapshot(snapshot_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    snapshot = crud.get_snapshot(db, snapshot_id)
    if not snapshot:
        raise HTTPException(status_code=404, detail="Snapshot not found")
    
    # Serialize to Pydantic model
    # Use model_validate for Pydantic v2 compatibility
    snapshot_data = schemas.GraphSnapshotRead.model_validate(snapshot)
    
    # Convert to dict
    data = snapshot_data.model_dump()
    
    # Create file stream
    file_content = json.dumps(data, indent=2, default=str)
    
    filename = f"{snapshot.version_label}.knw"
    
    return StreamingResponse(
        io.StringIO(file_content),
        media_type="application/json",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@router.post("/snapshots/import", response_model=schemas.GraphSnapshotRead)
async def import_snapshot(
    overwrite: bool = False,
    file: UploadFile = File(...), 
    db: Session = Depends(database.get_db), 
    current_user: models.User = Depends(get_current_user)
):
    if not file.filename.endswith(".knw"):
        raise HTTPException(status_code=400, detail="Invalid file format. Must be a .knw file")
    
    content = await file.read()
    try:
        data = json.loads(content)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON content")
        
    try:
        # Strip top-level read-only fields that might confuse creation
        data.pop('id', None)
        data.pop('created_at', None)
        data.pop('last_updated', None)
        data.pop('node_count', None)
        
        # Ensure metadata defaults if missing
        if 'base_graph' not in data:
            data['base_graph'] = None
        
        if 'created_by' not in data:
            data['created_by'] = "Unknown"

        # Create a new snapshot from the data
        snapshot_in = schemas.GraphSnapshotCreate(**data)
        
        # Apply overwrite flag from query param
        snapshot_in.overwrite = overwrite
        
    except Exception as e:
         raise HTTPException(status_code=400, detail=f"Invalid graph data: {str(e)}")

    # Check for existing snapshot with same version_label
    if snapshot_in.version_label:
        existing = crud.get_snapshot_by_label(db, snapshot_in.version_label)
        if existing:
            if overwrite:
                return crud.update_snapshot(db=db, db_snapshot=existing, snapshot_data=snapshot_in)
            else:
                # 409 Conflict is appropriate for resource already exists
                raise HTTPException(status_code=409, detail=f"Snapshot '{snapshot_in.version_label}' already exists. Confirm overwrite?")

    return crud.create_snapshot(db=db, snapshot_data=snapshot_in)
