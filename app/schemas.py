from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class NodeBase(BaseModel):
    local_id: int
    title: str
    description: Optional[str] = None
    prerequisite: Optional[str] = None
    mentions: Optional[str] = None
    sources: Optional[str] = None
    domain_id: Optional[int] = None

class NodeCreate(NodeBase):
    pass

class NodeRead(NodeBase):
    id: int
    snapshot_id: int

    class Config:
        from_attributes = True

class DomainBase(BaseModel):
    local_id: int
    title: str
    description: Optional[str] = None
    parent_id: Optional[int] = None
    collapsed: bool = True

class DomainCreate(DomainBase):
    pass

class DomainRead(DomainBase):
    id: int
    snapshot_id: int
    
    class Config:
        from_attributes = True

class GraphSnapshotBase(BaseModel):
    version_label: Optional[str] = None

class GraphSnapshotCreate(GraphSnapshotBase):
    nodes: List[NodeBase]
    domains: List[DomainBase] = []

class GraphSnapshotRead(GraphSnapshotBase):
    id: int
    created_at: datetime
    nodes: List[NodeRead]
    domains: List[DomainRead] = []
    node_count: int  # Computed field

    class Config:
        from_attributes = True

class GraphSnapshotSummary(BaseModel):
    id: int
    created_at: datetime
    version_label: Optional[str]
    node_count: int
    
    class Config:
        from_attributes = True

class PrerequisiteSimplifyRequest(BaseModel):
    expression: str
    current_node_id: Optional[int] = None
    context_nodes: List[NodeBase] = []

class PrerequisiteSimplifyResponse(BaseModel):
    simplified_expression: str
    redundant_ids: List[int]

class UserBase(BaseModel):
    username: str

class UserCreate(UserBase):
    password: str
    invitation_code: str

class UserRead(UserBase):
    id: int
    is_active: bool

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None

class InvitationCreate(BaseModel):
    code: str

class InvitationRead(BaseModel):
    id: int
    code: str
    is_used: bool
    created_at: datetime

    class Config:
        from_attributes = True
