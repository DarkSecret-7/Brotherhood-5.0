# The Brotherhood v0.1
The official digital infrastructure for The Brotherhood project - a full-stack web application for building, managing, and assessing graph-based knowledge snapshots.

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)

## License
This project is licensed under the **GNU General Public License v3.0**. See the [LICENSE.txt](LICENSE.txt) file for details.

## More information on The Brotherhood project
For more information on The Brotherhood project, please check out the docs or visit the [official website](https://brotherhood-11pi.onrender.com/landing/).

## Project Overview
The project currently functions with two main components:

### The Brotherhood Curator Lab
A local-first graph management system built with Python, FastAPI, and PostgreSQL. It features an interactive Web UI and a powerful CLI for managing complex node dependencies with automated validation and simplification. Currently invite-only.

### The Brotherhood Public Site
A static, public-facing website built with HTML, CSS, and JavaScript. It features a manifesto, read-only graph gallery, and contact forms.

## Architecture Direction (Important)
The current codebase is **mid-refactor** and follows a strict layering model. This repository contains both legacy patterns and the target architecture documented below.

### Backend Layers (Target)
1. **CRUD**  
   Dumb persistence only: model reads/writes and query helpers.
2. **Services**  
   Business logic, orchestration, authorization decisions, validation rules.
3. **API**  
   HTTP endpoints for frontend consumption; converts request/response at the boundary.

### Frontend Layers (Target)
1. **API**  
   HTTP calls to backend endpoints.
2. **Transformer**  
   Converts backend payloads into frontend state shapes (and back).
3. **State**  
   Single authoritative source of frontend data.
4. **Controllers/UI**  
   DOM rendering + event wiring only; no direct data manipulation logic.
5. **Workspace/Database Orchestration (pseudo-layer)**  
   Controllers coordinate handoff between isolated states and ensure snapshot operations route through database management.

### Layering Rules
#### Backend
- `app/api/*` can call `app/services/*`
- `app/services/*` can call `app/crud/*`
- `app/crud/*` can call SQLAlchemy models/session only
- No business rules in CRUD
- No direct DB access from API layer

#### Frontend
- `frontend/api/*` talks to backend only
- `frontend/transformer/*` translates payloads between API and State contracts
- `frontend/state/*` owns application state mutations and notifications
- `frontend/ui/*` reads from state and dispatches actions; it should not mutate raw data directly
- `database_management` is the only frontend boundary allowed to perform snapshot collection/save/load/delete against backend
- `workspace` is draft-only and must not call snapshot backend APIs directly
- `frontend/state/lab-state-manager.js` and `frontend/state/database-state-manager.js` must never call/import each other
- Controllers orchestrate cross-state handoff (state A -> controller -> state B), never state-to-state

### Canonical Data Flow
**Read path**  
`Backend CRUD -> Backend Service -> Backend API -> Frontend API -> Frontend Transformer -> Frontend State -> Controllers/UI`

**Write path**  
`Controllers/UI -> Frontend State intent -> Frontend Transformer -> Frontend API -> Backend API -> Backend Service -> Backend CRUD`

### Workspace vs Database Management Split (Mandatory)
This split separates draft editing from direct backend communication.

#### Responsibilities
- **Database Management domain** (`database-state-manager` + `database-manager`):  
  Owns all snapshot backend interactions (list/fetch/save/import/export/delete).
- **Workspace domain** (`lab-state-manager` + workspace controllers):  
  Owns draft editing, graph manipulation, local draft state, and UI behavior.

#### Hard Rules
1. Workspace does not fetch snapshot collections directly from backend.
2. Workspace save actions are intents only; persistence is executed by database management orchestration.
3. States are isolated: no direct calls between workspace state and database state.
4. Controllers orchestrate transfers between domains.

## Repository Structure
```text
.
├─ app/
│  ├─ api/                    # FastAPI route handlers
│  ├─ crud/                   # Pure database operations
│  ├─ services/               # Business logic layer
│  ├─ main.py                 # FastAPI application entry point
│  ├─ database.py             # Engine/session setup
│  ├─ models.py               # SQLAlchemy models
│  ├─ schemas.py              # Pydantic request/response schemas
│  ├─ utils.py                # Auth helpers, utilities
│  └─ crud.py                 # Transitional/deprecated monolith
├─ frontend/
│  ├─ api/                    # HTTP client and endpoint services
│  ├─ assets/                 # Static assets (images, icons)
│  ├─ components/             # Reusable graph components
│  ├─ css/                    # Stylesheets
│  ├─ state/                  # Single source of truth (lab-state-manager, database-state-manager)
│  ├─ templates/              # HTML templates
│  │  ├─ auth/                # Login/signup pages
│  │  ├─ lab/                 # Workspace, database, curator guide, profile
│  │  └─ landing/             # Public site pages (index, crisis, solution, components, help, contact, documents, gallery)
│  ├─ transformer/            # Data format conversion between backend and frontend
│  ├─ ui/                     # Controllers and UI logic
│  │  ├─ gallery/             # Gallery UI components
│  │  ├─ lab/                 # Lab workspace controllers
│  │  ├─ landing/             # Landing page logic
│  │  └─ profile/             # User profile UI
│  ├─ utils/                  # Frontend utilities
│  └─ index.html              # Main frontend entry
├─ self_assessment/           # Standalone assessment package
│  ├─ assessment.py           # Core assessment logic
│  ├─ models.py               # Pydantic models for assessments
│  ├─ utils.py                # Assessment utilities
│  └─ test_assessment.py      # Assessment tests
├─ static [LEGACY]/           # Legacy frontend assets (deprecated)
├─ templates [LEGACY]/        # Legacy HTML templates (deprecated)
├─ profile [LEGACY]/          # Legacy profile management (deprecated)
├─ docker-compose.yml         # Local development services
├─ Dockerfile                 # Production container
├─ render.yaml                # Render deployment config
├─ requirements.txt           # Python dependencies
├─ test/                      # Test suite
│  ├─ run_tests.bat            # Windows test runner
│  ├─ run_tests.sh             # Unix/Linux/macOS test runner
│  ├─ setup_database.py       # Test database setup
│  └─ test_backend.py         # Backend test suite
```

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

1. **Workspace Application**
   - **URL**: [http://localhost:8000](http://localhost:8000)
   - **Access**: Invite-only. Requires authentication (Login/Signup).

2. **Public Landing Site**
   - **URL**: [http://localhost:8000/landing/](http://localhost:8000/landing/)
   - **Purpose**: Public information, manifesto, and contact form.

3. **Public Gallery**
   - **URL**: [http://localhost:8000/landing/gallery](http://localhost:8000/landing/gallery)

4. **User Profile** (authenticated)
   - **URL**: `http://localhost:8000/profile/{user_uuid}`
   - View and manage user profiles

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

### 6. Interactive Graph Management
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

## Technical Architecture Details

### Backend Overview
#### Entry point
- `app/main.py` boots FastAPI, CORS, static mounts, API router registration, and page routes.

#### API layer (`app/api/`)
Current endpoint modules include:
- Auth flows (`auth.py`)
- Snapshots (`snapshots.py`)
- Proposals (`proposals.py`)
- Authorship (`authorship.py`)
- Utility endpoints (`utility.py`)
- Assessment/capability endpoints (`assessments.py`)
- LLM suggestion endpoint (`llm.py`)

All API routes are exposed under `/api/v1` when registered.

#### Service layer (`app/services/`)
Business logic lives here (snapshots, users, invitations, bibliography, assessments, proposals).
Services should own:
- authorization checks
- orchestration across multiple CRUD calls
- domain rules and transformations

#### CRUD layer (`app/crud/`)
Database operations only:
- entity fetch/create/update/delete helpers
- query composition
- no endpoint or business branching logic

#### Persistence model
Primary entities include snapshots, nodes, domains, users, authorship, redirects, capabilities, and proposal/consent records (`app/models.py`).

#### Runtime database modes
`app/database.py` supports:
- `APP_MODE=local` (SQLite-based local persistence)
- `APP_MODE=docker` (Postgres service in compose)
- `APP_MODE=production` (managed Postgres, SSL-enforced)

### Frontend Overview
#### API layer (`frontend/api/`)
Base HTTP client and domain-specific services:
- auth
- snapshots
- assessments
- users (present in codebase for evolving profile/social endpoints)

#### Transformer layer (`frontend/transformer/`)
Maps backend shapes (snake_case and backend metadata) to frontend shapes used by state/UI and maps back on save.

#### State layer (`frontend/state/`)
- `lab-state-manager.js`: workspace draft state, graph data, modal/form state, in-editor behavior
- `database-state-manager.js`: snapshot collection + persistence workflow state (backend-facing snapshot lifecycle)

State is intended to be the frontend source of truth.

#### Controllers/UI layer (`frontend/ui/` + templates)
Controllers handle rendering and user interaction wiring:
- `workspace-ui-controller.js`
- `workspace-ops-controller.js`
- `graph-controller.js`
- `database-manager.js` (snapshot backend orchestration boundary)
- `nav-controller.js`

Templates in `frontend/templates/` define page structure; controllers bind behavior.

### Main User-Facing Routes
Served by backend:
- `/` and `/landing`
- `/landing/crisis`, `/landing/solution`, `/landing/components`, `/landing/help`, `/landing/contact`, `/landing/documents`
- `/landing/gallery` (public gallery)
- `/auth/login`
- `/auth/signup`
- `/lab/workspace`
- `/lab/database`
- `/lab/curator-guide`
- `/profile/{user_uuid}` (user profiles)

API and health:
- `/api/v1/*`
- `/health`

## Development

### Local Development (Direct Backend-First Mode)
1. Install dependencies:
   ```powershell
   pip install -r requirements.txt
   ```
2. Start application:
   ```powershell
   uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
   ```
3. Open:
   - `http://localhost:8000/` (landing)
   - `http://localhost:8000/auth/login`
   - `http://localhost:8000/lab/workspace`

### API Documentation
Visit [http://localhost:8000/docs](http://localhost:8000/docs) for the interactive Swagger UI.

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

## Refactor Status and Expectations
The repository still contains transitional patterns.
Examples include:
- mixed usage of layered modules and older monolithic patterns
- places where frontend controller logic still overlaps with responsibilities that should move to stricter layer boundaries

When adding or changing features:
1. Preserve the target layer boundaries from this README.
2. Move logic toward `CRUD -> Services -> API` on backend.
3. Enforce `API -> Transformer -> State -> Controllers/UI` on frontend.
4. Avoid introducing new cross-layer shortcuts, even if existing code still has them.

## Practical Guidance for Contributors
- Treat this file as the architecture contract for new code.
- Keep data contracts explicit at API and Transformer boundaries.
- Prefer incremental refactors that remove cross-layer leakage while preserving behavior.
- If uncertain where new logic belongs, default to:
  - backend business decisions in `services`
  - frontend data manipulation in `transformer` + `state`
  - UI files for rendering/event wiring only
