# TRIP_PLANNER_DOCUMENTATION.md — COCO AI Travel Planner

> A complete, implementation-accurate handbook. Every file, route, API, and data flow described below exists in this repository. Where a capability requires paid credentials it is called out explicitly with a clean fallback.

---

## 1. Project Overview
COCO is an AI travel planner + companion. A user (guest or signed-in) describes a destination and preferences; COCO generates a **structured, validated** day-by-day itinerary using Gemini, enriches it with **real** data (OpenStreetMap places/hotels, Open-Meteo weather, OSRM routing), and lets the user edit it in natural language, browse stays with an AI Match Score, view an interactive calendar with a daily "What's cooking today?" briefing, track budgets/expenses, and chat with a trip-aware assistant. **Guests can do almost everything without an account**; authentication is required only to persist/sync trips and access private data (documents, collaboration).

## 2. Architecture (diagram)
```
        ┌────────────┐   REST /api (+SSE)   ┌─────────────────────────────┐
 USER → │  React SPA │ ───────────────────► │        FastAPI (server.py)   │
        └────────────┘  cookies + Bearer    │  routers → services (logic)  │
                                            └───────────────┬──────────────┘
                                    ┌───────────────────────┼───────────────────────┐
                                    ▼                        ▼                       ▼
                              MongoDB (Motor)        External APIs            AI Orchestrator
                              users/trips/...   OSM · Open-Meteo · OSRM ·   (ai_service, Gemini
                                                Frankfurter · Wikipedia     via emergentintegrations)
```
Raw API responses are **normalized** in each `*_service.py` before being returned to the UI or handed to the AI. The AI reasons over normalized data; it never invents prices/availability.

## 3. Frontend technology & major files
React 18 (CRA) + React Router 6 + TanStack Query 5 + Tailwind + Framer Motion + Leaflet + Recharts + Phosphor icons.

| Path | Responsibility |
|------|----------------|
| `src/index.js` | App bootstrap: QueryClient, Router, AuthProvider, Toaster |
| `src/App.js` | Route table (public + protected); Google OAuth hash handoff |
| `src/api/client.js` | Axios instance (`baseURL=${REACT_APP_BACKEND_URL}/api`, `withCredentials`), Bearer injection, `apiError()` flattener |
| `src/services/api.js` | All typed API functions: `authApi, tripsApi (incl. aiEdit/daySummary/hotels/flights/optimizeRoute), activitiesApi, packingApi, expensesApi, collabApi, dataApi, documentsApi, chatApi, notifApi, exploreApi` |
| `src/context/AuthContext.js` | Auth state, login/register/googleSession/logout; **skips `/me` for guests on public routes** |
| `src/layouts/AppLayout.jsx` | Authed shell: desktop sidebar + mobile bottom nav |
| `src/pages/Landing.jsx` | Marketing home; links to `/explore` |
| `src/pages/Explore.jsx` | **Public guest hub**: destination search → things-to-do, stays, guest itinerary, public COCO chat |
| `src/pages/CreateTrip.jsx` | Trip form incl. personalization (food, walking, luxury, vibe, tourist↔local slider) |
| `src/pages/TripDetail.jsx` | Tabs: Itinerary, Calendar, Map, Stays, Flights, Budget, Expenses, Packing, Team, Optimizer, Memories + chat drawer |
| `src/pages/{Dashboard,Nearby,Discover,Chat,WhatNow,TravelMode,Documents,Profile,Login,Register,ForgotPassword,ResetPassword}.jsx` | Feature pages |
| `src/components/trip/*` | `ItineraryTab, CalendarTab, StaysTab, FlightsTab, BudgetTab, ExpensesTab, PackingTab, CollaboratorsTab, OptimizerTab, MemoriesTab, WeatherStrip, AICommandBar` |
| `src/components/chat/ChatPanel.jsx` | SSE streaming chat; `guest` prop → posts to `/api/explore/chat` |
| `src/components/map/TripMap.jsx` | Leaflet map with category pins + auto fit-bounds |
| `src/components/DestinationBanner.jsx` | Deterministic gradient banner (reliable image fallback) |
| `src/hooks/useGeolocation.js` | Location permission + manual fallback |
| `src/utils/{index,format}.js` | Constants (currencies, interests, category colors) + formatters (money, dates) |

## 4. Backend technology & every route/service
Python 3.11 + FastAPI + Motor + Pydantic v2 + PyJWT + bcrypt. Entry `backend/server.py` mounts routers under `/api`.

**Routers** (`app/api/`):
- `routes_health.py` → `GET /api/health`
- `routes_auth.py` → register, login, session (Google), me, refresh, logout, forgot/reset password
- `routes_trips.py` → trips CRUD, `generate`, `optimize` (advice), budget GET/PUT, memories
- `routes_trip_ai.py` → `ai-edit`, `day/{i}/summary`, `hotels`, `hotel` (select), `optimize-route`, `flights`
- `routes_activities.py` → activities CRUD, reorder, packing (+`packing/generate`)
- `routes_expenses.py` → expenses CRUD, `settlements`
- `routes_chat.py` → authed SSE chat + conversation history
- `routes_data.py` → weather, geocode, places/search, currency, discovery, emergency, what-now, saved-places
- `routes_explore.py` → **public** destinations, hotels, things-to-do, flights, generate, chat
- `routes_documents.py`, `routes_collab.py`, `routes_notifications.py`

**Services** (`app/services/`): `ai_service`, `hotels_service`, `places_service`, `routing_service`, `weather_service`, `currency_service`, `flights_service`.
**Core** (`app/core/`): `config` (env), `security` (bcrypt+JWT), `logging` (secret-safe), `ratelimit`.

## 5. Database (MongoDB) — collections & models
Base helpers in `app/models/common.py` (`PyObjectId`, `BaseDocument`, `utcnow`). Collections & indexes are created in `app/db/mongo.py::ensure_indexes()`:

`users`(email unique), `trips`((owner_id,created_at),(member_ids), fields incl. personalization + `selected_hotel`), `activities`((trip_id,day_index,order)), `expenses`((trip_id,date)), `chat_conversations`/`chat_messages`, `saved_places`, `travel_documents`, `notifications`, `trip_memories`, `packing_items`, `trip_suggestions`, `discovery_cache`, `login_attempts`, `password_reset_tokens`(TTL), `user_sessions` (Google).

## 6. External APIs used
| API | Keyless? | Used by |
|-----|----------|---------|
| Gemini (official Google GenAI client) | key required | `ai_service` |
| OpenStreetMap Overpass | ✅ | `places_service`, `hotels_service` |
| OpenStreetMap Nominatim | ✅ | geocoding |
| Open-Meteo | ✅ | `weather_service` |
| OSRM (public demo) | ✅ | `routing_service` (fallback: haversine) |
| Frankfurter (ECB) | ✅ | `currency_service` |
| Flight provider (Amadeus/Duffel) | **key required** | `flights_service` (abstraction; off by default) |

## 7. Official API docs
- Gemini: https://ai.google.dev/gemini-api/docs
- Overpass: https://wiki.openstreetmap.org/wiki/Overpass_API
- Nominatim: https://nominatim.org/release-docs/latest/
- Open-Meteo: https://open-meteo.com/en/docs
- OSRM: http://project-osrm.org/docs/v5.24.0/api/
- Frankfurter: https://www.frankfurter.app/docs/
- Amadeus (flights): https://developers.amadeus.com/ · Duffel: https://duffel.com/docs

## 8. Why each API
Gemini = reasoning/structured itinerary + chat. Overpass = real POIs & accommodations. Nominatim = destination→coords. Open-Meteo = forecast for weather-aware planning & warnings. OSRM = real travel times/route optimization. Frankfurter = currency conversion. Flight provider = real fares (opt-in).

## 9. Environment variables (names only — never commit secrets)
Backend `backend/.env`: `MONGO_URL`, `DB_NAME`, `JWT_SECRET`, `GOOGLE_API_KEY`, `AI_MODEL`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `FRONTEND_URL`. Optional: `AMADEUS_CLIENT_ID`, `AMADEUS_CLIENT_SECRET`, `AMADEUS_ENV`, `HOTEL_API_KEY`, `OVERPASS_MIRRORS`.
Frontend `frontend/.env`: `REACT_APP_BACKEND_URL`.

## 10. Authentication & guest-mode architecture
- **JWT** (bcrypt hashing, access+refresh tokens) set as httpOnly cookies **and** returned in the login/register body for Bearer use. `get_current_user` accepts either.
- **Google OAuth** (Emergent): SPA → `auth.emergentagent.com?redirect=<origin>/app` → returns `#session_id` → `AuthCallback` posts to `POST /api/auth/session` → backend exchanges server-side, upserts user, issues the **same** app JWT → uniform authorization.
- **Guest mode**: `/api/explore/*` require no auth. The SPA keeps guest trips in the browser (localStorage) until the user signs in to save. `AuthContext` skips `/me` on public routes to avoid 401 noise.

## 11. Hotel-data flow
`GET /api/explore/hotels` or `GET /api/trips/{id}/hotels` → geocode destination (`geocode_destination`) → `hotels_service.search_hotels()` builds an Overpass query for `tourism=hotel|guest_house|apartment|hostel|chalet|motel` (style-filtered) → normalizes name/coords/stars/amenities/website → computes **AI Match Score** (see §25) → sorts desc → UI `StaysTab.jsx`/`Explore.jsx` renders cards with score, reasons, distance, "Stay Like a Local" note. Pricing is `null` unless `HOTEL_API_KEY` is set (`pricing_available` flag). `POST /api/trips/{id}/hotel` persists `selected_hotel`.

## 12. Flight-data flow
`flights_service.search()` → if `FLIGHT_API_KEY` **unset** returns `{configured:false, message}` (honest, no fake data). If set, `_provider_search()` (implement per provider) returns offers `{price,currency,duration_min,stops,carrier,...}` → `_rank()` picks cheapest/fastest/best. `FlightsTab.jsx` shows either the not-connected card or the three ranked options.

## 13. Restaurant/place-data flow
`GET /api/explore/things-to-do` / `GET /api/places/search` → geocode → `places_service.search_places()` (Overpass by category via `CATEGORY_TAGS`) → normalized `{name,lat,lng,address,phone,website,opening_hours,cuisine}` → rendered in `Nearby.jsx` / `Explore.jsx` with a map.

## 14. Maps/routing-data flow
Client maps via Leaflet + OSM tiles (`TripMap.jsx`). Server routing via `routing_service`: `leg(a,b)` calls OSRM `/route/v1/driving`; on failure falls back to haversine + assumed speeds. `optimize_order()` = nearest-neighbour reorder. Used by Calendar (travel time/walking) and `POST /api/trips/{id}/optimize-route`.

## 15. Weather-data flow
`weather_service`: Nominatim/Open-Meteo geocode → Open-Meteo `forecast` (current + 7-day). `WeatherStrip.jsx` shows it; day summary uses the matching day for warnings. On upstream failure the API returns a clean 503 and the UI hides the strip / sets `weather:null`.

## 16. AI/Gemini architecture
`ai_service.py` calls Google's official `google-genai` async client with `AI_MODEL` and `GOOGLE_API_KEY`. JSON is extracted defensively (`_extract_json`) and validated/normalized (`_normalize_itinerary`) before persistence; generation retries once on invalid output.

## 17. Important prompts / system instructions
- `ITINERARY_SYSTEM`: "output ONLY valid JSON… realistic, geographically sensible… approximate real coordinates… never invent flight prices."
- `_itinerary_prompt`: injects destination, dates, travelers, budget, style, interests, pace, dietary, accessibility, **food/accommodation/walking/luxury/tourist-vs-local/vibe**; rules for activity count & respecting preferences.
- `EDIT_SYSTEM` + `edit_itinerary` prompt: "MODIFY the EXISTING itinerary… keep unaffected parts intact… return FULL updated JSON."
- `build_chat_system`: persona + injected trip context + recent history.
- Discovery/what-now prompts return labelled JSON estimates.

## 18. AI tools/function-calling
No provider-side function-calling. Instead a **deterministic orchestration**: routes gather DB + external data, pass compact JSON to Gemini, validate the JSON response, then write to Mongo. This is more reliable and testable than free-form tool calls.

## 19. Normalizing raw API responses before the AI
Each service converts provider JSON into small, typed dicts (e.g., hotels → name/coords/amenities/stars; itinerary activities → fixed schema with coerced numeric types and clamped categories). Only these normalized shapes reach the AI (chat context) or the client.

## 20. How the AI generates & updates itineraries
Generate: `POST /api/trips/{id}/generate` → `generate_itinerary(spec, num_days)` → normalized days → replace `activities`. Update: `POST /api/trips/{id}/ai-edit {instruction}` → loads current activities → `edit_itinerary()` returns the full revised plan → activities replaced, `summary` updated. Guests: `POST /api/explore/generate` returns days without persisting.

## 21. How the calendar works
`CalendarTab.jsx`: a day strip (dates derived from `start_date`) selects a `day_index`; it fetches `GET /api/trips/{id}/day/{i}/summary` and lists that day's activities; includes "Optimize route" and an embedded `AICommandBar`.

## 22. How "What's cooking today?" works
`routes_trip_ai.day_summary()` computes, for the chosen day: estimated spend (`Σ estimated_cost × travelers`), walking km + travel minutes (via `routing_service.legs_for_sequence`), reservations (food/accommodation activities), weather for that day (Open-Meteo), and **warnings** (rain ≥50%, packed day >6 activities, long walking >8km, over daily budget). Returned as a compact JSON headline + stats.

## 23. How hotel images are retrieved/displayed
Uses the OSM `image` tag when present; otherwise a deterministic **DestinationBanner** gradient (no broken images). Real per-hotel photography requires a licensed provider (documented). Destination imagery can be sourced from Wikipedia REST when needed.

## 24. How flight recommendations are ranked
`_rank()`: cheapest = min price, fastest = min duration, best = weighted blend (`0.6·price + 0.3·duration + 10·stops`). Only over **real** provider offers; never fabricated.

## 25. Hotel recommendations & AI Match Score
`hotels_service._match_score()` — deterministic 0–100 + reasons: base 55; +proximity to itinerary centroid/city; ± tourist-vs-local alignment (distance from centre); +amenity matches vs stated prefs; ± stars vs luxury level. Explainable `match_reasons` power the UI. Deterministic ⇒ testable, never hallucinated.

## 26. Personalized/local recommendations
`tourist_vs_local` (0–100) threads into the generation prompt (more local at higher values) and the hotel score ("Stay Like a Local" boosts residential stays). Interests/vibe/food prefs shape activities & dining.

## 27. Budget calculation & optimization
`GET /api/trips/{id}/budget`: budget, breakdown, estimated activity cost (`×travelers`), spent-by-category (from expenses), remaining, daily average, projected total. Optimization via `AICommandBar` "Make cheaper"/"Upgrade" → `ai-edit`. Group **settlements** via `GET /api/trips/{id}/settlements` (minimal-transaction greedy).

## 28. Weather-aware replanning
"Rainy day" chip (or free text) → `ai-edit` with the instruction; the prompt already knows to swap outdoor→indoor. Day summary surfaces rain warnings proactively.

## 29. Route optimization
`POST /api/trips/{id}/optimize-route?day_index=i` → nearest-neighbour reorder of that day's activities (haversine; OSRM for real legs), persisting `order`. Coordinate-less activities are appended with stable ordering.

## 30. How AI chat receives trip context
Authed: `routes_chat._build_trip_context()` compiles trip + per-day activities + budget into the system message; recent messages replayed for memory. Guest: `POST /api/explore/chat` accepts `{context, history}` from the client. Both stream via SSE.

## 31. How guest trips are temporarily stored
Guest generation returns the itinerary in the response; the SPA holds it in memory/localStorage and shows a "Create free account to save" CTA. Nothing is written server-side for guests.

## 32. What requires authentication & why
Persistent trips & sub-resources (activities, budget, expenses, packing, memories), AI-edit of a saved trip, hotel selection, documents (private), collaboration, notifications — all require auth so data is owned/isolated (`get_owned_trip`). Exploration, discovery, guest generation and chat do not.

## 33. Booking/affiliate flow
COCO does **not** book. It links out (hotel `website`, OSM map links, and — when a flight provider is configured — `deep_link`). No affiliate integration is claimed.

## 34. Error handling & fallbacks per external API
| API | Failure behaviour |
|-----|-------------------|
| Gemini | retry once → 502 with message |
| Overpass | 2 mirrors, 7s each → graceful `degraded:true` 200 (places/hotels) |
| Nominatim | returns None → 404 "couldn't find" |
| Open-Meteo | 503 with message; UI hides strip / `weather:null` |
| OSRM | falls back to haversine estimate (`source:"estimate"`) |
| Frankfurter | 502 with message |
| Flights | `configured:false` (no key) or `error:true` message |

Global FastAPI handler returns a generic 500 JSON (no stack traces to clients).

## 35. Rate limits, caching & performance
In-memory `rate_limit` on AI/expensive endpoints (chat, discovery, places, generate). Discovery cached 24h (`discovery_cache`). TanStack Query caches client-side with `enabled` gating and skeletons. Overpass timeouts kept short (7s) so degraded states render fast. Mongo indexes on hot paths; trip lists paginated.

## 36. Security
bcrypt hashing; JWT (httpOnly cookies + Bearer); brute-force lockout; CORS allow-list **+ preview-domain regex** with credentials; Pydantic validation; parameterized Mongo queries; secret-safe logging; owner/admin authorization on every trip resource; documents private per user; no secrets in frontend.

## 37. Request/response examples
```
POST /api/explore/generate            # guest, no auth
{ "destination":"Kyoto, Japan","start_date":"2026-10-01","end_date":"2026-10-02",
  "travelers":2,"interests":["food","culture"],"tourist_vs_local":70 }
→ { "num_days":2,"summary":"…","days":[{"day_index":0,"title":"…","activities":[
     {"title":"Fushimi Inari","lat":34.96,"lng":135.77,"start_time":"08:30",
      "duration_minutes":120,"estimated_cost":0,"category":"culture","transport":"metro"}]}] }

POST /api/trips/{id}/ai-edit          # auth (owner)
{ "instruction":"make it cheaper and reduce walking" }
→ { "summary":"Reduced cost by replacing private tours…","activities_created":9 }

GET /api/trips/{id}/day/0/summary     # auth
→ { "headline":"Clear sky, 24°C · 4 activities","estimated_spend":384,"currency":"EUR",
    "walking_km":3.1,"total_travel_min":42,"reservations":["Dinner …"],"warnings":[…] }

GET /api/explore/flights?origin=London&destination=Lisbon&date=2026-07-10
→ { "configured":false,"message":"Live flight search isn't connected…","offers":[] }
```

## 38. End-to-end user journey
Landing → **Explore** (search destination → things-to-do & stays with match scores → ask COCO → "Plan it" generates a free sample itinerary) → **Sign up** to save → **Create Trip** (personalization) → auto-generate → **TripDetail**: refine in Itinerary (AI command bar), review **Calendar** ("What's cooking today?"), pick a **Stay** (match score), check **Flights**, manage **Budget/Expenses**, **Optimize route**, **Travel Mode** on the road.

## 39. Setup (new developer)
```
# Backend
cd backend && pip install -r requirements.txt && cp .env.example .env  # fill secrets
uvicorn server:app --reload --port 8001
# Frontend
cd frontend && yarn install && cp .env.example .env  # set REACT_APP_BACKEND_URL
yarn start
```
Or `docker compose up --build`. Health: `GET /api/health`.

## 40. Deployment
Frontend → Vercel/Netlify (`yarn build`). Backend → Render/Railway/Fly (uvicorn/gunicorn). DB → MongoDB Atlas. Set all env vars; `FRONTEND_URL` must match the frontend origin (cookies are Secure+SameSite=None → HTTPS both sides). Point platform health check at `/api/health`.

## 41. Testing strategy
- Unit: `backend/tests/test_business_logic.py` (JSON extraction, itinerary normalization, settlement math).
- Regression/feature: `test_regression_2.py`, `test_upgrade_3.py` (public explore, trip-AI, auth/ownership, personalization).
- E2E: automated UI flows (guest explore, calendar/stays/flights tabs, AI command bar, create-trip). Test the fallbacks (degraded states) too.

## 42. Known limitations
Overpass/Open-Meteo can be blocked/rate-limited from shared IPs → graceful degraded states (works in normal deployments). No live flight/hotel prices without provider keys. Document vault stores metadata only (no object storage). Reset links logged to console (no email provider). Calendar uses native date inputs.

## 43. Future improvements
Connect a flight/hotel pricing provider; object storage for documents + hotel photos; email delivery; itinerary PDF/calendar export; multi-currency settlement normalization; realtime collaboration; offline/PWA travel mode.

## 44. "If you need to change X, edit Y"
| Change | Edit |
|--------|------|
| Itinerary prompt / structure | `backend/app/services/ai_service.py` (`ITINERARY_SYSTEM`, `_itinerary_prompt`, `_normalize_itinerary`) |
| AI edit behaviour | `ai_service.edit_itinerary` + `routes_trip_ai.ai_edit` |
| Hotel match score | `hotels_service._match_score` |
| Add hotel pricing provider | `hotels_service` + set `HOTEL_API_KEY` |
| Connect flights | `flights_service._provider_search` + `FLIGHT_API_KEY` |
| Add place category | `places_service.CATEGORY_TAGS` |
| Weather logic/warnings | `weather_service` + `routes_trip_ai.day_summary` |
| Routing/optimization | `routing_service` |
| Guest endpoints | `routes_explore.py` |
| Auth/session rules | `routes_auth.py`, `core/security.py`, `api/deps.py` |
| CORS/origins | `server.py` (regex) + `core/config.py` |
| DB collections/indexes | `db/mongo.py` |
| New page/route | `frontend/src/App.js` + `src/pages/*` |
| API client functions | `frontend/src/services/api.js` |
| Trip tabs | `frontend/src/pages/TripDetail.jsx` + `components/trip/*` |
| Explore/guest UI | `frontend/src/pages/Explore.jsx` |
| Theme/colors/fonts | `frontend/tailwind.config.js`, `src/index.css` |

---

## SYSTEM MAP
```
USER → FRONTEND (React SPA: Explore/TripDetail/Calendar/Chat)
     → BACKEND (FastAPI routers)
     → EXTERNAL APIs (Gemini · OSM Overpass/Nominatim · Open-Meteo · OSRM · Frankfurter · [Flight provider])
     → NORMALIZER (per-service typed dicts; JSON extract+validate)
     → AI ORCHESTRATOR (ai_service: generate / edit / chat with injected context)
     → DATABASE (MongoDB: users, trips, activities, expenses, chat, …)
     → CALENDAR / MAP / UI (day summary, Leaflet map, match scores, budgets)
```
