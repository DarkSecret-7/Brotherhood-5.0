import re
import os
from datetime import datetime, timedelta
from typing import List, Set, Dict, Optional, Union
from jose import JWTError, jwt
from passlib.context import CryptContext
import hashlib
from uuid import UUID
from fastapi import HTTPException, Depends
from sqlalchemy.orm import Session
import json
from fastapi.responses import StreamingResponse
from io import StringIO
import smtplib
from email.message import EmailMessage
import uuid

# Auth configuration
SECRET_KEY = os.getenv("SECRET_KEY", "09d25e094faa6ca2556c818166b7a9563b93f7099f6f0f4caa6cf63b88e8d3e7")
ALGORITHM = "HS256"
# Set expiration to 2 days (2 * 24 * 60 minutes)
ACCESS_TOKEN_EXPIRE_MINUTES = 2 * 24 * 60 

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_password(plain_password, hashed_password):
    try:
        return pwd_context.verify(plain_password, hashed_password)
    except Exception:
        # Try a fallback if it's a version mismatch or similar
        try:
            import bcrypt
            return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))
        except:
            return False

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def generate_hash(data: str) -> str:
    return hashlib.sha256(data.encode("utf-8")).hexdigest()

# --- Authentication Utilities ---

def get_current_user_token_data(token: str):
    """Extract and validate token data from JWT token"""
    credentials_exception = HTTPException(
        status_code=401,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("username")
        user_uuid: UUID = payload.get("user_uuid")
        exp: datetime = payload.get("exp")
        if username is None or user_uuid is None or exp is None:
            raise credentials_exception
        # Import schemas here to avoid circular import
        import app.schemas as schemas
        return schemas.TokenData(username=username, user_uuid=user_uuid, exp=exp)
    except JWTError:
        raise credentials_exception

def get_current_user(db: Session = None, token: str = None, crud_module=None):
    """Get current user from token - utility function for endpoints"""
    if not db or not token or not crud_module:
        raise ValueError("db, token, and crud_module are required")
    
    token_data = get_current_user_token_data(token)
    user = crud_module.get_user(db, user_uuid=token_data.user_uuid)
    if user is None:
        raise HTTPException(
            status_code=401,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user

# --- Email Utilities ---

def send_contact_email(payload, email_config: dict):
    """Send contact form email"""
    msg = EmailMessage()
    msg["Subject"] = f"Brotherhood contact form: {payload.name}"
    msg["From"] = email_config["from_email"]
    msg["To"] = email_config["to_email"]
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
        with smtplib.SMTP(email_config["smtp_host"], email_config["smtp_port"], timeout=15) as server:
            server.ehlo()
            if email_config["smtp_use_tls"]:
                server.starttls()
                server.ehlo()
            if email_config["smtp_user"] and email_config["smtp_password"]:
                server.login(email_config["smtp_user"], email_config["smtp_password"])
            server.send_message(msg)
        return True
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to send email: {str(e)}")

def get_email_config():
    """Get email configuration from environment variables"""
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

    return {
        "to_email": to_email,
        "from_email": from_email,
        "smtp_host": smtp_host,
        "smtp_port": smtp_port,
        "smtp_user": smtp_user,
        "smtp_password": smtp_password,
        "smtp_use_tls": smtp_use_tls
    }

# --- File/Import-Export Utilities ---

def validate_import_file(filename: str) -> bool:
    """Validate imported file format"""
    return filename.endswith(".knw")

def parse_import_content(content: bytes) -> dict:
    """Parse and validate imported JSON content"""
    try:
        data = json.loads(content)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON content")
    return data

def clean_import_data(data: dict) -> dict:
    """Clean imported data by removing read-only fields and setting defaults"""
    # Strip top-level fields that should not be imported (DB will generate these)
    data.pop('id', None)
    data.pop('node_count', None)
    
    # Note: created_at and last_updated are preserved as they are metadata to be restored
    
    # Strip site-specific fields (these should not be imported)
    data.pop('is_public', None)
    data.pop('authors', None)
    
    # Ensure metadata defaults if missing
    if 'base_uuid' not in data:
        data['base_uuid'] = None
    
    return data

def handle_redirects_import(data: dict) -> dict:
    """Handle redirects mapping for import - convert dict to list format"""
    if 'redirects' in data and isinstance(data['redirects'], dict):
        # If it's the old format (dict), convert to new format (list of objects)
        # Import schemas here to avoid circular import
        import app.schemas as schemas
        redirects_list = []
        for old_id, new_id in data['redirects'].items():
            redirects_list.append(schemas.NodeRedirectBase(
                snapshot_uuid=data.get('nodes', [{}])[0].get('snapshot_uuid', uuid.uuid4()),
                old_local_id=int(old_id),
                new_local_id=int(new_id)
            ))
        data['redirects'] = redirects_list
    return data

def create_export_file(snapshot_data: dict, graphLabel: str) -> StreamingResponse:
    """Create export file response"""
    # Create file stream
    file_content = json.dumps(snapshot_data, indent=2, default=str)
    filename = f"{graphLabel}.knw"
    
    return StreamingResponse(
        StringIO(file_content),
        media_type="application/json",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

# --- Snapshot and Authorization Utilities ---

def validate_redirects(redirects: List, snapshot_uuid: UUID, db: Session, crud_module) -> bool:
    """
    Validate that all redirects in a snapshot are valid:
    1. All referenced nodes exist in the snapshot
    2. No circular redirects
    3. No duplicate old_local_id or new_local_id within the same snapshot
    """
    if not redirects:
        return True
    
    # Get all nodes in the snapshot
    nodes = crud_module.get_nodes_by_snapshot_uuid(db, snapshot_uuid)
    node_ids = {node.local_id for node in nodes}
    
    # Check for duplicates
    old_ids = set()
    new_ids = set()
    
    for redirect in redirects:
        # Check if old and new nodes exist
        if redirect.old_local_id not in node_ids:
            raise HTTPException(
                status_code=400, 
                detail=f"Invalid redirect: source node {redirect.old_local_id} does not exist in snapshot"
            )
        if redirect.new_local_id not in node_ids:
            raise HTTPException(
                status_code=400, 
                detail=f"Invalid redirect: target node {redirect.new_local_id} does not exist in snapshot"
            )
        
        # Check for duplicates
        if redirect.old_local_id in old_ids:
            raise HTTPException(
                status_code=400, 
                detail=f"Duplicate redirect source: node {redirect.old_local_id} is redirected multiple times"
            )
        if redirect.new_local_id in new_ids:
            raise HTTPException(
                status_code=400, 
                detail=f"Duplicate redirect target: node {redirect.new_local_id} is target of multiple redirects"
            )
        
        old_ids.add(redirect.old_local_id)
        new_ids.add(redirect.new_local_id)
    
    # Check for circular redirects (A -> B -> A)
    redirect_map = {r.old_local_id: r.new_local_id for r in redirects}
    for old_id, new_id in redirect_map.items():
        if new_id in redirect_map and redirect_map[new_id] == old_id:
            raise HTTPException(
                status_code=400, 
                detail=f"Circular redirect detected between nodes {old_id} and {new_id}"
            )
    
    return True

# --- Validation Utilities ---

def validate_contact_form(payload):
    """Validate contact form input"""
    if not payload.name.strip() or not payload.email.strip() or not payload.message.strip():
        raise HTTPException(status_code=400, detail="Name, email, and message are required")