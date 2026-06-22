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
Bibliography service layer - Business logic for bibliography operations.
Orchestrates CRUD operations and handles business rules.
"""
from sqlalchemy.orm import Session
from .. import crud, schemas, models, utils

class BibliographyService:

    @staticmethod
    def _convert_to_read_schema(db_bibliography: models.Bibliography) -> schemas.BibliographyRead:
        """Convert database model to read schema"""
        return schemas.BibliographyRead(
            public_hash=db_bibliography.public_hash,
            title=db_bibliography.title,
            author=db_bibliography.author,
            year=db_bibliography.year,
            bib_type=db_bibliography.bib_type,
            url=db_bibliography.url
        )

    @staticmethod
    def get_bibliography(db: Session, public_hash: str) -> schemas.BibliographyRead:
        """Get bibliography by hash"""
        db_bibliography = crud.bibliography.get_bibliography_by_hash(db, public_hash)
        if not db_bibliography:
            return None
        return BibliographyService._convert_to_read_schema(db_bibliography)

    @staticmethod
    def create_bibliography(db: Session, bibliography_data: schemas.BibliographyCreate) -> schemas.BibliographyRead:
        """Create bibliography with business logic"""
        string_data = bibliography_data.title + bibliography_data.author + str(bibliography_data.year) + bibliography_data.bib_type + bibliography_data.url
        public_hash = utils.generate_hash(string_data)
        
        db_bibliography = crud.bibliography.create_bibliography_record(
            db=db,
            public_hash=public_hash,
            title=bibliography_data.title,
            author=bibliography_data.author,
            year=bibliography_data.year,
            bib_type=bibliography_data.bib_type,
            url=bibliography_data.url
        )
        
        db.commit()
        db.refresh(db_bibliography)
        return BibliographyService._convert_to_read_schema(db_bibliography)

    @staticmethod
    def delete_bibliography(db: Session, public_hash: str) -> bool:
        """Delete bibliography with business logic"""
        return crud.bibliography.delete_bibliography_by_hash(db, public_hash)
