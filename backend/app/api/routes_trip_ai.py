"""Authenticated trip AI-power routes: AI-edit, day summary, hotels, route optimization, flights."""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel, Field

from app.api.deps import db_dep, get_current_user, get_owned_trip, oid
from app.core.logging import logger
from app.services import ai_service, hotels_service, routing_service, weather_service, flights_service
from app.api.routes_explore import geocode_destination

router = APIRouter(prefix="/api/trips", tags=["trip-ai"])


def _prefs(trip: dict) -> dict:
    return {k: trip.get(k) for k in ("travel_style", "interests", "pace", "dietary", "food_pref",
                                     "accommodation_pref", "walking_level", "luxury_level", "tourist_vs_local", "vibe")}


async def _activities(db, tid):
    return [a async for a in db.activities.find({"trip_id": tid}).sort([("day_index", 1), ("order", 1)])]


class AiEdit(BaseModel):
    instruction: str = Field(min_length=1, max_length=600)


@router.post("/{trip_id}/ai-edit")
async def ai_edit(trip_id: str, payload: AiEdit, user: dict = Depends(get_current_user), db: AsyncIOMotorDatabase = Depends(db_dep)):
    trip = await get_owned_trip(trip_id, user, db, write=True)
    tid = oid(trip_id)
    acts = await _activities(db, tid)
    if not acts:
        raise HTTPException(status_code=422, detail="Generate an itinerary first, then ask COCO to edit it.")
    days_map: dict[int, dict] = {}
    for a in acts:
        d = days_map.setdefault(a["day_index"], {"day_index": a["day_index"], "title": "", "activities": []})
        d["activities"].append(a)
    days = [days_map[k] for k in sorted(days_map)]
    try:
        result = await ai_service.edit_itinerary(trip["destination"], trip.get("currency", "USD"), days, payload.instruction, _prefs(trip))
    except Exception as exc:  # noqa: BLE001
        logger.error(f"ai-edit failed for {trip_id}: {exc}")
        raise HTTPException(status_code=502, detail=str(exc))
    now = datetime.now(timezone.utc)
    await db.activities.delete_many({"trip_id": tid})
    docs = []
    for day in result["days"]:
        for order, a in enumerate(day["activities"]):
            docs.append({"trip_id": tid, "day_index": day["day_index"], "order": order, **a, "notes": "", "created_at": now})
    if docs:
        await db.activities.insert_many(docs)
    await db.trips.update_one({"_id": tid}, {"$set": {"summary": result["summary"], "updated_at": now}})
    return {"summary": result["summary"], "activities_created": len(docs)}


@router.get("/{trip_id}/day/{index}/summary")
async def day_summary(trip_id: str, index: int, user: dict = Depends(get_current_user), db: AsyncIOMotorDatabase = Depends(db_dep)):
    """'What's cooking today?' — computed from itinerary + weather + budget + routing."""
    trip = await get_owned_trip(trip_id, user, db)
    tid = oid(trip_id)
    day_acts = [a async for a in db.activities.find({"trip_id": tid, "day_index": index}).sort("order", 1)]
    currency = trip.get("currency", "USD")
    spend = round(sum(a.get("estimated_cost", 0) for a in day_acts) * trip.get("travelers", 1), 2)
    reservations = [a["title"] for a in day_acts if a.get("category") in ("food", "accommodation")]

    legs = await routing_service.legs_for_sequence(day_acts) if len(day_acts) > 1 else []
    walking_km = round(sum(l["distance_km"] for l in legs if l and l["mode"] == "walk"), 1)
    total_travel_min = sum(l["duration_min"] for l in legs if l)

    weather = None
    warnings = []
    try:
        geo = await geocode_destination(trip["destination"])
        w = await weather_service.get_weather(geo["lat"], geo["lng"])
        if index < len(w["daily"]):
            d = w["daily"][index]
            weather = {"max": d["max"], "min": d["min"], "condition": d["condition"], "precip_prob": d.get("precip_prob")}
            if (d.get("precip_prob") or 0) >= 50:
                warnings.append(f"High chance of rain ({d['precip_prob']}%) — pack an umbrella or favour indoor stops.")
    except Exception:  # noqa: BLE001
        pass

    if len(day_acts) > 6:
        warnings.append(f"Busy day — {len(day_acts)} activities. Consider trimming for a relaxed pace.")
    if walking_km > 8:
        warnings.append(f"Lots of walking (~{walking_km} km). Wear comfortable shoes.")
    if trip.get("budget") and spend > trip["budget"] / max(1, _num_days(trip)):
        warnings.append("Today's estimated spend is above your daily average budget.")

    headline = f"{len(day_acts)} activities planned"
    if weather:
        headline = f"{weather['condition']}, {round(weather['max'])}°C · {len(day_acts)} activities"
    return {
        "day_index": index,
        "headline": headline,
        "activities_count": len(day_acts),
        "estimated_spend": spend, "currency": currency,
        "walking_km": walking_km, "total_travel_min": total_travel_min,
        "reservations": reservations, "weather": weather, "warnings": warnings,
    }


def _num_days(trip):
    return max(1, (trip["end_date"].date() - trip["start_date"].date()).days + 1)


@router.get("/{trip_id}/hotels")
async def trip_hotels(trip_id: str, style: str = Query(default="any"), user: dict = Depends(get_current_user), db: AsyncIOMotorDatabase = Depends(db_dep)):
    trip = await get_owned_trip(trip_id, user, db)
    geo = await geocode_destination(trip["destination"])
    acts = await _activities(db, oid(trip_id))
    points = [(a["lat"], a["lng"]) for a in acts if a.get("lat") is not None]
    try:
        hotels = await hotels_service.search_hotels(geo["lat"], geo["lng"], style=style, prefs=_prefs(trip), itinerary_points=points)
    except RuntimeError:
        return {"hotels": [], "degraded": True, "center": geo,
                "message": "Accommodation data provider unreachable. Please try again shortly.",
                "pricing_available": hotels_service.HOTEL_PRICING_CONFIGURED}
    return {"hotels": hotels, "center": geo, "selected": trip.get("selected_hotel"),
            "pricing_available": hotels_service.HOTEL_PRICING_CONFIGURED}


@router.post("/{trip_id}/hotel")
async def select_hotel(trip_id: str, payload: dict, user: dict = Depends(get_current_user), db: AsyncIOMotorDatabase = Depends(db_dep)):
    trip = await get_owned_trip(trip_id, user, db, write=True)
    await db.trips.update_one({"_id": oid(trip_id)}, {"$set": {"selected_hotel": payload, "updated_at": datetime.now(timezone.utc)}})
    return {"ok": True, "selected_hotel": payload}


@router.post("/{trip_id}/optimize-route")
async def optimize_route(trip_id: str, day_index: int = Query(...), user: dict = Depends(get_current_user), db: AsyncIOMotorDatabase = Depends(db_dep)):
    await get_owned_trip(trip_id, user, db, write=True)
    tid = oid(trip_id)
    acts = [a async for a in db.activities.find({"trip_id": tid, "day_index": day_index}).sort("order", 1)]
    order = routing_service.optimize_order(acts)
    if not order:
        return {"ok": True, "reordered": 0}
    ordered_ids = {acts[idx]["_id"] for idx in order}
    for new_order, idx in enumerate(order):
        await db.activities.update_one({"_id": acts[idx]["_id"]}, {"$set": {"order": new_order}})
    # coordinate-less activities keep a stable order after the optimized ones
    tail = len(order)
    for a in acts:
        if a["_id"] not in ordered_ids:
            await db.activities.update_one({"_id": a["_id"]}, {"$set": {"order": tail}})
            tail += 1
    return {"ok": True, "reordered": len(order)}


@router.get("/{trip_id}/flights")
async def trip_flights(trip_id: str, origin: str = Query(...), user: dict = Depends(get_current_user), db: AsyncIOMotorDatabase = Depends(db_dep)):
    trip = await get_owned_trip(trip_id, user, db)
    return await flights_service.search(origin, trip["destination"], trip["start_date"].date().isoformat(), trip.get("travelers", 1))


@router.post("/{trip_id}/share")
async def share_trip(trip_id: str, user: dict = Depends(get_current_user), db: AsyncIOMotorDatabase = Depends(db_dep)):
    """Create (or return) a public read-only share token for the printable plan."""
    import secrets
    trip = await get_owned_trip(trip_id, user, db, write=True)
    token = trip.get("share_token")
    if not token:
        token = secrets.token_urlsafe(10)
        await db.trips.update_one({"_id": oid(trip_id)}, {"$set": {"share_token": token, "updated_at": datetime.now(timezone.utc)}})
    return {"token": token, "path": f"/share/{token}"}
