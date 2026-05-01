from pydantic import BaseModel, Field, ConfigDict
from typing import List, Dict, Optional, Any
from datetime import datetime
from uuid import UUID

from sqlalchemy.dialects.postgresql import JSONB

class NodeData(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    local_id: int
    title: str
    description: Optional[str] = None
    prerequisite: Optional[dict] = None # dict matches to jsonb

class GraphData(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    public_uuid: UUID
    version_label: str
    nodes: List[NodeData]

class Assessment(BaseModel):
    node_id: int
    evaluation: int = Field(..., ge=0, le=2) # 0, 1, or 2

class ProofInput(BaseModel):
    node_id: int
    value: int = Field(..., ge=0, le=2) # 0, 1, or 2

class UserData(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    public_uuid: UUID
    username: str

class CapabilityObject(BaseModel):
    assessment_name: str
    assessment_type: str
    version: str
    assessment_date: datetime
    user: UserData
    graph_uuid: UUID
    assessed_nodes: List[Assessment]
