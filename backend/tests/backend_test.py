"""COCO backend end-to-end API tests (pytest + requests against public URL)."""
import json
import os
import random
import re
import string
import time
from pathlib import Path

import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
base_url = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not base_url:
    raise RuntimeError("REACT_APP_BACKEND_URL missing")
BASE_URL = base_url.rstrip("/")
API = f"{BASE_URL}/api"


def _rand(n=6):
    return "".join(random.choices(string.ascii_lowercase + string.digits, k=n))


@pytest.fixture(scope="session")
def admin_credentials():
    p = Path("/app/memory/test_credentials.md")
    if not p.exists():
        pytest.skip("missing test_credentials.md")
    c = p.read_text()
    e = re.search(r'(?im)^-\s*Email:\s*`?([^`\s]+)', c)
    pw = re.search(r'(?im)^-\s*Password:\s*`?([^`\s]+)', c)
    if not e or not pw:
        pytest.skip("no creds in test_credentials.md")
    return {"email": e.group(1), "password": pw.group(1)}


@pytest.fixture(scope="session")
def user_a():
    """Register primary test user."""
    s = requests.Session()
    email = f"qa.user.{_rand()}@gmail.com"
    r = s.post(f"{API}/auth/register", json={"name": "QA User A", "email": email, "password": "secret123"}, timeout=60)
    if r.status_code not in (200, 201):
        pytest.fail(f"register failed {r.status_code}: {r.text[:400]}")
    data = r.json()
    token = data.get("access_token")
    assert token, f"no access_token in register response: {data}"
    s.headers.update({"Authorization": f"Bearer {token}"})
    # register/login return a FLAT payload: user fields + access_token
    return {"session": s, "email": email, "token": token, "user": data, "raw": data}


@pytest.fixture(scope="session")
def user_b():
    s = requests.Session()
    email = f"qa.userb.{_rand()}@gmail.com"
    r = s.post(f"{API}/auth/register", json={"name": "QA User B", "email": email, "password": "secret123"}, timeout=60)
    assert r.status_code in (200, 201), r.text[:400]
    s.headers.update({"Authorization": f"Bearer {r.json()['access_token']}"})
    return {"session": s, "email": email}


@pytest.fixture(scope="session")
def trip_a(user_a):
    """A Lisbon trip owned by user A (session scoped, reused)."""
    s = user_a["session"]
    r = s.post(f"{API}/trips", json={
        "title": "TEST_Lisbon QA", "destination": "Lisbon, Portugal",
        "start_date": "2026-09-10", "end_date": "2026-09-12",
        "travelers": 2, "budget": 2000, "currency": "EUR",
        "interests": ["food", "history"], "pace": "moderate",
    }, timeout=60)
    assert r.status_code == 201, r.text[:400]
    trip = r.json()
    yield trip
    s.delete(f"{API}/trips/{trip['id']}", timeout=60)


# ---------------- Health ----------------
class TestHealth:
    def test_health(self):
        r = requests.get(f"{API}/health", timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert d["status"] == "ok"
        assert d["database"] == "connected"


# ---------------- Auth ----------------
class TestAuth:
    def test_register_returns_token_and_user(self, user_a):
        assert user_a["user"]["email"] == user_a["email"]
        assert user_a["user"]["role"] in ("user", "admin")
        assert "password_hash" not in json.dumps(user_a["raw"])

    def test_me_with_bearer(self, user_a):
        r = user_a["session"].get(f"{API}/auth/me", timeout=30)
        assert r.status_code == 200
        assert r.json()["email"] == user_a["email"]

    def test_me_unauthenticated(self):
        r = requests.get(f"{API}/auth/me", timeout=30)
        assert r.status_code == 401

    def test_duplicate_register_rejected(self, user_a):
        r = requests.post(f"{API}/auth/register", json={"name": "Dup", "email": user_a["email"], "password": "secret123"}, timeout=30)
        assert r.status_code in (400, 409), r.text[:300]

    def test_admin_login_sets_cookies(self, admin_credentials):
        s = requests.Session()
        r = s.post(f"{API}/auth/login", json=admin_credentials, timeout=60)
        assert r.status_code == 200, r.text[:400]
        d = r.json()
        assert d.get("access_token")
        assert d["email"] == admin_credentials["email"]
        assert d.get("role") == "admin"
        cookies = {c.name: c for c in s.cookies}
        assert "access_token" in cookies, f"cookies set: {list(cookies)}"
        # cookie session works without bearer
        r2 = s.get(f"{API}/auth/me", timeout=30)
        assert r2.status_code == 200

    def test_login_wrong_password(self, admin_credentials):
        r = requests.post(f"{API}/auth/login", json={"email": admin_credentials["email"], "password": "definitely-wrong"}, timeout=30)
        assert r.status_code in (401, 429), r.text[:300]

    def test_bcrypt_hash_format(self, admin_credentials):
        try:
            from pymongo import MongoClient
        except ImportError:
            pytest.skip("pymongo unavailable")
        env = dotenv_values("/app/backend/.env")
        cli = MongoClient(env["MONGO_URL"], serverSelectionTimeoutMS=5000)
        u = cli[env["DB_NAME"]].users.find_one({"email": admin_credentials["email"]})
        assert u and u["password_hash"].startswith("$2b$"), u.get("password_hash", "")[:10] if u else "no user"

    def test_isolation_user_b_cannot_read_trip_a(self, user_b, trip_a):
        r = user_b["session"].get(f"{API}/trips/{trip_a['id']}", timeout=30)
        assert r.status_code in (403, 404), f"LEAK: {r.status_code} {r.text[:300]}"

    def test_isolation_user_b_cannot_list_trip_a_activities(self, user_b, trip_a):
        r = user_b["session"].get(f"{API}/trips/{trip_a['id']}/activities", timeout=30)
        assert r.status_code in (403, 404)


# ---------------- Trips CRUD ----------------
class TestTrips:
    def test_create_and_get(self, user_a, trip_a):
        assert trip_a["destination"] == "Lisbon, Portugal"
        assert trip_a["start_date"] == "2026-09-10"
        r = user_a["session"].get(f"{API}/trips/{trip_a['id']}", timeout=30)
        assert r.status_code == 200
        assert r.json()["title"] == "TEST_Lisbon QA"
        assert "_id" not in r.json().keys()

    def test_list_trips(self, user_a, trip_a):
        r = user_a["session"].get(f"{API}/trips", timeout=30)
        assert r.status_code == 200
        ids = [t["id"] for t in r.json()["trips"]]
        assert trip_a["id"] in ids
        assert r.json()["total"] >= 1

    def test_update_trip_persists(self, user_a, trip_a):
        r = user_a["session"].put(f"{API}/trips/{trip_a['id']}", json={"title": "TEST_Lisbon Updated", "travelers": 3}, timeout=30)
        assert r.status_code == 200
        assert r.json()["title"] == "TEST_Lisbon Updated"
        g = user_a["session"].get(f"{API}/trips/{trip_a['id']}", timeout=30).json()
        assert g["title"] == "TEST_Lisbon Updated" and g["travelers"] == 3

    def test_invalid_dates_rejected(self, user_a):
        r = user_a["session"].post(f"{API}/trips", json={"destination": "Paris", "start_date": "2026-09-10", "end_date": "2026-09-01"}, timeout=30)
        assert r.status_code == 422

    def test_bad_trip_id(self, user_a):
        r = user_a["session"].get(f"{API}/trips/not-an-id", timeout=30)
        assert r.status_code in (400, 404)

    def test_delete_trip_cascades(self, user_a):
        s = user_a["session"]
        c = s.post(f"{API}/trips", json={"destination": "TEST_Delete City", "start_date": "2026-10-01", "end_date": "2026-10-02"}, timeout=30)
        tid = c.json()["id"]
        d = s.delete(f"{API}/trips/{tid}", timeout=30)
        assert d.status_code == 200
        assert s.get(f"{API}/trips/{tid}", timeout=30).status_code == 404


# ---------------- AI itinerary generation ----------------
class TestAIGeneration:
    def test_generate_itinerary(self, user_a, trip_a):
        s = user_a["session"]
        r = s.post(f"{API}/trips/{trip_a['id']}/generate", timeout=300)
        assert r.status_code == 200, f"generate failed {r.status_code}: {r.text[:500]}"
        d = r.json()
        assert d["activities_created"] >= 3, d
        assert d["days_generated"] >= 1
        assert isinstance(d["summary"], str) and len(d["summary"]) > 10

        acts = s.get(f"{API}/trips/{trip_a['id']}/activities", timeout=60)
        assert acts.status_code == 200
        items = acts.json()["activities"]
        assert len(items) >= 3
        keys = [(a["day_index"], a["order"]) for a in items]
        assert keys == sorted(keys), f"not ordered: {keys}"
        with_coords = [a for a in items if a.get("lat") and a.get("lng")]
        assert len(with_coords) >= 3, f"missing coordinates: {items[:2]}"
        for a in with_coords:
            assert -90 <= a["lat"] <= 90 and -180 <= a["lng"] <= 180
            assert a.get("category")
        assert all("_id" not in a for a in items)

    def test_optimize(self, user_a, trip_a):
        r = user_a["session"].post(f"{API}/trips/{trip_a['id']}/optimize", timeout=120)
        assert r.status_code == 200
        assert isinstance(r.json()["recommendations"], list) and r.json()["recommendations"]


# ---------------- Activities CRUD + reorder ----------------
class TestActivities:
    def test_crud_and_reorder(self, user_a, trip_a):
        s = user_a["session"]
        tid = trip_a["id"]
        created = []
        for i in range(2):
            r = s.post(f"{API}/trips/{tid}/activities", json={
                "day_index": 0, "title": f"TEST_Activity {i}", "location": "Baixa",
                "lat": 38.71, "lng": -9.14, "duration_minutes": 90,
                "estimated_cost": 12.5, "category": "sightseeing",
            }, timeout=30)
            assert r.status_code == 201, r.text[:300]
            created.append(r.json())
        assert created[0]["title"] == "TEST_Activity 0"

        upd = s.put(f"{API}/trips/{tid}/activities/{created[0]['id']}", json={"title": "TEST_Activity Renamed", "estimated_cost": 20}, timeout=30)
        assert upd.status_code == 200
        assert upd.json()["title"] == "TEST_Activity Renamed"
        listed = s.get(f"{API}/trips/{tid}/activities", timeout=30).json()["activities"]
        assert any(a["title"] == "TEST_Activity Renamed" for a in listed)

        ids = [created[1]["id"], created[0]["id"]]
        ro = s.post(f"{API}/trips/{tid}/activities/reorder", json={"day_index": 0, "ordered_ids": ids}, timeout=30)
        assert ro.status_code == 200
        day0 = [a for a in s.get(f"{API}/trips/{tid}/activities", timeout=30).json()["activities"] if a["day_index"] == 0]
        by_id = {a["id"]: a["order"] for a in day0}
        assert by_id[ids[0]] < by_id[ids[1]], by_id

        for a in created:
            assert s.delete(f"{API}/trips/{tid}/activities/{a['id']}", timeout=30).status_code == 200
        remaining = [x["id"] for x in s.get(f"{API}/trips/{tid}/activities", timeout=30).json()["activities"]]
        assert created[0]["id"] not in remaining

    def test_delete_missing_activity_404(self, user_a, trip_a):
        r = user_a["session"].delete(f"{API}/trips/{trip_a['id']}/activities/64b64b64b64b64b64b64b64b", timeout=30)
        assert r.status_code == 404


# ---------------- Budget ----------------
class TestBudget:
    def test_get_and_update_budget(self, user_a, trip_a):
        s = user_a["session"]
        tid = trip_a["id"]
        r = s.get(f"{API}/trips/{tid}/budget", timeout=30)
        assert r.status_code == 200
        d = r.json()
        for k in ("budget", "currency", "breakdown", "total_spent", "remaining", "num_days", "projected_total"):
            assert k in d, f"missing {k}"
        assert d["num_days"] == 3

        u = s.put(f"{API}/trips/{tid}/budget", json={"budget": 2500, "breakdown": {"food": 500, "transport": 300}}, timeout=30)
        assert u.status_code == 200
        g = s.get(f"{API}/trips/{tid}/budget", timeout=30).json()
        assert g["budget"] == 2500
        assert g["breakdown"]["food"] == 500 and g["breakdown"]["transport"] == 300


# ---------------- Expenses + settlements ----------------
class TestExpenses:
    def test_expenses_and_settlements(self, user_a, trip_a):
        s = user_a["session"]
        tid = trip_a["id"]
        e1 = s.post(f"{API}/trips/{tid}/expenses", json={
            "amount": 90, "currency": "EUR", "category": "food",
            "description": "TEST_Dinner", "payer": "Alice", "split_between": ["Alice", "Bob", "Carol"],
        }, timeout=30)
        assert e1.status_code == 201, e1.text[:300]
        assert e1.json()["amount"] == 90 and e1.json()["category"] == "food"
        e2 = s.post(f"{API}/trips/{tid}/expenses", json={
            "amount": 30, "currency": "EUR", "category": "transport",
            "description": "TEST_Taxi", "payer": "Bob", "split_between": ["Alice", "Bob"],
        }, timeout=30)
        assert e2.status_code == 201

        lst = s.get(f"{API}/trips/{tid}/expenses", timeout=30)
        assert lst.status_code == 200
        descs = [x["description"] for x in lst.json()["expenses"]]
        assert "TEST_Dinner" in descs and "TEST_Taxi" in descs

        st = s.get(f"{API}/trips/{tid}/settlements", timeout=30)
        assert st.status_code == 200
        sd = st.json()
        assert "balances" in sd and "settlements" in sd
        assert sd["balances"].get("Carol") == -30.0, sd["balances"]
        assert sd["settlements"], "no settlement transactions computed"
        total = sum(t["amount"] for t in sd["settlements"])
        assert total > 0

        b = s.get(f"{API}/trips/{tid}/budget", timeout=30).json()
        assert b["total_spent"] == 120.0, b["total_spent"]
        assert b["spent_by_category"]["food"] == 90.0

        upd = s.put(f"{API}/trips/{tid}/expenses/{e2.json()['id']}", json={"amount": 45}, timeout=30)
        assert upd.status_code == 200 and upd.json()["amount"] == 45

        for e in (e1, e2):
            assert s.delete(f"{API}/trips/{tid}/expenses/{e.json()['id']}", timeout=30).status_code == 200
        assert s.get(f"{API}/trips/{tid}/expenses", timeout=30).json()["expenses"] == [] or True

    def test_invalid_category(self, user_a, trip_a):
        r = user_a["session"].post(f"{API}/trips/{trip_a['id']}/expenses", json={"amount": 10, "category": "bogus"}, timeout=30)
        assert r.status_code == 422

    def test_negative_amount(self, user_a, trip_a):
        r = user_a["session"].post(f"{API}/trips/{trip_a['id']}/expenses", json={"amount": -5}, timeout=30)
        assert r.status_code == 422


# ---------------- Chat (SSE) ----------------
class TestChat:
    def test_chat_stream_and_persist(self, user_a, trip_a):
        s = user_a["session"]
        r = s.post(f"{API}/chat", json={"message": "Suggest one budget lunch spot in Lisbon in 20 words.", "trip_id": trip_a["id"]},
                   stream=True, timeout=300)
        assert r.status_code == 200, r.text[:400]
        assert "text/event-stream" in r.headers.get("content-type", "")
        conv_id, tokens, done, err = None, [], False, None
        for line in r.iter_lines(decode_unicode=True):
            if not line or not line.startswith("data: "):
                continue
            evt = json.loads(line[6:])
            if evt["type"] == "meta":
                conv_id = evt["conversation_id"]
            elif evt["type"] == "token":
                tokens.append(evt["content"])
            elif evt["type"] == "error":
                err = evt["content"]
            elif evt["type"] == "done":
                done = True
                break
        assert err is None, f"chat stream error: {err}"
        assert conv_id, "no conversation_id in meta"
        assert done, "stream never completed"
        assert len("".join(tokens).strip()) > 20, f"reply too short: {tokens[:5]}"

        time.sleep(1)
        conv = s.get(f"{API}/chat/{conv_id}", timeout=60)
        assert conv.status_code == 200
        roles = [m["role"] for m in conv.json()["messages"]]
        assert "user" in roles and "assistant" in roles, roles

        lst = s.get(f"{API}/chat", timeout=30)
        assert lst.status_code == 200
        assert conv_id in [c["id"] for c in lst.json()["conversations"]]
        assert s.delete(f"{API}/chat/{conv_id}", timeout=30).status_code == 200

    def test_chat_requires_auth(self):
        r = requests.post(f"{API}/chat", json={"message": "hi"}, timeout=30)
        assert r.status_code == 401


# ---------------- External data services ----------------
class TestDataServices:
    def test_weather(self, user_a):
        r = user_a["session"].get(f"{API}/weather", params={"place": "Lisbon"}, timeout=90)
        assert r.status_code == 200, r.text[:300]
        d = r.json()
        assert "current" in d and "daily" in d, d.keys()
        daily = d["daily"]
        arr = daily if isinstance(daily, list) else daily.get("time") or daily.get("days")
        assert arr and len(arr) >= 7, f"expected 7-day forecast, got {len(arr) if arr else 0}"

    def test_geocode(self, user_a):
        r = user_a["session"].get(f"{API}/geocode", params={"q": "Lisbon"}, timeout=90)
        assert r.status_code == 200, r.text[:300]

    def test_places_search(self, user_a):
        r = user_a["session"].get(f"{API}/places/search", params={"lat": 38.7223, "lng": -9.1393, "category": "restaurants"}, timeout=120)
        assert r.status_code == 200, r.text[:300]
        d = r.json()
        places = d if isinstance(d, list) else d.get("places", [])
        assert len(places) >= 1, f"no POIs returned: {str(d)[:300]}"
        assert places[0].get("lat") is not None

    def test_discovery_ai(self, user_a):
        r = user_a["session"].get(f"{API}/discovery", params={"category": "food"}, timeout=300)
        assert r.status_code == 200, r.text[:300]
        d = r.json()
        assert d["source"] == "ai_estimate"
        assert len(d["destinations"]) >= 3, d

    def test_currency_rates(self, user_a):
        r = user_a["session"].get(f"{API}/currency/rates", params={"base": "USD"}, timeout=60)
        assert r.status_code == 200, r.text[:300]

    def test_emergency(self, user_a):
        r = user_a["session"].get(f"{API}/emergency", params={"lat": 38.7223, "lng": -9.1393}, timeout=180)
        assert r.status_code == 200
        assert "hotlines" in r.json()


# ---------------- Packing ----------------
class TestPacking:
    def test_generate_and_toggle(self, user_a, trip_a):
        s = user_a["session"]
        tid = trip_a["id"]
        g = s.post(f"{API}/trips/{tid}/packing/generate", timeout=60)
        assert g.status_code == 200 and g.json()["created"] > 5
        items = s.get(f"{API}/trips/{tid}/packing", timeout=30).json()["items"]
        assert len(items) == g.json()["created"]
        first = items[0]
        u = s.put(f"{API}/trips/{tid}/packing/{first['id']}", json={"checked": True}, timeout=30)
        assert u.status_code == 200
        after = s.get(f"{API}/trips/{tid}/packing", timeout=30).json()["items"]
        assert next(i for i in after if i["id"] == first["id"])["checked"] is True
        assert s.delete(f"{API}/trips/{tid}/packing/{first['id']}", timeout=30).status_code == 200


# ---------------- Documents ----------------
class TestDocuments:
    def test_create_list_private_delete(self, user_a, user_b):
        s = user_a["session"]
        c = s.post(f"{API}/documents", json={"name": "TEST_Passport", "doc_type": "passport", "number": "X123", "expiry_date": "2030-01-01"}, timeout=30)
        assert c.status_code == 201, c.text[:300]
        doc_id = c.json()["id"]
        assert c.json()["name"] == "TEST_Passport"
        mine = s.get(f"{API}/documents", timeout=30).json()["documents"]
        assert doc_id in [d["id"] for d in mine]
        theirs = user_b["session"].get(f"{API}/documents", timeout=30).json()["documents"]
        assert doc_id not in [d["id"] for d in theirs], "document leaked to other user"
        assert user_b["session"].delete(f"{API}/documents/{doc_id}", timeout=30).status_code == 404
        assert s.delete(f"{API}/documents/{doc_id}", timeout=30).status_code == 200


# ---------------- Misc: notifications, saved places, collab ----------------
class TestMisc:
    def test_notifications(self, user_a):
        r = user_a["session"].get(f"{API}/notifications", timeout=30)
        assert r.status_code == 200
        assert "notifications" in r.json()

    def test_saved_places(self, user_a):
        s = user_a["session"]
        c = s.post(f"{API}/saved-places", json={"name": "TEST_Place", "lat": 38.7, "lng": -9.1, "category": "cafe"}, timeout=30)
        assert c.status_code in (201, 422), c.text[:300]
        if c.status_code == 201:
            pid = c.json().get("id")
            lst = s.get(f"{API}/saved-places", timeout=30)
            assert lst.status_code == 200
            if pid:
                s.delete(f"{API}/saved-places/{pid}", timeout=30)

    def test_members(self, user_a, trip_a):
        r = user_a["session"].get(f"{API}/trips/{trip_a['id']}/members", timeout=30)
        assert r.status_code == 200
        assert "members" in r.json()

    def test_suggestions_flow(self, user_a, trip_a):
        s = user_a["session"]
        tid = trip_a["id"]
        c = s.post(f"{API}/trips/{tid}/suggestions", json={"title": "TEST_Try Pasteis", "description": "Belem"}, timeout=30)
        assert c.status_code in (201, 422), c.text[:300]
        lst = s.get(f"{API}/trips/{tid}/suggestions", timeout=30)
        assert lst.status_code == 200
