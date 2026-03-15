"""
Bibliography service layer - Business logic for bibliography operations.
Orchestrates CRUD operations and handles business rules.
"""
from sqlalchemy.orm import Session
from .. import crud, schemas, models, utils

class BibliographyService:
    
    @staticmethod
    def get_bibliography(db: Session, public_hash: str) -> models.Bibliography:
        """Get bibliography by hash"""
        return crud.bibliography.get_bibliography_by_hash(db, public_hash)

    @staticmethod
    def create_bibliography(db: Session, bibliography_data: schemas.BibliographyCreate) -> models.Bibliography:
        """Create bibliography with business logic"""
        # Generate public hash - business logic
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
        return db_bibliography

    @staticmethod
    def delete_bibliography(db: Session, public_hash: str) -> bool:
        """Delete bibliography with business logic"""
        return crud.bibliography.delete_bibliography_by_hash(db, public_hash)
