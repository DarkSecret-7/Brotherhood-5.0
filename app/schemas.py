import uuid
from pydantic import BaseModel
from typing import List, Optional, Union, Dict, Any
from datetime import datetime
from uuid import UUID

# IMPORTANT: ONLY USE HASHES AND UUIDS FOR ANY COMMUNICATION WITH API
# --- Contact Form ---

class ContactFormRequest(BaseModel):
    name: str
    email: str
    message: str

class ContactFormResponse(BaseModel):
    ok: bool

# --- Bibliography and Source Fragments ---

class BibliographyBase(BaseModel):
    # public_hash: Optional[str]      # Accept hash if bibliography already exists or null if it does not
    title: str
    author: Optional[str] = None
    year: Optional[int] = None
    bib_type: str
    url: Optional[str] = None

class BibliographyCreate(BaseModel):
    title: str
    author: Optional[str] = None
    year: Optional[int] = None
    bib_type: str
    url: Optional[str] = None

    class Config:
        from_attributes = True

class BibliographyRead(BibliographyBase):
    public_hash: str

    class Config:
        from_attributes = True

class BibliographySafeRead(BibliographyBase):   # Safe reading of bibliography, public_hash is optional
    bib_hash: Optional[str] = None

    class Config:
        from_attributes = True

class SourceBase(BibliographySafeRead):             # Now Bibliography must be created/referenced before Source
    snapshot_uuid: Optional[UUID] = None
    node_id: Optional[int] = None        # ALWAYS LOCAL ID
    fragment_start: Optional[str] = None
    fragment_end: Optional[str] = None

class SourceCreate(SourceBase):
    updated: Optional[bool] = False  # True if source was modified (for delta updates)
    deleted: Optional[bool] = False  # True if source should be deleted
    source_uuid: Optional[UUID] = None  # UUID for identifying individual source fragments

    class Config:
        from_attributes = True

class SourceRead(SourceBase):
    source_uuid: UUID  # UUID for identifying individual source fragments

    class Config:
        from_attributes = True
        populate_by_name = True

# --- Assessment & Capability ---
    
class Assessment(BaseModel):
    snapshot_uuid: UUID
    node_id: int
    evaluation: Dict[str, Any]           # Flexible evaluation data, expected to be a dict (per node)

class CapabilityBase(BaseModel):
    snapshot_uuid: UUID
    user_uuid: UUID

    # Assessment Info
    assessment_name: str
    assessment_type: str
    assessment_version: str
    assessed_nodes: List[Assessment] # Flexible evaluation data, expected to be a list of assessments

class CapabilityCreate(CapabilityBase):
    pass

class CapabilityRead(CapabilityBase):
    public_hash: str
    assessment_date: datetime

    class Config:
        from_attributes = True

# --- Self-Assessment ---

class ProofInput(BaseModel):
    node_id: int
    value: int

class SelfAssessmentRequest(BaseModel):
    graph_uuid: UUID
    proof_inputs: List[ProofInput]

# --- Nodes and Domains ---

class NodeBase(BaseModel):
    local_id: int
    title: str
    description: Optional[str] = None
    prerequisite: Optional[dict] = None         # dict matches directly to JSONB
    mentions: Optional[dict] = None             # dict matches directly to JSONB
    source_items: Optional[List[SourceRead]] = []
    domain_id: Optional[int] = None
    x: Optional[float] = None
    y: Optional[float] = None
    assessable: Optional[bool] = False

class NodeUpdate(NodeBase):
    pass

class NodeCreate(NodeBase):
    source_items: Optional[List[SourceCreate]] = []
    updated: Optional[bool] = False  # True if node was modified
    deleted: Optional[bool] = False  # True if node should be deleted

class NodeRead(NodeBase):
    snapshot_uuid: Optional[UUID] = None
    snapshot_label: Optional[str] = None
    domain_label: Optional[str] = None

class DomainBase(BaseModel):
    local_id: int
    title: str
    description: Optional[str] = None
    parent_id: Optional[int] = None

class DomainCreate(DomainBase):
    snapshot_uuid: Optional[UUID] = None
    updated: Optional[bool] = False  # True if domain was modified
    deleted: Optional[bool] = False  # True if domain should be deleted

class DomainRead(DomainCreate):
    snapshot_uuid: Optional[UUID] = None
    parent_label: Optional[str] = None
    node_count: Optional[int] = None                # Computed field
    assessable_node_count: Optional[int] = None     # Computed field
    
    class Config:
        from_attributes = True

# --- Node Redirects ---
    
class NodeRedirectBase(BaseModel):
    snapshot_uuid: UUID
    old_local_id: int
    new_local_id: int

class NodeRedirectRead(NodeRedirectBase):
    created_at: datetime = None
    snapshot_label: Optional[str] = None
    old_local_id_label: Optional[str] = None
    new_local_id_label: Optional[str] = None

    class Config:
        from_attributes = True

# --- Auth Schemas ---

class UserBase(BaseModel):
    username: str

class UserProfileUpdate(UserBase):
    user_uuid: UUID
    username: Optional[str] = None

    # Profile Fields
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
    user_uuid: UUID
    username: Optional[str] = None
    is_active: Optional[bool] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class UserCreate(UserBase):
    password: str
    invitation_code: str

# --- Graph Snapshots ---

class GraphSnapshotBase(BaseModel):
    version_label: Optional[str] = None
    redirects: Optional[List[NodeRedirectBase]] = None

class GraphSnapshotCreate(GraphSnapshotBase):
    nodes: List[NodeCreate]
    domains: Optional[List[DomainCreate]] = []
    base_uuid: Optional[UUID] = None
    created_by: Optional[UserRead] = None

    class Config:
        from_attributes = True

class GraphSnapshotUpdate(GraphSnapshotBase):
    nodes: Optional[List[NodeCreate]] = []
    domains: Optional[List[DomainCreate]] = []
    overwrite: Optional[bool] = False
    is_public: Optional[bool] = None
    metadata_only: Optional[bool] = False
    
    class Config:
        from_attributes = True

class GraphSnapshotRead(GraphSnapshotBase):
    public_uuid: UUID
    base_uuid: Optional[UUID] = None
    base_graph_label: Optional[str] = None
    created_at: Optional[datetime] = None
    last_updated: Optional[datetime] = None
    is_public: Optional[bool] = None
    authors: Optional[List[UserRead]] = []
    nodes: List[NodeRead]
    domains: List[DomainRead] = []
    redirects: Optional[List[NodeRedirectRead]] = []
    node_count: Optional[int] = None                    # Computed field
    assessable_node_count: Optional[int] = None         # Computed field

    class Config:
        from_attributes = True

# --- LLM Integration ---

class LLMQuery(BaseModel):
    prompt: str
    context: Optional[str] = None
    graph_name: Optional[str] = None
    system_prompt: Optional[str] = None

class LLMSuggestion(BaseModel):
    title: str
    description: str

class LLMResponse(BaseModel):
    suggestions: List[LLMSuggestion]

# --- Invitations ---

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

# --- Proposals ---

class ProposalBase(BaseModel):
    proposal_type: str
    graph_uuid: UUID
    proposer_uuid: UUID
    target_user_uuid: Optional[UUID] = None          # Target user for join/invite request, remains null otherwise
    target_graph_uuid: Optional[UUID] = None         # Target graph for merge request, remains null otherwise

class ProposalCreate(ProposalBase):
    pass

class Consensus(BaseModel):
    yes_count: int
    no_count: int
    remaining_votes: int

class ProposalRead(ProposalBase):
    public_hash: str
    proposal_time: Optional[datetime] = None
    proposal_status: Optional[str] = None
    consensus: Optional[Consensus] = None          # computed field - [yes_count, no_count, remaining_votes]
    votes: Optional[Dict[UUID, int]] = None              # computed field - 1 for yes, 0 for no per user
    
    # Readable Fields
    graph_label: Optional[str] = None
    proposer_label: Optional[str] = None
    target_user_label: Optional[str] = None
    target_graph_label: Optional[str] = None

    class Config:
        from_attributes = True

# --- Token Data ---

class Token(BaseModel):         # DEPRECATED
    access_token: str
    token_type: str

class TokenData(BaseModel):     # DEPRECATED
    username: str
    user_uuid: UUID
    exp: datetime

# --- Proposal Response Schemas ---

class ProposalResponse(BaseModel):
    approve: bool
    message: Optional[str] = None

class ProposalConsentCreate(BaseModel):
    proposal_hash: str
    user_uuid: UUID
    user_vote: int  # 1 for approve, -1 for reject

class ProposalConsentRead(BaseModel):
    proposal_hash: str
    user_uuid: UUID
    consent_date: datetime
    user_vote: int
    
    class Config:
        from_attributes = True

# --- Authorship Schemas ---

class GraphAuthorshipBase(BaseModel):
    graph_uuid: UUID
    user_uuid: UUID
    role: Optional[str] = "Curator"

class GraphAuthorshipCreate(GraphAuthorshipBase):
    pass

class GraphAuthorshipRead(GraphAuthorshipBase):
    username: str
    created_at: datetime
    
    class Config:
        from_attributes = True