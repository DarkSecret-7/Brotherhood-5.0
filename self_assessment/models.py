from pydantic import BaseModel, Field
from typing import List, Dict, Optional, Any
from datetime import datetime

class NodeData(BaseModel):
    local_id: int
    title: str
    description: Optional[str] = None
    prerequisite: Optional[str] = None
    # We explicitly exclude 'assessable' from assessment logic as per requirement

class GraphData(BaseModel):
    nodes: List[NodeData]
    # We might need other fields for graph structure (like domains), but requirements mention arbitrary graph structure

class Assessment(BaseModel):
    node_id: int
    evaluation: int = Field(..., ge=0, le=2) # 0, 1, or 2

class ProofInput(BaseModel):
    node_id: int
    value: int = Field(..., ge=0, le=2) # 0, 1, or 2

class CapabilityObject(BaseModel):
    assessment_name: str
    assessment_type: str
    version: str
    assessment_date: datetime
    user_reference: str
    graph_label: str
    assessed_nodes: List[Assessment]
