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
User service layer - Business logic for user operations.
Orchestrates CRUD operations and handles business rules.
"""
from sqlalchemy.orm import Session
from uuid import UUID
from .. import crud, schemas, models, utils

class UserService:

    @staticmethod
    def _convert_to_read_schema(db_user: models.User) -> schemas.UserRead:
        """Convert database model to read schema"""
        return schemas.UserRead(
            user_uuid=db_user.public_uuid,
            username=db_user.username,
            is_active=db_user.is_active,
            created_at=db_user.created_at
        )

    @staticmethod
    def _convert_to_profile_schema(db_user: models.User) -> schemas.UserProfileRead:
        """Convert database model to full profile read schema"""
        return schemas.UserProfileRead(
            user_uuid=db_user.public_uuid,
            username=db_user.username,
            is_active=db_user.is_active,
            created_at=db_user.created_at,
            email=db_user.email,
            phone=db_user.phone,
            dob=db_user.dob,
            bio=db_user.bio,
            location=db_user.location,
            social_github=db_user.social_github,
            social_linkedin=db_user.social_linkedin,
            profile_image=db_user.profile_image
        )

    @staticmethod
    def create_user(db: Session, user: schemas.UserCreate) -> schemas.UserRead:
        """Create a new user with business logic"""
        # Hash password - business logic
        hashed_password = utils.get_password_hash(user.password)
        
        db_user = crud.users.create_user_record(
            db=db,
            username=user.username,
            hashed_password=hashed_password
        )
        
        db.commit()
        db.refresh(db_user)
        return UserService._convert_to_read_schema(db_user)

    @staticmethod
    def get_user(db: Session, user_uuid: UUID) -> schemas.UserRead:
        """Get user by UUID"""
        db_user = crud.users.get_user_by_uuid(db, user_uuid)
        if not db_user:
            return None
        return UserService._convert_to_read_schema(db_user)

    @staticmethod
    def get_user_by_uuid(db: Session, user_uuid: UUID) -> schemas.UserRead:
        """Get user by UUID (internal helper)"""
        db_user = crud.users.get_user_by_uuid(db, user_uuid)
        if not db_user:
            return None
        return UserService._convert_to_read_schema(db_user)

    @staticmethod
    def get_user_by_username(db: Session, username: str) -> schemas.UserRead:
        """Get user by username"""
        db_user = crud.users.get_user_by_username(db, username)
        if not db_user:
            return None
        return UserService._convert_to_read_schema(db_user)

    @staticmethod
    def update_user(db: Session, db_user: models.User, user_update: schemas.UserProfileUpdate) -> schemas.UserRead:
        """Update user with business logic"""
        update_data = user_update.model_dump(exclude_unset=True)
        
        # Never change UUID - business rule
        if 'user_uuid' in update_data:
            del update_data['user_uuid']
        
        # Handle password update separately if present
        if 'password' in update_data:
            update_data['hashed_password'] = utils.get_password_hash(update_data['password'])
            del update_data['password']
        
        crud.users.update_user_record(db, db_user.id, **update_data)
        
        db.commit()
        db.refresh(db_user)
        return UserService._convert_to_read_schema(db_user)

    @staticmethod
    def get_user_profile(db: Session, user_uuid: UUID) -> schemas.UserProfileRead:
        """Get full user profile"""
        db_user = crud.users.get_user_by_uuid(db, user_uuid)
        if not db_user:
            return None
        return UserService._convert_to_profile_schema(db_user)

    @staticmethod
    def delete_user(db: Session, user_uuid: UUID) -> bool:
        """Delete user with business logic"""
        return crud.users.delete_user_by_uuid(db, user_uuid)
