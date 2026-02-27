# The Brotherhood
The official code for The Brotherhood project

## Project Overview
The project currently functions with two main components:

### The Brotherhood Curator Lab
A local-first graph management system built with Python, FastAPI, and PostgreSQL. It features an interactive Web UI and a powerful CLI for managing complex node dependencies with automated validation and simplification. Currently invite-only.

### The Brotherhood Public Site
A static, public-facing website built with HTML, CSS, and JavaScript. It features a manifesto, read-only graph gallery, and contact forms.

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

### 4. Access the Web UI & Public Pages
The system runs as a single web service:

1.  **Workspace Application**
    -   **URL**: [http://localhost:8000](http://localhost:8000)
    -   **Access**: Invite-only. Requires authentication (Login/Signup).

2.  **Public Landing Site**
    -   **URL**: [http://localhost:8000/landing/](http://localhost:8000/landing/)
    -   **Purpose**: Public information, manifesto, and contact form.

3.  **Public Gallery**
    -   **URL**: [http://localhost:8000/gallery](http://localhost:8000/gallery)

### 5. Import & Export (.knw)
The system supports a custom `.knw` (Knowledge Graph) file format for sharing graphs.

**Export:**
- Open any graph snapshot.
- Click **"Download .knw"** inside the "Export" section of the graph details.
- The file contains all nodes, domains, metadata, and sources.

**Import:**
- **Global Import**: Use the "Import Graph (.knw)" button on the Database Management dashboard to add a new graph.
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

### 7. Interactive Graph Management
- **Visual Drag & Drop**: Rearrange nodes freely in the workspace. Your custom layout is saved with the snapshot.
- **Group Movement**: Collapse a Domain to treat it as a single unit. Dragging a collapsed domain automatically moves all its internal nodes and nested domains, maintaining their relative positions.
- **Background Rendering**: Domains are visualized as convex hulls that encompass their nodes, providing a clear visual hierarchy.
- **Layout Controls**:
  - **Fix Positions**: Saves current node coordinates to the local workspace.
  - **Reset Layout**: Reverts to the last saved configuration.
  - **Randomise**: Scrambles the layout to help untangle dense clusters.
- **Alternative Pathways**: Click on edges to cycle through active prerequisites for nodes with complex logic (e.g., OR conditions).

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

## Project Structure

- **`app/`**: FastAPI backend application logic (routes, models, database).
- **`landing_page/`**: Static site for the public landing page and graph gallery.
  - **`static/`**: Contains HTML, CSS, JS, and assets.
  - **`Dockerfile`**: Builds the Nginx container for the landing page.
- **`static/`**: Frontend assets for the main Workspace application (JS, CSS, Login/Signup HTML).
- **`templates/`**: HTML templates for the Workspace application (index.html, public_gallery.html).
- **`docker-compose.yml`**: Defines services (API, DB, Landing Page) for local development.
- **`render.yaml`**: Deployment configuration for Render.com.
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
