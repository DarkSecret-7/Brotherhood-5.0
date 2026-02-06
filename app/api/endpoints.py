from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from typing import List
from datetime import timedelta
from .. import crud, schemas, database, utils, models

router = APIRouter()

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/v1/auth/login")

async def get_current_user(db: Session = Depends(database.get_db), token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = utils.jwt.decode(token, utils.SECRET_KEY, algorithms=[utils.ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
        token_data = schemas.TokenData(username=username)
    except utils.JWTError:
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
    user = crud.get_user_by_username(db, username=form_data.username)
    if not user or not utils.verify_password(form_data.password, user.hashed_password):
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
    return crud.create_snapshot(db=db, snapshot_data=snapshot)

@router.get("/snapshots", response_model=List[schemas.GraphSnapshotSummary])
def list_snapshots(skip: int = 0, limit: int = 100, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    return crud.get_snapshots(db=db, skip=skip, limit=limit)

@router.get("/snapshots/{snapshot_id}", response_model=schemas.GraphSnapshotRead)
def get_snapshot(snapshot_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    snapshot = crud.get_snapshot(db=db, snapshot_id=snapshot_id)
    if snapshot is None:
        raise HTTPException(status_code=404, detail="Snapshot not found")
    return snapshot

@router.delete("/snapshots/{snapshot_id}")
def delete_snapshot(snapshot_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    success = crud.delete_snapshot(db, snapshot_id)
    if not success:
        raise HTTPException(status_code=404, detail="Snapshot not found")
    return {"message": "Snapshot deleted"}

