"""Shared FastAPI dependencies: DB access, current user, resource authorization."""
from bson import ObjectId
from bson.errors import InvalidId
from fastapi import Depends, HTTPException, Request, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.security import decode_token
from app.db.mongo import get_db


def db_dep() -> AsyncIOMotorDatabase:
    return get_db()


def _extract_token(request: Request) -> str | None:
    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    return token


async def get_current_user(request: Request, db: AsyncIOMotorDatabase = Depends(db_dep)) -> dict:
    token = _extract_token(request)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    try:
        payload = decode_token(token)
        if payload.get("type") != "access":
            raise ValueError("Invalid token type")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    user["id"] = str(user["_id"])
    user.pop("password_hash", None)
    return user


def oid(value: str) -> ObjectId:
    try:
        return ObjectId(value)
    except (InvalidId, TypeError):
        raise HTTPException(status_code=400, detail="Invalid id")


async def get_owned_trip(trip_id: str, user: dict, db: AsyncIOMotorDatabase, write: bool = False) -> dict:
    trip = await db.trips.find_one({"_id": oid(trip_id)})
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    uid = user["id"]
    is_admin = user.get("role") == "admin"
    owner = str(trip.get("owner_id")) == uid
    member = uid in [str(m) for m in trip.get("member_ids", [])]
    if not (owner or member or is_admin):
        raise HTTPException(status_code=403, detail="Access denied")
    if write and not owner and not is_admin:
        raise HTTPException(status_code=403, detail="Only the trip owner can modify the itinerary")
    return trip
