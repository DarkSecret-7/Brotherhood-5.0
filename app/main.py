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
from . import models, utils

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
# Dynamic CORS configuration for both local and production
allowed_origins = [
    "http://localhost:3000",
    "http://localhost:8000", 
    "http://127.0.0.1:3000",
    "http://127.0.0.1:8000"
]

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

    return FileResponse(os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "templates", "dashboard", "index.html"))

@app.get("/dashboard/profile")
async def dashboard_profile(request: Request):
    redirect_response = utils.check_token(request)
    if redirect_response:
        return redirect_response
        
    return FileResponse(os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "templates", "dashboard", "profile.html"))

# Academia routes
@app.get("/academia")
async def academia_index(request: Request):
    redirect_response = utils.check_token(request)
    if redirect_response:
        return redirect_response

    return FileResponse(os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "templates", "academia", "index.html"))

@app.get("/academia/library")
async def dashboard_library(request: Request):
    redirect_response = utils.check_token(request)
    if redirect_response:
        return redirect_response
        
    return FileResponse(os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "templates", "academia", "library.html"))

@app.get("/academia/learning")
async def dashboard_learning(request: Request):
    redirect_response = utils.check_token(request)
    if redirect_response:
        return redirect_response

    return FileResponse(os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "templates", "academia", "learning.html"))

@app.get("/academia/assessment")
async def dashboard_assessment(request: Request):
    redirect_response = utils.check_token(request)
    if redirect_response:
        return redirect_response

    return FileResponse(os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "templates", "academia", "assessment.html"))

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

# Public gallery route
@app.get("/landing/gallery")
async def public_gallery():
    return FileResponse(os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "templates", "landing", "public_gallery.html"))

@app.get("/lab/workspace")
async def lab_workspace(request: Request):
    redirect_response = utils.check_token(request)
    if redirect_response:
        return redirect_response

    return FileResponse(os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "templates", "lab", "workspace.html"), headers={"Cache-Control": "no-store, no-cache, must-revalidate"})

# Database management page
@app.get("/lab/database")
async def lab_database(request: Request):
    redirect_response = utils.check_token(request)
    if redirect_response:
        return redirect_response

    return FileResponse(os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "templates", "lab", "database.html"), headers={"Cache-Control": "no-store, no-cache, must-revalidate"})

# Curator guide page
@app.get("/lab/curator-guide")
async def lab_curator_guide(request: Request):
    redirect_response = utils.check_token(request)
    if redirect_response:
        return redirect_response

    return FileResponse(os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "templates", "lab", "curator-guide.html"), headers={"Cache-Control": "no-store, no-cache, must-revalidate"})

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
