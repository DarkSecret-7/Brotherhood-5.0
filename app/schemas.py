from pydantic import BaseModel
from typing import List, Optional, Union, Dict, Any
from datetime import datetime

class ContactFormRequest(BaseModel):
    name: str
    email: str
    message: str

class ContactFormResponse(BaseModel):
    ok: bool

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

# --- Assessment & Capability ---
    
class Assessment(BaseModel):
    node_id: int
    evaluation: Dict[str, Any]           # Flexible evaluation data, expected to be a dict (per node)

class ProofInput(BaseModel):
    node_id: int
    value: int

class SelfAssessmentRequest(BaseModel):
    graph_label: str
    proof_inputs: List[ProofInput]

class CapabilityCreate(BaseModel):
    assessment_name: str
    assessment_type: str
    version: str
    graph_label: str
    assessed_nodes: List[Assessment] # Flexible evaluation data, expected to be a list of assessments

class CapabilityUpdate(BaseModel):
    graph_label: Optional[str] = None
    assessed_nodes: Optional[List[Assessment]] = None # Flexible evaluation data, expected to be a list of assessments

class CapabilityRead(BaseModel):
    id: int
    user_id: int
    assessment_name: str
    assessment_type: str
    version: str
    assessment_date: datetime
    graph_label: str
    assessed_nodes: List[Assessment] # Flexible evaluation data, expected to be a list of assessments

    class Config:
        from_attributes = True

class NodeBase(BaseModel):
    local_id: int
    title: str
    description: Optional[str] = None
    prerequisite: Optional[str] = None
    mentions: Optional[str] = None
    source_items: List[SourceBase] = []
    domain_id: Optional[int] = None
    x: Optional[int] = None
    y: Optional[int] = None
    assessable: bool = False

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
    id: Optional[int] = None # Allow ID for import mapping

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

class NodeRedirectBase(BaseModel):
    old_local_id: int
    new_local_id: int
    created_at: datetime = None

class NodeRedirectRead(NodeRedirectBase):
    id: int
    snapshot_id: int

    class Config:
        from_attributes = True

class GraphSnapshotCreate(GraphSnapshotBase):
    nodes: List[NodeCreate]
    domains: List[DomainCreate] = []
    overwrite: bool = False
    redirects: Optional[Dict[str, int]] = None # old_id -> new_id map from frontend

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
    redirects: List[NodeRedirectRead] = []
    node_count: int  # Computed field
    assessable_node_count: int = 0  # Computed field

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
    assessable_node_count: int = 0
    is_public: bool = False
    redirect_count: int = 0
    
    class Config:
        from_attributes = True
    
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

class UserProfileUpdate(BaseModel):
    email: Optional[str] = None
    phone: Optional[str] = None
    dob: Optional[str] = None
    bio: Optional[str] = None
    location: Optional[str] = None
    social_github: Optional[str] = None
    social_linkedin: Optional[str] = None
    profile_image: Optional[str] = None

class UserPasswordUpdate(BaseModel):
    old_password: str
    new_password: str

class UserRead(UserBase):
    id: int
    is_active: bool
    created_at: datetime
    
    # Profile Fields
    email: Optional[str] = None
    phone: Optional[str] = None
    dob: Optional[str] = None
    bio: Optional[str] = None
    location: Optional[str] = None
    social_github: Optional[str] = None
    social_linkedin: Optional[str] = None
    profile_image: Optional[str] = None
    
    class Config:
        from_attributes = True

class UserCreate(UserBase):
    password: str
    invitation_code: str

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
