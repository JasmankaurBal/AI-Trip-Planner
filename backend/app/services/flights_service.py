"""Flight search — real provider abstraction (Amadeus Self-Service).

Enabled ONLY when AMADEUS_CLIENT_ID + AMADEUS_CLIENT_SECRET are set. Without them
the API returns a clear 'not configured' state. We NEVER fabricate prices/times.

Env:
  AMADEUS_CLIENT_ID, AMADEUS_CLIENT_SECRET   (from https://developers.amadeus.com)
  AMADEUS_ENV = "test" (default) | "production"
"""
import os
import re
import time

import httpx

from app.core.logging import logger

CLIENT_ID = os.environ.get("AMADEUS_CLIENT_ID")
CLIENT_SECRET = os.environ.get("AMADEUS_CLIENT_SECRET")
BASE = "https://api.amadeus.com" if os.environ.get("AMADEUS_ENV") == "production" else "https://test.api.amadeus.com"
FLIGHT_PROVIDER = "amadeus"

_token_cache = {"token": None, "exp": 0}


def is_configured() -> bool:
    return bool(CLIENT_ID and CLIENT_SECRET)


def _iso_duration_to_min(iso: str) -> int:
    m = re.match(r"PT(?:(\d+)H)?(?:(\d+)M)?", iso or "")
    if not m:
        return 0
    return int(m.group(1) or 0) * 60 + int(m.group(2) or 0)


async def _get_token(client: httpx.AsyncClient) -> str:
    if _token_cache["token"] and _token_cache["exp"] > time.time() + 30:
        return _token_cache["token"]
    r = await client.post(
        f"{BASE}/v1/security/oauth2/token",
        data={"grant_type": "client_credentials", "client_id": CLIENT_ID, "client_secret": CLIENT_SECRET},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    r.raise_for_status()
    data = r.json()
    _token_cache["token"] = data["access_token"]
    _token_cache["exp"] = time.time() + data.get("expires_in", 1799)
    return _token_cache["token"]


async def _resolve_iata(client: httpx.AsyncClient, token: str, place: str) -> str | None:
    if re.fullmatch(r"[A-Za-z]{3}", place.strip()):
        return place.strip().upper()
    r = await client.get(
        f"{BASE}/v1/reference-data/locations",
        params={"keyword": place, "subType": "CITY,AIRPORT", "page[limit]": 1},
        headers={"Authorization": f"Bearer {token}"},
    )
    r.raise_for_status()
    data = r.json().get("data", [])
    return data[0]["iataCode"] if data else None


def _normalize(offer: dict) -> dict:
    price = offer.get("price", {})
    itin = (offer.get("itineraries") or [{}])[0]
    segs = itin.get("segments", [])
    first, last = (segs[0] if segs else {}), (segs[-1] if segs else {})
    return {
        "origin": first.get("departure", {}).get("iataCode"),
        "destination": last.get("arrival", {}).get("iataCode"),
        "price": float(price.get("grandTotal", price.get("total", 0)) or 0),
        "currency": price.get("currency", "USD"),
        "duration_min": _iso_duration_to_min(itin.get("duration", "")),
        "stops": max(0, len(segs) - 1),
        "carrier": (offer.get("validatingAirlineCodes") or ["--"])[0],
        "depart": first.get("departure", {}).get("at"),
        "arrive": last.get("arrival", {}).get("at"),
        "deep_link": None,
    }


def _rank(offers: list[dict]) -> dict:
    if not offers:
        return {"cheapest": None, "fastest": None, "best": None}
    cheapest = min(offers, key=lambda o: o.get("price", float("inf")))
    fastest = min(offers, key=lambda o: o.get("duration_min", float("inf")))
    best = min(offers, key=lambda o: 0.6 * o.get("price", 0) + 0.3 * o.get("duration_min", 0) + 60 * o.get("stops", 0))
    return {"cheapest": cheapest, "fastest": fastest, "best": best}


async def search(origin: str, destination: str, date: str, travelers: int = 1) -> dict:
    if not is_configured():
        return {
            "configured": False, "provider": FLIGHT_PROVIDER,
            "message": ("Live flight search isn't connected. Add AMADEUS_CLIENT_ID and "
                        "AMADEUS_CLIENT_SECRET to enable real prices, times and booking. "
                        "COCO never invents flight prices."),
            "offers": [], "ranked": {"cheapest": None, "fastest": None, "best": None},
        }
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            token = await _get_token(client)
            o_iata = await _resolve_iata(client, token, origin)
            d_iata = await _resolve_iata(client, token, destination)
            if not o_iata or not d_iata:
                return {"configured": True, "provider": FLIGHT_PROVIDER, "error": True,
                        "message": f"Couldn't resolve airports for '{origin}' / '{destination}'.",
                        "offers": [], "ranked": {"cheapest": None, "fastest": None, "best": None}}
            r = await client.get(
                f"{BASE}/v2/shopping/flight-offers",
                params={"originLocationCode": o_iata, "destinationLocationCode": d_iata,
                        "departureDate": date, "adults": max(1, travelers), "max": 15, "currencyCode": "USD"},
                headers={"Authorization": f"Bearer {token}"},
            )
            r.raise_for_status()
            offers = [_normalize(o) for o in r.json().get("data", [])]
        return {"configured": True, "provider": FLIGHT_PROVIDER, "origin": o_iata, "destination": d_iata,
                "offers": offers, "ranked": _rank(offers)}
    except Exception as exc:  # noqa: BLE001
        logger.error(f"Amadeus flight search failed: {exc}")
        return {"configured": True, "provider": FLIGHT_PROVIDER, "error": True,
                "message": "Flight provider is temporarily unavailable.",
                "offers": [], "ranked": {"cheapest": None, "fastest": None, "best": None}}
