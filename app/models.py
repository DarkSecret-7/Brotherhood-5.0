from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean, text, JSON
from sqlalchemy.orm import relationship, backref
from sqlalchemy.sql import func
from .database import Base

class GraphSnapshot(Base):
    __tablename__ = "graph_snapshots"

    id = Column(Integer, primary_key=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    last_updated = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    version_label = Column(String, unique=True, index=True, nullable=True)  # e.g. "v1", "Initial Draft"
    is_public = Column(Boolean, default=False, server_default=text('false'), nullable=False)
    
    # Relationships
    base_graph_id = Column(Integer, ForeignKey("graph_snapshots.id"), nullable=True)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    base_snapshot = relationship("GraphSnapshot", remote_side=[id], backref="derived_snapshots")
    creator = relationship("User", backref="created_snapshots")

    @property
    def created_by(self):
        return self.creator.username if self.creator else "Unknown"

    @property
    def base_graph(self):
        return self.base_snapshot.version_label if self.base_snapshot else None
    
    nodes = relationship("Node", back_populates="snapshot", cascade="all, delete-orphan")
    domains = relationship("Domain", back_populates="snapshot", cascade="all, delete-orphan")
    redirects = relationship("NodeRedirect", back_populates="snapshot", cascade="all, delete-orphan")

class NodeRedirect(Base):
    __tablename__ = "node_redirects"

    id = Column(Integer, primary_key=True, index=True)
    snapshot_id = Column(Integer, ForeignKey("graph_snapshots.id"))
    old_local_id = Column(Integer, nullable=False)
    new_local_id = Column(Integer, nullable=False)
    # The timestamp of the redirect acts as the version control
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    snapshot = relationship("GraphSnapshot", back_populates="redirects")

class Node(Base):
    __tablename__ = "nodes"

    id = Column(Integer, primary_key=True, index=True)
    snapshot_id = Column(Integer, ForeignKey("graph_snapshots.id"))
    domain_id = Column(Integer, ForeignKey("domains.id"), nullable=True)
    
    # The ID used by the user in the graph (1, 2, 3...)
    local_id = Column(Integer, nullable=False)
    
    title = Column(String, nullable=False)
    description = Column(String, nullable=True)
    prerequisite = Column(String, nullable=True)  # Boolean expression e.g. "(1 AND 2) OR 3"
    mentions = Column(String, nullable=True) # Comma-separated list of local_ids that depend on this node
    assessable = Column(Boolean, default=False, server_default=text('false'), nullable=False)
    x = Column(Integer, nullable=True)
    y = Column(Integer, nullable=True)

    snapshot = relationship("GraphSnapshot", back_populates="nodes")
    domain = relationship("Domain", back_populates="node_objects")
    source_items = relationship("Source", back_populates="node", cascade="all, delete-orphan")

class Source(Base):
    __tablename__ = "sources"

    id = Column(Integer, primary_key=True, index=True)
    node_id = Column(Integer, ForeignKey("nodes.id"), nullable=False)
    
    title = Column(String, nullable=False)
    author = Column(String, nullable=True)
    year = Column(Integer, nullable=True)
    source_type = Column(String, nullable=False) # e.g. "Book", "Video", "Article"
    url = Column(String, nullable=True)
    
    # Fragment info
    fragment_start = Column(String, nullable=True)
    fragment_end = Column(String, nullable=True)

    node = relationship("Node", back_populates="source_items")

class Domain(Base):
    __tablename__ = "domains"

    id = Column(Integer, primary_key=True, index=True)
    local_id = Column(Integer, nullable=False)
    snapshot_id = Column(Integer, ForeignKey("graph_snapshots.id"))
    title = Column(String, nullable=False)
    description = Column(String, nullable=True)
    parent_id = Column(Integer, ForeignKey("domains.id"), nullable=True)
    collapsed = Column(Boolean, default=True)

    snapshot = relationship("GraphSnapshot", back_populates="domains")
    sub_domains = relationship("Domain", backref=backref("parent", remote_side=[id]))
    node_objects = relationship("Node", back_populates="domain")

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Profile Fields
    email = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    dob = Column(String, nullable=True)  # Store as YYYY-MM-DD
    bio = Column(String, nullable=True)
    location = Column(String, nullable=True)
    social_github = Column(String, nullable=True)
    social_linkedin = Column(String, nullable=True)
    profile_image = Column(String, nullable=True)  # Store base64 or URL

class Invitation(Base):
    __tablename__ = "invitations"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String, unique=True, index=True, nullable=False)
    is_used = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

class Capability(Base):
    __tablename__ = "capabilities"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    assessment_name = Column(String, nullable=False)
    assessment_type = Column(String, nullable=False)
    version = Column(String, nullable=False)
    assessment_date = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    graph_label = Column(String, ForeignKey("graph_snapshots.version_label"), nullable=False)
    assessed_nodes = Column(JSON, nullable=False)

    user = relationship("User", backref="capabilities")
