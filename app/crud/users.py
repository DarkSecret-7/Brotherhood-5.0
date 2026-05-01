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

"""
Pure CRUD operations for User model.
No business logic - only raw database operations.
"""
from sqlalchemy.orm import Session
from uuid import UUID
from .. import models

def get_user_by_uuid(db: Session, user_uuid: UUID):
    """Get user by public_uuid"""
    return db.query(models.User).filter(models.User.public_uuid == user_uuid).first()

def get_user_by_id(db: Session, user_id: int):
    """Get user by primary key"""
    return db.query(models.User).filter(models.User.id == user_id).first()

def get_user_by_username(db: Session, username: str):
    """Get user by username"""
    return db.query(models.User).filter(models.User.username == username).first()

def create_user_record(db: Session, **kwargs):
    """Create a new user record with provided fields"""
    db_user = models.User(**kwargs)
    db.add(db_user)
    db.flush()
    return db_user

def update_user_record(db: Session, user_id: int, **kwargs):
    """Update user record with provided fields"""
    db.query(models.User).filter(models.User.id == user_id).update(kwargs)
    db.flush()

def delete_user_by_uuid(db: Session, user_uuid: UUID):
    """Delete user by public_uuid"""
    user = get_user_by_uuid(db, user_uuid)
    if user:
        db.delete(user)
        db.commit()
        return True
    return False

def delete_user_by_username(db: Session, username: str):
    """Delete user by username"""
    user = get_user_by_username(db, username)
    if user:
        db.delete(user)
        db.commit()
        return True
    return False
