"""Places & geocoding via OpenStreetMap Nominatim + Overpass (keyless, real data)."""
import os

import httpx

from app.core.logging import logger

NOMINATIM = "https://nominatim.openstreetmap.org"
# Overpass has several public mirrors; we try them in order for resilience.
OVERPASS_MIRRORS = [
    m.strip() for m in os.environ.get(
        "OVERPASS_MIRRORS",
        "https://overpass-api.de/api/interpreter,"
        "https://overpass.kumi.systems/api/interpreter",
    ).split(",") if m.strip()
]
HEADERS = {"User-Agent": "COCO-Trip-Planner/1.0 (contact: support@coco.travel)"}

# Category -> OSM tag filters for Overpass
CATEGORY_TAGS = {
    "restaurants": '["amenity"="restaurant"]',
    "cafes": '["amenity"="cafe"]',
    "attractions": '["tourism"~"attraction|museum|gallery|viewpoint|artwork"]',
    "pharmacies": '["amenity"="pharmacy"]',
    "hospitals": '["amenity"~"hospital|clinic"]',
    "police": '["amenity"="police"]',
    "transport": '["public_transport"="station"]',
    "shopping": '["shop"~"mall|supermarket|department_store"]',
    "activities": '["leisure"~"park|sports_centre|fitness_centre"]',
    "embassy": '["amenity"="embassy"]',
    "atm": '["amenity"="atm"]',
    "fuel": '["amenity"="fuel"]',
}


async def geocode(query: str) -> dict | None:
    try:
        async with httpx.AsyncClient(timeout=10, headers=HEADERS, follow_redirects=True) as client:
            r = await client.get(f"{NOMINATIM}/search", params={"q": query, "format": "json", "limit": 1})
            r.raise_for_status()
            results = r.json()
            if not results:
                return None
            g = results[0]
            return {
                "lat": float(g["lat"]), "lng": float(g["lon"]),
                "name": g.get("display_name"), "type": g.get("type"),
            }
    except Exception as exc:  # noqa: BLE001
        logger.error(f"Nominatim geocode failed: {exc}")
        return None


async def overpass_raw(query: str) -> list[dict]:
    """Run an Overpass QL query against mirrors; return elements or raise RuntimeError."""
    last_exc = None
    for mirror in OVERPASS_MIRRORS:
        try:
            async with httpx.AsyncClient(timeout=7, headers=HEADERS, follow_redirects=True) as client:
                r = await client.post(mirror, data={"data": query})
                r.raise_for_status()
                return r.json().get("elements", [])
        except Exception as exc:  # noqa: BLE001
            last_exc = exc
            logger.warning(f"Overpass mirror failed ({mirror}): {exc}")
    logger.error(f"All Overpass mirrors failed: {last_exc}")
    raise RuntimeError("Places service unavailable")


async def search_places(lat: float, lng: float, category: str, radius: int = 2000, limit: int = 30) -> list[dict]:
    tag = CATEGORY_TAGS.get(category)
    if not tag:
        raise ValueError(f"Unsupported category: {category}")
    query = f"""
    [out:json][timeout:20];
    (
      node{tag}(around:{radius},{lat},{lng});
      way{tag}(around:{radius},{lat},{lng});
    );
    out center {limit};
    """
    elements = await overpass_raw(query)

    places = []
    for el in elements:
        tags = el.get("tags", {})
        name = tags.get("name")
        if not name:
            continue
        plat = el.get("lat") or (el.get("center") or {}).get("lat")
        plng = el.get("lon") or (el.get("center") or {}).get("lon")
        if plat is None or plng is None:
            continue
        addr_parts = [tags.get("addr:housenumber"), tags.get("addr:street"), tags.get("addr:city")]
        address = " ".join(p for p in addr_parts if p) or None
        places.append({
            "id": f"{el.get('type')}/{el.get('id')}",
            "name": name,
            "lat": plat,
            "lng": plng,
            "category": category,
            "address": address,
            "phone": tags.get("phone") or tags.get("contact:phone"),
            "website": tags.get("website") or tags.get("contact:website"),
            "opening_hours": tags.get("opening_hours"),
            "cuisine": tags.get("cuisine"),
        })
    return places[:limit]
