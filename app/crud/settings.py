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
Pure CRUD operations for the UserSetting model.
No business logic, no whitelist checks (those live in the service).
"""
from sqlalchemy.orm import Session
from typing import Dict
from uuid import UUID
from .. import models

def get_user_settings(db: Session, user_id: int) -> list[models.UserSetting]:
    """Return all persisted settings for a user (by internal id)."""
    return db.query(models.UserSetting).filter(
        models.UserSetting.user_id == user_id
    ).all()

def get_user_setting(db: Session, user_id: int, setting_key: str):
    """Return a single setting row or None."""
    return db.query(models.UserSetting).filter(
        models.UserSetting.user_id == user_id,
        models.UserSetting.setting_key == setting_key,
    ).first()

def upsert_user_setting(
    db: Session, user_id: int, user_uuid: UUID, setting_key: str, setting_value: str
) -> models.UserSetting:
    """Insert-or-update a single setting. Returns the row."""
    row = get_user_setting(db, user_id=user_id, setting_key=setting_key)
    if row is None:
        row = models.UserSetting(
            user_id=user_id,
            user_uuid=user_uuid,
            setting_key=setting_key,
            setting_value=setting_value,
        )
        db.add(row)
    else:
        row.setting_value = setting_value
    db.flush()
    return row

def upsert_user_settings_bulk(
    db: Session, user_id: int, user_uuid: UUID, settings: Dict[str, str]
) -> list[models.UserSetting]:
    """Insert-or-update many settings. Returns the touched rows.
    Caller is expected to whitelist the keys first."""
    touched = []
    for key, value in settings.items():
        row = upsert_user_setting(
            db, user_id=user_id, user_uuid=user_uuid,
            setting_key=key, setting_value=str(value),
        )
        touched.append(row)
    db.commit()
    for row in touched:
        db.refresh(row)
    return touched
