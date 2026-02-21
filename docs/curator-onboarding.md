# Welcome to the Brotherhood Graph Builder! 🌟

This guide will help you get started with building and curating the knowledge graph. Think of this tool as a digital whiteboard where you can map out ideas, connect them, and organize them into a structured learning path.

## 1. The Workspace: Your Digital Drafting Table 🎨

When you log in, you land on the **Workspace Draft** tab. This is your sandbox. Nothing here is permanent until you decide to save it, so feel free to experiment!

*   **Draft Nodes List**: This is where your new ideas (Nodes) and groups (Domains) will appear as you create them.
*   **Active Workspace**: Shows you what you're currently working on.
*   **Graph Visualizer**: A magic button that draws a picture of your connections. Use this often to see how your ideas link together!

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
*   **Sources**: Where can one learn about this? Click **Add Source** to link it to a resource (e.g., a PDF, a video, or others).
*   **Click "Add to Draft"**: Watch it appear in your list above!

## 3. Connecting the Dots (Prerequisites) 🔗

This is the most powerful part! You can define what needs to be learned *before* something else.
*   **Prerequisite Expression**: In the "Add New Node" section, you can say "To learn Node 3, you must know Node 1 and Node 2".
*   **How to write it**:
    *   Simple: `1` (Means you need Node 1 first).
    *   Combined: `1 AND 2` (Need both).
    *   Options: `1 OR 2` (Need either one).
    *   Complex: `(1 AND 2) OR 3`.

## 4. Visualizing Your Work 👁️

*   Click **Show Graph Visualizer** at the top.
*   You'll see arrows pointing from the *prerequisite* to the *dependent* node.
*   If the arrows look like a tangled mess, don't worry! It means you're building something complex and interesting.

## 5. Saving & Publishing 💾

Once you're happy with your draft:

1.  Scroll to the bottom **Save to Database** section.
2.  **Overwrite Toggle**:
    *   **Unchecked**: Creates a brand new graph.
    *   **Checked**: Updates the existing graph (use this if you're editing).
3.  **Version Label**: Give it a name like "Draft v1" or "Final Version".
4.  **Click "Create Versioned Snapshot"**: Your work is now saved safely in the database!

### 🔒 Ownership & Remixing
*   **Updating Your Work**: If you are the original creator of the graph, you will see the **Overwrite base graph** checkbox. Check this if you want to update your existing version.
*   **Remixing Others' Work**: If you are building on top of someone else's graph, the **Overwrite** option will be hidden. This protects their original work! You can still make changes and save, but it will automatically be saved as a **new** graph (your own copy).

---
**Happy Curating!** 🚀
