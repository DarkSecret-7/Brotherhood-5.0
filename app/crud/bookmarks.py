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

from sqlalchemy.orm import Session
from .. import models

def get_bookmarks(db: Session, user_id: int):
    return db.query(models.Bookmark).filter(models.Bookmark.user_id == user_id).all()

def create_bookmark(db: Session, user_id: int, graph_id: int):
    user_uuid = db.query(models.User).filter(models.User.id == user_id).first().public_uuid
    graph_uuid = db.query(models.GraphSnapshot).filter(models.GraphSnapshot.id == graph_id).first().public_uuid
    db_bookmark = models.Bookmark(user_id=user_id, graph_id=graph_id, user_uuid=user_uuid, graph_uuid=graph_uuid)
    db.add(db_bookmark)
    db.commit()
    db.refresh(db_bookmark)
    return db_bookmark

def delete_bookmark(db: Session, user_id: int, graph_id: int):
    db_bookmark = db.query(models.Bookmark).filter(
        models.Bookmark.user_id == user_id,
        models.Bookmark.graph_id == graph_id
    ).first()
    if db_bookmark:
        db.delete(db_bookmark)
        db.commit()
        return True
    return False

def get_bookmark(db: Session, user_id: int, graph_id: int):
    return db.query(models.Bookmark).filter(
        models.Bookmark.user_id == user_id,
        models.Bookmark.graph_id == graph_id
    ).first()
