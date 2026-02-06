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
    # Render often provides DATABASE_URL
    SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL")

    if not SQLALCHEMY_DATABASE_URL:
        # Check all env vars for something containing DATABASE_URL or POSTGRES_URL
        for key, value in os.environ.items():
            if "DATABASE_URL" in key.upper() or "POSTGRES_URL" in key.upper():
                print(f"DEBUG: Found alternative DB env var: {key}")
                SQLALCHEMY_DATABASE_URL = value
                break

    if not SQLALCHEMY_DATABASE_URL:
        print("!!! WARNING: No database environment variable found (DATABASE_URL, etc.).")
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
            host = parsed.hostname or "unknown"
            port = parsed.port or "5432"
            path = parsed.path or "/unknown"
            print(f"DEBUG: Connecting to DB host: {host}:{port}{path}")
        except Exception as e:
            print(f"DEBUG: DB config found but parsing for logs failed: {e}")

    engine_args = {
        "pool_pre_ping": True,
        "pool_recycle": 300,
        "pool_size": 5,
        "max_overflow": 10,
    }
    # If we are on Render, we MUST use sslmode=require for external connections
    # and it helps with stability even for internal ones.
    if os.getenv("RENDER") or "render.com" in SQLALCHEMY_DATABASE_URL:
        if "sslmode" not in SQLALCHEMY_DATABASE_URL:
            # For psycopg2 (default for postgresql://), we use connect_args
            engine_args["connect_args"] = {"sslmode": "require"}

    try:
        engine = create_engine(SQLALCHEMY_DATABASE_URL, **engine_args)
    except Exception as e:
        print(f"!!! ERROR: Failed to create engine: {e}")
        # Final fallback just in case
        engine = create_engine("postgresql://postgres:postgrespassword@localhost:5432/brotherhood", pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
