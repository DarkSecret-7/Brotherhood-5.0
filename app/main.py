from fastapi import FastAPI, Depends, HTTPException, status, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, RedirectResponse
from contextlib import asynccontextmanager
import os

from .database import engine, Base
from .api import endpoints
from .api.endpoints import get_current_user
from . import models

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create tables on startup
    try:
        Base.metadata.create_all(bind=engine)
    except Exception as e:
        print(f"ERROR: Database initialization failed: {e}")
    yield

app = FastAPI(title="Brotherhood 5.0 Graph API", lifespan=lifespan)

# Mount static files - we keep this for CSS/JS which are needed for login too
static_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "static")
templates_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "templates")
app.mount("/static", StaticFiles(directory=static_path), name="static")

app.include_router(endpoints.router, prefix="/api/v1")

@app.get("/login")
def login_page():
    return FileResponse(os.path.join(static_path, "login.html"))

@app.get("/signup")
def signup_page():
    return FileResponse(os.path.join(static_path, "signup.html"))

@app.get("/")
async def read_root(request: Request):
    # Check for token in cookie
    token = request.cookies.get("access_token")
    if not token:
        # Check if it's in the Authorization header (though browser won't send this for initial GET)
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
            
    if not token:
        response = RedirectResponse(url="/login")
        # Ensure we clear the cookie if it was somehow invalid/missing
        response.delete_cookie("access_token")
        return response
    
    # Optional: Verify token here to prevent serving index.html to invalid tokens
    try:
        from .utils import SECRET_KEY, ALGORITHM
        from jose import jwt
        jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except:
        response = RedirectResponse(url="/login")
        response.delete_cookie("access_token")
        return response

    return FileResponse(os.path.join(templates_path, "index.html"), headers={"Cache-Control": "no-store, no-cache, must-revalidate"})
