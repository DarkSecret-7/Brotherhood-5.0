# This file is part of The Brotherhood Project
#
# Copyright (C) 2026  The Brotherhood Project Developers
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
from .utils import utils

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Simple database initialization
    try:
        Base.metadata.create_all(bind=engine)
        print("Database tables created successfully")
    except Exception as e:
        print(f"Database initialization failed: {e}")
    yield

app = FastAPI(title="The Brotherhood Project Backend API", lifespan=lifespan)

# Add CORS middleware for development
print("Adding CORS middleware...")
# Dynamic CORS configuration for both local and production
allowed_origins = [
    "http://localhost:3000",
    "http://localhost:8000", 
    "http://127.0.0.1:3000",
    "http://127.0.0.1:8000"
]

secure_headers = {
    "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0, private",
    "Pragma": "no-cache",
    "Expires": "0"
}

# Add Render URLs using built-in environment variables
if os.getenv("RENDER"):
    # Render automatically provides these variables
    render_service_url = os.getenv("RENDER_SERVICE_URL")
    render_external_url = os.getenv("RENDER_EXTERNAL_URL") 
    render_external_hostname = os.getenv("RENDER_EXTERNAL_HOSTNAME")
    
    if render_service_url:
        allowed_origins.append(render_service_url)
    if render_external_url:
        allowed_origins.append(render_external_url)
    if render_external_hostname:
        # Construct URLs from hostname
        allowed_origins.append(f"https://{render_external_hostname}")
        allowed_origins.append(f"http://{render_external_hostname}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
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

# Dashboard routes
@app.get("/dashboard")
async def dashboard_index(request: Request):
    redirect_response = utils.check_token(request)
    if redirect_response:
        return redirect_response

    return FileResponse(os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "templates", "dashboard", "index.html"),
        headers=secure_headers)

@app.get("/dashboard/profile")
async def dashboard_profile(request: Request):
    redirect_response = utils.check_token(request)
    if redirect_response:
        return redirect_response
        
    return FileResponse(os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "templates", "dashboard", "profile.html"),
        headers=secure_headers)

@app.get("/dashboard/proposals")
async def dashboard_proposals(request: Request):
    redirect_response = utils.check_token(request)
    if redirect_response:
        return redirect_response
        
    return FileResponse(os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "templates", "dashboard", "proposals.html"),
        headers=secure_headers)

@app.get("/dashboard/settings")
async def dashboard_settings(request: Request):
    redirect_response = utils.check_token(request)
    if redirect_response:
        return redirect_response

    return FileResponse(os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "templates", "dashboard", "settings.html"),
        headers=secure_headers)

# Academia routes
@app.get("/academia")
async def academia_index(request: Request):
    redirect_response = utils.check_token(request)
    if redirect_response:
        return redirect_response

    return FileResponse(os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "templates", "academia", "index.html"),
        headers=secure_headers)

@app.get("/academia/library")
async def dashboard_library(request: Request):
    redirect_response = utils.check_token(request)
    if redirect_response:
        return redirect_response
        
    return FileResponse(os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "templates", "academia", "library.html"),
        headers=secure_headers)

@app.get("/academia/learning")
async def dashboard_learning(request: Request):
    redirect_response = utils.check_token(request)
    if redirect_response:
        return redirect_response

    return FileResponse(os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "templates", "academia", "learning.html"),
        headers=secure_headers)

@app.get("/academia/assessment")
async def dashboard_assessment(request: Request):
    redirect_response = utils.check_token(request)
    if redirect_response:
        return redirect_response

    return FileResponse(os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "templates", "academia", "assessment.html"),
        headers=secure_headers)

def _landing_template(name: str) -> str:
    return os.path.join(
        os.path.dirname(os.path.dirname(__file__)),
        "frontend", "templates", "landing", name,
    )

# Root endpoint - serve landing page directly
@app.get("/")
async def root():
    return FileResponse(_landing_template("index_architech.html"))

@app.get("/landing")
async def landing():
    return FileResponse(_landing_template("index_architech.html"))

@app.get("/landing/documents")
async def landing_documents():
    return FileResponse(_landing_template("documents.html"))

@app.get("/landing/gallery")
async def public_gallery():
    return FileResponse(_landing_template("public_gallery.html"))

@app.get("/landing/crisis")
async def landing_crisis():
    return FileResponse(_landing_template("crisis.html"))

@app.get("/landing/solution")
async def landing_solution():
    return FileResponse(_landing_template("solution.html"))

@app.get("/landing/components")
async def landing_components():
    return FileResponse(_landing_template("components.html"))

@app.get("/landing/help")
async def landing_help():
    return FileResponse(_landing_template("help.html"))

@app.get("/landing/contact")
async def landing_contact():
    return FileResponse(_landing_template("contact.html"))

# Curator Lab routes
@app.get("/lab")
async def lab_index(request: Request):
    redirect_response = utils.check_token(request)
    if redirect_response:
        return redirect_response

    return FileResponse(os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "templates", "lab", "index.html"),
        headers=secure_headers)

@app.get("/lab/workspace")
async def lab_workspace(request: Request):
    redirect_response = utils.check_token(request)
    if redirect_response:
        return redirect_response

    return FileResponse(os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "templates", "lab", "workspace.html"),
        headers=secure_headers)

# Database management page
@app.get("/lab/database")
async def lab_database(request: Request):
    redirect_response = utils.check_token(request)
    if redirect_response:
        return redirect_response

    return FileResponse(os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "templates", "lab", "database.html"),
        headers=secure_headers)

@app.get("/lab/curator-guide")
async def lab_curator_guide(request: Request):
    redirect_response = utils.check_token(request)
    if redirect_response:
        return redirect_response

    return FileResponse(os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "templates", "lab", "curator-guide.html"),
        headers=secure_headers)

@app.get("/auth/login")
async def auth_login():
    return FileResponse(os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "templates", "auth", "login.html"),
        headers=secure_headers)

@app.get("/auth/signup")
async def auth_signup():
    return FileResponse(os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "templates", "auth", "signup.html"),
        headers=secure_headers)

# Logout endpoint
@app.post("/auth/logout")
async def logout():
    # Complex implementations like server side session clearing are saved for the future
    return RedirectResponse(url="/auth/login")

# Health check

@app.get("/health")
async def health_check():
    """Health check endpoint for testing and monitoring"""
    return {"status": "healthy", "service": "brotherhood-backend"}
