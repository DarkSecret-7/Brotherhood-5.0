# This file is part of The Brotherhood Project
#
# Copyright (C) 2026  The Brotherhood Project Developers
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

"""
Pure CRUD operations for Invitation model.
No business logic - only raw database operations.
"""
from sqlalchemy.orm import Session
from .. import models

def get_invitation_by_code(db: Session, code: str):
    """Get invitation by code"""
    return db.query(models.Invitation).filter(models.Invitation.code == code).first()

def create_invitation_record(db: Session, **kwargs):
    """Create a new invitation record with provided fields"""
    db_invitation = models.Invitation(**kwargs)
    db.add(db_invitation)
    db.flush()
    return db_invitation

def update_invitation_record(db: Session, invitation_id: int, **kwargs):
    """Update invitation record with provided fields"""
    db.query(models.Invitation).filter(models.Invitation.id == invitation_id).update(kwargs)
    db.flush()

def delete_invitation_by_code(db: Session, code: str):
    """Delete invitation by code"""
    invitation = get_invitation_by_code(db, code)
    if invitation:
        db.delete(invitation)
        db.commit()
        return True
    return False
