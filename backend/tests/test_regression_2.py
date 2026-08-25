"""Targeted regression suite (iteration 2): currency, places, owner-only itinerary writes, chat SSE framing, core flow."""
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
API = f"{base_url.rstrip('/')}/api"


def _rand(n=6):
    return "".join(random.choices(string.ascii_lowercase + string.digits, k=n))


def _register(name):
    s = requests.Session()
    email = f"qa.{_rand()}@gmail.com"
    r = s.post(f"{API}/auth/register", json={"name": name, "email": email, "password": "secret123"}, timeout=60)
    assert r.status_code in (200, 201), f"register failed {r.status_code}: {r.text[:300]}"
    s.headers.update({"Authorization": f"Bearer {r.json()['access_token']}"})
    return {"session": s, "email": email, "id": r.json().get("id")}


@pytest.fixture(scope="session")
def admin_credentials():
    c = Path("/app/memory/test_credentials.md").read_text()
    e = re.search(r'(?im)^-\s*Email:\s*`?([^`\s]+)', c)
    pw = re.search(r'(?im)^-\s*Password:\s*`?([^`\s]+)', c)
    if not e or not pw:
        pytest.skip("no creds in test_credentials.md")
    return {"email": e.group(1), "password": pw.group(1)}


@pytest.fixture(scope="session")
def admin(admin_credentials):
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json=admin_credentials, timeout=60)
    if r.status_code != 200:
        pytest.fail(f"admin login failed {r.status_code}: {r.text[:300]}")
    s.headers.update({"Authorization": f"Bearer {r.json()['access_token']}"})
    return {"session": s, "id": r.json().get("id")}


@pytest.fixture(scope="session")
def owner():
    return _register("QA Owner")


@pytest.fixture(scope="session")
def member():
    return _register("QA Member")


@pytest.fixture(scope="session")
def shared_trip(owner, member):
    """Trip owned by `owner`, with `member` invited (session-scoped)."""
    s = owner["session"]
    r = s.post(f"{API}/trips", json={
        "title": "TEST_Regression Lisbon", "destination": "Lisbon, Portugal",
        "start_date": "2026-09-10", "end_date": "2026-09-12",
        "travelers": 2, "budget": 1500, "currency": "EUR",
        "interests": ["food"], "pace": "moderate",
    }, timeout=60)
    assert r.status_code == 201, r.text[:300]
    trip = r.json()
    inv = s.post(f"{API}/trips/{trip['id']}/invite", json={"email": member["email"]}, timeout=60)
    assert inv.status_code == 200, f"invite failed {inv.status_code}: {inv.text[:300]}"
    yield trip
    s.delete(f"{API}/trips/{trip['id']}", timeout=60)


# ---------------- REGRESSION: currency ----------------
class TestCurrencyRegression:
    def test_convert_usd_eur(self, owner):
        r = owner["session"].get(f"{API}/currency/convert", params={"amount": 100, "from": "USD", "to": "EUR"}, timeout=60)
        assert r.status_code == 200, f"{r.status_code}: {r.text[:300]}"
        d = r.json()
        assert d["from"] == "USD" and d["to"] == "EUR"
        assert isinstance(d["result"], (int, float)) and 30 < d["result"] < 200, d
        assert 0.3 < d["rate"] < 2.0, d

    def test_rates_base_usd(self, owner):
        r = owner["session"].get(f"{API}/currency/rates", params={"base": "USD"}, timeout=60)
        assert r.status_code == 200, f"{r.status_code}: {r.text[:300]}"
        d = r.json()
        assert d.get("base") == "USD", d
        assert isinstance(d.get("rates"), dict) and "EUR" in d["rates"], d

    def test_same_currency_noop(self, owner):
        r = owner["session"].get(f"{API}/currency/convert", params={"amount": 50, "from": "EUR", "to": "EUR"}, timeout=60)
        assert r.status_code == 200
        assert r.json()["result"] == 50 and r.json()["rate"] == 1.0

    def test_invalid_amount_422(self, owner):
        r = owner["session"].get(f"{API}/currency/convert", params={"amount": 0, "from": "USD", "to": "EUR"}, timeout=60)
        assert r.status_code == 422


# ---------------- REGRESSION: places search must not 500 ----------------
class TestPlacesRegression:
    def test_places_search_200_or_502(self, owner):
        r = owner["session"].get(f"{API}/places/search",
                                 params={"lat": 38.7223, "lng": -9.1393, "category": "restaurants"}, timeout=180)
        assert r.status_code != 500, f"generic 500 regression: {r.text[:300]}"
        assert r.status_code in (200, 502), f"{r.status_code}: {r.text[:300]}"
        if r.status_code == 200:
            d = r.json()
            assert isinstance(d["places"], list) and d["count"] == len(d["places"])
            if d["places"]:
                assert d["places"][0].get("lat") is not None
        else:
            # NOTE: through the public edge (Cloudflare) a 502 body is replaced with an HTML
            # error page, so only assert JSON detail when the app's own body survives.
            if "application/json" in r.headers.get("content-type", ""):
                detail = r.json().get("detail", "")
                assert "unavailable" in detail.lower(), detail

    def test_unsupported_category_422(self, owner):
        r = owner["session"].get(f"{API}/places/search",
                                 params={"lat": 38.7, "lng": -9.1, "category": "bogus"}, timeout=60)
        assert r.status_code == 422


# ---------------- REGRESSION: owner-only itinerary/packing writes ----------------
class TestOwnerOnlyWrites:
    def test_member_can_read(self, member, shared_trip):
        s = member["session"]
        assert s.get(f"{API}/trips/{shared_trip['id']}", timeout=30).status_code == 200
        assert s.get(f"{API}/trips/{shared_trip['id']}/activities", timeout=30).status_code == 200
        assert s.get(f"{API}/trips/{shared_trip['id']}/packing", timeout=30).status_code == 200

    def test_owner_activity_crud_and_reorder(self, owner, shared_trip):
        s = owner["session"]
        tid = shared_trip["id"]
        made = []
        for i in range(2):
            r = s.post(f"{API}/trips/{tid}/activities", json={
                "day_index": 0, "title": f"TEST_Act {i}", "location": "Baixa",
                "lat": 38.71, "lng": -9.14, "duration_minutes": 60,
                "estimated_cost": 10, "category": "sightseeing"}, timeout=30)
            assert r.status_code == 201, r.text[:300]
            made.append(r.json())
        u = s.put(f"{API}/trips/{tid}/activities/{made[0]['id']}", json={"title": "TEST_Act Renamed"}, timeout=30)
        assert u.status_code == 200 and u.json()["title"] == "TEST_Act Renamed"
        ids = [made[1]["id"], made[0]["id"]]
        ro = s.post(f"{API}/trips/{tid}/activities/reorder", json={"day_index": 0, "ordered_ids": ids}, timeout=30)
        assert ro.status_code == 200, ro.text[:300]
        day0 = {a["id"]: a["order"] for a in s.get(f"{API}/trips/{tid}/activities", timeout=30).json()["activities"] if a["day_index"] == 0}
        assert day0[ids[0]] < day0[ids[1]], day0
        assert s.delete(f"{API}/trips/{tid}/activities/{made[1]['id']}", timeout=30).status_code == 200
        # keep made[0] for member-write tests
        TestOwnerOnlyWrites.activity_id = made[0]["id"]

    def test_owner_packing_crud(self, owner, shared_trip):
        s = owner["session"]
        tid = shared_trip["id"]
        c = s.post(f"{API}/trips/{tid}/packing", json={"name": "TEST_Sunscreen", "category": "essentials"}, timeout=30)
        assert c.status_code == 201, c.text[:300]
        pid = c.json()["id"]
        u = s.put(f"{API}/trips/{tid}/packing/{pid}", json={"checked": True}, timeout=30)
        assert u.status_code == 200
        items = s.get(f"{API}/trips/{tid}/packing", timeout=30).json()["items"]
        assert next(i for i in items if i["id"] == pid)["checked"] is True
        TestOwnerOnlyWrites.packing_id = pid

    def test_member_activity_writes_403(self, member, shared_trip):
        s = member["session"]
        tid = shared_trip["id"]
        aid = getattr(TestOwnerOnlyWrites, "activity_id", "64b64b64b64b64b64b64b64b")
        post = s.post(f"{API}/trips/{tid}/activities", json={"day_index": 0, "title": "TEST_Member Act"}, timeout=30)
        assert post.status_code == 403, f"POST activity: {post.status_code} {post.text[:200]}"
        put = s.put(f"{API}/trips/{tid}/activities/{aid}", json={"title": "TEST_Hijack"}, timeout=30)
        assert put.status_code == 403, f"PUT activity: {put.status_code} {put.text[:200]}"
        dele = s.delete(f"{API}/trips/{tid}/activities/{aid}", timeout=30)
        assert dele.status_code == 403, f"DELETE activity: {dele.status_code} {dele.text[:200]}"
        ro = s.post(f"{API}/trips/{tid}/activities/reorder", json={"day_index": 0, "ordered_ids": [aid]}, timeout=30)
        assert ro.status_code == 403, f"reorder: {ro.status_code} {ro.text[:200]}"

    def test_member_packing_writes_403(self, member, shared_trip):
        s = member["session"]
        tid = shared_trip["id"]
        pid = getattr(TestOwnerOnlyWrites, "packing_id", "64b64b64b64b64b64b64b64b")
        assert s.post(f"{API}/trips/{tid}/packing", json={"name": "TEST_M"}, timeout=30).status_code == 403
        assert s.put(f"{API}/trips/{tid}/packing/{pid}", json={"checked": False}, timeout=30).status_code == 403
        assert s.delete(f"{API}/trips/{tid}/packing/{pid}", timeout=30).status_code == 403
        assert s.post(f"{API}/trips/{tid}/packing/generate", timeout=60).status_code == 403

    def test_member_can_post_expense(self, member, owner, shared_trip):
        s = member["session"]
        tid = shared_trip["id"]
        r = s.post(f"{API}/trips/{tid}/expenses", json={
            "amount": 24, "currency": "EUR", "category": "food",
            "description": "TEST_Member Lunch", "payer": "Member", "split_between": ["Member", "Owner"]}, timeout=30)
        assert r.status_code == 201, f"member expense blocked: {r.status_code} {r.text[:300]}"
        eid = r.json()["id"]
        listed = owner["session"].get(f"{API}/trips/{tid}/expenses", timeout=30).json()["expenses"]
        assert "TEST_Member Lunch" in [e["description"] for e in listed]
        assert s.delete(f"{API}/trips/{tid}/expenses/{eid}", timeout=30).status_code == 200

    def test_admin_can_write_any_trip(self, admin, owner, shared_trip):
        s = admin["session"]
        tid = shared_trip["id"]
        r = s.post(f"{API}/trips/{tid}/activities", json={
            "day_index": 1, "title": "TEST_Admin Act", "lat": 38.7, "lng": -9.1, "category": "food"}, timeout=30)
        assert r.status_code == 201, f"admin write blocked: {r.status_code} {r.text[:300]}"
        assert s.delete(f"{API}/trips/{tid}/activities/{r.json()['id']}", timeout=30).status_code == 200

    def test_outsider_still_403_or_404(self, shared_trip):
        stranger = _register("QA Stranger")
        r = stranger["session"].get(f"{API}/trips/{shared_trip['id']}", timeout=30)
        assert r.status_code in (403, 404), r.status_code


# ---------------- REGRESSION: chat SSE json framing ----------------
class TestChatSSERegression:
    def _stream(self, session, message, trip_id=None):
        payload = {"message": message}
        if trip_id:
            payload["trip_id"] = trip_id
        r = session.post(f"{API}/chat", json=payload, stream=True, timeout=300)
        assert r.status_code == 200, r.text[:300]
        assert "text/event-stream" in r.headers.get("content-type", "")
        conv_id, tokens, done, err = None, [], False, None
        for line in r.iter_lines(decode_unicode=True):
            if not line or not line.startswith("data: "):
                continue
            evt = json.loads(line[6:])  # will raise if framing is broken
            if evt["type"] == "meta":
                conv_id = evt["conversation_id"]
            elif evt["type"] == "token":
                tokens.append(evt["content"])
            elif evt["type"] == "error":
                err = evt["content"]
            elif evt["type"] == "done":
                done = True
                break
        return conv_id, "".join(tokens), done, err

    def test_stream_with_quotes_and_newlines(self, owner, shared_trip):
        s = owner["session"]
        msg = 'Reply with exactly this JSON on one line and nothing else: {"a": "b\\nc", "q": "he said \\"hi\\""}'
        conv_id, text, done, err = self._stream(s, msg, shared_trip["id"])
        assert err is None, f"stream error: {err}"
        assert conv_id, "no meta conversation_id"
        assert done, "stream never completed"
        assert len(text.strip()) > 5, f"empty reply: {text!r}"

        time.sleep(1)
        conv = s.get(f"{API}/chat/{conv_id}", timeout=60)
        assert conv.status_code == 200
        msgs = conv.json()["messages"]
        roles = [m["role"] for m in msgs]
        assert "user" in roles and "assistant" in roles, roles
        assert any(m["role"] == "assistant" and m["content"].strip() for m in msgs)
        assert s.delete(f"{API}/chat/{conv_id}", timeout=30).status_code == 200


# ---------------- CORE flow re-verify ----------------
class TestCoreFlow:
    def test_generate_budget_expense_settlement(self, owner, shared_trip):
        s = owner["session"]
        tid = shared_trip["id"]
        g = s.post(f"{API}/trips/{tid}/generate", timeout=300)
        assert g.status_code == 200, f"generate failed {g.status_code}: {g.text[:400]}"
        gd = g.json()
        assert gd["activities_created"] >= 3, gd
        acts = s.get(f"{API}/trips/{tid}/activities", timeout=60).json()["activities"]
        coords = [a for a in acts if a.get("lat") and a.get("lng")]
        assert len(coords) >= 3, f"coords missing: {acts[:2]}"
        assert all("_id" not in a for a in acts)

        b = s.get(f"{API}/trips/{tid}/budget", timeout=30)
        assert b.status_code == 200 and b.json()["num_days"] == 3

        e = s.post(f"{API}/trips/{tid}/expenses", json={
            "amount": 60, "currency": "EUR", "category": "food",
            "description": "TEST_Core Dinner", "payer": "Owner", "split_between": ["Owner", "Member", "Guest"]}, timeout=30)
        assert e.status_code == 201, e.text[:300]
        st = s.get(f"{API}/trips/{tid}/settlements", timeout=30)
        assert st.status_code == 200
        sd = st.json()
        assert sd["balances"].get("Guest") == -20.0, sd["balances"]
        assert sd["settlements"], sd
        assert s.get(f"{API}/trips/{tid}/budget", timeout=30).json()["total_spent"] == 60.0
        assert s.delete(f"{API}/trips/{tid}/expenses/{e.json()['id']}", timeout=30).status_code == 200
