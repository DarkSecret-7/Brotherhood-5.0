import hashlib
import json
from typing import Dict, Any

def generate_graph_hash(graph_data: Dict[str, Any]) -> str:
    """
    Generate a consistent hashcode for a graph structure.
    We normalize the graph data to ensure consistency.
    """
    # Sort nodes by local_id to ensure consistent order
    if 'nodes' in graph_data:
        graph_data['nodes'] = sorted(graph_data['nodes'], key=lambda x: x.get('local_id', 0))
    
    # Remove 'assessable' property from hash generation if it exists,
    # as per requirement: "exclude the assessable property from assessment logic"
    # Although the hash should represent the graph structure, the user mentioned 
    # "exclude assessable from assessment logic" - let's see if we should exclude it from the hash too.
    # If the hash is used for "maintaining graph references", it should probably include structural changes.
    # However, if 'assessable' is just a UI flag, we might exclude it to keep the hash stable.
    # The requirement says "exclude assessable property from assessment logic". 
    # Let's keep the hash focused on node IDs, titles, and prerequisites.
    
    normalized_data = []
    for node in graph_data.get('nodes', []):
        node_copy = {
            'local_id': node.get('local_id'),
            'title': node.get('title'),
            'prerequisite': node.get('prerequisite')
        }
        normalized_data.append(node_copy)
    
    # Convert to a sorted JSON string for consistent hashing
    graph_str = json.dumps(normalized_data, sort_keys=True)
    return hashlib.sha256(graph_str.encode('utf-8')).hexdigest()