"""
CRUD layer - Pure database operations only.
No business logic, no pydantic schemas, no orchestration.
Only raw SQLAlchemy model operations.
"""

from . import snapshots, users, invitations, bibliography, assessments, proposals, access_control
