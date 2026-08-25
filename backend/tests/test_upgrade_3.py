"""Iteration 3 — COCO upgrade: public explore/guest endpoints + authed trip-AI routes.

Covers: /api/explore/{generate,destinations,things-to-do,hotels,flights,chat}
and /api/trips/{id}/{ai-edit,day/N/summary,hotels,hotel,optimize-route,flights}
plus personalization persistence. External providers (Overpass/Open-Meteo/OSRM)
may be blocked from the sandbox: a clean degraded 200 / 502-with-message is OK,
500 is a failure.
"""
import os
import re
import time
import uuid
from datetime import date, timedelta
from pathlib import Path

import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
base_url = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not base_url:
    raise RuntimeError("REACT_APP_BACKEND_URL missing")
BASE_URL = base_url.rstrip("/")

START = (date.today() + timedelta(days=30)).isoformat()
END = (date.today() + timedelta(days=32)).isoformat()


def _creds():
    content = Path("/app/memory/test_credentials.md").read_text(encoding="utf-8")
    e = re.search(r'(?im)^\s*(?:[-*]\s*)?(?:\*\*)?email(?:\*\*)?\s*:\s*`?([^`\s]+)', content)
    p = re.search(r'(?im)^\s*(?:[-*]\s*)?(?:\*\*)?password(?:\*\*)?\s*:\s*`?([^`\s]+)', content)
    return {"email": e.group(1), "password": p.group(1)}


@pytest.fixture(scope="session")
def admin_client():
    s = requests.Session()
    c = _creds()
    r = s.post(f"{BASE_URL}/api/auth/login", json=c, timeout=60)
    if r.status_code != 200:
        pytest.fail(f"admin login failed {r.status_code}: {r.text[:300]}")
    token = r.json().get("access_token")
    assert token, f"no access_token in login body: {r.json().keys()}"
    s.headers.update({"Authorization": f"Bearer {token}"})
    return s


@pytest.fixture(scope="session")
def other_client():
    """A second, non-owner registered user."""
    s = requests.Session()
    email = f"TEST_other_{uuid.uuid4().hex[:8]}@gmail.com"
    r = s.post(f"{BASE_URL}/api/auth/register",
               json={"name": "TEST Other", "email": email, "password": "OtherPass!2026"}, timeout=60)
    if r.status_code not in (200, 201):
        pytest.fail(f"register failed {r.status_code}: {r.text[:300]}")
    s.headers.update({"Authorization": f"Bearer {r.json()['access_token']}"})
    return s


# ---------------------------------------------------------------- public explore
class TestPublicExplore:
    """No-auth guest endpoints."""

    def test_generate_no_auth(self):
        s = requests.Session()  # deliberately unauthenticated
        payload = {"destination": "Lisbon", "start_date": START, "end_date": END,
                   "interests": ["food", "history"], "tourist_vs_local": 70,
                   "luxury_level": "mid", "currency": "EUR", "travelers": 2}
        r = s.post(f"{BASE_URL}/api/explore/generate", json=payload, timeout=300)
        assert r.status_code == 200, f"{r.status_code}: {r.text[:400]}"
        d = r.json()
        assert d["num_days"] == 3
        assert isinstance(d["summary"], str) and d["summary"]
        assert len(d["days"]) == 3, d["days"]
        acts = [a for day in d["days"] for a in day["activities"]]
        assert len(acts) >= 3
        coord = [a for a in acts if a.get("lat") is not None and a.get("lng") is not None]
        assert len(coord) >= 1, "no activity had lat/lng"
        for a in coord:
            assert 36 < a["lat"] < 40 and -11 < a["lng"] < -7, f"Lisbon coords off: {a}"

    def test_destinations_no_auth(self):
        r = requests.get(f"{BASE_URL}/api/explore/destinations", params={"category": "food"}, timeout=180)
        assert r.status_code == 200, f"{r.status_code}: {r.text[:300]}"
        d = r.json()
        assert d["category"] == "food"
        assert isinstance(d["destinations"], list) and len(d["destinations"]) >= 1
        assert d["source"] == "ai_estimate"

    def test_things_to_do_no_auth(self):
        r = requests.get(f"{BASE_URL}/api/explore/things-to-do",
                         params={"destination": "Lisbon", "category": "attractions"}, timeout=120)
        assert r.status_code in (200, 404, 502), f"{r.status_code}: {r.text[:300]}"
        if r.status_code != 200:
            pytest.skip(f"external geocode/places blocked: {r.status_code} {r.text[:150]}")
        d = r.json()
        assert "places" in d and isinstance(d["places"], list)
        assert "center" in d and d["center"]["lat"]
        if not d["places"]:
            assert d.get("degraded") is True and d.get("message")
        else:
            for p in d["places"][:5]:
                assert p.get("name") and p.get("lat") is not None

    def test_hotels_no_auth(self):
        r = requests.get(f"{BASE_URL}/api/explore/hotels", params={"destination": "Lisbon"}, timeout=120)
        assert r.status_code in (200, 404, 502), f"{r.status_code}: {r.text[:300]}"
        if r.status_code != 200:
            pytest.skip(f"external geocode blocked: {r.status_code}")
        d = r.json()
        assert isinstance(d["hotels"], list)
        if not d["hotels"]:
            assert d.get("degraded") is True and d.get("message")
        else:
            for h in d["hotels"]:
                assert 0 <= h["match_score"] <= 100
                assert isinstance(h["match_reasons"], list) and h["match_reasons"]
                assert h["pricing_available"] is False
            scores = [h["match_score"] for h in d["hotels"]]
            assert scores == sorted(scores, reverse=True), "hotels not sorted by match_score"

    def test_flights_no_auth_honest(self):
        r = requests.get(f"{BASE_URL}/api/explore/flights",
                         params={"origin": "London", "destination": "Lisbon", "date": START}, timeout=60)
        assert r.status_code == 200, f"{r.status_code}: {r.text[:300]}"
        d = r.json()
        assert d["configured"] is False
        assert "message" in d and d["offers"] == []
        assert d["ranked"] == {"cheapest": None, "fastest": None, "best": None}

    def test_chat_sse_no_auth(self):
        r = requests.post(f"{BASE_URL}/api/explore/chat",
                          json={"message": "Give me one tip for Lisbon", "context": {"destination": "Lisbon"}},
                          stream=True, timeout=180)
        assert r.status_code == 200, f"{r.status_code}: {r.text[:300]}"
        tokens, done = [], False
        for line in r.iter_lines(decode_unicode=True):
            if not line:
                continue
            assert line.startswith("data: "), line
            import json as _j
            ev = _j.loads(line[6:])
            if ev["type"] == "token":
                tokens.append(ev["content"])
            elif ev["type"] == "error":
                pytest.fail(f"chat error event: {ev}")
            elif ev["type"] == "done":
                done = True
                break
        assert done, "no done event"
        assert len("".join(tokens)) > 10, f"empty reply: {tokens[:5]}"


# ---------------------------------------------------------------- authed trip AI
@pytest.fixture(scope="session")
def trip(admin_client):
    """Trip created with full personalization + generated itinerary."""
    payload = {
        "name": "TEST_Upgrade3 Lisbon", "destination": "Lisbon", "start_date": START, "end_date": END,
        "travelers": 2, "budget": 1500, "currency": "EUR", "travel_style": "cultural",
        "interests": ["food", "history"], "pace": "moderate",
        "food_pref": "vegetarian", "walking_level": "low", "luxury_level": "luxury",
        "tourist_vs_local": 75, "vibe": "romantic", "accommodation_pref": "boutique",
    }
    r = admin_client.post(f"{BASE_URL}/api/trips", json=payload, timeout=120)
    assert r.status_code in (200, 201), f"create trip {r.status_code}: {r.text[:400]}"
    t = r.json()
    tid = t.get("id") or t.get("_id")
    assert tid
    g = admin_client.post(f"{BASE_URL}/api/trips/{tid}/generate", json={}, timeout=300)
    assert g.status_code == 200, f"generate {g.status_code}: {g.text[:400]}"
    yield {"id": tid, "payload": payload}
    admin_client.delete(f"{BASE_URL}/api/trips/{tid}", timeout=60)


class TestPersonalization:
    def test_prefs_persist(self, admin_client, trip):
        r = admin_client.get(f"{BASE_URL}/api/trips/{trip['id']}", timeout=60)
        assert r.status_code == 200
        d = r.json()
        assert "_id" not in d, "raw mongo _id leaked"
        for k in ("food_pref", "walking_level", "luxury_level", "tourist_vs_local", "vibe"):
            assert d.get(k) == trip["payload"][k], f"{k}: {d.get(k)} != {trip['payload'][k]}"


class TestTripAI:
    def test_day_summary(self, admin_client, trip):
        r = admin_client.get(f"{BASE_URL}/api/trips/{trip['id']}/day/0/summary", timeout=120)
        assert r.status_code == 200, f"{r.status_code}: {r.text[:400]}"
        d = r.json()
        assert d["day_index"] == 0
        assert isinstance(d["headline"], str) and d["headline"]
        assert d["activities_count"] >= 1
        assert isinstance(d["estimated_spend"], (int, float))
        assert isinstance(d["walking_km"], (int, float))
        assert isinstance(d["total_travel_min"], (int, float))
        assert isinstance(d["reservations"], list)
        assert isinstance(d["warnings"], list)
        assert "weather" in d

    def test_hotels_authed(self, admin_client, trip):
        r = admin_client.get(f"{BASE_URL}/api/trips/{trip['id']}/hotels", timeout=120)
        assert r.status_code in (200, 404, 502), f"{r.status_code}: {r.text[:300]}"
        if r.status_code != 200:
            pytest.skip(f"geocode blocked: {r.status_code}")
        d = r.json()
        assert isinstance(d["hotels"], list)
        if not d["hotels"]:
            assert d.get("degraded") is True
        else:
            assert all(0 <= h["match_score"] <= 100 and h["match_reasons"] for h in d["hotels"])

    def test_hotels_style_boutique(self, admin_client, trip):
        r = admin_client.get(f"{BASE_URL}/api/trips/{trip['id']}/hotels",
                             params={"style": "boutique"}, timeout=120)
        assert r.status_code in (200, 404, 502), f"{r.status_code}: {r.text[:300]}"

    def test_select_hotel_persists(self, admin_client, trip):
        hotel = {"name": "TEST_Hotel Alfama", "id": "node/1234", "lat": 38.712, "lng": -9.13}
        r = admin_client.post(f"{BASE_URL}/api/trips/{trip['id']}/hotel", json=hotel, timeout=60)
        assert r.status_code == 200, f"{r.status_code}: {r.text[:300]}"
        assert r.json()["ok"] is True
        g = admin_client.get(f"{BASE_URL}/api/trips/{trip['id']}", timeout=60)
        sel = g.json().get("selected_hotel")
        assert sel and sel["name"] == hotel["name"] and sel["lat"] == hotel["lat"]

    def test_optimize_route(self, admin_client, trip):
        r = admin_client.post(f"{BASE_URL}/api/trips/{trip['id']}/optimize-route",
                              params={"day_index": 0}, timeout=120)
        assert r.status_code == 200, f"{r.status_code}: {r.text[:300]}"
        assert r.json()["ok"] is True
        acts = admin_client.get(f"{BASE_URL}/api/trips/{trip['id']}/activities", timeout=60).json()
        day0 = [a for a in (acts if isinstance(acts, list) else acts.get("activities", [])) if a["day_index"] == 0]
        orders = sorted(a["order"] for a in day0)
        assert orders == list(range(len(day0))), f"orders not contiguous: {orders}"

    def test_trip_flights(self, admin_client, trip):
        r = admin_client.get(f"{BASE_URL}/api/trips/{trip['id']}/flights",
                             params={"origin": "London"}, timeout=60)
        assert r.status_code == 200, f"{r.status_code}: {r.text[:300]}"
        d = r.json()
        assert d["configured"] is False and d["offers"] == []

    def test_ai_edit_replaces_activities(self, admin_client, trip):
        before = admin_client.get(f"{BASE_URL}/api/trips/{trip['id']}/activities", timeout=60).json()
        before_n = len(before if isinstance(before, list) else before.get("activities", []))
        assert before_n > 0
        r = admin_client.post(f"{BASE_URL}/api/trips/{trip['id']}/ai-edit",
                             json={"instruction": "make it cheaper and reduce walking"}, timeout=300)
        assert r.status_code == 200, f"{r.status_code}: {r.text[:500]}"
        d = r.json()
        assert isinstance(d["summary"], str) and d["summary"]
        assert d["activities_created"] > 0
        after = admin_client.get(f"{BASE_URL}/api/trips/{trip['id']}/activities", timeout=60).json()
        after_list = after if isinstance(after, list) else after.get("activities", [])
        assert len(after_list) == d["activities_created"], "persisted count mismatch"

    def test_ai_edit_non_owner_403(self, other_client, trip):
        r = other_client.post(f"{BASE_URL}/api/trips/{trip['id']}/ai-edit",
                              json={"instruction": "make it cheaper"}, timeout=120)
        assert r.status_code == 403, f"expected 403, got {r.status_code}: {r.text[:300]}"

    def test_day_summary_non_owner_403(self, other_client, trip):
        r = other_client.get(f"{BASE_URL}/api/trips/{trip['id']}/day/0/summary", timeout=120)
        assert r.status_code == 403, f"expected 403, got {r.status_code}"

    def test_ai_routes_require_auth(self, trip):
        for method, url in (
            ("get", f"{BASE_URL}/api/trips/{trip['id']}/hotels"),
            ("get", f"{BASE_URL}/api/trips/{trip['id']}/day/0/summary"),
            ("post", f"{BASE_URL}/api/trips/{trip['id']}/ai-edit"),
        ):
            r = getattr(requests, method)(url, json={"instruction": "x"}, timeout=60)
            assert r.status_code == 401, f"{url} -> {r.status_code}"

    def test_ai_edit_bad_trip_id(self, admin_client):
        r = admin_client.post(f"{BASE_URL}/api/trips/notanid/ai-edit",
                              json={"instruction": "x"}, timeout=60)
        assert r.status_code == 400, f"{r.status_code}: {r.text[:200]}"

    def test_ai_edit_without_itinerary_422(self, admin_client):
        c = admin_client.post(f"{BASE_URL}/api/trips", json={
            "name": "TEST_Empty", "destination": "Porto", "start_date": START, "end_date": END,
            "travelers": 1, "currency": "EUR"}, timeout=60)
        assert c.status_code in (200, 201), c.text[:200]
        tid = c.json().get("id") or c.json().get("_id")
        try:
            r = admin_client.post(f"{BASE_URL}/api/trips/{tid}/ai-edit",
                                  json={"instruction": "cheaper"}, timeout=120)
            assert r.status_code == 422, f"{r.status_code}: {r.text[:300]}"
        finally:
            admin_client.delete(f"{BASE_URL}/api/trips/{tid}", timeout=60)


# ---------------------------------------------------------------- regression smoke
class TestRegressionSmoke:
    def test_health(self):
        r = requests.get(f"{BASE_URL}/api/health", timeout=60)
        assert r.status_code == 200 and r.json().get("status") in ("ok", "healthy")

    def test_me(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/auth/me", timeout=60)
        assert r.status_code == 200 and r.json()["email"] == _creds()["email"]

    def test_trips_list(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/trips", timeout=60)
        assert r.status_code == 200
        d = r.json()
        assert isinstance(d.get("trips"), list) and isinstance(d.get("total"), int)

    def test_budget(self, admin_client, trip):
        r = admin_client.get(f"{BASE_URL}/api/trips/{trip['id']}/budget", timeout=60)
        assert r.status_code == 200, r.text[:200]

    def test_expenses_and_settlements(self, admin_client, trip):
        e = admin_client.post(f"{BASE_URL}/api/trips/{trip['id']}/expenses", json={
            "description": "TEST_dinner", "amount": 60, "currency": "EUR",
            "paid_by": "Admin", "split_between": ["Admin", "Guest"]}, timeout=60)
        assert e.status_code in (200, 201), f"{e.status_code}: {e.text[:300]}"
        s = admin_client.get(f"{BASE_URL}/api/trips/{trip['id']}/settlements", timeout=60)
        assert s.status_code == 200, s.text[:200]


# ---------------------------------------------------------------- edge cases
class TestEdgeCases:
    def test_generate_missing_fields_422(self):
        r = requests.post(f"{BASE_URL}/api/explore/generate", json={"destination": "Lisbon"}, timeout=60)
        assert r.status_code == 422, f"{r.status_code}: {r.text[:200]}"

    def test_generate_reversed_dates_no_500(self):
        r = requests.post(f"{BASE_URL}/api/explore/generate", json={
            "destination": "Lisbon", "start_date": END, "end_date": START}, timeout=300)
        assert r.status_code != 500, r.text[:300]
        assert r.status_code in (200, 400, 422, 502), f"{r.status_code}: {r.text[:200]}"

    def test_unknown_destination_404(self):
        r = requests.get(f"{BASE_URL}/api/explore/things-to-do",
                         params={"destination": "zzqqxxnotarealplace123"}, timeout=90)
        assert r.status_code in (404, 502), f"{r.status_code}: {r.text[:200]}"
        assert "detail" in r.json()

    def test_flights_missing_params_422(self):
        r = requests.get(f"{BASE_URL}/api/explore/flights", params={"origin": "London"}, timeout=60)
        assert r.status_code == 422

    def test_optimize_route_non_owner_403(self, other_client, trip):
        r = other_client.post(f"{BASE_URL}/api/trips/{trip['id']}/optimize-route",
                              params={"day_index": 0}, timeout=60)
        assert r.status_code == 403, f"{r.status_code}: {r.text[:200]}"

    def test_select_hotel_non_owner_403(self, other_client, trip):
        r = other_client.post(f"{BASE_URL}/api/trips/{trip['id']}/hotel",
                              json={"name": "x", "id": "y", "lat": 1, "lng": 2}, timeout=60)
        assert r.status_code == 403, f"{r.status_code}: {r.text[:200]}"
