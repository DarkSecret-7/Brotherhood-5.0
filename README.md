# Brotherhood 5.0 - Local Graph Workspace

A local-first graph management system built with Python, FastAPI, and PostgreSQL. It features an interactive Web UI and a powerful CLI for managing complex node dependencies with automated validation and simplification.

## Prerequisites

- **Docker Desktop** must be installed and running.
- **Python 3.10+** (for the CLI client and local development).

## Quick Start

### 1. Start the Environment
Run the following command to start the Database and API using Docker:
```powershell
docker-compose up -d --build
```

### 2. Database Migrations
If you are updating from an older version, you can migrate your existing graphs to the new schema using the provided migration script:
```powershell
# For local Docker PostgreSQL
py debug/migrate_docker_postgres.py

# For Render (Remote)
py debug/migrate_graphs.py
```

### 3. Configure Environment (Local Development)
To connect to a remote database (e.g., Render), create a `.env` file in the project root:
```text
DATABASE_URL=postgresql://user:password@hostname:port/database
```

### 3. Install CLI Dependencies (Optional)
If you plan to use the CLI tool locally, install the required packages:
```powershell
pip install -r requirements.txt
```

### 4. Access the Web UI
The Web UI is now **invite-only**. You must have an invitation code to register.
- **URL**: [http://localhost:8000](http://localhost:8000)
- **Authentication**: JWT-based auth with protected routes.
- **Features**: 
  - **Advanced Graph Persistence**:
    - **Versioning**: Save graphs with unique version labels.
    - **Base Graph Tracking**: Automatically tracks the source graph for every saved version.
    - **Smart Conflict Resolution**: Prevents accidental overwrites of existing graphs unless the "Overwrite" toggle is explicitly enabled.
    - **Authorship Integrity**: Tracks the creator of each graph. Original authorship is preserved even during overwrites to maintain data provenance.
    - **Timestamping**: Tracks both `Created At` and `Last Updated` timestamps for every graph snapshot.
    - **Overwrite Toggle**: Intelligent UI toggle that acts as an autofill for existing names and locks the field for safe editing.
  - Automated **Prerequisite Simplification** (Transitive Reduction).
  - **Circularity Detection** to prevent dependency loops.
  - **Mentions Tracking**: See which nodes depend on the current one.
  - **ID Propagation**: Changing a node's Local ID automatically updates all references.
  - **Compact UI**: Neat display of metadata and timestamps in the database management interface.

### 4. Use the CLI
The CLI manages a local graph state and syncs with the backend.

**Basic Workflow**:
```powershell
# Create nodes interactively
python cli.py create-node

# List current local nodes
python cli.py list-nodes

# Save the current graph as a new version
python cli.py save-graph --version-label "v1"

# Load a previous version (replaces local state)
python cli.py load-graph <snapshot_id>
```

## Advanced Features

### Boolean Prerequisite Logic
Prerequisites support complex boolean expressions using `AND`, `OR`, and parentheses:
- Example: `(1 AND 2) OR 3`
- The system automatically parses these into an AST (Abstract Syntax Tree) to ensure operator precedence is respected.

### Automatic Simplification & Transitive Reduction
When you edit a prerequisite in the Web UI, the system automatically:
1. **Simplifies** the boolean expression.
2. Performs **Transitive Reduction** (e.g., if A depends on B and B depends on C, then A depending on C is redundant and removed).

### Reference Integrity
- **Mentions**: Each node tracks which other nodes reference it in their prerequisites.
- **Validation**: You cannot reference a non-existent node ID.
- **Cascade Updates**: Renaming a node's ID propagates the change to all referencing nodes automatically.
- **Safe Deletion**: Deleting a node automatically removes its ID from all other nodes' prerequisites.

### Circularity Detection
The system prevents the creation of circular dependencies (e.g., A -> B -> A) by performing a cycle check during every create or update operation.

## Deployment to Render

This project is configured to deploy easily to [Render](https://render.com) using the provided `render.yaml` blueprint.

### 1. Connect your Database
On Render, the database environment variable is usually provided automatically if you use the Blueprint. If you are setting it up manually:
1. Go to your **Web Service** dashboard.
2. Click **Environment**.
3. Add a new environment variable:
   - **Key**: `DATABASE_URL`
   - **Value**: (Copy the **Internal Database URL** from your Render Database dashboard)
4. Save changes and the service will redeploy.

### 2. Troubleshoot "No Database Environment Variable"
If the logs show `!!! WARNING: No database environment variable found`, it means the `DATABASE_URL` is missing from the environment.
- Ensure the name of your database in `render.yaml` matches your actual database name (currently set to `brotherhood-db`).
- Check that the database is in the same "Region" as your web service.

## Authentication & Security

- **Invite-Only Signup**: Registration is restricted to users with a valid invitation code.
- **JWT Authorization**: Backend endpoints are protected using OAuth2 with Password Flow and JWT tokens.
- **Secure Access**: The static dashboard is only accessible to authenticated users.

## Architecture

- **Web Dashboard**: Interactive frontend served at `/static/index.html`.
- **API**: FastAPI service running on port 8000.
- **Database**: PostgreSQL 15 running on port 5432.
- **Storage**: Data is persisted in the `postgres_data` Docker volume.
- **Versioning**: Every "Save" creates a full immutable snapshot of the graph in the database.

## Development

### API Documentation
Visit [http://localhost:8000/docs](http://localhost:8000/docs) for the interactive Swagger UI.
