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
Invitation service layer - Business logic for invitation operations.
Orchestrates CRUD operations and handles business rules.
"""
from sqlalchemy.orm import Session
from .. import crud, schemas, models

class InvitationService:
    
    @staticmethod
    def get_invitation_by_code(db: Session, code: str) -> models.Invitation:
        """Get invitation by code"""
        return crud.invitations.get_invitation_by_code(db, code)

    @staticmethod
    def create_invitation(db: Session, code: str) -> models.Invitation:
        """Create a new invitation with business logic"""
        db_invitation = crud.invitations.create_invitation_record(db=db, code=code)
        
        db.commit()
        db.refresh(db_invitation)
        return db_invitation

    @staticmethod
    def use_invitation(db: Session, invitation: models.Invitation) -> models.Invitation:
        """Mark invitation as used - business logic"""
        crud.invitations.update_invitation_record(db, invitation.id, is_used=True)
        
        db.commit()
        db.refresh(invitation)
        return invitation

    @staticmethod
    def delete_invitation(db: Session, code: str) -> bool:
        """Delete invitation with business logic"""
        return crud.invitations.delete_invitation_by_code(db, code)
