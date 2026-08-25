"""Public Explore / guest-mode endpoints — NO authentication required.

Guests can discover destinations, browse hotels & things-to-do (real OSM data),
chat with COCO, and generate a trip. Nothing is persisted for guests; the frontend
keeps guest trips in localStorage until the user signs in to save.
"""
import json
from datetime import date

import httpx
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.core.logging import logger
from app.core.ratelimit import rate_limit
from fastapi import Depends
from app.services import ai_service, hotels_service, places_service, weather_service, flights_service

router = APIRouter(prefix="/api/explore", tags=["explore"])

THINGS_CATEGORIES = {
    "attractions": "attractions", "food": "restaurants", "cafes": "cafes",
    "nature": "activities", "shopping": "shopping", "nightlife": "restaurants",
}


async def geocode_destination(name: str) -> dict:
    g = await places_service.geocode(name)
    if g:
        return g
    g = await weather_service.geocode(name)
    if g:
        return {"lat": g["lat"], "lng": g["lng"], "name": g.get("name")}
    raise HTTPException(status_code=404, detail=f"Couldn't find '{name}'. Try a city or 'City, Country'.")


@router.get("/suggest")
async def suggest(q: str = Query(min_length=2, max_length=80), _rl=Depends(rate_limit("suggest", 60, 60))):
    """Destination autocomplete (keyless, via Open-Meteo geocoding)."""
    try:
        async with httpx.AsyncClient(timeout=6) as client:
            r = await client.get("https://geocoding-api.open-meteo.com/v1/search",
                                  params={"name": q, "count": 6, "language": "en"})
            r.raise_for_status()
            results = r.json().get("results") or []
    except Exception as exc:  # noqa: BLE001
        logger.info(f"suggest failed: {exc}")
        return {"suggestions": []}
    out = []
    seen = set()
    for g in results:
        parts = [g.get("name"), g.get("admin1"), g.get("country")]
        label = ", ".join(p for p in parts if p)
        key = label.lower()
        if not g.get("name") or key in seen:
            continue
        seen.add(key)
        out.append({"name": g["name"], "label": label, "country": g.get("country"),
                    "lat": g.get("latitude"), "lng": g.get("longitude")})
    return {"suggestions": out}


@router.get("/destinations")
async def destinations(category: str = Query(default="trending"), _rl=Depends(rate_limit("explore-dest", 30, 60))):
    try:
        dests = await ai_service.generate_discovery(category)
    except Exception as exc:  # noqa: BLE001
        logger.error(f"explore destinations failed: {exc}")
        raise HTTPException(status_code=502, detail="Discovery is temporarily unavailable")
    return {"category": category, "destinations": dests, "source": "ai_estimate"}


@router.get("/hotels")
async def explore_hotels(
    destination: str = Query(...),
    style: str = Query(default="any"),
    tourist_vs_local: int | None = None,
    luxury_level: str | None = None,
    _rl=Depends(rate_limit("explore-hotels", 30, 60)),
):
    geo = await geocode_destination(destination)
    prefs = {"tourist_vs_local": tourist_vs_local, "luxury_level": luxury_level}
    try:
        hotels = await hotels_service.search_hotels(geo["lat"], geo["lng"], style=style, prefs=prefs)
    except RuntimeError:
        return {"destination": destination, "center": geo, "hotels": [], "degraded": True,
                "message": "Accommodation data provider unreachable. Please try again shortly.",
                "pricing_available": hotels_service.HOTEL_PRICING_CONFIGURED}
    return {"destination": destination, "center": geo, "hotels": hotels,
            "pricing_available": hotels_service.HOTEL_PRICING_CONFIGURED}


@router.get("/things-to-do")
async def things_to_do(
    destination: str = Query(...),
    category: str = Query(default="attractions"),
    _rl=Depends(rate_limit("explore-things", 30, 60)),
):
    geo = await geocode_destination(destination)
    osm_cat = THINGS_CATEGORIES.get(category, "attractions")
    try:
        places = await places_service.search_places(geo["lat"], geo["lng"], osm_cat, radius=5000, limit=30)
    except RuntimeError:
        return {"destination": destination, "center": geo, "category": category, "places": [], "degraded": True,
                "message": "Places provider unreachable. Please try again shortly."}
    return {"destination": destination, "center": geo, "category": category, "places": places}


@router.get("/flights")
async def explore_flights(origin: str = Query(...), destination: str = Query(...), date: str = Query(...), travelers: int = 1):
    return await flights_service.search(origin, destination, date, travelers)


class GuestGenerate(BaseModel):
    destination: str = Field(min_length=1)
    start_date: date
    end_date: date
    travelers: int = 1
    budget: float | None = None
    currency: str = "USD"
    travel_style: str | None = None
    interests: list[str] = Field(default_factory=list)
    pace: str | None = "moderate"
    food_pref: str | None = None
    accommodation_pref: str | None = None
    walking_level: str | None = None
    luxury_level: str | None = None
    tourist_vs_local: int | None = None
    vibe: str | None = None


@router.post("/generate")
async def guest_generate(payload: GuestGenerate, _rl=Depends(rate_limit("explore-generate", 10, 60))):
    num_days = max(1, (payload.end_date - payload.start_date).days + 1)
    spec = payload.model_dump()
    try:
        result = await ai_service.generate_itinerary(spec, num_days)
    except Exception as exc:  # noqa: BLE001
        logger.error(f"guest generate failed: {exc}")
        raise HTTPException(status_code=502, detail=str(exc))
    return {"num_days": num_days, "summary": result["summary"], "days": result["days"], "spec": spec}


class ExploreChat(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    context: dict | None = None
    history: list[dict] = Field(default_factory=list)


@router.post("/chat")
async def explore_chat(payload: ExploreChat, _rl=Depends(rate_limit("explore-chat", 30, 60))):
    ctx = payload.context or {}
    ctx_text = None
    if ctx:
        parts = [f"Destination: {ctx.get('destination')}", f"Dates: {ctx.get('dates')}",
                 f"Budget: {ctx.get('budget')}", f"Preferences: {ctx.get('preferences')}"]
        if ctx.get("itinerary"):
            parts.append(f"Itinerary: {json.dumps(ctx['itinerary'])[:2500]}")
        ctx_text = "\n".join(p for p in parts if p and "None" not in str(p))
    system = ai_service.build_chat_system(ctx_text, payload.history)

    async def gen():
        try:
            async for tok in ai_service.chat_stream("guest-chat", system, payload.message):
                yield f"data: {json.dumps({'type': 'token', 'content': tok})}\n\n"
        except Exception as exc:  # noqa: BLE001
            logger.error(f"explore chat error: {exc}")
            yield f"data: {json.dumps({'type': 'error', 'content': 'COCO is unavailable right now.'})}\n\n"
        yield f"data: {json.dumps({'type': 'done'})}\n\n"

    return StreamingResponse(gen(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})
