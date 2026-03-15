"""
Authentication endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import timedelta
from .. import services, schemas, database, utils, models
from uuid import UUID

router = APIRouter()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")

async def get_current_user(db: Session = Depends(database.get_db), token: str = Depends(oauth2_scheme)):
    """FastAPI dependency for getting current user"""
    try:
        token_data = utils.get_current_user_token_data(token)
        user = services.users.UserService.get_user(db, user_uuid=token_data.user_uuid)
        if user is None:
            raise HTTPException(
                status_code=401,
                detail="Could not validate credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )
        return user
    except Exception:
        raise HTTPException(
            status_code=401,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

@router.post("/auth/signup", response_model=schemas.UserRead)
def signup(user: schemas.UserCreate, db: Session = Depends(database.get_db)):
    # Check if user already exists
    db_user = services.users.UserService.get_user_by_username(db, username=user.username)
    if db_user:
        raise HTTPException(status_code=400, detail="Username already registered")
    
    # Check invitation code
    db_invitation = services.invitations.InvitationService.get_invitation_by_code(db, code=user.invitation_code)
    if not db_invitation or db_invitation.is_used:
        raise HTTPException(status_code=400, detail="Invalid or used invitation code")
    
    # Create user - frontend sends plain passwords now
    new_user = services.users.UserService.create_user(db, user=user)
    
    # Mark invitation as used
    services.invitations.InvitationService.use_invitation(db, db_invitation)
    
    # Convert to response schema
    return schemas.UserRead(
        user_uuid=new_user.public_uuid,
        username=new_user.username,
        email=new_user.email,
        created_at=new_user.created_at
    )

@router.post("/auth/login", response_model=schemas.Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(database.get_db)):
    try:
        user = services.users.UserService.get_user_by_username(db, username=form_data.username)
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
            data={"username": user.username, "user_uuid": str(user.public_uuid)}, expires_delta=access_token_expires
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

@router.post("/auth/logout")
async def logout():
    from fastapi.responses import JSONResponse
    response = JSONResponse(content={"message": "Logged out successfully"})
    response.delete_cookie("access_token")
    return response

@router.get("/auth/me", response_model=schemas.UserRead)
async def read_users_me(current_user: models.User = Depends(get_current_user)):
    # Convert SQLAlchemy model to Pydantic schema
    return schemas.UserRead(
        user_uuid=current_user.public_uuid,
        username=current_user.username,
        email=current_user.email,
        created_at=current_user.created_at
    )

@router.put("/auth/me", response_model=schemas.UserRead)
async def update_user_me(user_update: schemas.UserProfileUpdate, current_user: models.User = Depends(get_current_user), db: Session = Depends(database.get_db)):
    updated_user = services.users.UserService.update_user(db, current_user, user_update)
    # Convert raw model to Pydantic schema
    return schemas.UserRead(
        user_uuid=updated_user.public_uuid,
        username=updated_user.username,
        email=updated_user.email,
        created_at=updated_user.created_at
    )

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
    deleted = services.users.UserService.delete_user(db, current_user.username)
    if not deleted:
        raise HTTPException(status_code=400, detail="Could not delete user")
    return

# --- Utility Endpoints (for dev/setup) DO NOT USE IN PRODUCTION ---

@router.post("/auth/invitations", response_model=schemas.InvitationRead)
def create_invitation(invitation: schemas.InvitationCreate, db: Session = Depends(database.get_db)):
    # This should ideally be protected, but for now we need a way to create the first invitation
    return services.invitations.InvitationService.create_invitation(db, code=invitation.code)
