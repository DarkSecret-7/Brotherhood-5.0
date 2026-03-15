import typer
import requests
import json
import os
from typing import Optional, List
from rich.console import Console
from rich.table import Table

app = typer.Typer()
console = Console()

API_URL = os.getenv("BROTHERHOOD_API_URL", "http://localhost:8000/api/v1")

@app.command()
def list_saved_graphs():
    """Fetch and list all graph versions saved in the database."""
    try:
        response = requests.get(f"{API_URL}/snapshots")
        response.raise_for_status()
        snapshots = response.json()
        
        table = Table(title="Saved Graph Versions")
        table.add_column("ID", style="cyan")
        table.add_column("Created At", style="blue")
        table.add_column("Label", style="yellow")
        table.add_column("Node Count", style="green")

        for s in snapshots:
            table.add_row(
                str(s["id"]),
                s["created_at"],
                s["version_label"] or "",
                str(s["node_count"])
            )
        console.print(table)
    except Exception as e:
        console.print(f"[bold red]Error fetching snapshots:[/bold red] {e}")

@app.command()
def delete_graph(snapshot_id: int):
    """Permanently delete a snapshot from the database."""
    if not typer.confirm(f"Are you sure you want to PERMANENTLY delete snapshot {snapshot_id}?"):
        return
    
    try:
        res = requests.delete(f"{API_URL}/snapshots/{snapshot_id}")
        res.raise_for_status()
        console.print(f"[bold red]Snapshot {snapshot_id} deleted.[/bold red]")
    except Exception as e:
        console.print(f"[red]Error deleting snapshot: {e}[/red]")

if __name__ == "__main__":
    app()
