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
Pure CRUD operations for Bibliography model.
No business logic - only raw database operations.
"""
from sqlalchemy.orm import Session
from .. import models

def get_bibliography_by_hash(db: Session, public_hash: str):
    """Get bibliography by public_hash"""
    return db.query(models.Bibliography).filter(models.Bibliography.public_hash == public_hash).first()

def create_bibliography_record(db: Session, **kwargs):
    """Create a new bibliography record with provided fields"""
    db_bibliography = models.Bibliography(**kwargs)
    db.add(db_bibliography)
    db.flush()
    return db_bibliography

def get_bibliography_by_details(db: Session, title: str, author: str = None, year: int = None):
    """Get bibliography by title, author, year (for deduplication when hash lookup fails)"""
    query = db.query(models.Bibliography).filter(models.Bibliography.title == title)
    if author:
        query = query.filter(models.Bibliography.author == author)
    else:
        query = query.filter(models.Bibliography.author.is_(None))
    if year:
        query = query.filter(models.Bibliography.year == year)
    else:
        query = query.filter(models.Bibliography.year.is_(None))
    return query.first()

def delete_bibliography_by_hash(db: Session, public_hash: str):
    """Delete bibliography by public_hash"""
    bibliography = get_bibliography_by_hash(db, public_hash)
    if bibliography:
        db.delete(bibliography)
        db.commit()
        return True
    return False
