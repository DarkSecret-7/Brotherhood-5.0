# This file is part of The Brotherhood Project
#
# Copyright (C) 2026  The Brotherhood Project
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

from sqlalchemy import Column, Float, Integer, String, Date, DateTime, ForeignKey, UniqueConstraint, Boolean, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship, backref
from sqlalchemy.sql import func
from .database import Base
from uuid import uuid4

class GraphSnapshot(Base):
    __tablename__ = "graph_snapshots"

    id = Column(Integer, primary_key=True, index=True)
    public_uuid = Column(UUID(as_uuid=True), unique=True, index=True, nullable=False, server_default=text("gen_random_uuid()"))
    base_uuid = Column(UUID(as_uuid=True), index=True, nullable=True)
    base_snapshot_id = Column(Integer, ForeignKey("graph_snapshots.id"), index=True, nullable=True)
    version_label = Column(String, unique=True, index=True, nullable=False)  # e.g. "v1", "Initial Draft"
    is_public = Column(Boolean, default=False, server_default=text('false'), nullable=False)

    # Automatic fields
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    last_updated = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    base_snapshot = relationship("GraphSnapshot", remote_side=[id], backref="derived_snapshots")
    authors_ref = relationship("User", secondary="graph_authorship", backref="created_snapshots")
    nodes = relationship("Node", back_populates="snapshot", cascade="all, delete-orphan")
    domains = relationship("Domain", back_populates="snapshot", cascade="all, delete-orphan")
    redirects = relationship("NodeRedirect", back_populates="snapshot", cascade="all, delete-orphan")
    bookmarks = relationship("Bookmark", back_populates="graph", cascade="all, delete-orphan")

    # Properties
    @property
    def authors(self):
        return [author.username for author in self.authors_ref]

    @property
    def base_graph_label(self):
        return self.base_snapshot.version_label if self.base_snapshot else None

class GraphAuthorship(Base):
    __tablename__ = "graph_authorship"
    __table_args__ = (
        UniqueConstraint("graph_id", "user_id", name="uq_graph_user"),
    )

    id = Column(Integer, primary_key=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    graph_id = Column(Integer, ForeignKey("graph_snapshots.id", ondelete="CASCADE"), index=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    role = Column(String, nullable=True)  # e.g. "Admin", "Editor", "Viewer"

class NodeRedirect(Base):
    __tablename__ = "node_redirects"

    id = Column(Integer, primary_key=True, index=True)
    snapshot_id = Column(Integer, ForeignKey("graph_snapshots.id", ondelete="CASCADE"), index=True, nullable=False)
    old_local_id = Column(Integer, nullable=False)
    new_local_id = Column(Integer, nullable=False)
    # The timestamp of the redirect acts as the version control
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    snapshot = relationship("GraphSnapshot", back_populates="redirects")

class Node(Base):
    __tablename__ = "nodes"
    __table_args__ = (
    UniqueConstraint("snapshot_id", "local_id", name="uq_node_snapshot_local"),
)

    id = Column(Integer, primary_key=True, index=True)
    snapshot_id = Column(Integer, ForeignKey("graph_snapshots.id", ondelete="CASCADE"), index=True, nullable=False)
    domain_id = Column(Integer, ForeignKey("domains.id", ondelete="SET NULL"), index=True, nullable=True)
    
    # The ID used by the user in the graph (1, 2, 3...)
    local_id = Column(Integer, index=True, nullable=False)
    
    title = Column(String, nullable=False)
    description = Column(String, nullable=True)
    prerequisite = Column(JSONB, nullable=True)  # Boolean expression converted into JSONB
    mentions = Column(JSONB, nullable=True) # Comma-separated list of local_ids converted into JSONB
    assessable = Column(Boolean, default=False, server_default=text('false'), nullable=False)
    x = Column(Float, nullable=True)
    y = Column(Float, nullable=True)

    snapshot = relationship("GraphSnapshot", back_populates="nodes")
    domain = relationship("Domain", back_populates="node_objects")
    source_frags = relationship("SourceFragment", back_populates="node", cascade="all, delete-orphan")

class SourceFragment(Base):
    __tablename__ = "source_fragments"

    id = Column(Integer, primary_key=True, index=True)
    public_uuid = Column(UUID(as_uuid=True), unique=True, index=True, nullable=False, server_default=text("gen_random_uuid()"))
    node_id = Column(Integer, ForeignKey("nodes.id", ondelete="CASCADE"), index=True, nullable=False)
    bib_id = Column(Integer, ForeignKey("bibliographies.id", ondelete="CASCADE"), index=True, nullable=False)

    # Fragment info
    fragment_start = Column(String, nullable=True)
    fragment_end = Column(String, nullable=True)

    node = relationship("Node", back_populates="source_frags")
    bibliography = relationship("Bibliography", back_populates="source_frags")

class Bibliography(Base):
    __tablename__ = "bibliographies"

    id = Column(Integer, primary_key=True, index=True)
    public_hash = Column(String(64), unique=True, index=True, nullable=False)
    title = Column(String, nullable=False)
    author = Column(String, nullable=True)
    year = Column(Integer, nullable=True)
    bib_type = Column(String, nullable=False) # e.g. "PDF", "Video", "Other"
    url = Column(String, nullable=True)

    source_frags = relationship("SourceFragment", back_populates="bibliography", cascade="all, delete-orphan")

class Domain(Base):
    __tablename__ = "domains"
    __table_args__ = (
        UniqueConstraint("snapshot_id", "local_id", name="uq_domain_snapshot_local"),
    )

    id = Column(Integer, primary_key=True, index=True)
    local_id = Column(Integer, index=True, nullable=False)
    snapshot_id = Column(Integer, ForeignKey("graph_snapshots.id", ondelete="CASCADE"), index=True, nullable=False)
    title = Column(String, nullable=False)
    description = Column(String, nullable=True)
    parent_id = Column(Integer, ForeignKey("domains.id", ondelete="CASCADE"), index=True, nullable=True)

    snapshot = relationship("GraphSnapshot", back_populates="domains")
    node_objects = relationship("Node", back_populates="domain")
    sub_domains = relationship("Domain", backref=backref("parent", remote_side=[id]))

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    public_uuid = Column(UUID(as_uuid=True), unique=True, index=True, nullable=False, server_default=text("gen_random_uuid()"))
    username = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Profile Fields
    email = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    dob = Column(Date, nullable=True)  # Store as YYYY-MM-DD
    bio = Column(String, nullable=True)
    location = Column(String, nullable=True)
    social_github = Column(String, nullable=True)
    social_linkedin = Column(String, nullable=True)
    profile_image = Column(String, nullable=True)  # Store base64 or URL

    # Relationships
    bookmarks = relationship("Bookmark", back_populates="user")

class Bookmark(Base):
    __tablename__ = "bookmarks"
    __table_args__ = (
        UniqueConstraint("user_id", "graph_id", name="uq_user_graph_bookmark_id"),
        UniqueConstraint("user_uuid", "graph_uuid", name="uq_user_graph_bookmark_uuid")
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)   # Foreign key to users table
    graph_id = Column(Integer, ForeignKey("graph_snapshots.id", ondelete="CASCADE"), nullable=False, index=True)   # Foreign key to graph_snapshots table
    user_uuid = Column(UUID, nullable=False, index=True)
    graph_uuid = Column(UUID(as_uuid=True), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user = relationship("User", back_populates="bookmarks")
    graph = relationship("GraphSnapshot", back_populates="bookmarks")

class Invitation(Base):
    __tablename__ = "invitations"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String, unique=True, index=True, nullable=False)
    is_used = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

class Capability(Base):
    __tablename__ = "capabilities"

    id = Column(Integer, primary_key=True, index=True)
    public_hash = Column(String(64), unique=True, index=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    graph_id = Column(Integer, ForeignKey("graph_snapshots.id"), index=True, nullable=False)
    user_uuid = Column(UUID(as_uuid=True), nullable=False)        # No FK, just user's uuid at the time of assessment
    graph_uuid = Column(UUID(as_uuid=True), nullable=False)        # No FK, just graph's uuid at the time of assessment

    # Assessment Info
    assessment_name = Column(String, nullable=False)
    assessment_type = Column(String, nullable=False)
    assessment_version = Column(String, nullable=False)
    assessment_date = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    assessed_nodes = Column(JSONB, nullable=False)      # JSONB of assessed nodes

    user = relationship("User", backref="capabilities")
    graph = relationship("GraphSnapshot", backref="capabilities")

class GraphProposal(Base):
    __tablename__ = "graph_proposals"

    # Metadata
    id = Column(Integer, primary_key=True, index=True)
    public_hash = Column(String(64), unique=True, index=True, nullable=False)
    proposal_type = Column(String, nullable=False)              # e.g. "Join", "Invite", "Merge", "Delete"
    proposal_time = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    proposal_status = Column(String, nullable=False, default="Pending")              # e.g. "Pending", "Approved", "Rejected"

    # Proposal Info
    graph_id = Column(Integer, ForeignKey("graph_snapshots.id", ondelete="CASCADE"), index=True, nullable=False)
    graph_uuid = Column(UUID(as_uuid=True), nullable=False)        # No FK, just graph's uuid at the time of proposal
    proposer_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    proposer_uuid = Column(UUID(as_uuid=True), nullable=False)        # No FK, just proposer's uuid at the time of proposal
    target_user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=True)    # Target user for join/invite request, remains null otherwise
    target_user_uuid = Column(UUID(as_uuid=True), nullable=True)        # No FK, just target user's uuid at the time of proposal
    target_graph_id = Column(Integer, ForeignKey("graph_snapshots.id", ondelete="CASCADE"), index=True, nullable=True)    # Target graph for merge request, remains null otherwise
    target_graph_uuid = Column(UUID(as_uuid=True), nullable=True)        # No FK, just target graph's uuid at the time of proposal

    proposer = relationship("User", foreign_keys=[proposer_id], backref="proposals")
    target_user = relationship("User", foreign_keys=[target_user_id], backref="received_proposals")
    graph = relationship("GraphSnapshot", foreign_keys=[graph_id], backref="proposals")
    target_graph = relationship("GraphSnapshot", foreign_keys=[target_graph_id], backref="received_proposals")

class ProposalConsent(Base):
    __tablename__ = "proposal_consents"

    id = Column(Integer, primary_key=True, index=True)
    proposal_id = Column(Integer, ForeignKey("graph_proposals.id", ondelete="CASCADE"), index=True, nullable=False)
    proposal_hash = Column(String(64), nullable=False)        # No FK, just proposal's hash at the time of consent
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    user_uuid = Column(UUID(as_uuid=True), nullable=False)        # No FK, just user's uuid at the time of consent
    consent_date = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user_vote = Column(Integer, nullable=False)              # e.g. 1 for approve, -1 for reject

    # Relationships
    proposal = relationship("GraphProposal", backref="consents")
    user = relationship("User", backref="consents")