"""Health check and root info."""
from fastapi import APIRouter

from app.db.mongo import ping

router = APIRouter(prefix="/api", tags=["system"])


@router.get("/health")
async def health():
    db_ok = await ping()
    return {
        "status": "ok" if db_ok else "degraded",
        "api": "running",
        "database": "connected" if db_ok else "unavailable",
        "service": "coco-backend",
    }
