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

def get_api_url():
    """Get API URL from environment or detect current host"""
    if os.getenv("BROTHERHOOD_API_URL"):
        return os.getenv("BROTHERHOOD_API_URL")
    
    # For Render deployment, use built-in environment variables
    if os.getenv("RENDER"):
        render_service_url = os.getenv("RENDER_SERVICE_URL")
        render_external_url = os.getenv("RENDER_EXTERNAL_URL")
        render_external_hostname = os.getenv("RENDER_EXTERNAL_HOSTNAME")
        
        if render_service_url:
            return f"{render_service_url}/api/v1"
        elif render_external_url:
            return f"{render_external_url}/api/v1"
        elif render_external_hostname:
            return f"https://{render_external_hostname}/api/v1"
    
    return "http://localhost:8000/api/v1"

@app.command()
def list_saved_graphs():
    """Fetch and list all graph versions saved in the database."""
    try:
        api_url = get_api_url()
        response = requests.get(f"{api_url}/snapshots")
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
def delete_graph(snapshot_id: str):
    """Delete a graph snapshot by its UUID."""
    try:
        api_url = get_api_url()
        response = requests.delete(f"{api_url}/snapshots/{snapshot_id}")
        response.raise_for_status()
        console.print(f"[bold red]Snapshot {snapshot_id} deleted.[/bold red]")
    except Exception as e:
        console.print(f"[red]Error deleting snapshot: {e}[/red]")

if __name__ == "__main__":
    app()
