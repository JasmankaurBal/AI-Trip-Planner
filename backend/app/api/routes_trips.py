"""Trips: CRUD, AI generation, optimizer, budget, memories."""
from datetime import date, datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.api.deps import db_dep, get_current_user, get_owned_trip, oid
from app.core.logging import logger
from app.schemas.trips import BudgetUpdate, TripCreate, TripUpdate
from app.schemas.misc import MemoryCreate
from app.services import ai_service

router = APIRouter(prefix="/api/trips", tags=["trips"])

DEFAULT_BREAKDOWN = {
    "accommodation": 0, "transport": 0, "food": 0, "activities": 0,
    "shopping": 0, "miscellaneous": 0, "emergency": 0,
}


def _serialize(trip: dict) -> dict:
    trip = dict(trip)
    trip["id"] = str(trip.pop("_id"))
    trip["owner_id"] = str(trip.get("owner_id"))
    trip["member_ids"] = [str(m) for m in trip.get("member_ids", [])]
    for k in ("start_date", "end_date"):
        v = trip.get(k)
        if isinstance(v, datetime):
            trip[k] = v.date().isoformat()
        elif isinstance(v, date):
            trip[k] = v.isoformat()
    for k in ("created_at", "updated_at"):
        v = trip.get(k)
        if isinstance(v, datetime):
            trip[k] = v.isoformat()
    return trip


def _num_days(start: date, end: date) -> int:
    return max(1, (end - start).days + 1)


def _to_dt(d: date) -> datetime:
    return datetime(d.year, d.month, d.day, tzinfo=timezone.utc)


@router.get("")
async def list_trips(
    user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(db_dep),
    status: str | None = Query(default=None),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=100),
):
    uid = user["id"]
    query = {"$or": [{"owner_id": ObjectId(uid)}, {"member_ids": ObjectId(uid)}]}
    if status:
        query["status"] = status
    cursor = db.trips.find(query).sort("created_at", -1).skip(skip).limit(limit)
    trips = [_serialize(t) async for t in cursor]
    total = await db.trips.count_documents(query)
    return {"trips": trips, "total": total}


@router.post("", status_code=201)
async def create_trip(payload: TripCreate, user: dict = Depends(get_current_user), db: AsyncIOMotorDatabase = Depends(db_dep)):
    if payload.end_date < payload.start_date:
        raise HTTPException(status_code=422, detail="End date must be on or after start date")
    now = datetime.now(timezone.utc)
    doc = {
        "owner_id": ObjectId(user["id"]),
        "member_ids": [],
        "title": payload.title or f"Trip to {payload.destination}",
        "destination": payload.destination.strip(),
        "start_date": _to_dt(payload.start_date),
        "end_date": _to_dt(payload.end_date),
        "travelers": payload.travelers,
        "budget": payload.budget,
        "currency": payload.currency.upper(),
        "travel_style": payload.travel_style,
        "interests": payload.interests,
        "dietary": payload.dietary,
        "accessibility": payload.accessibility,
        "pace": payload.pace,
        "food_pref": payload.food_pref,
        "accommodation_pref": payload.accommodation_pref,
        "walking_level": payload.walking_level,
        "luxury_level": payload.luxury_level,
        "tourist_vs_local": payload.tourist_vs_local,
        "vibe": payload.vibe,
        "status": "planning",
        "summary": "",
        "budget_breakdown": dict(DEFAULT_BREAKDOWN),
        "selected_hotel": None,
        "created_at": now,
        "updated_at": now,
    }
    res = await db.trips.insert_one(doc)
    doc["_id"] = res.inserted_id
    return _serialize(doc)


@router.get("/{trip_id}")
async def get_trip(trip_id: str, user: dict = Depends(get_current_user), db: AsyncIOMotorDatabase = Depends(db_dep)):
    trip = await get_owned_trip(trip_id, user, db)
    return _serialize(trip)


@router.put("/{trip_id}")
async def update_trip(trip_id: str, payload: TripUpdate, user: dict = Depends(get_current_user), db: AsyncIOMotorDatabase = Depends(db_dep)):
    trip = await get_owned_trip(trip_id, user, db, write=True)
    if str(trip["owner_id"]) != user["id"] and user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Only the trip owner can edit trip details")
    updates: dict = {}
    for field, value in payload.model_dump(exclude_none=True).items():
        if field in ("start_date", "end_date") and isinstance(value, date):
            updates[field] = _to_dt(value)
        elif field == "currency":
            updates[field] = value.upper()
        else:
            updates[field] = value
    if updates:
        updates["updated_at"] = datetime.now(timezone.utc)
        await db.trips.update_one({"_id": oid(trip_id)}, {"$set": updates})
    return _serialize(await db.trips.find_one({"_id": oid(trip_id)}))


@router.delete("/{trip_id}")
async def delete_trip(trip_id: str, user: dict = Depends(get_current_user), db: AsyncIOMotorDatabase = Depends(db_dep)):
    trip = await get_owned_trip(trip_id, user, db)
    if str(trip["owner_id"]) != user["id"]:
        raise HTTPException(status_code=403, detail="Only the owner can delete this trip")
    tid = oid(trip_id)
    await db.trips.delete_one({"_id": tid})
    await db.activities.delete_many({"trip_id": tid})
    await db.expenses.delete_many({"trip_id": tid})
    await db.packing_items.delete_many({"trip_id": tid})
    await db.trip_memories.delete_many({"trip_id": tid})
    return {"ok": True}


@router.post("/{trip_id}/generate")
async def generate_trip(trip_id: str, user: dict = Depends(get_current_user), db: AsyncIOMotorDatabase = Depends(db_dep)):
    trip = await get_owned_trip(trip_id, user, db, write=True)
    if str(trip["owner_id"]) != user["id"]:
        raise HTTPException(status_code=403, detail="Only the owner can regenerate")
    num_days = _num_days(trip["start_date"].date(), trip["end_date"].date())
    spec = {
        "destination": trip["destination"], "travelers": trip.get("travelers", 1),
        "budget": trip.get("budget"), "currency": trip.get("currency", "USD"),
        "travel_style": trip.get("travel_style"), "interests": trip.get("interests", []),
        "pace": trip.get("pace"), "dietary": trip.get("dietary"), "accessibility": trip.get("accessibility"),
        "food_pref": trip.get("food_pref"), "accommodation_pref": trip.get("accommodation_pref"),
        "walking_level": trip.get("walking_level"), "luxury_level": trip.get("luxury_level"),
        "tourist_vs_local": trip.get("tourist_vs_local"), "vibe": trip.get("vibe"),
    }
    try:
        result = await ai_service.generate_itinerary(spec, num_days)
    except Exception as exc:  # noqa: BLE001
        logger.error(f"Generate failed for trip {trip_id}: {exc}")
        raise HTTPException(status_code=502, detail=str(exc))

    tid = oid(trip_id)
    await db.activities.delete_many({"trip_id": tid})
    now = datetime.now(timezone.utc)
    docs = []
    for day in result["days"]:
        for order, a in enumerate(day["activities"]):
            docs.append({
                "trip_id": tid, "day_index": day["day_index"], "order": order,
                **a, "notes": "", "created_at": now,
            })
    if docs:
        await db.activities.insert_many(docs)
    await db.trips.update_one({"_id": tid}, {"$set": {"summary": result["summary"], "status": "planned", "updated_at": now}})
    return {"summary": result["summary"], "days_generated": len(result["days"]), "activities_created": len(docs)}


@router.post("/{trip_id}/optimize")
async def optimize_trip(trip_id: str, user: dict = Depends(get_current_user), db: AsyncIOMotorDatabase = Depends(db_dep)):
    """Analyse the itinerary and return recommendations (never mutates silently)."""
    trip = await get_owned_trip(trip_id, user, db)
    tid = oid(trip_id)
    acts = [a async for a in db.activities.find({"trip_id": tid}).sort([("day_index", 1), ("order", 1)])]
    recs: list[dict] = []

    by_day: dict[int, list[dict]] = {}
    for a in acts:
        by_day.setdefault(a["day_index"], []).append(a)

    for day, day_acts in by_day.items():
        total_minutes = sum(a.get("duration_minutes", 0) for a in day_acts)
        if len(day_acts) > 6:
            recs.append({"type": "too_many_activities", "day": day, "severity": "medium",
                         "message": f"Day {day + 1} has {len(day_acts)} activities — consider trimming for a relaxed pace."})
        if total_minutes > 10 * 60:
            recs.append({"type": "insufficient_rest", "day": day, "severity": "medium",
                         "message": f"Day {day + 1} is packed ({total_minutes // 60}h of activities). Add downtime."})
        titles = [a["title"].lower() for a in day_acts]
        dupes = {t for t in titles if titles.count(t) > 1}
        for d in dupes:
            recs.append({"type": "duplicate_activity", "day": day, "severity": "low",
                         "message": f"Day {day + 1} repeats '{d}'."})

    # budget check
    budget = trip.get("budget")
    if budget:
        est = sum(a.get("estimated_cost", 0) for a in acts) * trip.get("travelers", 1)
        if est > budget:
            recs.append({"type": "budget_issue", "severity": "high",
                         "message": f"Estimated activity cost ({est:.0f} {trip.get('currency')}) exceeds budget ({budget:.0f})."})

    if not recs:
        recs.append({"type": "ok", "severity": "info", "message": "Your itinerary looks well balanced!"})
    return {"recommendations": recs}


@router.put("/{trip_id}/budget")
async def update_budget(trip_id: str, payload: BudgetUpdate, user: dict = Depends(get_current_user), db: AsyncIOMotorDatabase = Depends(db_dep)):
    trip = await get_owned_trip(trip_id, user, db, write=True)
    if str(trip["owner_id"]) != user["id"]:
        raise HTTPException(status_code=403, detail="Only the owner can change the budget")
    updates = {"budget": payload.budget, "updated_at": datetime.now(timezone.utc)}
    if payload.breakdown is not None:
        merged = dict(DEFAULT_BREAKDOWN)
        merged.update({k: v for k, v in payload.breakdown.items() if k in DEFAULT_BREAKDOWN})
        updates["budget_breakdown"] = merged
    await db.trips.update_one({"_id": oid(trip_id)}, {"$set": updates})
    return _serialize(await db.trips.find_one({"_id": oid(trip_id)}))


@router.get("/{trip_id}/budget")
async def get_budget(trip_id: str, user: dict = Depends(get_current_user), db: AsyncIOMotorDatabase = Depends(db_dep)):
    trip = await get_owned_trip(trip_id, user, db)
    tid = oid(trip_id)
    acts = [a async for a in db.activities.find({"trip_id": tid})]
    travelers = trip.get("travelers", 1)
    estimated_activities = sum(a.get("estimated_cost", 0) for a in acts) * travelers

    spent_by_cat: dict[str, float] = {k: 0.0 for k in DEFAULT_BREAKDOWN}
    total_spent = 0.0
    async for e in db.expenses.find({"trip_id": tid}):
        cat = e.get("category", "miscellaneous")
        amt = e.get("amount", 0)
        spent_by_cat[cat] = spent_by_cat.get(cat, 0.0) + amt
        total_spent += amt

    budget = trip.get("budget") or 0
    num_days = _num_days(trip["start_date"].date(), trip["end_date"].date())
    return {
        "budget": budget,
        "currency": trip.get("currency", "USD"),
        "breakdown": trip.get("budget_breakdown", DEFAULT_BREAKDOWN),
        "estimated_activities_cost": round(estimated_activities, 2),
        "total_spent": round(total_spent, 2),
        "spent_by_category": {k: round(v, 2) for k, v in spent_by_cat.items()},
        "remaining": round(budget - total_spent, 2),
        "daily_average": round(total_spent / num_days, 2) if num_days else 0,
        "projected_total": round(total_spent + estimated_activities, 2),
        "num_days": num_days,
    }


# ---- Trip memories ----
@router.get("/{trip_id}/memories")
async def list_memories(trip_id: str, user: dict = Depends(get_current_user), db: AsyncIOMotorDatabase = Depends(db_dep)):
    await get_owned_trip(trip_id, user, db)
    tid = oid(trip_id)
    items = []
    async for m in db.trip_memories.find({"trip_id": tid}).sort("created_at", -1):
        m["id"] = str(m.pop("_id"))
        m["trip_id"] = str(m["trip_id"])
        m["created_at"] = m["created_at"].isoformat() if isinstance(m.get("created_at"), datetime) else m.get("created_at")
        items.append(m)
    return {"memories": items}


@router.post("/{trip_id}/memories", status_code=201)
async def add_memory(trip_id: str, payload: MemoryCreate, user: dict = Depends(get_current_user), db: AsyncIOMotorDatabase = Depends(db_dep)):
    await get_owned_trip(trip_id, user, db, write=True)
    doc = {
        "trip_id": oid(trip_id), "author_id": user["id"], "title": payload.title,
        "note": payload.note, "photos": payload.photos, "favorite_places": payload.favorite_places,
        "created_at": datetime.now(timezone.utc),
    }
    res = await db.trip_memories.insert_one(doc)
    doc["id"] = str(res.inserted_id)
    doc.pop("_id", None)
    doc["trip_id"] = trip_id
    doc["created_at"] = doc["created_at"].isoformat()
    return doc
