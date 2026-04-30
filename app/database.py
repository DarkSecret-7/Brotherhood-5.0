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

# Determine the environment mode
# Possible values: "production", "docker", "local"
# Note: Backend runs on Render, database is on Supabase
APP_MODE = os.getenv("APP_MODE", "docker")
# APP_MODE = "docker"   # Forcing docker for local development
print(f"INFO: Application running in {APP_MODE} mode")

# Isolated Pipeline Configurations
if APP_MODE == "production":
    # --- PRODUCTION PIPELINE (BACKEND ON RENDER, DATABASE ON SUPABASE) ---
    SQLALCHEMY_DATABASE_URL = os.getenv("SQLALCHEMY_URL")
    
    if not SQLALCHEMY_DATABASE_URL:
        # Check all env vars for fallback (Render sometimes uses different keys)
        for key, value in os.environ.items():
            if "DATABASE_URL" in key.upper() or "POSTGRES_URL" in key.upper():
                SQLALCHEMY_DATABASE_URL = value
                break

    if not SQLALCHEMY_DATABASE_URL:
        raise RuntimeError("CRITICAL: DATABASE_URL not found in production mode!")

    # SQLAlchemy requires "postgresql://"
    if SQLALCHEMY_DATABASE_URL.startswith("postgres://"):
        SQLALCHEMY_DATABASE_URL = SQLALCHEMY_DATABASE_URL.replace("postgres://", "postgresql://", 1)

    # Connection pool optimized for cloud database (Supabase)
    # pool_size: Keep a small pool to avoid exhausting Supabase connection limits
    # max_overflow: Allow burst connections during load spikes
    # pool_recycle: Recycle connections before Supabase timeout (10 min default)
    # pool_pre_ping: Verify connections are alive before use (prevents stale connections)
    engine_args = {
        "pool_pre_ping": True,
        "pool_recycle": 540,    # 9 minutes (below Supabase 10 min timeout)
        "pool_size": 5,         # Base connections per worker
        "max_overflow": 10,     # Allow up to 15 total during spikes
        "pool_timeout": 10,     # Wait time before giving up on getting connection
    }
    
    # Enforce SSL for production (Required for Supabase)
    if "sslmode" not in SQLALCHEMY_DATABASE_URL:
        engine_args["connect_args"] = {"sslmode": "require"}
    else:
        # Ensure existing sslmode is set to require for Supabase
        engine_args["connect_args"] = {"sslmode": "require"}

    try:
        engine = create_engine(SQLALCHEMY_DATABASE_URL, **engine_args)
        # Verify connection immediately
        with engine.connect() as conn:
            pass
    except Exception as e:
        raise RuntimeError(f"CRITICAL: Failed to connect to production database: {e}")

elif APP_MODE == "docker":
    # --- DOCKER PIPELINE (POSTGRES) ---
    # In Docker, we expect DATABASE_URL to be set, otherwise default to the service name
    SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgrespassword@db:5432/brotherhood")
    
    engine_args = {
        "pool_pre_ping": True,
        "pool_size": 5,
        "max_overflow": 10
    }
    
    try:
        engine = create_engine(SQLALCHEMY_DATABASE_URL, **engine_args)
    except Exception as e:
        raise RuntimeError(f"CRITICAL: Failed to connect to Docker database: {e}")

else:
    # --- LOCAL PIPELINE (SQLITE) ---
    # Local development uses SQLite for simplicity and zero setup
    SQLALCHEMY_DATABASE_URL = os.getenv("SQLALCHEMY_DATABASE_URL", "sqlite:///./brotherhood.db")
    print(f"INFO: Using local SQLite database at {SQLALCHEMY_DATABASE_URL}")
    
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL, 
        connect_args={"check_same_thread": False} # Required for SQLite + FastAPI
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    Base.metadata.create_all(bind=engine)
    try:
        yield db
    finally:
        db.close()
