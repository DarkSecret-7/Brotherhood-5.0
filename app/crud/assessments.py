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
Pure CRUD operations for Capability/Assessment model.
No business logic - only raw database operations.
"""
from sqlalchemy.orm import Session
from .. import models

def get_capability_by_hash(db: Session, public_hash: str):
    """Get capability by public_hash"""
    return db.query(models.Capability).filter(models.Capability.public_hash == public_hash).first()

def get_latest_capability_by_user_and_graph(db: Session, user_id: int, graph_id: int, assessment_name: str):
    """Get latest capability by user, graph, and assessment name"""
    return db.query(models.Capability).filter(
        models.Capability.user_id == user_id,
        models.Capability.graph_id == graph_id,
        models.Capability.assessment_name == assessment_name
    ).order_by(models.Capability.assessment_date.desc()).first()

def create_capability_record(db: Session, **kwargs):
    """Create a new capability record with provided fields"""
    db_capability = models.Capability(**kwargs)
    db.add(db_capability)
    db.flush()
    return db_capability

def delete_capability_by_hash(db: Session, public_hash: str):
    """Delete capability by public_hash"""
    capability = get_capability_by_hash(db, public_hash)
    if capability:
        db.delete(capability)
        db.commit()
        return True
    return False

def delete_capabilities_by_user_and_graph(db: Session, user_id: int, graph_id: int, assessment_name: str):
    """Delete all capabilities for a user, assessment name, and graph label"""
    # Query and delete matching capabilities
    db.query(models.Capability).filter(
        models.Capability.user_id == user_id,
        models.Capability.graph_id == graph_id,
        models.Capability.assessment_name == assessment_name,
    ).delete(synchronize_session=False)
    db.commit()
