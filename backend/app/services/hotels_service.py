"""Hotels & accommodation via OpenStreetMap (real names/coords/amenities).

OSM has NO pricing or live availability — those require a commercial provider
(configure HOTEL_API_KEY and extend `pricing_provider`). We therefore compute a
deterministic, explainable AI Match Score in the backend rather than hallucinating data.
"""
import math
import os

from app.core.logging import logger
from app.services import places_service

# OSM tourism tags per accommodation style
STYLE_TAGS = {
    "hotel": '["tourism"="hotel"]',
    "boutique": '["tourism"="hotel"]["stars"]',
    "apartment": '["tourism"="apartment"]',
    "guesthouse": '["tourism"~"guest_house|chalet"]',
    "hostel": '["tourism"="hostel"]',
    "any": '["tourism"~"hotel|guest_house|apartment|hostel|chalet|motel"]',
}

HOTEL_PRICING_CONFIGURED = bool(os.environ.get("HOTEL_API_KEY"))


def haversine_km(lat1, lng1, lat2, lng2):
    r = 6371
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlng / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def _amenities(tags: dict) -> list[str]:
    out = []
    if tags.get("internet_access") in ("wlan", "yes", "wifi"):
        out.append("wifi")
    if tags.get("parking") or tags.get("amenity") == "parking":
        out.append("parking")
    if tags.get("breakfast") in ("yes", "included"):
        out.append("breakfast")
    if tags.get("swimming_pool") == "yes" or tags.get("leisure") == "swimming_pool":
        out.append("pool")
    if tags.get("air_conditioning") == "yes":
        out.append("air conditioning")
    if tags.get("wheelchair") == "yes":
        out.append("accessible")
    return out


def _match_score(hotel: dict, prefs: dict, center, itinerary_points: list) -> tuple[int, list[str]]:
    """Deterministic 0-100 score with human-readable reasons."""
    score = 55
    reasons = []
    # distance to itinerary centroid (or city center)
    ref = None
    if itinerary_points:
        ref = (sum(p[0] for p in itinerary_points) / len(itinerary_points),
               sum(p[1] for p in itinerary_points) / len(itinerary_points))
    elif center:
        ref = center
    if ref and hotel.get("lat") is not None:
        d = haversine_km(hotel["lat"], hotel["lng"], ref[0], ref[1])
        hotel["distance_km"] = round(d, 2)
        if d < 1:
            score += 18; reasons.append("Very close to your planned activities")
        elif d < 2.5:
            score += 12; reasons.append("Short trips to your activities")
        elif d < 5:
            score += 4
        else:
            score -= 6; reasons.append("A little far from your itinerary")
    # local vs tourist preference (further from center = more local)
    tvl = prefs.get("tourist_vs_local")
    if tvl is not None and center and hotel.get("lat") is not None:
        dc = haversine_km(hotel["lat"], hotel["lng"], center[0], center[1])
        if tvl >= 60 and dc > 2:
            score += 10; reasons.append("In a local neighbourhood, away from tourist hubs")
        if tvl <= 40 and dc <= 2:
            score += 8; reasons.append("Central, near the main sights")
    # amenity match
    ams = hotel.get("amenities", [])
    pref_txt = " ".join(str(v).lower() for v in prefs.values() if v)
    for want, label in (("wifi", "Wi-Fi"), ("pool", "a pool"), ("breakfast", "breakfast"), ("parking", "parking")):
        if want in ams:
            score += 3
            if want in pref_txt:
                score += 5; reasons.append(f"Has {label} you asked for")
    # stars / luxury alignment
    stars = hotel.get("stars")
    lux = (prefs.get("luxury_level") or "").lower()
    if stars:
        if lux == "luxury" and stars >= 4:
            score += 10; reasons.append(f"{stars}-star, matches your luxury preference")
        elif lux == "budget" and stars <= 2:
            score += 8; reasons.append("Simple and budget-friendly")
        else:
            score += 4
    if not reasons:
        reasons.append("Solid, well-located option")
    return max(0, min(100, int(score))), reasons


async def search_hotels(lat, lng, style="any", prefs=None, itinerary_points=None, radius=4000, limit=20):
    prefs = prefs or {}
    itinerary_points = itinerary_points or []
    tag = STYLE_TAGS.get(style, STYLE_TAGS["any"])
    query = f"""
    [out:json][timeout:20];
    (
      node{tag}(around:{radius},{lat},{lng});
      way{tag}(around:{radius},{lat},{lng});
    );
    out center {limit};
    """
    elements = await places_service.overpass_raw(query)  # may raise RuntimeError
    center = (lat, lng)
    hotels = []
    for el in elements:
        tags = el.get("tags", {})
        name = tags.get("name")
        if not name:
            continue
        hlat = el.get("lat") or (el.get("center") or {}).get("lat")
        hlng = el.get("lon") or (el.get("center") or {}).get("lon")
        if hlat is None or hlng is None:
            continue
        stars = None
        try:
            stars = int(str(tags.get("stars", "")).split(".")[0]) if tags.get("stars") else None
        except ValueError:
            stars = None
        h = {
            "id": f"{el.get('type')}/{el.get('id')}",
            "name": name,
            "lat": hlat, "lng": hlng,
            "style": tags.get("tourism", style),
            "stars": stars,
            "amenities": _amenities(tags),
            "address": " ".join(p for p in [tags.get("addr:street"), tags.get("addr:city")] if p) or None,
            "website": tags.get("website") or tags.get("contact:website"),
            "phone": tags.get("phone") or tags.get("contact:phone"),
            "image": tags.get("image"),
            "price": None,                       # requires a pricing provider (HOTEL_API_KEY)
            "pricing_available": HOTEL_PRICING_CONFIGURED,
        }
        h["match_score"], h["match_reasons"] = _match_score(h, prefs, center, itinerary_points)
        hotels.append(h)
    hotels.sort(key=lambda x: x["match_score"], reverse=True)
    return hotels[:limit]
