# COCO — AI Trip Planner & Travel Companion

COCO turns a destination and a few preferences into a real, editable trip: an AI-generated day-by-day itinerary with real coordinates, interactive maps, live weather, budgets, group expenses, a context-aware chat companion, and a travel-ready mobile mode.

It is a production-oriented full-stack application — **React + FastAPI + MongoDB** — built to feel like it was designed and engineered by a human product team, not auto-generated.

---

## ✨ Features

- **AI trip generation** — structured, validated day-by-day itineraries (Gemini) with real coordinates, times, categories and cost estimates.
- **Itinerary management** — create, view, edit, reorder, regenerate and delete activities per day.
- **Interactive maps** — Leaflet + OpenStreetMap with custom category pins and route context. No API key required.
- **Budgets** — category breakdown, spent/remaining/projected, daily average and progress.
- **Group expenses & settlements** — split costs and compute minimal-transaction settlements.
- **COCO chat** — persistent, streaming chat that understands your active trip ("make day 2 cheaper").
- **Discovery** — mood-based destination discovery, clearly labelled as AI estimates (no fake reviews/prices).
- **Nearby / local discovery** — real restaurants, cafés, hospitals, pharmacies, police, transport via OpenStreetMap.
- **"What can I do right now?"** — suggestions based on live location, time and weather.
- **Travel Mode** — simplified, high-readability mobile screen for use on the road, with emergency assistance.
- **Packing list** — auto-generated from trip attributes, editable and persisted.
- **Document vault** — private storage of travel-document metadata with access control.
- **Collaboration** — invite members, share ideas, vote.
- **Trip optimizer** — flags pacing/budget/duplicate issues and recommends changes (never silent edits).
- **Trip memories** — a timeline of highlights.
- **Auth** — email/password (JWT) **and** Google OAuth  unified into one session.

---

## 🏗️ Architecture

```
User → React (SPA) → REST /api → FastAPI → Services (business logic) → MongoDB
                                                   ↓
                                    External APIs / AI
                          (Gemini · OpenStreetMap · Open-Meteo · Frankfurter)
```

The backend is modular (`app/core`, `app/db`, `app/models`, `app/schemas`, `app/services`, `app/api`) — no monolithic `main.py`.

---

## 🧰 Tech stack

| Layer     | Technology |
|-----------|------------|
| Frontend  | React 18, React Router 6, TanStack Query, Tailwind CSS, Framer Motion, Leaflet, Recharts, Phosphor Icons |
| Backend   | Python 3.11, FastAPI, Motor (async MongoDB), Pydantic v2, PyJWT, bcrypt |
| Database  | MongoDB |
| AI        | Gemini 3 Flash via Google's official `google-genai` client |
| Maps/Places | OpenStreetMap (Leaflet, Nominatim, Overpass) — keyless |
| Weather   | Open-Meteo — keyless |
| Currency  | Frankfurter (ECB) — keyless |

---

## 🚀 Local development

### Prerequisites
- Python 3.11+, Node 20+, Yarn, MongoDB running locally

### Backend
```bash
cd backend
pip install -r requirements.txt
cp .env.example .env         # fill in JWT_SECRET, GOOGLE_API_KEY, etc.
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

### Frontend
```bash
cd frontend
yarn install
cp .env.example .env         # set REACT_APP_BACKEND_URL
yarn start                   # http://localhost:3000
```

> In this hosted environment, supervisor runs both services automatically.
> `sudo supervisorctl restart backend|frontend`

---

## 🔑 Environment variables

### Backend (`backend/.env`)
| Variable | Required | Purpose |
|----------|----------|---------|
| `MONGO_URL` | ✅ | MongoDB connection string |
| `DB_NAME` | ✅ | Database name |
| `JWT_SECRET` | ✅ | Signs JWT access/refresh tokens |
| `GOOGLE_API_KEY` | ✅ (for AI) | Powers direct Gemini itinerary + chat |
| `AI_MODEL` | ⬜ | Defaults to `gemini-3-flash-preview` |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | ⬜ | Seeded admin account |
| `FRONTEND_URL` | ✅ | CORS origin |

### Frontend (`frontend/.env`)
| Variable | Required | Purpose |
|----------|----------|---------|
| `REACT_APP_BACKEND_URL` | ✅ | Base URL of the API (routes prefixed with `/api`) |

No secrets are ever stored in the frontend. Maps/weather/currency are keyless.

---

## 🏭 Production build

```bash
cd frontend && yarn build      # static assets in frontend/build
# Backend: run uvicorn/gunicorn behind a reverse proxy; set FRONTEND_URL for CORS
```

Recommended: Frontend on Vercel/Netlify, Backend on Render/Railway/Fly, DB on MongoDB Atlas. See `docs/PROJECT_DOCUMENTATION.md` §21.

---

## 🐳 Docker

```bash
docker compose up --build
```
Runs MongoDB, backend and frontend for local development.

---

## 🧪 Testing

- Backend unit tests: `cd backend && pytest`
- Health check: `GET /api/health`

---

## 📚 Documentation

Full technical + product documentation lives in **[`docs/PROJECT_DOCUMENTATION.md`](docs/PROJECT_DOCUMENTATION.md)** — a single-file SRS + developer handbook covering requirements, DB design, every API endpoint, AI architecture, security and deployment.

---

## 🩺 Troubleshooting

| Symptom | Fix |
|---------|-----|
| `AI is not configured` | Set `GOOGLE_API_KEY` in `backend/.env` and restart backend |
| 401 on protected routes | Ensure requests send cookies (`credentials: include`) or a Bearer token |
| Map blank | Check the browser can reach `tile.openstreetmap.org` |
| Weather/Places empty | External keyless APIs may rate-limit; retry shortly |

Maps © OpenStreetMap contributors.
