# The Brotherhood Project

Digital infrastructure for building, managing, and assessing graph-based knowledge snapshots.

[License: GPL v3](https://www.gnu.org/licenses/gpl-3.0)

Licensed under **GNU GPL v3.0** — see [LICENSE.txt](LICENSE.txt).

Website: [the-brotherhood-project.onrender.com](https://the-brotherhood-project.onrender.com/)

## Components


| Area            | Path              | Purpose                                                            |
| --------------- | ----------------- | ------------------------------------------------------------------ |
| **Curator Lab** | `/lab/`*          | Invite-only graph authoring workspace and database management      |
| **Academia**    | `/academia/`*     | Self-assessment, learning paths, and graph library (authenticated) |
| **Dashboard**   | `/dashboard/`*    | Profile, bookmarks, and proposal management (authenticated)        |
| **Public site** | `/`, `/landing/`* | Documentation, gallery, contact form, legal documents              |




## Quick Start

**Prerequisites:** Docker Desktop (recommended) or Python 3.10+.

```powershell
docker-compose up -d --build
```

Optional `.env` for remote database:

```
DATABASE_URL=postgresql://user:password@host:port/database
APP_MODE=production
OPENROUTER_API_KEY=your_key
```


| URL                                                                     | Access                                 |
| ----------------------------------------------------------------------- | -------------------------------------- |
| [localhost:8000](http://localhost:8000)                                 | Public landing page                    |
| [localhost:8000/lab/workspace](http://localhost:8000/lab/workspace)     | Curator workspace (auth required)      |
| [localhost:8000/lab/database](http://localhost:8000/lab/database)       | Snapshot management (auth required)    |
| [localhost:8000/academia](http://localhost:8000/academia)               | Assessments & learning (auth required) |
| [localhost:8000/dashboard](http://localhost:8000/dashboard)             | User dashboard (auth required)         |
| [localhost:8000/landing/gallery](http://localhost:8000/landing/gallery) | Public graph gallery                   |
| [localhost:8000/docs](http://localhost:8000/docs)                       | Swagger API docs                       |


Auth pages: `/auth/login`, `/auth/signup`.

## Repository Structure

```
.
├── app/
│   ├── api/           # FastAPI routers (auth, snapshots, proposals, authorship, utility, bookmarks, llm, assessments)
│   ├── services/      # Business logic
│   ├── crud/          # Database operations
│   ├── utils/         # Auth, email, validation, knw_format.py
│   ├── main.py        # App entry, page routes, static mounts
│   ├── models.py
│   ├── schemas.py
│   └── database.py
├── frontend/
│   ├── api/           # HTTP client services
│   ├── transformer/   # Backend ↔ frontend conversion
│   ├── state/         # State managers (lab, database, dashboard, gallery, academia, …)
│   ├── ui/            # Controllers (lab, dashboard, academia, gallery, landing, nav)
│   ├── components/    # reusable components like graph-visualizer.js (vis.js)
│   ├── templates/     # HTML (auth, lab, landing, dashboard, academia)
│   └── css/
├── self_assessment/   # Standalone assessment engine
├── migrations/        # Alembic migration scripts (config in alembic.ini)
├── docs/
├── docker-compose.yml
├── Dockerfile
├── render.yaml
└── start-services.sh  # Migrations + uvicorn (+ static server on :3000 in container)
```



## Architecture



### Backend layers

`API → Services → CRUD`. No business logic in CRUD; no direct DB access from API.

### Frontend layers

`API → Transformer → State → UI`. Workspace draft state (`lab-state-manager`) is isolated from snapshot persistence (`database-state-manager`). Controllers orchestrate cross-domain handoffs.

### Data flow

- **Read:** Backend CRUD → Service → API → Frontend API → Transformer → State → UI
- **Write:** UI → State → Transformer → Frontend API → Backend API → Service → CRUD



## Import & Export (.knw v1.0)

Binary format: 6-byte header (`KNW` + version + compression) + zstd-compressed JSON.

Payload shape: `{ metadata, graph, graphHash, fileHash }`. Identity fields (`uuid`, `version_label`, `authors`, `license`, …) live in `metadata`; `graph` contains only `nodes`, `domains`, `redirects`.

- **Export:** "Download .knw" in graph details
- **Import:** Database dashboard (new graph) or graph settings (overwrite)
- **Spec:** `app/knw_format.py` and `frontend/utils/knw-format.js` — field names must match



## Database Migrations

Alembic scripts in `migrations/versions/`. Run automatically on container start via `start-services.sh`.

```bash
python migrations/run_migration.py upgrade   # or: python -m alembic upgrade head
python migrations/run_migration.py current
```



## Key Features

- **Prerequisites** — Boolean expressions (`(1 AND 2) OR 3`) with AST parsing, simplification, and transitive reduction
- **Governance** — Join, Invite, Remove, Delete proposals with author voting
- **Authorship** — Multi-author graphs with role-based access
- **AI suggestions** — OpenRouter multi-model node suggestions (`/api/v1/llm/suggest`)
- **Self-assessment** — Capability tracking against graph nodes
- **Bookmarks** — Save public graphs to your dashboard
- **Reference integrity** — Prerequisite validation, cascade ID updates, circularity detection



## Environment Variables


| Variable             | Required     | Description                        |
| -------------------- | ------------ | ---------------------------------- |
| `APP_MODE`           | Yes          | `production`, `docker`, or `local` |
| `DATABASE_URL`       | docker/prod  | PostgreSQL connection string       |
| `OPENROUTER_API_KEY` | No           | AI suggestions; mock data if unset |
| `SECRET_KEY`         | Production   | JWT signing key                    |
| `EMAIL_*`            | Contact form | SMTP settings                      |


See [.env.example](.env.example).

## Deployment

Deployed to [Render](https://render.com) via `render.yaml`. Set `DATABASE_URL` to your PostgreSQL instance (Render, Supabase, etc.) and `APP_MODE=production`. Migrations run on startup.

## Development

```powershell
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

When adding features, follow the layer boundaries above. Backend business logic goes in `services`; frontend data shaping in `transformer` + `state`; UI files handle rendering and events only.