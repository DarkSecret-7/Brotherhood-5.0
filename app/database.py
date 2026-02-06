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
    SQLALCHEMY_DATABASE_URL = (
        os.getenv("DATABASE_URL") or 
        os.getenv("INTERNAL_DATABASE_URL") or
        os.getenv("DATABASE_PUBLIC_URL")
    )

    if not SQLALCHEMY_DATABASE_URL:
        # If no env var found, we fallback to localhost
        SQLALCHEMY_DATABASE_URL = "postgresql://postgres:postgrespassword@localhost:5432/brotherhood"
        print("!!! WARNING: No database environment variable found. Falling back to localhost.")
    else:
        # Log the connection (safely)
        from urllib.parse import urlparse
        try:
            parsed = urlparse(SQLALCHEMY_DATABASE_URL)
            # Hide password but show host to confirm if it's internal or external
            safe_url = f"{parsed.scheme}://{parsed.username}:****@{parsed.hostname}:{parsed.port}{parsed.path}"
            print(f"DEBUG: Found DB config. Connecting to: {safe_url}")
        except:
            print("DEBUG: DB config found but parsing failed.")

    # Render/SQLAlchemy fix for "postgres://"
    if SQLALCHEMY_DATABASE_URL and SQLALCHEMY_DATABASE_URL.startswith("postgres://"):
        SQLALCHEMY_DATABASE_URL = SQLALCHEMY_DATABASE_URL.replace("postgres://", "postgresql://", 1)

    try:
        engine = create_engine(SQLALCHEMY_DATABASE_URL)
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
