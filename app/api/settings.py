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
User-scoped settings endpoints.

GET  /api/v1/dashboard/settings  -> current user's settings as a flat map
POST /api/v1/dashboard/settings  -> bulk upsert of one or more whitelisted keys
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from .. import database, models, schemas, services
from .auth import get_current_user

router = APIRouter()

@router.get("/dashboard/settings", response_model=schemas.UserSettingBulkRead)
def get_settings(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Return the current user's settings as `{ key: value }`."""
    return schemas.UserSettingBulkRead(
        settings=services.settings.SettingService.get_user_settings(
            db, user_uuid=current_user.public_uuid
        )
    )

@router.post("/dashboard/settings", response_model=schemas.UserSettingBulkRead)
def post_settings(
    payload: schemas.UserSettingBulkUpdate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Bulk upsert the supplied settings. Unknown keys are rejected
    with 400 by the service layer (whitelist enforcement)."""
    updated = services.settings.SettingService.upsert_user_settings(
        db, user_uuid=current_user.public_uuid, settings=payload.settings
    )
    return schemas.UserSettingBulkRead(settings=updated)
