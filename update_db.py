from sqlalchemy import create_engine, text
import os
from dotenv import load_dotenv

load_dotenv()

# Determine the environment mode
APP_MODE = "production" 
# Use the same logic as database.py
if APP_MODE == "production":
    SQLALCHEMY_DATABASE_URL = "postgresql://brotherhood_user:JtmO0b7wHwTfdsxIpW1LUvEvyU9P3b1z@dpg-d6cjqja4d50c73a5msg0-a.oregon-postgres.render.com/brotherhood_sdry"
elif APP_MODE == "docker":
    SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgrespassword@db:5432/brotherhood")
else:
    SQLALCHEMY_DATABASE_URL = os.getenv("SQLALCHEMY_DATABASE_URL", "sqlite:///./brotherhood.db")

print(f"Connecting to {SQLALCHEMY_DATABASE_URL}")

try:
    engine = create_engine(SQLALCHEMY_DATABASE_URL)
    with engine.connect() as conn:
        print("Connected.")
        
        # Check if columns exist
        # This is a bit rough, but works for adding columns
        try:
            conn.execute(text("ALTER TABLE nodes ADD COLUMN IF NOT EXISTS x INTEGER DEFAULT NULL"))
            print("Added column x (if not exists)")
        except Exception as e:
            print(f"Column x might already exist or error: {e}")
            conn.rollback()
            
        try:
            conn.execute(text("ALTER TABLE nodes ADD COLUMN IF NOT EXISTS y INTEGER DEFAULT NULL"))
            print("Added column y (if not exists)")
        except Exception as e:
            print(f"Column y might already exist or error: {e}")
            conn.rollback()

        try:
            conn.execute(text("ALTER TABLE nodes DROP COLUMN IF EXISTS sources"))
            print("Dropped column sources (if exists)")
        except Exception as e:
            print(f"Column sources might not exist or drop failed: {e}")
            conn.rollback()
            
        conn.commit()
        print("Database update complete.")
except Exception as e:
    print(f"Failed to update database: {e}")
