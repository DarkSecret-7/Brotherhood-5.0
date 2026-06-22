# This file is part of The Brotherhood Project
#
# Copyright (C) 2026  The Brotherhood Project Developers
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program.  If not, see <https://www.gnu.org/licenses/>.

from typing import List, Dict, Any, Optional, Union
from datetime import datetime
from .models import CapabilityObject, Assessment, ProofInput, NodeData, GraphData, UserData
from .utils import generate_graph_hash

# Assessment Constants
ASSESSMENT_NAME = "Default Self Assessment"
ASSESSMENT_VERSION = "0.1"
ASSESSMENT_TYPE = "Self-assessment"

def perform_assessment(
    graph_data: Union[GraphData, Dict[str, Any]],
    proof_inputs: List[ProofInput],
    user_reference: Union[UserData, Dict[str, Any]],
) -> Optional[CapabilityObject]:
    """
    Standalone Python assessment module logic.
    Accepts arbitrary graph structure (as GraphData, dict, or SQLAlchemy model) and proof inputs.
    Generates a capability object with essential metadata.
    """
    # 1. Handle different input formats for graph
    if isinstance(graph_data, dict):
        graph = GraphData(**graph_data)
    elif hasattr(graph_data, 'public_uuid'): # Likely SQLAlchemy model
        graph = GraphData.model_validate(graph_data)
    else:
        return None
    
    # 2. Handle user reference
    if isinstance(user_reference, dict):
        user = UserData(**user_reference)
    elif hasattr(user_reference, 'public_uuid'): # Likely User SQLAlchemy model
        user = UserData.model_validate(user_reference)
    else:
        return None
    
    # 3. Assess the nodes based on proof inputs
    # Simply copy the value from proof inputs
    assessed_nodes = []
    for pi in proof_inputs:
        assessment = Assessment(
            node_id=pi.node_id,
            evaluation=pi.value
        )
        assessed_nodes.append(assessment)
    
    # 4. Construct and return the capability object
    return CapabilityObject(
        assessment_name=ASSESSMENT_NAME,
        assessment_type=ASSESSMENT_TYPE,
        version=ASSESSMENT_VERSION,
        assessment_date=datetime.now(),
        user=user,
        graph_uuid=graph.public_uuid,
        assessed_nodes=assessed_nodes
    )
