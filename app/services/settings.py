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
Service layer for user-scoped settings.

This is the single source of truth for which setting keys are
recognised by the platform. New keys must be added to
`SettingService.WHITELISTED_KEYS` (and given a known value domain
where applicable). Unknown keys coming in via POST are rejected so
the table cannot grow on the client.
"""
from typing import Dict
from uuid import UUID
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from .. import crud

class SettingService:

    # Whitelist of recognised setting keys. New keys must be added here
    # and (when relevant) given a known value domain below.
    WHITELISTED_KEYS = frozenset({
        "dark_mode",     # 'true' / 'false'
    })

    # Per-key value domain. Strings not in `allowed` raise 400.
    # Keys not listed here are still allowed (treated as opaque strings).
    VALUE_DOMAINS: Dict[str, set] = {
        "dark_mode": {"true", "false"},
    }

    # ------------------------------------------------------------------
    # Reads
    # ------------------------------------------------------------------

    @staticmethod
    def get_user_settings(db: Session, user_uuid: UUID) -> Dict[str, str]:
        """Return the full setting map for the user (only whitelisted keys)."""
        user = crud.users.get_user_by_uuid(db, user_uuid=user_uuid)
        if user is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

        rows = crud.settings.get_user_settings(db, user_id=user.id)
        result: Dict[str, str] = {}
        for row in rows:
            if row.setting_key in SettingService.WHITELISTED_KEYS:
                result[row.setting_key] = row.setting_value
        return result

    # ------------------------------------------------------------------
    # Writes
    # ------------------------------------------------------------------

    @staticmethod
    def _validate_settings_dict(settings: Dict[str, str]) -> Dict[str, str]:
        """Reject unknown keys and out-of-domain values. Returns the
        same dict on success."""
        if not isinstance(settings, dict):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="`settings` must be an object of string -> string pairs",
            )

        # Reject empty body to keep the call idempotent on intent.
        if not settings:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="`settings` must contain at least one key",
            )

        for key, value in settings.items():
            if not isinstance(key, str) or not key:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid setting key: {key!r}",
                )
            if key not in SettingService.WHITELISTED_KEYS:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Unknown setting key: {key!r}",
                )
            value_str = "" if value is None else str(value)
            domain = SettingService.VALUE_DOMAINS.get(key)
            if domain is not None and value_str not in domain:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid value for {key!r}: {value_str!r}",
                )

        return {k: ("" if v is None else str(v)) for k, v in settings.items()}

    @staticmethod
    def upsert_user_settings(
        db: Session, user_uuid: UUID, settings: Dict[str, str]
    ) -> Dict[str, str]:
        """Validate + bulk-upsert the supplied keys. Returns the full
        resulting setting map (so the client doesn't need a follow-up GET)."""
        validated = SettingService._validate_settings_dict(settings)

        user = crud.users.get_user_by_uuid(db, user_uuid=user_uuid)
        if user is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

        crud.settings.upsert_user_settings_bulk(
            db, user_id=user.id, user_uuid=user.public_uuid, settings=validated
        )
        return SettingService.get_user_settings(db, user_uuid=user_uuid)
