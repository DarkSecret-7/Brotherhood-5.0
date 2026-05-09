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
Pure CRUD operations for access control.
No business logic - only raw database operations.
"""
from sqlalchemy.orm import Session
from .. import models

def get_authorship_by_graph(db: Session, graph_id: int):
    """Get all authorships for a graph"""
    return db.query(models.GraphAuthorship).filter(
        models.GraphAuthorship.graph_id == graph_id
    ).all()

def get_authorship_by_graph_and_user(db: Session, graph_id: int, user_id: int):
    """Get authorship record by graph and user"""
    return db.query(models.GraphAuthorship).filter(
        models.GraphAuthorship.graph_id == graph_id,
        models.GraphAuthorship.user_id == user_id
    ).first()

def get_authorships_by_user(db: Session, user_id: int):
    """Get all authorships for a user"""
    return db.query(models.GraphAuthorship).filter(
        models.GraphAuthorship.user_id == user_id
    ).all()

def create_authorship_record(db: Session, **kwargs):
    """Create a new authorship record with provided fields"""
    db_authorship = models.GraphAuthorship(**kwargs)
    db.add(db_authorship)
    db.flush()
    return db_authorship

def delete_authorship_record(db: Session, graph_id: int, user_id: int):
    """Delete authorship record by graph and user"""
    authorship = get_authorship_by_graph_and_user(db, graph_id, user_id)
    if authorship:
        db.delete(authorship)
        db.commit()
        return True
    return False
