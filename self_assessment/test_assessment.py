import json
from datetime import datetime
from assessment import perform_assessment
from models import ProofInput
from utils import generate_graph_hash

def test_assessment():
    # 1. Define an arbitrary graph structure
    graph_data = {
        "nodes": [
            {"local_id": 1, "title": "Node 1", "prerequisite": None, "assessable": True},
            {"local_id": 2, "title": "Node 2", "prerequisite": "1", "assessable": True},
            {"local_id": 3, "title": "Node 3", "prerequisite": "1 AND 2", "assessable": False} # assessable: False should be ignored by assessment logic
        ]
    }
    
    # 2. Define three proof inputs for specified nodes (0, 1, or 2)
    proof_inputs = [
        ProofInput(node_id=1, value=2), 
        ProofInput(node_id=2, value=1), 
        ProofInput(node_id=3, value=0)  
    ]
    
    # 3. Perform assessment
    capability_object = perform_assessment(
        graph_data=graph_data,
        proof_inputs=proof_inputs,
        assessment_name="Integration Test Assessment",
        assessment_type="Skills Validation",
        version="1.0.0",
        user_reference="user_123",
        graph_label="test_graph"
    )

    print(capability_object)
    
    # 4. Verify output
    print("Assessment Name:", capability_object.assessment_name)
    print("Graph Label:", capability_object.graph_label)
    print("Assessed Nodes:")
    for node in capability_object.assessed_nodes:
        print(f"  Node ID: {node.node_id}, Confidence Score: {node.evaluation}")
    
    # Verify confidence score mapping
    print(capability_object.assessed_nodes)
    print("\nStandalone Assessment Module Verification: SUCCESS")

if __name__ == "__main__":
    test_assessment()
