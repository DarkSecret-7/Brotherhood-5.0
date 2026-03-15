"""
Utility endpoints (health check, contact form, etc.)
"""
from fastapi import APIRouter, HTTPException
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
