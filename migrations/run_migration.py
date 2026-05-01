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

"""
Database migration runner for The Brotherhood Project.

This script runs Alembic migrations to update the database schema.
"""

import sys
import os
import subprocess
from pathlib import Path

# Add the project root to the path
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))


def run_migration():
    """Run the Alembic migration to upgrade the database."""
    print("Running database migration...")
    print("Upgrading to latest version...")
    
    # Change to the project directory
    os.chdir(project_root)
    
    # Run alembic upgrade
    result = subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head"],
        capture_output=True,
        text=True
    )
    
    print(result.stdout)
    if result.stderr:
        print("Stderr:", result.stderr)
    
    if result.returncode == 0:
        print("✓ Migration completed successfully!")
        return 0
    else:
        print(f"✗ Migration failed with exit code {result.returncode}")
        return 1


def show_current_version():
    """Show the current database version."""
    os.chdir(project_root)
    
    result = subprocess.run(
        [sys.executable, "-m", "alembic", "current"],
        capture_output=True,
        text=True
    )
    
    print(result.stdout)
    if result.stderr:
        print("Stderr:", result.stderr)
    
    return result.returncode


def show_history():
    """Show migration history."""
    os.chdir(project_root)
    
    result = subprocess.run(
        [sys.executable, "-m", "alembic", "history"],
        capture_output=True,
        text=True
    )
    
    print(result.stdout)
    if result.stderr:
        print("Stderr:", result.stderr)
    
    return result.returncode


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Database migration runner")
    parser.add_argument(
        "command",
        choices=["upgrade", "current", "history", "downgrade"],
        default="upgrade",
        nargs="?",
        help="Migration command to run"
    )
    parser.add_argument(
        "--revision",
        default="-1",
        help="Revision for downgrade (default: -1)"
    )
    
    args = parser.parse_args()
    
    if args.command == "upgrade":
        sys.exit(run_migration())
    elif args.command == "current":
        sys.exit(show_current_version())
    elif args.command == "history":
        sys.exit(show_history())
    elif args.command == "downgrade":
        print(f"Downgrading to revision {args.revision}...")
        os.chdir(project_root)
        result = subprocess.run(
            [sys.executable, "-m", "alembic", "downgrade", args.revision],
            capture_output=True,
            text=True
        )
        print(result.stdout)
        if result.stderr:
            print("Stderr:", result.stderr)
        sys.exit(result.returncode)
