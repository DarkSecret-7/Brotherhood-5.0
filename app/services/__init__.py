"""
Services layer - Business logic and orchestration.
Accepts pydantic schemas, calls CRUD operations, compiles results.
Contains all business logic that was previously mixed with CRUD.
"""

from . import snapshots, users, invitations, bibliography, assessments, proposals, bookmarks, authorship
