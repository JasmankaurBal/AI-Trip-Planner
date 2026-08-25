"""Public/travel data: weather, places, geocode, currency, discovery, emergency, what-now, saved places."""
import asyncio
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.api.deps import db_dep, get_current_user
from app.core.logging import logger
from app.core.ratelimit import rate_limit
from app.services import ai_service, currency_service, places_service, weather_service

router = APIRouter(prefix="/api", tags=["data"])

EMERGENCY_CATEGORIES = ["hospitals", "police", "pharmacies", "embassy"]


@router.get("/geocode")
async def geocode(q: str = Query(min_length=1)):
    result = await places_service.geocode(q)
    if not result:
        raise HTTPException(status_code=404, detail="Location not found")
    return result


@router.get("/weather")
async def weather(lat: float | None = None, lng: float | None = None, place: str | None = None):
    if place and (lat is None or lng is None):
        geo = await weather_service.geocode(place)
        if not geo:
            raise HTTPException(status_code=404, detail="Location not found")
        lat, lng = geo["lat"], geo["lng"]
    if lat is None or lng is None:
        raise HTTPException(status_code=422, detail="Provide lat/lng or place")
    try:
        return await weather_service.get_weather(lat, lng)
    except RuntimeError:
        raise HTTPException(status_code=503, detail="Weather is temporarily unavailable. Please try again shortly.")


@router.get("/places/search")
async def places_search(
    lat: float = Query(...),
    lng: float = Query(...),
    category: str = Query(...),
    radius: int = Query(default=2000, ge=100, le=20000),
    _rl=Depends(rate_limit("places", 30, 60)),
):
    if category not in places_service.CATEGORY_TAGS:
        raise HTTPException(status_code=422, detail=f"Unsupported category. Allowed: {list(places_service.CATEGORY_TAGS)}")
    try:
        results = await places_service.search_places(lat, lng, category, radius)
    except RuntimeError:
        # Degrade gracefully with a 200 payload so the UI can show a clear message
        # (edge proxies can replace 5xx bodies, hiding our detail).
        return {"places": [], "count": 0, "degraded": True,
                "message": "Nearby search is temporarily unavailable (map data provider unreachable)."}
    return {"places": results, "count": len(results), "degraded": False}


@router.get("/currency/convert")
async def currency_convert(amount: float = Query(gt=0), from_currency: str = Query(alias="from"), to_currency: str = Query(alias="to")):
    try:
        return await currency_service.convert(amount, from_currency, to_currency)
    except RuntimeError:
        raise HTTPException(status_code=502, detail="Currency service is temporarily unavailable.")


@router.get("/currency/rates")
async def currency_rates(base: str = "USD"):
    try:
        return await currency_service.rates(base)
    except RuntimeError:
        raise HTTPException(status_code=502, detail="Currency service is temporarily unavailable.")


@router.get("/discovery")
async def discovery(
    category: str = Query(default="trending"),
    user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(db_dep),
    _rl=Depends(rate_limit("discovery", 20, 60)),
):
    # cache discovery results for 24h to reduce AI calls
    cached = await db.discovery_cache.find_one({"category": category})
    if cached and (datetime.now(timezone.utc) - cached["created_at"].replace(tzinfo=timezone.utc)).total_seconds() < 86400:
        return {"category": category, "destinations": cached["destinations"], "source": "ai_estimate"}
    try:
        destinations = await ai_service.generate_discovery(category)
    except Exception as exc:  # noqa: BLE001
        logger.error(f"Discovery failed: {exc}")
        raise HTTPException(status_code=502, detail="Discovery is temporarily unavailable")
    await db.discovery_cache.update_one(
        {"category": category},
        {"$set": {"category": category, "destinations": destinations, "created_at": datetime.now(timezone.utc)}},
        upsert=True,
    )
    return {"category": category, "destinations": destinations, "source": "ai_estimate"}


@router.get("/emergency")
async def emergency(lat: float = Query(...), lng: float = Query(...), radius: int = Query(default=5000, ge=500, le=20000)):
    async def lookup(cat):
        try:
            return cat, await places_service.search_places(lat, lng, cat, radius, limit=10)
        except Exception as exc:  # noqa: BLE001
            logger.error(f"Emergency lookup {cat} failed: {exc}")
            return cat, []

    out = {}
    try:
        results = await asyncio.wait_for(
            asyncio.gather(*[lookup(c) for c in EMERGENCY_CATEGORIES]), timeout=20
        )
        out = {cat: places for cat, places in results}
    except asyncio.TimeoutError:
        logger.warning("Emergency lookup timed out; returning partial/empty results")
        out = {c: [] for c in EMERGENCY_CATEGORIES}
    out["hotlines"] = {
        "note": "Universal emergency numbers vary by country. Verify locally.",
        "common": {"EU": "112", "US/Canada": "911", "UK": "999", "India": "112", "Australia": "000"},
    }
    return out


@router.post("/what-now")
async def what_now(
    payload: dict,
    user: dict = Depends(get_current_user),
    _rl=Depends(rate_limit("whatnow", 15, 60)),
):
    lat, lng = payload.get("lat"), payload.get("lng")
    location_name = payload.get("location")
    weather_summary = "unknown"
    if lat is not None and lng is not None:
        try:
            w = await weather_service.get_weather(lat, lng)
            weather_summary = f"{w['current']['temp']}\u00b0C, {w['current']['condition']}"
            if not location_name:
                location_name = f"{lat:.3f},{lng:.3f}"
        except Exception:  # noqa: BLE001
            pass
    context = {
        "location": location_name or "unknown",
        "time": payload.get("time") or datetime.now(timezone.utc).strftime("%H:%M UTC"),
        "weather": weather_summary,
        "budget": payload.get("budget", "flexible"),
        "interests": payload.get("interests", []),
    }
    try:
        suggestions = await ai_service.what_now(context)
    except Exception as exc:  # noqa: BLE001
        logger.error(f"what-now failed: {exc}")
        raise HTTPException(status_code=502, detail="COCO couldn't fetch suggestions right now")
    return {"context": context, "suggestions": suggestions, "source": "ai_estimate"}


# ---- Saved places ----
@router.get("/saved-places")
async def list_saved(user: dict = Depends(get_current_user), db: AsyncIOMotorDatabase = Depends(db_dep)):
    items = []
    async for p in db.saved_places.find({"user_id": user["id"]}).sort("created_at", -1):
        p["id"] = str(p.pop("_id"))
        p.pop("created_at", None)
        items.append(p)
    return {"places": items}


@router.post("/saved-places", status_code=201)
async def save_place(payload: dict, user: dict = Depends(get_current_user), db: AsyncIOMotorDatabase = Depends(db_dep)):
    if not payload.get("name"):
        raise HTTPException(status_code=422, detail="name required")
    doc = {
        "user_id": user["id"], "name": payload["name"], "lat": payload.get("lat"), "lng": payload.get("lng"),
        "category": payload.get("category", "other"), "address": payload.get("address"),
        "trip_id": payload.get("trip_id"), "created_at": datetime.now(timezone.utc),
    }
    res = await db.saved_places.insert_one(doc)
    doc["id"] = str(res.inserted_id)
    doc.pop("_id", None)
    doc.pop("created_at", None)
    return doc


@router.delete("/saved-places/{place_id}")
async def delete_saved(place_id: str, user: dict = Depends(get_current_user), db: AsyncIOMotorDatabase = Depends(db_dep)):
    from app.api.deps import oid
    await db.saved_places.delete_one({"_id": oid(place_id), "user_id": user["id"]})
    return {"ok": True}
