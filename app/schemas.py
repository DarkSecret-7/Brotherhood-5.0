from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class SourceBase(BaseModel):
    title: str
    author: Optional[str] = None
    year: Optional[int] = None
    source_type: str
    url: Optional[str] = None
    fragment_start: Optional[str] = None
    fragment_end: Optional[str] = None

class SourceCreate(SourceBase):
    pass

class SourceRead(SourceBase):
    id: int
    node_id: int

    class Config:
        from_attributes = True

class NodeBase(BaseModel):
    local_id: int
    title: str
    description: Optional[str] = None
    prerequisite: Optional[str] = None
    mentions: Optional[str] = None
    sources: Optional[str] = None # Deprecated
    source_items: List[SourceBase] = []
    domain_id: Optional[int] = None

class NodeCreate(NodeBase):
    pass

class NodeRead(NodeBase):
    id: int
    snapshot_id: int
    source_items: List[SourceRead] = []

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
    base_graph: Optional[str] = None
    created_by: Optional[str] = None
    is_public: bool = False

class GraphSnapshotCreate(GraphSnapshotBase):
    nodes: List[NodeBase]
    domains: List[DomainBase] = []
    overwrite: bool = False

class GraphSnapshotUpdate(BaseModel):
    version_label: Optional[str] = None
    is_public: Optional[bool] = None
    
    class Config:
        from_attributes = True

class GraphSnapshotRead(GraphSnapshotBase):
    id: int
    created_at: datetime
    last_updated: datetime
    nodes: List[NodeRead]
    domains: List[DomainRead] = []
    node_count: int  # Computed field

    class Config:
        from_attributes = True

class GraphSnapshotSummary(BaseModel):
    id: int
    created_at: datetime
    last_updated: datetime
    version_label: Optional[str]
    base_graph: Optional[str] = None
    created_by: Optional[str] = None
    node_count: int
    is_public: bool = False
    
    class Config:
        from_attributes = True

class PrerequisiteSimplifyRequest(BaseModel):
    expression: str
    current_node_id: Optional[int] = None
    context_nodes: List[NodeBase] = []

class PrerequisiteSimplifyResponse(BaseModel):
    simplified_expression: str
    redundant_ids: List[int]
    
class LLMQuery(BaseModel):
    prompt: str
    context: Optional[str] = None
    graph_name: Optional[str] = None

class LLMSuggestion(BaseModel):
    title: str
    description: str

class LLMResponse(BaseModel):
    suggestions: List[LLMSuggestion]

# --- Auth Schemas ---

class UserBase(BaseModel):
    username: str

class UserCreate(UserBase):
    password: str
    invitation_code: str

class UserRead(UserBase):
    id: int
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None

class InvitationBase(BaseModel):
    code: str

class InvitationCreate(InvitationBase):
    pass

class InvitationRead(InvitationBase):
    id: int
    is_used: bool
    created_at: datetime
    
    class Config:
        from_attributes = True
