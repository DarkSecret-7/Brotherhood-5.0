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
Utility endpoints (health check, contact form, etc.)
"""
from fastapi import APIRouter
from .. import schemas, utils

router = APIRouter()

@router.get("/health")
def health_check():
    return {"status": "healthy"}

@router.post("/contact", response_model=schemas.ContactFormResponse)
def contact_form(payload: schemas.ContactFormRequest):
    # Validate input
    utils.validate_contact_form(payload)
    
    # Get email configuration and send email
    email_config = utils.get_email_config()
    utils.send_contact_email(payload, email_config)
    
    return {"ok": True}
