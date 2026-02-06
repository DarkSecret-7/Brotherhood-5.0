from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship, backref
from sqlalchemy.sql import func
from .database import Base

class GraphSnapshot(Base):
    __tablename__ = "graph_snapshots"

    id = Column(Integer, primary_key=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    last_updated = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    version_label = Column(String, nullable=True)  # e.g. "v1", "Initial Draft"
    base_graph = Column(String, nullable=True)     # The name of the graph this was based on
    created_by = Column(String, nullable=True)     # The user who created this snapshot
    
    nodes = relationship("Node", back_populates="snapshot", cascade="all, delete-orphan")
    domains = relationship("Domain", back_populates="snapshot", cascade="all, delete-orphan")

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
    sources = Column(String, nullable=True) # Comma-separated list of URLs

    snapshot = relationship("GraphSnapshot", back_populates="nodes")
    domain = relationship("Domain", back_populates="node_objects")

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

class Invitation(Base):
    __tablename__ = "invitations"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String, unique=True, index=True, nullable=False)
    is_used = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
