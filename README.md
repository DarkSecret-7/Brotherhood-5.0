# The Brotherhood v0.1
The official digital infrastructure for The Brotherhood project - a full-stack web application for building, managing, and assessing graph-based knowledge snapshots.

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)

## License
This project is licensed under the **GNU General Public License v3.0**. See the [LICENSE.txt](LICENSE.txt) file for details.

## More information on The Brotherhood project
For more information on The Brotherhood project, please check out the docs or visit the [official website](https://the-brotherhood-project.onrender.com/).

## Project Overview
The project currently functions with two main components:

### The Brotherhood Curator Lab
A local-first graph management system built with Python, FastAPI, and PostgreSQL. It features an interactive Web UI for managing complex node dependencies with automated validation and simplification. Currently invite-only.

### The Brotherhood Public Site
A static, public-facing website built with HTML, CSS, and JavaScript. It features a manifesto, read-only graph gallery, and contact forms.

## Architecture Direction (Important)
The current codebase is **mid-refactor** and follows a strict layering model. This repository contains both legacy patterns and the target architecture documented below.

### Backend Layers (Target)
1. **CRUD**  
   Dumb persistence only: model reads/writes and query helpers.
   - Includes: `snapshots`, `users`, `proposals`, `authorship`, `access_control`, `bibliography`, `assessments`, `invitations`
2. **Services**  
   Business logic, orchestration, authorization decisions, validation rules.
   - Includes: `snapshots`, `bibliography`, `assessments`, `proposals`, `invitations`
3. **API**  
   HTTP endpoints for frontend consumption; converts request/response at the boundary.
   - Includes: `auth`, `snapshots`, `proposals`, `authorship`, `utility`, `llm`, `assessments`

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
│  ├─ api/                    # FastAPI route handlers (auth, snapshots, proposals, authorship, utility, llm, assessments)
│  ├─ crud/                   # Pure database operations (snapshots, users, proposals, authorship, access_control, etc.)
│  ├─ services/               # Business logic layer (snapshots, bibliography, assessments, proposals, invitations)
│  ├─ main.py                 # FastAPI application entry point
│  ├─ database.py             # Engine/session setup
│  ├─ models.py               # SQLAlchemy models
│  ├─ schemas.py              # Pydantic request/response schemas
│  ├─ utils.py                # Auth helpers, email utilities, import/export (.knw), validation
│  └─ crud.py                 # DEPRECATED: Transitional monolith (being migrated to app/crud/)
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
├─ LICENSES.txt               # GNU GPL v3.0 open-source license
├─ README.md                  # Overview of the repositiory
├─ start-services.sh          # Orchestrator for the project, to be copied inside the docker container
├─ alembic.ini                # Alembic database migration configuration
├─ alembic/                   # Database migration scripts
│  ├─ versions/               # Migration version files
│  └─ run_migration.py        # Helper script to upgrade database to latest config
```

## Prerequisites

- **Docker Desktop** must be installed and running.
- **Python 3.10+** (for local development outside Docker).

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

### 3. Install Python Dependencies (Optional)
For local development outside Docker:
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

4. **Dashboard** (authenticated)
   - **URL**: `http://localhost:8000/dashboard/`
   - View and manage user infomartion like profiles and graph bookmarks

### 5. Import & Export (.knw)
The system supports a custom `.knw` (Knowledge Graph) file format for sharing graphs. The .knw format is **JSON-based** with a `.knw` extension.

**⚠️ CRITICAL: There is only one .knw format.** Both the backend API and frontend workspace use identical field naming and structure. Any inconsistency will cause data loss or import failures.

**Export:**
- Open any graph snapshot.
- Click **"Download .knw"** inside the "Export" section of the graph details.
- The file contains all nodes, domains, metadata, and sources.

**Import:**
- **Global Import**: Use the "Import Graph (.knw)" button on the Database Management dashboard to add a new graph.
- **Overwrite**: Inside an existing graph's settings, you can import a `.knw` file to completely replace the current graph content (requires confirmation).
- **Smart Resolution**: The importer automatically resolves user references (creators) and base graph links. If a referenced user or graph is missing, it defaults to safe values ("Unknown" or null) to prevent errors.

#### .knw File Format Specification

```json
{
  "public_uuid": "uuid-string-or-null",
  "base_uuid": "uuid-string-or-null",
  "version_label": "Graph Name",
  "base_graph_label": "Parent Graph Name or null",
  "created_at": "ISO-8601-timestamp",
  "last_updated": "ISO-8601-timestamp",
  "authors": [{"user_uuid": "...", "username": "..."}],
  "nodes": [{
    "local_id": 1,
    "title": "Node Title",
    "description": "...",
    "prerequisite": "(1 AND 2) OR 3",
    "mentions": {"5": true},
    "domain_id": 1,
    "x": 100.5,
    "y": 200.3,
    "assessable": true,
    "source_items": [{
      "title": "Source Title",
      "bib_type": "PDF",
      "author": "Author Name",
      "year": 2024,
      "url": "https://example.com",
      "fragment_start": "Chapter 1",
      "fragment_end": "Page 10",
      "bib_hash": "64-char-sha256-hex",
      "source_uuid": "uuid-string"
    }]
  }],
  "domains": [{"local_id": 1, "title": "Domain", "description": "...", "parent_id": null}],
  "redirects": [{"old_local_id": 5, "new_local_id": 10}]
}
```

**Critical Field Names (snake_case required in .knw files):**
| Field | Description |
|-------|-------------|
| `bib_hash` | Bibliography SHA-256 hash (64-char hex). **Must be `bib_hash`, not `public_hash`.** |
| `bib_type` | Source type: "PDF", "Video", "Other" |
| `source_uuid` | Unique identifier for source fragment |
| `fragment_start` / `fragment_end` | Optional positioning info |
| `local_id` | Node/domain ID within the snapshot |
| `domain_id` | Parent domain for a node |

### 6. Graph Visualization (Under Development)
The graph visualization system is currently under active development. The architecture consists of:
- **GraphVisualizer** (`frontend/components/graph-visualizer.js`): Core visualization component using vis.js
- **Domain-specific controllers**: `graph-controller.js` for workspace, `gallery-graph-processor.js` for gallery

Planned features include drag-and-drop positioning, domain grouping, and interactive pathway exploration.

### 7. Database Migrations (Alembic)
The project uses Alembic for database schema migrations. Migrations run automatically when the Docker container starts.

**Migration Files:** Located in `alembic/versions/`

**Running Migrations Manually:**
```bash
# Using the helper script
python alembic/run_migration.py upgrade

# Or directly with Alembic
python -m alembic upgrade head

# Check current version
python alembic/run_migration.py current

# Show migration history
python alembic/run_migration.py history
```

**Note:** When building the Docker container, migrations run automatically via `start-services.sh` before the application starts.

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

### Graph Governance (Proposals)
A consent-based governance system for graph management:
- **Proposal Types**: Join (request to join as author), Invite (invite another user), Merge (merge graphs), Delete (remove graph)
- **Voting**: Authors vote approve/reject on proposals
- **Automatic Execution**: Delete proposals execute immediately when approved
- **API**: `/api/v1/proposals/*` endpoints

### Authorship Management
Multi-author graph collaboration:
- **Add Authors**: Existing authors can add new authors with roles (Curator, Editor, Viewer)
- **Role-Based Access**: Different permission levels for graph modifications
- **Last Author Protection**: Cannot remove the sole remaining author
- **API**: `/api/v1/snapshots/{uuid}/authors/*` endpoints

### Reference Integrity
- **Mentions**: Each node tracks which other nodes reference it in their prerequisites.
- **Validation**: You cannot reference a non-existent node ID.
- **Cascade Updates**: Renaming a node's ID propagates the change to all referencing nodes automatically.
- **Safe Deletion**: Deleting a node automatically removes its ID from all other nodes' prerequisites.

### Circularity Detection
The system prevents the creation of circular dependencies (e.g., A -> B -> A) by performing a cycle check during every create or update operation.

### AI-Powered Suggestions
- **Multi-Model Support**: Choose from various AI models (Qwen, Claude, Gemini, GPT-4o, Llama, DeepSeek) via OpenRouter.
- **Context-Aware**: The system uses AI to suggest new nodes based on your prompt and the current graph structure.
- **Selection-Aware Context**: When nodes are selected, only those nodes are used as context for more focused suggestions. A blue reminder banner shows when this is active.
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
- LLM suggestion endpoint (`llm.py`) using OpenRouter API with multi-model support

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
- `/profile/{user_uuid}` (user profiles - UI under development)

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

## Deployment to Render (with Supabase Database)

This project uses a split architecture:
- **Backend**: Deployed to [Render](https://render.com)
- **Database**: Hosted on [Supabase](https://supabase.com)

### 1. Set Up Supabase Database
1. Create a project on [Supabase](https://supabase.com)
2. Go to **Database → Connection String → URI (Direct connection)**
3. Copy the connection string (use port 5432, not the pooler)
4. Note: Keep the password handy (or reset it if needed)

### 2. Connect Render to Supabase
1. Go to your **Render Web Service** dashboard
2. Click **Environment**
3. Add/Update the environment variable:
   - **Key**: `DATABASE_URL`
   - **Value**: `postgresql://postgres:YOUR_PASSWORD@db.YOUR_PROJECT.supabase.co:5432/postgres`
4. Ensure `APP_MODE` is set to `production`
5. Save changes and the service will redeploy

### 3. Troubleshoot Connection Issues
If the logs show connection errors:
- Verify the Supabase database password is correct
- Ensure you're using the **direct connection** (port 5432), not the pooler
- Check that `sslmode=require` is enforced (handled automatically in `app/database.py`)

## Authentication & Security

- **Invite-Only Signup**: Registration is restricted to users with a valid invitation code. Administrators must generate invitation codes via the backend/admin interface.
- **JWT Authorization**: Backend endpoints are protected using OAuth2 with Password Flow and JWT tokens (2-day expiry).
- **Secure Access**: The workspace is only accessible to authenticated users.

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `APP_MODE` | `production`, `docker`, or `local`. Controls database connection strategy. Use `production` for Render + Supabase. | Yes |
| `DATABASE_URL` | PostgreSQL connection string. For Supabase: `postgresql://postgres:PASSWORD@db.PROJECT.supabase.co:5432/postgres` | For docker/prod |
| `OPENROUTER_API_KEY` | OpenRouter API key for AI node suggestions. If missing, returns mock data. Get one at https://openrouter.ai/keys | No |
| `SECRET_KEY` | JWT signing key (has hardcoded default for development only). | Production |
| `EMAIL_HOST` | SMTP server hostname for contact form. | For contact form |
| `EMAIL_PORT` | SMTP server port. | For contact form |
| `EMAIL_USER` | SMTP authentication username. | For contact form |
| `EMAIL_PASSWORD` | SMTP authentication password. | For contact form |

### Supabase Database Configuration
When using Supabase with Render:
1. Use the **Direct connection** (port 5432) - not the pooler
2. SSL is enforced automatically (`sslmode=require`)
3. The connection string format: `postgresql://postgres:PASSWORD@db.PROJECT_ID.supabase.co:5432/postgres`

## Refactor Status and Expectations
The repository still contains transitional patterns.

### Legacy Code (Migration in Progress)
- **`app/crud.py`**: DEPRECATED - Transitional monolith being migrated to `app/crud/` module. Do not add new code here.
- **`static [LEGACY]/`**: Old frontend assets. Being replaced by `frontend/` architecture.
- **`templates [LEGACY]/`**: Old HTML templates. Being replaced by `frontend/templates/`.
- **`profile [LEGACY]/`**: Old profile management. Being replaced by `frontend/templates/lab/user-profile.html`.

### Current Patterns to Follow
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
