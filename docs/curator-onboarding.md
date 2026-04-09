# Welcome to The Brotherhood Curator Lab! 🌟

This guide will help you get started with building and curating the knowledge graph. Think of this tool as a digital whiteboard where you can map out ideas, connect them, and organize them into a structured learning path.

## 1. The Workspace: Your Digital Drafting Table 🎨

When you log in, you land on the **Node Draft** tab. This is your sandbox. Nothing here is permanent until you decide to save it, so feel free to experiment!

*   **Draft Nodes List**: This is where your new ideas (Nodes) and groups (Domains) will appear as you create them.
*   **Persistent Toolbar**: Located below the tabs, it shows the active version you are working on and provides a **"Clear Workspace"** button to reset your draft.
*   **Graph Visualizer**: Click the tab to see a picture of your connections. Use this often to see how your ideas link together!

## 2. Building Blocks: Domains & Nodes 🧱

### Domains (The Big Buckets) 📂
Domains are like chapters in a book or folders on your computer. They help keep things organized.
*   **To Add a Domain**: Click the blue **Add Domain** button at the top.
*   **Give it a Name**: Like "History", "Science", or "Chapter 1".
*   **Give it an ID**: A simple number (e.g., 100, 200) to keep it sorted.

### Nodes (The Ideas) 💡
Nodes are the specific topics, facts, or concepts within those domains.
*   **Scroll down to "Add New Node"**.
*   **Local ID**: Pick a unique number for this node (e.g., 1, 2, 3).
*   **Title**: What is this concept called?
*   **Description**: A short explanation.
*   **Under Domain ID**: Type the ID of the Domain this node belongs to (e.g., 100).
*   **Sources**: Where can one learn about this? Click **Add Source** to link it to a resource.
*   **Click "Add to Draft"**: Watch it appear in your list above!

### 📚 Sources & Bibliography

Each node can have multiple sources linked to it. Sources are stored in a shared bibliography:

*   **Title**: Name of the resource (e.g., "Introduction to Python")
*   **Author**: Who created the resource
*   **Type**: PDF, Video, or Other
*   **Year**: Publication year (optional)
*   **URL**: Link to the resource (optional)
*   **Fragment**: For specific sections (e.g., "Chapter 3" or "00:05:30-00:10:00")

Sources are reused across nodes - if multiple nodes reference the same book, they share the same bibliography entry.

## 3. Connecting the Dots (Prerequisites) 🔗

This is the most powerful part! You can define what needs to be learned *before* something else.
*   **Prerequisite Expression**: In the "Add New Node" section, you can say "To learn Node 3, you must know Node 1 and Node 2".
*   **How to write it**:
    *   Simple: `1` (Means you need Node 1 first).
    *   Combined: `1 AND 2` (Need both).
    *   Options: `1 OR 2` (Need either one).
    *   Complex: `(1 AND 2) OR 3`.
    *   **CRITICAL**: You must **click outside the box** (unfocus) for the system to process and simplify your expression!

## 4. Graph Visualization (Under Development) 👁️

The graph visualization feature is currently under active development and may not be fully functional.

**Current Architecture:**
- Core visualizer: `frontend/components/graph-visualizer.js` (vis.js-based)
- Workspace controller: `frontend/ui/lab/graph-controller.js`
- Gallery processor: `frontend/components/gallery-graph-processor.js`

Future features planned: drag-and-drop node positioning, domain grouping visualization, and interactive prerequisite pathway exploration.

## 5. Saving & Publishing 💾

Once you're happy with your draft:

1.  Switch to the **Save Version** tab.
2.  **Your Layout Matters**: The system saves the exact position of every node. Make sure your graph looks good before saving!
3.  **Overwrite Toggle**:
    *   **Unchecked**: Creates a brand new graph. Redirection for assessable nodes is **optional** but recommended.
    *   **Checked**: Updates the existing graph (use this if you're editing). Redirection for any changed or removed assessable nodes is **mandatory** to ensure capability trail stability.

### 🔒 Assessable Nodes & Stability
Assessable nodes (marked with ⭐) are critical for tracking progress. If you change their ID or remove them, you should provide a **Redirect ID**. This tells the system where the "capability" formerly represented by that node has moved to. 

*   **Mandatory Overwrite Protection**: You cannot overwrite a graph if you've broken an assessable node trail without providing a valid redirect.
*   **Version Control**: Redirects are saved with a timestamp, creating a permanent audit trail of how capabilities have evolved. Each redirect records when the change occurred, preserving the complete history of capability transformations.

### 🔒 Ownership & Remixing
*   **Updating Your Work**: You can overwrite your own graphs by checking the **Overwrite** option during save.
*   **Remixing Others' Work**: You can save a copy of someone else's graph as a new version (e.g., "My Remix v1"). If you try to overwrite their graph directly, the system will warn you.
*   **Import/Export**: You can now export your graphs to `.knw` files to share them or back them up. To import a graph, use the "Import Graph" button on the dashboard or inside a graph's settings to overwrite it.

### 👥 Managing Graph Authors
Graphs support multiple authors with role-based permissions:

*   **Roles**: Authors can be assigned roles - **Curator** (full control), **Editor** (can modify content), **Viewer** (read-only).
*   **Adding Authors**: Existing authors can add new authors via the API (UI feature coming soon).
*   **Last Author Protection**: The system prevents removing the last remaining author to ensure graphs always have ownership.

## 6. Standalone Workspace: No Database Required 💻

The workspace can function as a **standalone web app** without any database connection - perfect for creating personal graphs privately!

### How It Works
*   **Local Storage**: Your graph data is saved to your browser's local storage.
*   **No Database Needed**: Create, edit, and visualize graphs entirely offline.

### Import/Export Directly in Workspace
*   **Export**: Click **"Export Graph (.knw)"** at the top of the workspace to download your graph as a file.
*   **Import**: Click **"Import Graph (.knw)"** to load a previously exported graph into your workspace.
*   **Share**: Send the `.knw` file to others - they can import it into their own standalone workspace.

### When to Use Standalone Mode
*   Creating personal knowledge graphs you don't want to publish
*   Drafting graphs offline before uploading to the database
*   Sharing graphs with friends without them needing accounts
*   Privacy-sensitive content that stays local-only

## 7. AI Assistance 🤖

Stuck on what to add next? Let the AI help you!

*   **Click "✨ AI Suggest"**: Located at the top of the workspace.
*   **Enter a Topic**: Ask for "steps to learn Python" or "key events in WWII".
*   **Get Suggestions**: The AI analyzes your current graph to provide relevant, modular additions.
*   **Select & Import**: Check the boxes for the nodes you like and click **"Import Selected"**. They will be automatically added to your draft with the correct IDs!

---
**Happy Curating!** 🚀
