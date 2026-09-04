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
Bibliography API - read-only endpoints for the global bibliography
database, used by the Source Attribution tab to find bibliographies
that are not yet present in the curator's current graph.
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from .. import database, schemas, services
from .auth import get_current_user
from .. import models

router = APIRouter()


@router.get("/bibliography/search", response_model=schemas.BibliographySearchResult)
def search_bibliography(
    q: str = Query(default=None, description="Free-text query matched against title and author (case insensitive)"),
    bib_type: str = Query(default=None, description="Exact-match filter on bib_type (e.g. 'PDF', 'Video', 'Other')"),
    limit: int = Query(default=50, ge=1, le=200, description="Page size (max 200)"),
    offset: int = Query(default=0, ge=0, description="Number of rows to skip"),
    db: Session = Depends(database.get_db),
    # Authenticated-only: any signed-in user can browse the global
    # bibliography database. Read access does not leak authorship
    # information (bibliographies have no owner column).
    _current_user: models.User = Depends(get_current_user),
):
    """Search the global bibliography database.

    Returns a paginated list of bibliographies together with the total
    number of matches. The query is matched against `title` and
    `author`; `bib_type` is an exact-match filter. Results are ordered
    alphabetically by title (case insensitive) with the hash as a
    stable tiebreaker.
    """
    return services.bibliography.BibliographyService.search_bibliographies(
        db=db,
        query=q,
        bib_type=bib_type,
        limit=limit,
        offset=offset,
    )
