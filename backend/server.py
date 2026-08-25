"""COCO backend — FastAPI application entry point.

Run by supervisor: `uvicorn server:app --host 0.0.0.0 --port 8001`
Modular app lives under `app/` (core, db, models, schemas, services, api).
"""
from dotenv import load_dotenv

load_dotenv()

from datetime import datetime, timezone  # noqa: E402

from fastapi import FastAPI, Request  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402
from fastapi.responses import JSONResponse  # noqa: E402

from app.core.config import settings  # noqa: E402
from app.core.logging import logger  # noqa: E402
from app.core.security import hash_password, verify_password  # noqa: E402
from app.db.mongo import ensure_indexes, get_db, ping  # noqa: E402

from app.api.routes_auth import router as auth_router  # noqa: E402
from app.api.routes_trips import router as trips_router  # noqa: E402
from app.api.routes_activities import router as activities_router  # noqa: E402
from app.api.routes_expenses import router as expenses_router  # noqa: E402
from app.api.routes_chat import router as chat_router  # noqa: E402
from app.api.routes_data import router as data_router  # noqa: E402
from app.api.routes_explore import router as explore_router  # noqa: E402
from app.api.routes_public import router as public_router  # noqa: E402
from app.api.routes_trip_ai import router as trip_ai_router  # noqa: E402
from app.api.routes_documents import router as documents_router  # noqa: E402
from app.api.routes_collab import router as collab_router  # noqa: E402
from app.api.routes_notifications import router as notifications_router  # noqa: E402
from app.api.routes_health import router as health_router  # noqa: E402

app = FastAPI(title="COCO API", version="1.0.0", description="AI Trip Planner & Travel Companion")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

for r in (
    health_router, auth_router, trips_router, trip_ai_router, activities_router, expenses_router,
    chat_router, data_router, explore_router, public_router, documents_router, collab_router, notifications_router,
):
    app.include_router(r)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled error on {request.method} {request.url.path}: {exc}")
    return JSONResponse(status_code=500, content={"detail": "An unexpected error occurred. Please try again."})


async def _seed_admin() -> None:
    db = get_db()
    existing = await db.users.find_one({"email": settings.ADMIN_EMAIL})
    now = datetime.now(timezone.utc)
    if existing is None:
        await db.users.insert_one({
            "name": "COCO Admin", "email": settings.ADMIN_EMAIL,
            "password_hash": hash_password(settings.ADMIN_PASSWORD),
            "role": "admin", "auth_provider": "password", "created_at": now,
        })
        logger.info("Seeded admin user")
    elif existing.get("password_hash") and not verify_password(settings.ADMIN_PASSWORD, existing["password_hash"]):
        await db.users.update_one({"email": settings.ADMIN_EMAIL}, {"$set": {"password_hash": hash_password(settings.ADMIN_PASSWORD)}})
        logger.info("Updated admin password")


@app.on_event("startup")
async def on_startup() -> None:
    logger.info("COCO backend starting up")
    if await ping():
        logger.info("MongoDB connected")
        await ensure_indexes()
        if settings.ADMIN_EMAIL and settings.ADMIN_PASSWORD:
            await _seed_admin()
        elif settings.ADMIN_EMAIL or settings.ADMIN_PASSWORD:
            raise RuntimeError("ADMIN_EMAIL and ADMIN_PASSWORD must be configured together")
    else:
        logger.error("MongoDB not reachable at startup")


@app.get("/")
async def root():
    return {"service": "COCO API", "docs": "/docs", "health": "/api/health"}
