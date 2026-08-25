# COCO — PRD & Build Log

## Original problem statement
Build COCO, a production-ready AI Trip Planner & Travel Companion (React + FastAPI + MongoDB). Must be real, responsive, mobile-first, secure, documented — not an AI-slop demo. Reuse existing COCO logo. Full feature scope (auth, AI generation, itinerary, map, budget, expenses, chat, discovery, nearby, what-now, travel mode, packing, documents, collaboration, optimizer, memories).

## User choices
- AI: Gemini 3 Flash (Emergent Universal Key)
- Maps/Places: OpenStreetMap (Leaflet/Nominatim/Overpass), keyless
- Weather: Open-Meteo, keyless
- Currency: Frankfurter (ECB), keyless
- Auth: email/password JWT + Emergent Google OAuth (unified session)
- Scope: full app

## Architecture
React SPA → REST /api → FastAPI (modular: core/db/models/schemas/services/api) → MongoDB. External: Gemini, OSM, Open-Meteo, Frankfurter. Logo reused from previous project at frontend/public/logofavicon.png.

## Personas
Guest, Authenticated user, Trip member, Owner, Admin (seeded).

## Implemented (v1.0.0 — 2026-06)
- Auth: register/login (bcrypt + JWT httpOnly cookies + Bearer), brute-force lockout, Google OAuth via /api/auth/session, forgot/reset, admin seed.
- Trips: CRUD, AI generate (structured+validated), optimizer (recommendations), budget summary+edit, memories.
- Activities: CRUD, reorder, owner/admin-only writes.
- Packing: auto-generate + CRUD.
- Expenses: CRUD + minimal-transaction settlements (members can add).
- Chat: SSE streaming, trip-aware, persisted conversations/messages.
- Data: weather, geocode, places search, currency convert/rates, discovery (AI estimates, 24h cache), emergency (parallel, capped), what-now, saved places.
- Documents: metadata vault (private). Collaboration: invite/members/suggestions/votes. Notifications.
- Frontend: Landing, auth pages, Dashboard, CreateTrip, TripDetail (8 tabs), Map (Leaflet), Discover, Nearby, Chat, WhatNow, TravelMode, Documents, Profile. Mobile bottom nav + desktop sidebar. Gradient destination banners. Recharts budget viz.
- Docs: README, backend/frontend READMEs, docs/PROJECT_DOCUMENTATION.md, auth_testing.md, docker-compose + Dockerfiles, .gitignore, .env.example files.

## Testing
- Backend unit: tests/test_business_logic.py, tests/test_regression_2.py (green).
- Testing agent iteration_1 (95% backend / 90% frontend) + iteration_2 regression (all HIGH fixed).

## Known limitations (this sandbox)
- Open-Meteo & Overpass rate-limit/block the shared container IP → weather/nearby degrade gracefully (503 / degraded payload). Work in real deployments.
- Document vault = metadata only (no object storage configured).
- No real flight/hotel prices (no booking API) — by design.
- Password reset link logged to backend console (no email provider).

## v1.1 — Capstone upgrade (2026-06)
- Guest mode: public `/explore` + `/api/explore/*` (destinations, things-to-do, hotels, flights, generate, chat) — no login needed; guest trips kept client-side until save.
- Deep personalization: food/accommodation/walking/luxury/vibe + tourist↔local slider threaded into AI prompts.
- Real-data services: hotels (OSM + deterministic AI Match Score + Stay-Like-a-Local), routing (OSRM + haversine fallback, route optimization), flights (honest provider abstraction — off without FLIGHT_API_KEY).
- AI-editable itinerary: `POST /api/trips/{id}/ai-edit` + command bar (cheaper/upgrade/less-walking/local/rainy/romantic/surprise) — modifies existing plan.
- Interactive Calendar + "What's cooking today?" day summary (spend/walking/travel/reservations/weather/warnings).
- New TripDetail tabs: Calendar, Stays, Flights. CORS hardened with preview-domain regex.
- Docs: `TRIP_PLANNER_DOCUMENTATION.md` (44 sections + SYSTEM MAP). Tests: `test_upgrade_3.py` (all green, 46/46 with regression).

## Backlog / next
- P1: Object storage for document files; email delivery (reset/invites).
- P2: Itinerary PDF/calendar export; optimizer that proposes concrete reorders; multi-currency settlement normalization.
- P3: Offline/PWA travel mode; realtime collaboration.
