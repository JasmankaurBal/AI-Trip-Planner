"""Public read-only trip view (share links). No authentication."""
from datetime import datetime, date

from fastapi import APIRouter, HTTPException
from motor.motor_asyncio import AsyncIOMotorDatabase
from fastapi import Depends

from app.api.deps import db_dep

router = APIRouter(prefix="/api/public", tags=["public"])


def _iso(v):
    if isinstance(v, datetime):
        return v.date().isoformat()
    if isinstance(v, date):
        return v.isoformat()
    return v


@router.get("/trips/{token}")
async def public_trip(token: str, db: AsyncIOMotorDatabase = Depends(db_dep)):
    trip = await db.trips.find_one({"share_token": token})
    if not trip:
        raise HTTPException(status_code=404, detail="This shared trip link is invalid or was revoked.")
    tid = trip["_id"]
    acts = []
    async for a in db.activities.find({"trip_id": tid}).sort([("day_index", 1), ("order", 1)]):
        acts.append({
            "id": str(a["_id"]), "day_index": a["day_index"], "title": a["title"],
            "description": a.get("description", ""), "location": a.get("location", ""),
            "start_time": a.get("start_time", ""), "duration_minutes": a.get("duration_minutes", 0),
            "estimated_cost": a.get("estimated_cost", 0), "category": a.get("category", "other"),
            "transport": a.get("transport", "none"), "lat": a.get("lat"), "lng": a.get("lng"),
        })
    return {
        "title": trip.get("title"), "destination": trip.get("destination"),
        "start_date": _iso(trip.get("start_date")), "end_date": _iso(trip.get("end_date")),
        "travelers": trip.get("travelers"), "currency": trip.get("currency", "USD"),
        "budget": trip.get("budget"), "summary": trip.get("summary", ""),
        "selected_hotel": trip.get("selected_hotel"),
        "activities": acts,
    }
