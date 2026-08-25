"""Activities (itinerary items), reorder, and packing list."""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.api.deps import db_dep, get_current_user, get_owned_trip, oid
from app.schemas.trips import ActivityCreate, ActivityUpdate, ReorderRequest
from app.schemas.misc import PackingItemCreate, PackingItemUpdate

router = APIRouter(prefix="/api/trips", tags=["activities"])


def _ser_activity(a: dict) -> dict:
    a = dict(a)
    a["id"] = str(a.pop("_id"))
    a["trip_id"] = str(a["trip_id"])
    a.pop("created_at", None)
    return a


@router.get("/{trip_id}/activities")
async def list_activities(trip_id: str, user: dict = Depends(get_current_user), db: AsyncIOMotorDatabase = Depends(db_dep)):
    await get_owned_trip(trip_id, user, db)
    cursor = db.activities.find({"trip_id": oid(trip_id)}).sort([("day_index", 1), ("order", 1)])
    return {"activities": [_ser_activity(a) async for a in cursor]}


@router.post("/{trip_id}/activities", status_code=201)
async def create_activity(trip_id: str, payload: ActivityCreate, user: dict = Depends(get_current_user), db: AsyncIOMotorDatabase = Depends(db_dep)):
    await get_owned_trip(trip_id, user, db, write=True)
    tid = oid(trip_id)
    count = await db.activities.count_documents({"trip_id": tid, "day_index": payload.day_index})
    doc = {"trip_id": tid, "order": count, "created_at": datetime.now(timezone.utc), **payload.model_dump()}
    res = await db.activities.insert_one(doc)
    doc["_id"] = res.inserted_id
    return _ser_activity(doc)


@router.put("/{trip_id}/activities/{activity_id}")
async def update_activity(trip_id: str, activity_id: str, payload: ActivityUpdate, user: dict = Depends(get_current_user), db: AsyncIOMotorDatabase = Depends(db_dep)):
    await get_owned_trip(trip_id, user, db, write=True)
    updates = payload.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(status_code=422, detail="No fields to update")
    result = await db.activities.update_one({"_id": oid(activity_id), "trip_id": oid(trip_id)}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Activity not found")
    return _ser_activity(await db.activities.find_one({"_id": oid(activity_id)}))


@router.delete("/{trip_id}/activities/{activity_id}")
async def delete_activity(trip_id: str, activity_id: str, user: dict = Depends(get_current_user), db: AsyncIOMotorDatabase = Depends(db_dep)):
    await get_owned_trip(trip_id, user, db, write=True)
    result = await db.activities.delete_one({"_id": oid(activity_id), "trip_id": oid(trip_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Activity not found")
    return {"ok": True}


@router.post("/{trip_id}/activities/reorder")
async def reorder_activities(trip_id: str, payload: ReorderRequest, user: dict = Depends(get_current_user), db: AsyncIOMotorDatabase = Depends(db_dep)):
    await get_owned_trip(trip_id, user, db, write=True)
    tid = oid(trip_id)
    for order, aid in enumerate(payload.ordered_ids):
        await db.activities.update_one(
            {"_id": oid(aid), "trip_id": tid},
            {"$set": {"order": order, "day_index": payload.day_index}},
        )
    return {"ok": True}


# ---- Packing list ----
@router.get("/{trip_id}/packing")
async def list_packing(trip_id: str, user: dict = Depends(get_current_user), db: AsyncIOMotorDatabase = Depends(db_dep)):
    await get_owned_trip(trip_id, user, db)
    items = []
    async for p in db.packing_items.find({"trip_id": oid(trip_id)}).sort("created_at", 1):
        p["id"] = str(p.pop("_id"))
        p["trip_id"] = str(p["trip_id"])
        p.pop("created_at", None)
        items.append(p)
    return {"items": items}


@router.post("/{trip_id}/packing", status_code=201)
async def add_packing(trip_id: str, payload: PackingItemCreate, user: dict = Depends(get_current_user), db: AsyncIOMotorDatabase = Depends(db_dep)):
    await get_owned_trip(trip_id, user, db, write=True)
    doc = {"trip_id": oid(trip_id), "checked": False, "created_at": datetime.now(timezone.utc), **payload.model_dump()}
    res = await db.packing_items.insert_one(doc)
    doc["id"] = str(res.inserted_id)
    doc.pop("_id", None)
    doc["trip_id"] = trip_id
    doc.pop("created_at", None)
    return doc


@router.put("/{trip_id}/packing/{item_id}")
async def update_packing(trip_id: str, item_id: str, payload: PackingItemUpdate, user: dict = Depends(get_current_user), db: AsyncIOMotorDatabase = Depends(db_dep)):
    await get_owned_trip(trip_id, user, db, write=True)
    updates = payload.model_dump(exclude_none=True)
    result = await db.packing_items.update_one({"_id": oid(item_id), "trip_id": oid(trip_id)}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Item not found")
    return {"ok": True}


@router.delete("/{trip_id}/packing/{item_id}")
async def delete_packing(trip_id: str, item_id: str, user: dict = Depends(get_current_user), db: AsyncIOMotorDatabase = Depends(db_dep)):
    await get_owned_trip(trip_id, user, db, write=True)
    await db.packing_items.delete_one({"_id": oid(item_id), "trip_id": oid(trip_id)})
    return {"ok": True}


@router.post("/{trip_id}/packing/generate")
async def generate_packing(trip_id: str, user: dict = Depends(get_current_user), db: AsyncIOMotorDatabase = Depends(db_dep)):
    """Seed a sensible packing list from trip attributes (no external call needed)."""
    trip = await get_owned_trip(trip_id, user, db, write=True)
    base = {
        "Essentials": ["Passport / ID", "Phone charger", "Wallet & cards", "Medications", "Travel insurance"],
        "Clothing": ["T-shirts", "Underwear", "Socks", "Comfortable shoes", "Light jacket"],
        "Toiletries": ["Toothbrush & paste", "Sunscreen", "Deodorant", "Shampoo"],
        "Tech": ["Power bank", "Universal adapter", "Headphones"],
    }
    interests = [i.lower() for i in trip.get("interests", [])]
    if any(x in interests for x in ("beach", "swimming", "water")):
        base.setdefault("Activity", []).extend(["Swimwear", "Beach towel", "Flip flops"])
    if any(x in interests for x in ("hiking", "adventure", "nature")):
        base.setdefault("Activity", []).extend(["Hiking boots", "Reusable water bottle", "Daypack"])
    now = datetime.now(timezone.utc)
    docs = [
        {"trip_id": oid(trip_id), "name": name, "category": cat, "quantity": 1, "checked": False, "created_at": now}
        for cat, items in base.items() for name in items
    ]
    await db.packing_items.delete_many({"trip_id": oid(trip_id)})
    await db.packing_items.insert_many(docs)
    return {"created": len(docs)}
