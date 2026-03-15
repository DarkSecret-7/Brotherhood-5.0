from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, RedirectResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import os
import traceback

from .database import engine, Base
from .api import api_router, llm, assessments
from .api.auth import get_current_user
from . import models

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Simple database initialization
    try:
        Base.metadata.create_all(bind=engine)
        print("Database tables created successfully")
    except Exception as e:
        print(f"Database initialization failed: {e}")
    yield

app = FastAPI(title="The Brotherhood Curator Lab Graph API", lifespan=lifespan)

# Add CORS middleware for development
print("Adding CORS middleware...")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:8000", "http://127.0.0.1:3000", "http://127.0.0.1:8000"],  # Frontend URLs
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)
print("CORS middleware added successfully!")

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    error_msg = f"Global Error: {exc}\n{traceback.format_exc()}"
    print(error_msg)
    with open("server_error.log", "a") as f:
        f.write(f"Timestamp: {os.times()}\n")
        f.write(error_msg)
        f.write("-" * 80 + "\n")
        
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal Server Error", "error": str(exc)},
    )

# Mount static files - updated paths for new frontend-first architecture
docs_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "docs")
frontend_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend")
css_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "css")
ui_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "ui")

# Only mount directories that exist
if os.path.exists(docs_path):
    app.mount("/docs", StaticFiles(directory=docs_path), name="docs")

if os.path.exists(css_path):
    app.mount("/css", StaticFiles(directory=css_path), name="css")

if os.path.exists(ui_path):
    app.mount("/ui", StaticFiles(directory=ui_path), name="ui")

app.mount("/frontend", StaticFiles(directory=frontend_path, html=True), name="frontend")

# Include API routers
app.include_router(api_router, prefix="/api/v1")

# LLM endpoints
app.include_router(llm.router, prefix="/api/v1")

# Assessment endpoints
app.include_router(assessments.router, prefix="/api/v1")

# Root endpoint - serve landing page directly
@app.get("/")
async def root():
    return FileResponse(os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "templates", "landing", "index.html"))

# Landing page route
@app.get("/landing")
async def landing():
    return FileResponse(os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "templates", "landing", "index.html"))

# Landing sub-pages
@app.get("/landing/crisis")
async def landing_crisis():
    return FileResponse(os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "templates", "landing", "crisis.html"))

@app.get("/landing/solution")
async def landing_solution():
    return FileResponse(os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "templates", "landing", "solution.html"))

@app.get("/landing/components")
async def landing_components():
    return FileResponse(os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "templates", "landing", "components.html"))

@app.get("/landing/help")
async def landing_help():
    return FileResponse(os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "templates", "landing", "help.html"))

@app.get("/landing/contact")
async def landing_contact():
    return FileResponse(os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "templates", "landing", "contact.html"))

@app.get("/landing/documents")
async def landing_documents():
    return FileResponse(os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "templates", "landing", "documents.html"))

@app.get("/lab/workspace")
async def lab_workspace(request: Request):
    # Check for token in cookie
    token = request.cookies.get("access_token")
    if not token:
        # Check if it's in the Authorization header (though browser won't send this for initial GET)
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
            
    if not token:
        response = RedirectResponse(url="/auth/login")
        # Ensure we clear the cookie if it was somehow invalid/missing
        response.delete_cookie("access_token")
        return response
    
    # Verify token here to prevent serving workspace to invalid tokens
    try:
        from .utils import SECRET_KEY, ALGORITHM
        from jose import jwt
        jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except:
        response = RedirectResponse(url="/auth/login")
        response.delete_cookie("access_token")
        return response

    return FileResponse(os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "templates", "lab", "workspace.html"), headers={"Cache-Control": "no-store, no-cache, must-revalidate"})

# Database management page
@app.get("/lab/database")
async def lab_database(request: Request):
    # Check for token in cookie
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
            
    if not token:
        response = RedirectResponse(url="/auth/login")
        response.delete_cookie("access_token")
        return response
    
    try:
        from .utils import SECRET_KEY, ALGORITHM
        from jose import jwt
        jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except:
        response = RedirectResponse(url="/auth/login")
        response.delete_cookie("access_token")
        return response

    return FileResponse(os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "templates", "lab", "database.html"), headers={"Cache-Control": "no-store, no-cache, must-revalidate"})

# Curator guide page
@app.get("/lab/curator-guide")
async def lab_curator_guide(request: Request):
    # Check for token in cookie
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
            
    if not token:
        response = RedirectResponse(url="/auth/login")
        response.delete_cookie("access_token")
        return response
    
    try:
        from .utils import SECRET_KEY, ALGORITHM
        from jose import jwt
        jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except:
        response = RedirectResponse(url="/auth/login")
        response.delete_cookie("access_token")
        return response

    return FileResponse(os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "templates", "lab", "curator-guide.html"), headers={"Cache-Control": "no-store, no-cache, must-revalidate"})

# User profile page with UUID parameter
@app.get("/profile/{user_uuid}")
async def user_profile(request: Request, user_uuid: str):
    # Check for token in cookie
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
            
    if not token:
        response = RedirectResponse(url="/auth/login")
        response.delete_cookie("access_token")
        return response
    
    try:
        from .utils import SECRET_KEY, ALGORITHM
        from jose import jwt
        jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except:
        response = RedirectResponse(url="/auth/login")
        response.delete_cookie("access_token")
        return response

    return FileResponse(os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "templates", "lab", "user-profile.html"), headers={"Cache-Control": "no-store, no-cache, must-revalidate"})

# Curator guide
@app.get("/docs/curator-guide")
async def curator_guide():
    return FileResponse(os.path.join(os.path.dirname(os.path.dirname(__file__)), "docs", "curator_guide.html"))

@app.get("/auth/login")
async def auth_login():
    return FileResponse(os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "templates", "auth", "login.html"))

@app.get("/auth/signup")
async def auth_signup():
    return FileResponse(os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "templates", "auth", "signup.html"))

# Logout endpoint
@app.post("/auth/logout")
async def logout():
    # In a real app, you'd clear the session/token here
    return RedirectResponse(url="/auth/login")

# Health check

@app.get("/health")
async def health_check():
    """Health check endpoint for testing and monitoring"""
    return {"status": "healthy", "service": "brotherhood-backend"}
