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
Utility endpoints (health check, contact form, etc.)
"""
import os
from typing import List

from fastapi import APIRouter
from pydantic import BaseModel

from .. import schemas
from ..utils import utils

router = APIRouter()

@router.get("/health")
def health_check():
    return {"status": "healthy"}


class DocInfo(BaseModel):
    """Metadata for one file served from /docs."""
    filename: str
    size_bytes: int
    size_human: str
    type: str          # e.g. "PDF", "DOCX"
    url: str           # absolute path, e.g. "/docs/Foo.pdf"


def _human_size(num_bytes: int) -> str:
    """Format a byte count as a short human-readable string (e.g. '21 KB')."""
    if num_bytes < 1024:
        return f"{num_bytes} B"
    units = ("KB", "MB", "GB")
    value = num_bytes / 1024.0
    for unit in units:
        if value < 1024 or unit == units[-1]:
            return f"{value:.0f} {unit}" if value >= 10 else f"{value:.1f} {unit}"
        value /= 1024.0
    return f"{num_bytes} B"


_TYPE_BY_EXT = {
    ".pdf":  "PDF",
    ".doc":  "DOC",
    ".docx": "DOCX",
    ".txt":  "TXT",
    ".md":   "MD",
}


@router.get("/docs-info", response_model=List[DocInfo])
def docs_info():
    """List every file in the project `docs/` directory with its size and URL.

    Used by the landing page to render document cards without hard-coded
    file sizes — drop a new file into `docs/` and it appears automatically.
    """
    docs_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
        "docs",
    )
    if not os.path.isdir(docs_path):
        return []

    out: List[DocInfo] = []
    for entry in sorted(os.listdir(docs_path)):
        full = os.path.join(docs_path, entry)
        if not os.path.isfile(full):
            continue
        size = os.path.getsize(full)
        _, ext = os.path.splitext(entry)
        out.append(
            DocInfo(
                filename=entry,
                size_bytes=size,
                size_human=_human_size(size),
                type=_TYPE_BY_EXT.get(ext.lower(), ext.lstrip(".").upper() or "FILE"),
                url=f"/docs/{entry}",
            )
        )
    return out


@router.post("/contact", response_model=schemas.ContactFormResponse)
def contact_form(payload: schemas.ContactFormRequest):
    # Validate input
    utils.validate_contact_form(payload)
    
    # Get email configuration and send email
    email_config = utils.get_email_config()
    utils.send_contact_email(payload, email_config)
    
    return {"ok": True}
