"""Routing & travel-time estimation.

Uses the public OSRM demo server when reachable; falls back to a haversine
great-circle estimate so route optimization always works (documented behaviour).
"""
import math

import httpx

from app.core.logging import logger

OSRM = "https://router.project-osrm.org"
WALK_KMH, DRIVE_KMH = 4.8, 30.0


def haversine_km(a, b):
    r = 6371
    dlat = math.radians(b[0] - a[0]); dlng = math.radians(b[1] - a[1])
    h = math.sin(dlat / 2) ** 2 + math.cos(math.radians(a[0])) * math.cos(math.radians(b[0])) * math.sin(dlng / 2) ** 2
    return 2 * r * math.asin(math.sqrt(h))


def _estimate(a, b):
    d = haversine_km(a, b)
    mode = "walk" if d <= 1.5 else "drive"
    kmh = WALK_KMH if mode == "walk" else DRIVE_KMH
    return {"distance_km": round(d, 2), "duration_min": round(d / kmh * 60), "mode": mode, "source": "estimate"}


async def leg(a, b) -> dict:
    """Distance + duration for one leg (OSRM if reachable, else estimate)."""
    try:
        url = f"{OSRM}/route/v1/driving/{a[1]},{a[0]};{b[1]},{b[0]}"
        async with httpx.AsyncClient(timeout=8) as client:
            r = await client.get(url, params={"overview": "false"})
            r.raise_for_status()
            route = r.json()["routes"][0]
            km = route["distance"] / 1000
            return {"distance_km": round(km, 2), "duration_min": round(route["duration"] / 60),
                    "mode": "walk" if km <= 1.5 else "drive", "source": "osrm"}
    except Exception as exc:  # noqa: BLE001
        logger.info(f"OSRM unreachable, using estimate: {exc}")
        return _estimate(a, b)


def optimize_order(points: list[dict]) -> list[int]:
    """Nearest-neighbour ordering (indices) to reduce backtracking. Keeps first point fixed."""
    valid = [(i, (p["lat"], p["lng"])) for i, p in enumerate(points) if p.get("lat") is not None]
    if len(valid) <= 2:
        return [i for i, _ in valid]
    remaining = valid[:]
    order = [remaining.pop(0)]
    while remaining:
        last = order[-1][1]
        nxt = min(range(len(remaining)), key=lambda k: haversine_km(last, remaining[k][1]))
        order.append(remaining.pop(nxt))
    return [i for i, _ in order]


async def legs_for_sequence(points: list[dict]) -> list[dict]:
    """Travel legs between consecutive points that have coordinates."""
    coords = [(p.get("lat"), p.get("lng")) for p in points]
    out = []
    for i in range(len(coords) - 1):
        if None in coords[i] or None in coords[i + 1]:
            out.append(None)
            continue
        out.append(await leg(coords[i], coords[i + 1]))
    return out
