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



### 2. Configure Environment (Local Development)
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
  - **Structured Source Management**:
    - Add multiple sources per node (PDF, Video, Other).
    - Track metadata: Title, Author, Year, URL, Fragment (Start/End).
    - Clean, list-based UI with one source per row for better readability.
  - Automated **Prerequisite Simplification** (Transitive Reduction).
  - **Circularity Detection** to prevent dependency loops.
  - **Mentions Tracking**: See which nodes depend on the current one.
  - **ID Propagation**: Changing a node's Local ID automatically updates all references.
  - **Compact UI**: Neat display of metadata and timestamps in the database management interface.

### 5. Import & Export (.knw)
The system supports a custom `.knw` (Knowledge Graph) file format for sharing graphs.

**Export:**
- Open any graph snapshot.
- Click **"Export Graph (.knw)"** to download the JSON-based file.
- The file contains all nodes, domains, metadata, and sources.

**Import:**
- **Global Import**: Use the "Import Graph (.knw)" button on the main dashboard to add a new graph.
- **Overwrite**: Inside an existing graph's settings, you can import a `.knw` file to completely replace the current graph content (requires confirmation).
- **Smart Resolution**: The importer automatically resolves user references (creators) and base graph links. If a referenced user or graph is missing, it defaults to safe values ("Unknown" or null) to prevent errors.

### 6. Use the CLI
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

> **CRITICAL**: The simplification triggers when you **unfocus** (click away) from the input field.

### Reference Integrity
- **Mentions**: Each node tracks which other nodes reference it in their prerequisites.
- **Validation**: You cannot reference a non-existent node ID.
- **Cascade Updates**: Renaming a node's ID propagates the change to all referencing nodes automatically.
- **Safe Deletion**: Deleting a node automatically removes its ID from all other nodes' prerequisites.

### Circularity Detection
The system prevents the creation of circular dependencies (e.g., A -> B -> A) by performing a cycle check during every create or update operation.

### AI-Powered Suggestions
- **Context-Aware**: The system uses Google Gemini to suggest new nodes based on your prompt and the current graph structure.
- **Modularity**: Suggestions are tailored to fit the existing granularity and modularity of your graph.
- **Bulk Import**: Select multiple suggestions and import them directly into your workspace with automatically assigned IDs.

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
