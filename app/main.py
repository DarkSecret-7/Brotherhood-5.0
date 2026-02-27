from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, RedirectResponse, JSONResponse
from contextlib import asynccontextmanager
import os
import traceback

from .database import engine, Base
from .api import endpoints, llm, assessments
from .api.endpoints import get_current_user
from . import models

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create tables on startup
    try:
        from sqlalchemy import text
        with engine.connect() as conn:
            dialect_name = engine.dialect.name
            # --- Check and add x, y columns if missing ---
            try:
                conn.execute(text("ALTER TABLE nodes ADD COLUMN x INTEGER DEFAULT NULL"))
                conn.commit()
                print("Added column x to nodes table")
            except Exception:
                pass # Column likely exists
                
            try:
                conn.execute(text("ALTER TABLE nodes ADD COLUMN y INTEGER DEFAULT NULL"))
                conn.commit()
                print("Added column y to nodes table")
            except Exception:
                pass # Column likely exists

            try:
                conn.execute(text("ALTER TABLE nodes DROP COLUMN sources"))
                conn.commit()
                print("Dropped column sources from nodes table")
            except Exception:
                pass # Column likely already dropped

            # --- Check and add user profile columns if missing ---
            # Inspect existing columns first to avoid transaction errors
            try:
                result = conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name = 'users'"))
                existing_columns = [row[0] for row in result.fetchall()]
                print(f"Existing columns in users: {existing_columns}")
            except Exception as e:
                print(f"Error inspecting users table: {e}")
                conn.rollback()
                existing_columns = []

            # --- Ensure core user columns exist (older DBs may predate these fields) ---
            core_user_columns = []
            if dialect_name == "postgresql":
                core_user_columns = [
                    ("created_at", "TIMESTAMPTZ", "now()"),
                    ("is_active", "BOOLEAN", "true"),
                ]
            else:
                core_user_columns = [
                    ("created_at", "DATETIME", "CURRENT_TIMESTAMP"),
                    ("is_active", "BOOLEAN", "1"),
                ]

            for col_name, col_type, default_expr in core_user_columns:
                if col_name not in existing_columns:
                    try:
                        conn.execute(text(f"ALTER TABLE users ADD COLUMN {col_name} {col_type} DEFAULT {default_expr}"))
                        conn.commit()
                        print(f"Added column {col_name} to users table")
                    except Exception as e:
                        print(f"Failed to add column {col_name}: {e}")
                        conn.rollback()

            user_columns = [
                ("email", "VARCHAR"),
                ("phone", "VARCHAR"),
                ("dob", "VARCHAR"),
                ("bio", "VARCHAR"),
                ("location", "VARCHAR"),
                ("social_github", "VARCHAR"),
                ("social_linkedin", "VARCHAR"),
                ("profile_image", "VARCHAR")
            ]
            
            for col_name, col_type in user_columns:
                if col_name not in existing_columns:
                    try:
                        conn.execute(text(f"ALTER TABLE users ADD COLUMN {col_name} {col_type} DEFAULT NULL"))
                        conn.commit()
                        print(f"Added column {col_name} to users table")
                    except Exception as e:
                        print(f"Failed to add column {col_name}: {e}")
                        conn.rollback() # Ensure transaction is clean for next iteration

            # --- Ensure version_label can be referenced by foreign keys ---
            # Postgres requires the referenced column(s) to be covered by a UNIQUE constraint or unique index.
            try:
                conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ux_graph_snapshots_version_label ON graph_snapshots (version_label)"))
                conn.commit()
                print("Ensured unique index on graph_snapshots.version_label")
            except Exception as e:
                print(f"Failed to ensure unique index on graph_snapshots.version_label: {e}")
                conn.rollback()


        Base.metadata.create_all(bind=engine)
    except Exception as e:
        print(f"ERROR: Database initialization failed: {e}")
    yield

app = FastAPI(title="The Brotherhood Curator Lab Graph API", lifespan=lifespan)

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

# Mount static files - we keep this for CSS/JS which are needed for login too
static_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "static")
docs_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "docs")
templates_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "templates")
landing_static_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "landing_page", "static")
app.mount("/static", StaticFiles(directory=static_path), name="static")
app.mount("/docs", StaticFiles(directory=docs_path), name="docs")
app.mount("/landing", StaticFiles(directory=landing_static_path, html=True), name="landing")

# Mount standalone profile
profile_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "profile")
app.mount("/user-profile", StaticFiles(directory=profile_path, html=True), name="user-profile")

app.include_router(endpoints.router, prefix="/api/v1")
app.include_router(llm.router, prefix="/api/v1/llm")
app.include_router(assessments.router, prefix="/api/v1")

@app.get("/curator-guide")
def curator_guide():
    return FileResponse(os.path.join(templates_path, "curator-onboarding.html"))

@app.get("/login")
def login_page():
    return FileResponse(os.path.join(static_path, "login.html"))

@app.get("/signup")
def signup_page():
    return FileResponse(os.path.join(static_path, "signup.html"))

@app.get("/gallery")
def public_gallery():
    return FileResponse(os.path.join(templates_path, "public_gallery.html"))

@app.get("/database")
async def database_page(request: Request):
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

    return FileResponse(os.path.join(templates_path, "database.html"), headers={"Cache-Control": "no-store, no-cache, must-revalidate"})

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
