from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from typing import List, Optional, Union
from datetime import timedelta
import json
import io
import os
import smtplib
from email.message import EmailMessage
from .. import crud, schemas, database, utils, models

# Import self-assessment module (located in root)
# Note: Self-assessment logic has been removed from main API.

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

@router.get("/snapshots/search", response_model=List[schemas.GraphSnapshotSummary])
def search_snapshots(q: str, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    return crud.search_snapshots(db, query=q)

@router.get("/auth/me", response_model=schemas.UserRead)
async def read_users_me(current_user: schemas.UserRead = Depends(get_current_user)):
    return current_user

@router.put("/auth/me", response_model=schemas.UserRead)
async def update_user_me(user_update: schemas.UserProfileUpdate, current_user: models.User = Depends(get_current_user), db: Session = Depends(database.get_db)):
    updated_user = crud.update_user(db, current_user, user_update)
    return updated_user

@router.put("/auth/me/password", status_code=status.HTTP_204_NO_CONTENT)
async def update_user_password(password_update: schemas.UserPasswordUpdate, current_user: models.User = Depends(get_current_user), db: Session = Depends(database.get_db)):
    # Verify old password
    if not utils.verify_password(password_update.old_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect old password")
    
    # Update new password
    current_user.hashed_password = utils.get_password_hash(password_update.new_password)
    db.add(current_user)
    db.commit()
    return

@router.delete("/auth/me", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user_me(current_user: models.User = Depends(get_current_user), db: Session = Depends(database.get_db)):
    deleted = crud.delete_user_by_username(db, current_user.username)
    if not deleted:
        raise HTTPException(status_code=400, detail="Could not delete user")
    return

@router.post("/auth/logout")
async def logout():
    response = JSONResponse(content={"message": "Logged out successfully"})
    response.delete_cookie("access_token")
    return response

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
        # Log error to file for debugging since stdout might be lost
        try:
            with open("login_error.log", "a") as f:
                import traceback
                f.write(f"Login error: {str(e)}\n")
                f.write(traceback.format_exc())
                f.write("\n" + "-"*20 + "\n")
        except:
            pass
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


@router.post("/contact", response_model=schemas.ContactFormResponse)
def contact_form(payload: schemas.ContactFormRequest):
    to_email = os.getenv("EMAIL_USER")
    from_email = os.getenv("EMAIL_USER")
    smtp_host = os.getenv("EMAIL_HOST")
    smtp_port = int(os.getenv("EMAIL_PORT", "587"))
    smtp_user = os.getenv("EMAIL_USER")
    smtp_password = os.getenv("EMAIL_PASSWORD")
    smtp_use_tls = os.getenv("EMAIL_USE_TLS", "true").lower() in ("1", "true", "yes")

    if not to_email:
        raise HTTPException(status_code=500, detail="EMAIL_USER is not configured")
    if not from_email:
        raise HTTPException(status_code=500, detail="EMAIL_USER is not configured")
    if not smtp_host:
        raise HTTPException(status_code=500, detail="EMAIL_HOST is not configured")

    if not payload.name.strip() or not payload.email.strip() or not payload.message.strip():
        raise HTTPException(status_code=400, detail="Name, email, and message are required")

    msg = EmailMessage()
    msg["Subject"] = f"Brotherhood contact form: {payload.name}"
    msg["From"] = from_email
    msg["To"] = to_email
    msg["Reply-To"] = payload.email.strip()
    msg.set_content(
        "\n".join(
            [
                "New message from the Brotherhood landing page contact form.",
                "",
                f"Name: {payload.name.strip()}",
                f"Email: {payload.email.strip()}",
                "",
                "Message:",
                payload.message.strip(),
                "",
            ]
        )
    )

    try:
        with smtplib.SMTP(smtp_host, smtp_port, timeout=15) as server:
            server.ehlo()
            if smtp_use_tls:
                server.starttls()
                server.ehlo()
            if smtp_user and smtp_password:
                server.login(smtp_user, smtp_password)
            server.send_message(msg)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to send email: {str(e)}")

    return {"ok": True}

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
def read_snapshots(skip: int = 0, limit: int = 100, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    snapshots = crud.get_snapshots(db, skip=skip, limit=limit)
    return snapshots

@router.get("/public/snapshots", response_model=List[schemas.GraphSnapshotSummary])
def read_public_snapshots(skip: int = 0, limit: int = 100, db: Session = Depends(database.get_db)):
    snapshots = crud.get_public_snapshots(db, skip=skip, limit=limit)
    return snapshots

@router.get("/public/snapshots/{graphLabel}", response_model=schemas.GraphSnapshotRead)
def read_public_snapshot(graphLabel: str, db: Session = Depends(database.get_db)):
    snapshot = crud.get_snapshot_by_label(db, graphLabel=graphLabel)
    if snapshot is None:
        raise HTTPException(status_code=404, detail="Snapshot not found")
    if not snapshot.is_public:
        raise HTTPException(status_code=403, detail="Snapshot is not public")
    return snapshot

@router.get("/snapshots/{graphLabel}/read", response_model=schemas.GraphSnapshotRead)
def get_snapshot(graphLabel: str, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    try:
        snapshot = crud.get_snapshot_by_label(db=db, graphLabel=graphLabel)
        if snapshot is None:
            raise HTTPException(status_code=404, detail="Snapshot not found")
        return snapshot
    except Exception as e:
        raise HTTPException(status_code=500, detail= str(e))

@router.patch("/snapshots/{graphLabel}", response_model=schemas.GraphSnapshotRead)
def update_snapshot_metadata(
    graphLabel: str, 
    update_data: schemas.GraphSnapshotUpdate, 
    db: Session = Depends(database.get_db), 
    current_user: models.User = Depends(get_current_user)
):
    snapshot = crud.get_snapshot_by_label(db=db, graphLabel=graphLabel)
    if not snapshot:
        raise HTTPException(status_code=404, detail="Snapshot not found")
    
    # Check ownership
    # Only allow update if the user is the creator or if it's an "Open" graph (created_by is None/Unknown)
    # AND the user is claiming it or just editing it.
    if snapshot.created_by and snapshot.created_by != "Unknown":
        if snapshot.created_by != current_user.username:
            raise HTTPException(status_code=403, detail="Not authorized to edit this graph")

    # Check for name conflict if version_label is being changed
    if update_data.version_label and update_data.version_label != snapshot.version_label:
        existing = crud.get_snapshot_by_label(db=db, graphLabel=update_data.version_label)
        if existing:
            raise HTTPException(status_code=400, detail=f"Graph with label '{update_data.version_label}' already exists.")

    return crud.update_snapshot_metadata(db=db, db_snapshot=snapshot, snapshot_update=update_data)  

@router.delete("/snapshots/{graphLabel}")
def delete_snapshot(graphLabel: str, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    # Check ownership
    snapshot = crud.get_snapshot_by_label(db=db, graphLabel=graphLabel)
    if not snapshot:
        raise HTTPException(status_code=404, detail="Snapshot not found")
        
    # Only allow deletion if the user is the creator
    # If created_by is None or "Unknown" (legacy), we allow deletion (Open Access)
    if snapshot.created_by and snapshot.created_by != "Unknown" and snapshot.created_by != current_user.username:
        raise HTTPException(status_code=403, detail="Not authorized to delete this snapshot")

    success = crud.delete_snapshot_by_label(db=db, graphLabel=graphLabel)
    if not success:
        raise HTTPException(status_code=404, detail="Snapshot not found")
    return {"message": "Snapshot deleted"}

@router.get("/snapshots/{graphLabel}/export")
def export_snapshot(graphLabel: str, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    snapshot = crud.get_snapshot_by_label(db=db, graphLabel=graphLabel)
    if not snapshot:
        raise HTTPException(status_code=404, detail="Snapshot not found")
    
    # Serialize to Pydantic model
    # Use model_validate for Pydantic v2 compatibility
    snapshot_data = schemas.GraphSnapshotRead.model_validate(snapshot)
    
    # Convert to dict
    data = snapshot_data.model_dump()
    
    # Create file stream
    file_content = json.dumps(data, indent=2, default=str)
    
    filename = f"{graphLabel}.knw"
    
    return StreamingResponse(
        io.StringIO(file_content),
        media_type="application/json",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@router.post("/snapshots/{graphLabel}/import", response_model=schemas.GraphSnapshotRead)
async def import_snapshot(
    graphLabel: str,
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

        # Handle redirects mapping for import
        if 'redirects' in data and isinstance(data['redirects'], list):
            # If it's the Read format (list of objects), convert to Create format (dict old_id -> new_id)
            redirects_map = {}
            for r in data['redirects']:
                if isinstance(r, dict) and 'old_local_id' in r and 'new_local_id' in r:
                    redirects_map[str(r['old_local_id'])] = r['new_local_id']
            data['redirects'] = redirects_map

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
