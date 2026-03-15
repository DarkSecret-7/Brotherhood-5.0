"""
API module initialization
"""
from fastapi import APIRouter
from . import auth, snapshots, proposals, authorship, utility

# Create main router
api_router = APIRouter()

# Include all sub-routers
api_router.include_router(auth.router, tags=["authentication"])
api_router.include_router(snapshots.router, tags=["snapshots"])
api_router.include_router(proposals.router, tags=["proposals"])
api_router.include_router(authorship.router, tags=["authorship"])
api_router.include_router(utility.router, tags=["utility"])