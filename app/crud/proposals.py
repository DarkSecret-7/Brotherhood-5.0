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
Pure CRUD operations for GraphProposal model.
No business logic - only raw database operations.
"""
from sqlalchemy.orm import Session
from uuid import UUID
from .. import models

def get_proposal_by_hash(db: Session, public_hash: str):
    """Get proposal by public_hash"""
    return db.query(models.GraphProposal).filter(models.GraphProposal.public_hash == public_hash).first()

def create_proposal_record(db: Session, **kwargs):
    """Create a new proposal record with provided fields"""
    db_proposal = models.GraphProposal(**kwargs)
    db.add(db_proposal)
    db.flush()
    return db_proposal

def update_proposal_record(db: Session, proposal_id: int, **kwargs):
    """Update proposal record with provided fields"""
    db.query(models.GraphProposal).filter(
        models.GraphProposal.id == proposal_id
    ).update(kwargs)
    db.flush()

def delete_proposal_by_hash(db: Session, public_hash: str):
    """Delete proposal by public_hash"""
    proposal = get_proposal_by_hash(db, public_hash)
    if proposal:
        db.delete(proposal)
        db.commit()
        return True
    return False

def get_proposal_by_kwargs(db: Session, **kwargs):
    """Get a single proposal by keyword arguments"""
    return db.query(models.GraphProposal).filter_by(**kwargs).first()

def get_proposals_by_kwargs(db: Session, skip: int = 0, limit: int = 100, **kwargs):
    """Get all proposals by keyword arguments"""
    return db.query(models.GraphProposal).filter_by(**kwargs).offset(skip).limit(limit).all()

def get_consent_by_kwargs(db: Session, **kwargs):
    """Get a single consent by keyword arguments"""
    return db.query(models.ProposalConsent).filter_by(**kwargs).first()
    
def get_consents_by_proposal_hash(db: Session, proposal_hash: str):
    """Get all consents for a proposal"""
    return db.query(models.ProposalConsent).filter(
        models.ProposalConsent.proposal_hash == proposal_hash
    ).all()

def get_consents_by_kwargs(db: Session, skip: int = 0, limit: int = 100, **kwargs):
    """Get all consents by keyword arguments"""
    return db.query(models.ProposalConsent).filter_by(**kwargs).offset(skip).limit(limit).all()

# Authorship invitations
def get_authorship_invitation_by_kwargs(db: Session, **kwargs):
    """Get a single authorship invitation by keyword arguments"""
    return db.query(models.AuthorshipInvitation).filter_by(**kwargs).first()

def get_authorship_invitations_by_kwargs(db: Session, skip: int = 0, limit: int = 100, **kwargs):
    """Get all authorship invitations by keyword arguments"""
    return db.query(models.AuthorshipInvitation).filter_by(**kwargs).offset(skip).limit(limit).all()

def create_authorship_invitation_record(db: Session, **kwargs):
    """Create a new authorship invitation record with provided fields"""
    db_invitation = models.AuthorshipInvitation(**kwargs)
    db.add(db_invitation)
    db.flush()
    return db_invitation

def update_authorship_invitation_record(db: Session, invitation_id: int, **kwargs):
    """Update authorship invitation record with provided fields"""
    db.query(models.AuthorshipInvitation).filter(models.AuthorshipInvitation.id == invitation_id).update(kwargs)
    db.flush()
