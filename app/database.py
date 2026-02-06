from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os

# Try to load environment variables from .env file for local development
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# --- SWITCH FOR LOCAL DATABASE (NON-DOCKER) ---
# Set this to True to use a local SQLite database instead of PostgreSQL/Docker
# Only use this for static testing and development, does NOT have backend support
USE_LOCAL_DB = False 

if USE_LOCAL_DB:
    SQLALCHEMY_DATABASE_URL = "sqlite:///./brotherhood.db"
    # SQLite requires check_same_thread=False for FastAPI
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
    )
else:
    # Get the database URL from environment variable
    # Render often provides DATABASE_URL or INTERNAL_DATABASE_URL
    # We also check for other common names just in case
    SQLALCHEMY_DATABASE_URL = (
        os.getenv("DATABASE_URL") or 
        os.getenv("INTERNAL_DATABASE_URL") or
        os.getenv("DATABASE_PUBLIC_URL") or
        os.getenv("POSTGRES_URL") or
        os.getenv("DB_URL")
    )

    if not SQLALCHEMY_DATABASE_URL:
        # If no env var found, we fallback to localhost for local development
        # But we print a very clear message for Render logs
        print("!!! WARNING: No database environment variable found (DATABASE_URL, INTERNAL_DATABASE_URL, etc.).")
        print("!!! If you are on Render, make sure your database is linked to this service.")
        print("!!! Falling back to localhost:5432 for local development.")
        SQLALCHEMY_DATABASE_URL = "postgresql://postgres:postgrespassword@localhost:5432/brotherhood"
    else:
        # Render/SQLAlchemy fix for "postgres://" (SQLAlchemy requires "postgresql://")
        if SQLALCHEMY_DATABASE_URL.startswith("postgres://"):
            SQLALCHEMY_DATABASE_URL = SQLALCHEMY_DATABASE_URL.replace("postgres://", "postgresql://", 1)
        
        # Log the connection (safely)
        from urllib.parse import urlparse
        try:
            parsed = urlparse(SQLALCHEMY_DATABASE_URL)
            # Hide password but show host and database name to confirm connection details
            scheme = parsed.scheme or "postgresql"
            user = parsed.username or "unknown"
            host = parsed.hostname or "unknown"
            port = parsed.port or "5432"
            path = parsed.path or "/unknown"
            safe_url = f"{scheme}://{user}:****@{host}:{port}{path}"
            print(f"DEBUG: Found DB configuration. Connecting to: {safe_url}")
        except Exception as e:
            print(f"DEBUG: DB config found but parsing for logs failed: {e}")

    engine_args = {}
    # If we are on Render (detected by environment variables), we might need sslmode
    if os.getenv("RENDER") or "render.com" in SQLALCHEMY_DATABASE_URL:
        # Only add sslmode if it's not already in the URL
        if "sslmode" not in SQLALCHEMY_DATABASE_URL:
            engine_args["connect_args"] = {"sslmode": "require"}

    try:
        engine = create_engine(SQLALCHEMY_DATABASE_URL, **engine_args)
    except Exception as e:
        print(f"!!! ERROR: Failed to create engine: {e}")
        # Final fallback just in case
        engine = create_engine("postgresql://postgres:postgrespassword@localhost:5432/brotherhood")
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
