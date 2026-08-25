"""Seed a generated trip for UI testing. Run: python tests/_seed_ui_trip.py [delete <id>]"""
import sys
import os
from datetime import date, timedelta

import requests
from dotenv import dotenv_values

BASE = dotenv_values("/app/frontend/.env")["REACT_APP_BACKEND_URL"].rstrip("/")
admin_email = os.environ["ADMIN_EMAIL"]
admin_password = os.environ["ADMIN_PASSWORD"]
s = requests.Session()
r = s.post(f"{BASE}/api/auth/login", json={"email": admin_email, "password": admin_password}, timeout=60)
s.headers.update({"Authorization": f"Bearer {r.json()['access_token']}"})

if len(sys.argv) > 2 and sys.argv[1] == "delete":
    print(s.delete(f"{BASE}/api/trips/{sys.argv[2]}", timeout=60).status_code)
    sys.exit()

start = (date.today() + timedelta(days=40)).isoformat()
end = (date.today() + timedelta(days=42)).isoformat()
t = s.post(f"{BASE}/api/trips", json={
    "title": "TEST_UI3 Lisbon", "destination": "Lisbon", "start_date": start, "end_date": end,
    "travelers": 2, "budget": 1200, "currency": "EUR", "travel_style": "cultural",
    "interests": ["food"], "pace": "moderate", "food_pref": "seafood", "walking_level": "low",
    "luxury_level": "mid", "tourist_vs_local": 70, "vibe": "romantic"}, timeout=120)
tid = t.json().get("id")
g = s.post(f"{BASE}/api/trips/{tid}/generate", json={}, timeout=300)
print("trip_id", tid, "generate", g.status_code)
