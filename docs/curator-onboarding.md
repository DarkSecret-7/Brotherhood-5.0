# Curator Onboarding Guide

Welcome to the **Curator Lab** — the graph authoring environment for The Brotherhood Project. This guide covers the full curator workflow: drafting in the workspace, saving to the database, collaborating with co-authors, and sharing graphs via `.knw` files.

**Key pages**


| Page                   | URL                    | Purpose                                                        |
| ---------------------- | ---------------------- | -------------------------------------------------------------- |
| Workspace              | `/lab/workspace`       | Draft and edit nodes/domains                                   |
| Database Management    | `/lab/database`        | List, import, export, and manage saved graphs                  |
| Curator Guide (in-app) | `/lab/curator-guide`   | Same content rendered in the app                               |
| Proposals Dashboard    | `/dashboard/proposals` | Vote on proposals, track join requests, respond to invitations |


You must be logged in to access the Lab.

---



## 1. How the Lab fits together

The Lab splits **draft editing** from **database operations**:

- **Workspace** holds your current draft (nodes, domains, layout). Changes here are local until you save.
- **Database Management** talks to the server: list graphs, fetch into workspace, import/export `.knw`, manage visibility, collaboration, and deletion.

Typical flow:

1. **Fetch** a graph from Database Management → opens in Workspace.
2. Edit in **Node Draft** / **Graph Visualizer**.
3. **Save Version** to persist changes (new graph or overwrite).
4. Manage metadata, collaborators, and exports from **Database Management**.

Your draft is also persisted to **browser localStorage**, so a refresh usually recovers unsaved work — but always save important changes to the database.

---



## 2. The Workspace

Open `/lab/workspace`. Three tabs:

### Node Draft

Your sandbox. Nothing is permanent until you save to the database.

- **Active Workspace** — list of draft domains and nodes. Use **Add Domain** or the **Add New Node** sidebar.
- **Toolbar** (below tabs) — shows which graph you are working on; **Import** loads a `.knw` into the draft; **Clear Workspace** resets the draft.
- **✨ AI Suggest** — opens the suggestion modal (see §9).

Click a node or domain in the list to edit or delete it. Edited items are marked dirty until saved.

### Graph Visualizer

Interactive graph view powered by **vis.js**.

- Arrows point from **prerequisite** → **dependent** node.
- **Reset Layout** / **Randomise** / **Fix Positions** / **Refresh Graph** control layout and re-render.
- Node positions are saved with the snapshot — arrange the graph before saving.



### Save Version

Persist the draft to the database.

1. Enter a **Version Label** (required).
2. **Overwrite base graph** — see §5 for when to use this.
3. **Save Snapshot** — writes to the database (with confirmation if overwriting).
4. **Export .knw** — downloads the current draft as a file without saving to the DB (see §8).

---



## 3. Building blocks: Domains & Nodes



### Domains

Organizational containers (chapters, subject areas, folders).

- Click **Add Domain**, give it a **name** and numeric **ID** (e.g. 100, 200).
- Domains can nest via parent relationships when editing.



### Nodes

Individual concepts within domains.

In **Add New Node**:


| Field                       | Description                                    |
| --------------------------- | ---------------------------------------------- |
| **Local ID**                | Unique integer within the graph (e.g. 1, 2, 3) |
| **Title**                   | Short name                                     |
| **Description**             | Longer explanation (optional)                  |
| **Under Domain ID**         | Which domain this node belongs to              |
| **Prerequisite Expression** | What must be learned first (see §4)            |
| **Sources**                 | Bibliography links (see below)                 |


Click **Add to Draft**. Use the edit modal on existing nodes to change fields, toggle **Assessable**, or enable **Propagate Changes** when renaming an ID (updates references in other nodes' prerequisites).

Assessable nodes appear with an **A** badge in the draft list. They matter for Academia self-assessments and redirect rules on save (§5).

### Sources & Bibliography

Each node can link to shared bibliography entries:

- **Title**, **Author**, **Type** (PDF / Video / Other), **Year**, **URL**
- **Fragment** — optional positioning (e.g. `Chapter 3`, `00:05:30-00:10:00`)

The same source entry is reused when multiple nodes reference the same resource.

---



## 4. Prerequisites

Define learning order with boolean expressions:


| Expression       | Meaning         |
| ---------------- | --------------- |
| `1`              | Requires node 1 |
| `1 AND 2`        | Requires both   |
| `1 OR 2`         | Requires either |
| `(1 AND 2) OR 3` | Combined logic  |


**Important:** After editing a prerequisite field, **click outside the input** (unfocus). The system then parses, validates, simplifies, and applies transitive reduction (removing redundant dependencies).

The system also enforces:

- **Reference integrity** — you cannot reference a non-existent node ID.
- **Cascade updates** — renaming a node ID can propagate to all referencing prerequisites (use **Propagate Changes** in the edit modal).
- **Safe deletion** — deleting a node removes its ID from other nodes' prerequisites.
- **Circularity detection** — cycles like A → B → A are blocked.

---



## 5. Saving, overwriting & remixing



### New graph vs overwrite

On the **Save Version** tab:


| Overwrite toggle | Result                                                |
| ---------------- | ----------------------------------------------------- |
| **Unchecked**    | Creates a **new** graph snapshot (fork).              |
| **Checked**      | **Overwrites** the graph you loaded from (same UUID). |


When you **Fetch** an existing graph into the workspace, the overwrite toggle is enabled and pre-checked — you are editing that snapshot. Clearing the workspace or starting fresh disables overwrite; saving then creates a new graph.

Saving with overwrite asks for confirmation before replacing all server data.

### Remixing someone else's graph

1. **Fetch** their graph from Database Management (any registered user can fetch for editing).
2. Edit in the workspace.
3. **Uncheck Overwrite base graph** and give a new **Version Label**.
4. **Save Snapshot** — creates your own graph linked to theirs via `base_uuid`.

You cannot overwrite a graph unless you are an **author** with write permission.

---



## 6. Database Management

Open `/lab/database` to manage saved graphs.

### Graph list

Each row shows version label, node count, assessable count, authors, and base graph. Actions:

- **Click the version name** — open the **Manage Graph** modal.
- **Fetch** — load the graph into the workspace (clears current draft; redirects to Workspace).



### Manage Graph modal

**Metadata**

- Edit **Graph Name**, toggle **Public Access** (visible in the public gallery), click **Save Changes**.

**Collaboration** (authors only)

- **Invite** — enter another user's UUID and send an invitation (see §7).
- Non-authors see **Join Graph** instead.

**Pending Proposals** (authors only)

- Lists proposals awaiting votes on this graph. Click to view details and vote.

**Export**

- **Download .knw** — server-side export of the saved graph.

**Danger Zone**

- **Delete Graph** — remove the graph (see §7 for multi-author behaviour).



### Global import

Click **Import Graph (.knw)** on the main database page to upload a file as a **new** database graph. Optionally check **Overwrite if a graph with the same version label exists**. Note that this will replace all teh data with the data of the new graph and you can not do so unless you are an author.

---



## 7. Proposals & collaboration

Graph authorship changes use a **consent-based proposal system**. Authors vote; the proposer and target user do not count toward the remaining vote tally.

Manage everything from:

- **Database Management → Manage Graph** (per-graph pending list + invite/join actions)
- **Dashboard → Proposals** (`/dashboard/proposals`) — three tabs:


| Tab                 | Shows                                                   |
| ------------------- | ------------------------------------------------------- |
| **Graph Proposals** | Proposals on graphs where you are an author (vote here) |
| **Join Requests**   | Join requests you submitted                             |
| **Invitations**     | Direct authorship invitations sent to you               |


Click any item to open details. Pending proposals let authors **Approve** or **Reject**. Proposers can **Delete** their own pending proposals.

### Proposal types


| Type       | Who initiates                     | What happens when approved               |
| ---------- | --------------------------------- | ---------------------------------------- |
| **Join**   | Non-author requests collaboration | Requestor becomes an author              |
| **Invite** | Author invites a user             | Target receives an authorship invitation |
| **Remove** | Author removes a co-author        | Target loses authorship                  |
| **Delete** | Author deletes the graph          | Graph is permanently removed             |




### Direct actions vs proposals

Some actions skip voting when consensus is not meaningful:


| Action               | Direct (immediate)                        | Proposal (requires votes)          |
| -------------------- | ----------------------------------------- | ---------------------------------- |
| **Join**             | Never — always a Join proposal            | Always                             |
| **Invite**           | Sole author → direct invitation to target | Multiple authors → Invite proposal |
| **Remove co-author** | Exactly two authors → immediate removal   | Three or more → Remove proposal    |
| **Delete graph**     | Sole author → immediate delete            | Multiple authors → Delete proposal |




### Invitations (separate from Invite proposals)

When a **sole author** invites someone, the target gets a direct **Authorship Invitation** (not a proposal). They accept or decline on the **Invitations** tab in Dashboard → Proposals.

When an **Invite proposal** is approved, the system sends an invitation to the target — they still must accept before becoming an author.

### Voting rules

- Only **authors of the affected graph** may vote (except viewing your own join requests).
- Each author gets one vote: approve (+1) or reject (−1).
- When all relevant authors have voted: **more approvals than rejections → executed**; otherwise **rejected**.
- Status values: `Pending`, `Executed`, `Rejected`.



### Collaboration UI quick reference

**As an author**

1. Open graph in Database Management → **Manage Graph**.
2. Enter user UUID under Collaboration → **Invite**.
3. Monitor **Pending Proposals** in the modal or vote on **Dashboard → Proposals**.

**As a non-author**

1. Open the graph → **Join Graph**.
2. Track status under **Dashboard → Proposals → Join Requests**.
3. Wait for authors to approve your Join proposal.

**Removing a co-author**

- Done via the authorship API (`DELETE /snapshots/{uuid}/authors/{user_uuid}`). With two authors this executes immediately; with three or more it creates a Remove proposal. *(UI for removal is API-only today.)*

**Last author protection**

- A graph always retains at least one author. You cannot remove yourself via the remove action — a co-author must initiate removal.

---



## 8. Import & export (.knw v1.0)

The `.knw` format is the portable graph exchange format. Both the backend and frontend use the **same v1.0 binary spec** — field names and hashing must match or imports will fail.

### Format summary


| Part                 | Details                                                                                |
| -------------------- | -------------------------------------------------------------------------------------- |
| **Header** (6 bytes) | Magic `KNW` + protocol version `1` + compression id `1` (zstd)                         |
| **Payload**          | zstd-compressed JSON: `{ metadata, graph, graphHash, fileHash }`                       |
| **metadata**         | Identity: `uuid`, `version_label`, `base_uuid`, `authors`, `license`, timestamps, etc. |
| **graph**            | Contents: `nodes`, `domains`, `redirects` (plus export metadata fields)                |
| **Hashes**           | SHA-256 over canonical JSON (RFC 8785 / JCS). Tampered files are rejected.             |


Default license on export: **CC-BY-SA-4.0**.

On import, if `metadata.authors` is present the first entry becomes the creator; remaining authors are reattached when their UUIDs exist in the database. Unknown author UUIDs are skipped and authorship falls back to the importing user.

Full spec: `app/utils/knw_format.py` and `frontend/utils/knw-format.js`.

### Five import/export paths


| Where                  | Action                  | Effect                                                                                                     |
| ---------------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------- |
| **Workspace toolbar**  | **Import**              | Loads `.knw` into the **draft only** (replaces workspace; unsaved work lost). Does not touch the database. |
| **Save Version tab**   | **Export .knw**         | Downloads the **current draft** as a file (client-side). Requires a version label.                         |
| **Database list**      | **Import Graph (.knw)** | Uploads to the **database** as a new graph. Optional overwrite if version label matches.                   |
| **Manage Graph modal** | **Download .knw**       | Exports the **saved server snapshot**.                                                                     |




### Practical tips

- Use **Export .knw** or **Download .knw** for backups and sharing.
- Use **workspace Import** to preview or edit a file locally before committing via Save.
- Use **global import** to seed the database from a file without opening the workspace.
- Use **the workspace import/export** to completely bypass the server for personal uses.

---



## 9. AI assistance

Click **✨ AI Suggest** in the workspace.

1. Choose a model and enter a prompt (e.g. "steps to learn Python").
2. The AI suggests nodes based on your graph structure.
3. Select suggestions and click **Import Selected** — nodes are added to the draft with assigned IDs.

**Selection-aware context:** When nodes are selected in the draft list, only those nodes are sent as context (a banner indicates this). Useful for focused expansion within one domain.

Requires an `OPENROUTER_API_KEY` on the server; without it the API returns mock suggestions.

---



## 10. Reference integrity & validation (summary)

When editing prerequisites the system automatically:

1. Parses boolean expressions into an AST.
2. **Simplifies** the expression on input blur.
3. Applies **transitive reduction** (e.g. if A→B and B→C, redundant A→C is removed).
4. Validates references, prevents cycles, and cascades ID changes when requested.

---



## 11. Getting help

- **In-app guide:** `/lab/curator-guide`
- **API docs:** `/docs` (Swagger UI when running locally)
- **Technical architecture:** `README.md` and `AGENTS.md` in the repository root

Happy curating.