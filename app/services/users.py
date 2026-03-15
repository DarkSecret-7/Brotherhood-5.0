"""
User service layer - Business logic for user operations.
Orchestrates CRUD operations and handles business rules.
"""
from sqlalchemy.orm import Session
from uuid import UUID
from .. import crud, schemas, models, utils

class UserService:
    
    @staticmethod
    def create_user(db: Session, user: schemas.UserCreate) -> models.User:
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
        return db_user

    @staticmethod
    def get_user(db: Session, user_uuid: UUID) -> models.User:
        """Get user by UUID"""
        return crud.users.get_user_by_uuid(db, user_uuid)

    @staticmethod
    def get_user_by_id(db: Session, user_id: int) -> models.User:
        """Get user by ID"""
        return crud.users.get_user_by_id(db, user_id)

    @staticmethod
    def get_user_by_username(db: Session, username: str) -> models.User:
        """Get user by username"""
        return crud.users.get_user_by_username(db, username)

    @staticmethod
    def update_user(db: Session, db_user: models.User, user_update: schemas.UserProfileUpdate) -> models.User:
        """Update user with business logic"""
        update_data = user_update.model_dump(exclude_unset=True)
        
        # Never change UUID - business rule
        if 'public_uuid' in update_data:
            del update_data['public_uuid']
        
        # Handle password update separately if present
        if 'password' in update_data:
            update_data['hashed_password'] = utils.get_password_hash(update_data['password'])
            del update_data['password']
        
        crud.users.update_user_record(db, db_user.id, **update_data)
        
        db.commit()
        db.refresh(db_user)
        return db_user

    @staticmethod
    def delete_user(db: Session, user_uuid: UUID) -> bool:
        """Delete user with business logic"""
        return crud.users.delete_user_by_uuid(db, user_uuid)
