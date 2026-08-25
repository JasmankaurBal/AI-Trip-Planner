# COCO — PROJECT DOCUMENTATION

_Single-file SRS + technical specification + developer handbook. This describes the **actual** implemented system._

---

## 1. Project Overview

**What COCO is.** COCO is an AI trip planner and travel companion. Users describe a destination and a few preferences; COCO generates a structured, editable day-by-day itinerary with real coordinates, then supports the whole journey with maps, weather, budgets, expenses, a context-aware chat companion and a travel-ready mobile mode.

**Why it exists.** Trip planning is fragmented across many tabs and apps. COCO unifies planning and on-the-road support into one calm, human product.

**Target users.** Independent travellers, couples, families and small groups who want a smart starting itinerary they can control.

**Core problem.** Turning a vague idea ("5 days in Lisbon, we like food and culture") into a realistic, geographically sensible plan — and keeping it useful while travelling.

**Core solution.** AI generates validated structured data (not free-form text); the backend owns all business logic; real keyless data sources power maps/weather/places so nothing is faked.

**Product vision.** A companion, not a corporate assistant — friendly, intelligent, calm, adventurous, helpful.

---

## 2. Objectives

1. Generate a valid multi-day itinerary in under ~20s with ≥3 activities/day and real coordinates.
2. Persist all trip data so users resume seamlessly across sessions/devices.
3. Enforce that users only access their own (or shared) trips.
4. Use only real data or clearly-labelled AI estimates — never fabricated prices/reviews.
5. Fully responsive, mobile-first, no horizontal overflow from 320px up.

---

## 3. Scope

### In scope (implemented)
Auth (email/password JWT + Google OAuth), trips CRUD, AI generation + validation, itinerary edit/reorder/regenerate, interactive map, budget, group expenses + settlements, persistent streaming chat, discovery (AI estimates), nearby/local search (OSM), "what can I do now", travel mode, packing list, document-metadata vault, collaboration (invite/ideas/votes), optimizer (recommendations), memories, weather, currency conversion, notifications, health check.

### Out of scope (intentionally)
Real flight/hotel booking & prices; uploading document binaries (needs object storage — only metadata stored); real-time collaborative editing/websockets; push notifications; payment processing.

---

## 4. Functional Requirements

| ID | Requirement | Expected behaviour | Priority |
|----|-------------|--------------------|----------|
| FR-001 | User registration | Create account with hashed password, issue session | P0 |
| FR-002 | User login | Verify credentials, brute-force lockout, issue session | P0 |
| FR-003 | Google OAuth | Exchange Emergent session_id → unified JWT session | P1 |
| FR-004 | Create trip | Persist trip with validation (dates, travelers) | P0 |
| FR-005 | AI generate itinerary | Structured JSON, validated/normalized, saved as activities | P0 |
| FR-006 | Edit/add/delete activity | CRUD on activities scoped to owner | P0 |
| FR-007 | Reorder activities | Persist order per day | P1 |
| FR-008 | Regenerate itinerary | Replace activities via AI | P1 |
| FR-009 | Budget summary | Compute spent/remaining/projected/daily avg | P0 |
| FR-010 | Expenses CRUD | Log expenses by category | P0 |
| FR-011 | Settlements | Minimal-transaction group settlement | P1 |
| FR-012 | Chat (streaming) | Trip-aware SSE chat, persisted | P0 |
| FR-013 | Discovery | AI destination suggestions (labelled), cached 24h | P2 |
| FR-014 | Nearby search | Real POIs via Overpass by category | P1 |
| FR-015 | What-can-I-do-now | Suggestions from location+time+weather | P2 |
| FR-016 | Travel mode | Simplified mobile UI + emergency lookup | P1 |
| FR-017 | Packing list | Auto-generate + CRUD + persist | P2 |
| FR-018 | Document vault | Metadata CRUD, private per user | P2 |
| FR-019 | Collaboration | Invite members, suggestions, votes | P2 |
| FR-020 | Optimizer | Analyse & recommend, never silent edits | P2 |
| FR-021 | Memories | Timeline entries per trip | P3 |
| FR-022 | Weather | 7-day forecast via Open-Meteo | P1 |
| FR-023 | Health check | Report API + DB status | P0 |

---

## 5. Non-Functional Requirements

- **NFR-001 Performance** — TanStack Query caching, debounced/enabled queries, discovery cache (24h), lean payloads. AI calls retried once max.
- **NFR-002 Security** — bcrypt hashing, JWT (httpOnly cookies + Bearer), per-resource authorization, CORS allow-list, input validation, rate limiting on AI/expensive endpoints, secret-safe logging.
- **NFR-003 Scalability** — stateless API, async Motor driver, MongoDB indexes on hot paths, pagination on trip lists.
- **NFR-004 Availability** — external services degrade gracefully (weather/places return clear errors, not crashes).
- **NFR-005 Maintainability** — modular backend packages, thin frontend pages over a typed API layer.
- **NFR-006 Usability** — mobile-first, bottom nav, comfortable touch targets, loading/empty/error states everywhere.
- **NFR-007 Accessibility** — focus rings, `prefers-reduced-motion`, WCAG-AA-oriented palette, semantic labels.
- **NFR-008 Reliability** — global exception handler returns consistent JSON; AI output validated before persistence.
- **NFR-009 Compatibility** — modern evergreen browsers; responsive 320px–1440px+.
- **NFR-010 Privacy** — documents private per user; no logging of secrets/tokens/document contents.

---

## 6. User Roles

| Role | Permissions |
|------|-------------|
| Guest | View landing page; register/login. |
| Authenticated user | Full CRUD on own trips and sub-resources; use AI, chat, discovery, nearby, docs. |
| Trip member | View a shared trip; add expenses, suggestions, votes. Cannot edit core trip or delete. |
| Owner | All member rights + edit trip, budget, invite/remove members, delete trip. |
| Admin | Seeded account (role `admin`); same API surface, elevated write override. |

---

## 7. Technology Stack

| Technology | Purpose | Version |
|------------|---------|---------|
| React | Frontend SPA | 18 |
| React Router | Routing | 6 |
| TanStack Query | Server-state/caching | 5 |
| Tailwind CSS | Styling | 3 |
| Framer Motion | Motion | 11 |
| Leaflet / react-leaflet | Maps | 1.9 / 4 |
| Recharts | Budget charts | 2 |
| Phosphor Icons | Icons | 2 |
| Python | Backend language | 3.11 |
| FastAPI | API framework | 0.110 |
| Motor | Async MongoDB driver | 3.3 |
| Pydantic | Validation | 2 |
| PyJWT / bcrypt | Auth | 2 / 4 |
| MongoDB | Database | 7 |
| google-genai | Official Google Gemini API client | 2.18.1 |
| Open-Meteo / OpenStreetMap / Frankfurter | Weather / maps+places / currency | keyless APIs |

---

## 8. Programming Languages

- **Frontend:** JavaScript (JSX, React).
- **Backend:** Python 3.11.
- **Database/query:** MongoDB (BSON) via Motor.
- **Config:** dotenv (`.env`), YAML (docker-compose), JSON (package/manifest).
- **Markup/style:** HTML5, Tailwind CSS, PostCSS.

---

## 9. Architecture

```
        User (mobile-first browser)
                 │
        React SPA (React Router, TanStack Query)
                 │  REST /api  (Bearer token + httpOnly cookies)
                 ▼
            FastAPI app  (server.py)
                 │  routers → services (business logic)
                 ▼
        ┌────────────────────────────┐
        │  MongoDB (Motor, indexed)  │
        └────────────────────────────┘
                 │
        External APIs / AI layer
   Gemini · OpenStreetMap (Nominatim/Overpass) · Open-Meteo · Frankfurter
```

The AI layer never returns free-form itinerary text to the client: it produces JSON that the backend validates & normalizes before persistence.

---

## 10. Folder Structure (key files)

```
COCO/
├── backend/
│   ├── server.py                     → FastAPI entry; CORS, routers, startup (indexes, admin seed)
│   ├── requirements.txt
│   ├── .env.example
│   └── app/
│       ├── core/config.py            → env-driven Settings
│       ├── core/security.py          → bcrypt hashing + JWT create/decode
│       ├── core/logging.py           → secret-safe logger
│       ├── core/ratelimit.py         → in-memory limiter dependency
│       ├── db/mongo.py               → Motor client, get_db, ensure_indexes
│       ├── models/common.py          → PyObjectId, BaseDocument, utcnow
│       ├── schemas/*.py              → Pydantic request/response models
│       ├── services/ai_service.py    → Gemini itinerary generation + chat + discovery/what-now
│       ├── services/weather_service.py  → Open-Meteo
│       ├── services/places_service.py   → Nominatim + Overpass
│       ├── services/currency_service.py → Frankfurter
│       └── api/
│           ├── deps.py               → get_current_user, ownership checks
│           ├── routes_auth.py        → register/login/session/me/refresh/logout/reset
│           ├── routes_trips.py       → trips CRUD, generate, optimize, budget, memories
│           ├── routes_activities.py  → activities CRUD, reorder, packing
│           ├── routes_expenses.py    → expenses CRUD + settlements
│           ├── routes_chat.py        → SSE streaming chat
│           ├── routes_data.py        → weather/places/geocode/currency/discovery/emergency/what-now/saved-places
│           ├── routes_documents.py   → document metadata vault
│           ├── routes_collab.py      → members/invite/suggestions/votes
│           ├── routes_notifications.py
│           └── routes_health.py
├── frontend/
│   └── src/ (api, services, context, components, layouts, pages, hooks, utils)
├── docs/PROJECT_DOCUMENTATION.md
├── docker-compose.yml
└── README.md
```

---

## 11. Database Design (MongoDB)

| Collection | Purpose | Key fields | Indexes |
|-----------|---------|-----------|---------|
| `users` | Accounts | email, password_hash, name, role, auth_provider, picture | `email` (unique) |
| `trips` | Trips | owner_id, member_ids[], destination, start/end_date, budget, currency, status, summary, budget_breakdown | `(owner_id, created_at)`, `member_ids` |
| `activities` | Itinerary items | trip_id, day_index, order, title, lat/lng, category, estimated_cost, duration_minutes | `(trip_id, day_index, order)` |
| `expenses` | Expenses | trip_id, amount, currency, category, payer, split_between[], date | `(trip_id, date)` |
| `chat_conversations` | Chat threads | user_id, trip_id, title, updated_at | `(user_id, trip_id)` |
| `chat_messages` | Messages | conversation_id, role, content, created_at | `(conversation_id, created_at)` |
| `saved_places` | Saved POIs | user_id, name, lat/lng, category | `(user_id)` |
| `travel_documents` | Doc metadata | user_id, trip_id, name, doc_type, expiry_date, number | `(user_id, trip_id)` |
| `notifications` | Feed | user_id, type, message, read | `(user_id, created_at)` |
| `trip_memories` | Memories | trip_id, title, note, favorite_places[] | `trip_id` |
| `packing_items` | Packing list | trip_id, name, category, checked | `(trip_id)` |
| `trip_suggestions` | Group ideas | trip_id, text, author, votes[] | — |
| `discovery_cache` | AI discovery cache | category, destinations[], created_at | — |
| `login_attempts` | Brute-force | identifier, count, locked_until | `identifier` |
| `password_reset_tokens` | Resets | token, user_id, expires_at, used | `expires_at` (TTL) |
| `user_sessions` | Google sessions | user_id, session_token, expires_at | — |

**Relationships:** `trips.owner_id`/`member_ids` → `users`; `activities/expenses/... .trip_id` → `trips`; `chat_messages.conversation_id` → `chat_conversations`.

---

## 12. API Documentation

All routes are prefixed with `/api`. Auth via httpOnly cookie or `Authorization: Bearer <token>`. Errors return `{"detail": "..."}`.

### Auth
| Method | Endpoint | Auth | Body / Notes |
|--------|----------|------|--------------|
| POST | /auth/register | ⬜ | `{name,email,password}` |
| POST | /auth/login | ⬜ | `{email,password}` |
| POST | /auth/session | ⬜ | `{session_id}` (Google) |
| GET | /auth/me | ✅ | current user |
| POST | /auth/refresh | cookie | new access token |
| POST | /auth/logout | ✅ | clears cookies |
| POST | /auth/forgot-password | ⬜ | `{email}` |
| POST | /auth/reset-password | ⬜ | `{token,password}` |

### Trips
`GET /trips` · `POST /trips` · `GET /trips/{id}` · `PUT /trips/{id}` · `DELETE /trips/{id}` ·
`POST /trips/{id}/generate` · `POST /trips/{id}/optimize` · `GET|PUT /trips/{id}/budget` ·
`GET|POST /trips/{id}/memories` — all ✅ and ownership-checked.

### Activities & Packing
`GET|POST /trips/{id}/activities` · `PUT|DELETE /trips/{id}/activities/{aid}` · `POST /trips/{id}/activities/reorder` ·
`GET|POST /trips/{id}/packing` · `PUT|DELETE /trips/{id}/packing/{pid}` · `POST /trips/{id}/packing/generate`.

### Expenses
`GET|POST /trips/{id}/expenses` · `PUT|DELETE /trips/{id}/expenses/{eid}` · `GET /trips/{id}/settlements`.

### Chat
`POST /chat` (SSE stream) · `GET /chat` · `GET /chat/{conversation_id}` · `DELETE /chat/{conversation_id}`.

### Data / services
`GET /weather` · `GET /geocode` · `GET /places/search` · `GET /currency/convert` · `GET /currency/rates` ·
`GET /discovery` · `GET /emergency` · `POST /what-now` · `GET|POST /saved-places` · `DELETE /saved-places/{id}`.

### Collaboration & Notifications
`GET /trips/{id}/members` · `POST /trips/{id}/invite` · `DELETE /trips/{id}/members/{mid}` ·
`GET|POST /trips/{id}/suggestions` · `POST /trips/{id}/suggestions/{sid}/vote` ·
`GET /notifications` · `POST /notifications/{id}/read` · `POST /notifications/read-all`.

### Documents & System
`GET|POST /documents` · `DELETE /documents/{id}` · `GET /health`.

---

## 13. Environment Variables

| Variable | Purpose | Required | Where used |
|----------|---------|----------|-----------|
| MONGO_URL | DB connection | ✅ | backend/db |
| DB_NAME | DB name | ✅ | backend/db |
| JWT_SECRET | Sign tokens | ✅ | backend/security |
| GOOGLE_API_KEY | Direct Gemini access | ✅ (AI) | backend/ai_service |
| AI_MODEL | Model id | ⬜ | backend/ai_service |
| ADMIN_EMAIL / ADMIN_PASSWORD | Seed admin | ⬜ | backend startup |
| FRONTEND_URL | CORS origin | ✅ | backend CORS |
| REACT_APP_BACKEND_URL | API base | ✅ | frontend |

No secret values are committed. Maps/weather/currency require no keys.

---

## 14. AI Architecture

- **Provider/model:** Gemini `gemini-3-flash-preview` via Google's official `google-genai` client and `GOOGLE_API_KEY`.
- **Prompt strategy:** Strict system prompt demanding JSON-only, geographically sensible plans with real coordinates and no fabricated prices.
- **Structured output:** Response parsed via a fenced/loose JSON extractor, then `_normalize_itinerary` coerces types, clamps categories, drops invalid activities.
- **Validation:** Backend rejects empty/invalid days and retries generation once before returning a 502 with a clear message.
- **Context management (chat):** Recent conversation + a compact trip context (days, activities, budget) are injected into the system message so COCO understands "make day 2 cheaper".
- **Conversation memory:** Persisted in `chat_conversations`/`chat_messages`; the in-memory LLM thread is not relied upon across requests.
- **Streaming:** SSE (`text/event-stream`, `X-Accel-Buffering: no`) token-by-token.
- **Rate limiting:** discovery/what-now/places limited per IP.

---

## 15. External APIs

| API | Purpose | Feature | Env var | Fallback |
|-----|---------|---------|---------|----------|
| Gemini (Google) | Itinerary + chat + discovery | AI | GOOGLE_API_KEY | 502 with clear message if unset |
| OpenStreetMap Nominatim | Geocoding | Nearby / What-now | — | 404 if not found |
| OpenStreetMap Overpass | POI search | Nearby / Emergency | — | empty list on failure |
| Open-Meteo | Weather forecast | Trip/Travel mode | — | strip hidden if unavailable |
| Frankfurter (ECB) | Currency conversion | Budget/expenses | — | 502 on failure |

---

## 16. Authentication & Authorization

- **Registration/login:** email normalized, bcrypt hash, brute-force lockout, JWT issued as httpOnly cookies (+ body token).
- **Google:** frontend redirects to `auth.emergentagent.com`; callback posts `session_id` to `/auth/session`; backend exchanges it server-side, finds/creates the user, stores the Emergent `session_token`, and issues the **same** app JWT so all routes authorize uniformly.
- **Tokens:** access (1 day) + refresh (7 days).
- **Protected routes:** `get_current_user` validates JWT (or a stored Google session_token fallback) and loads the user.
- **Trip ownership/collaboration:** `get_owned_trip` enforces owner-or-member access; write-sensitive actions require ownership.

---

## 17. Security

- Secret management via env only; `.env` git-ignored; `.env.example` documents keys.
- CORS allow-list from `FRONTEND_URL`; `allow_credentials=True`.
- Pydantic validation on all request bodies/params; Mongo queries parameterized (no injection).
- Rate limiting on AI/expensive endpoints.
- Secret-safe logging (no passwords/tokens/document contents).
- XSS-safe React rendering; documents are private per user.

---

## 18. Performance

- Frontend: TanStack Query caching + `enabled` gating, skeletons, image lazy loading, memoized derived data.
- Backend: async I/O, MongoDB indexes on hot paths, discovery cached 24h, list pagination.
- AI: single retry cap; discovery cache prevents repeat calls.

---

## 19. Error Handling

- **Backend:** consistent `{"detail"}` errors; global handler returns a generic 500 (no stack traces to clients); external-service failures mapped to 502 with human messages.
- **Frontend:** `apiError()` flattens FastAPI 422 arrays to strings; every network view has loading/empty/error/retry states; toasts for actions.

---

## 20. Testing Strategy

- **Unit (backend):** `backend/tests/test_business_logic.py` — JSON extraction, itinerary normalization, settlement math (no DB/network).
- **API:** curl flows in `auth_testing.md`; `/api/health`.
- **Integration/E2E:** automated UI testing of auth, trip creation + AI generation, itinerary editing, budget/expenses, chat, maps, responsive behaviour.
- **Manual:** responsive checks at 320/375/390/430/768/1024/1440px.

---

## 21. Deployment

- **Frontend:** build (`yarn build`) → Vercel/Netlify; set `REACT_APP_BACKEND_URL`.
- **Backend:** uvicorn/gunicorn on Render/Railway/Fly; set all env vars; `FRONTEND_URL` must match the deployed frontend origin for CORS.
- **Database:** MongoDB Atlas; set `MONGO_URL`/`DB_NAME`.
- **CORS/cookies:** cookies are `Secure`+`SameSite=None`, so both origins must be HTTPS.
- **Health:** point the platform health check at `/api/health`.

---

## 22. Local Development

```bash
# Backend
cd backend && pip install -r requirements.txt
cp .env.example .env
uvicorn server:app --reload --port 8001

# Frontend
cd frontend && yarn install
cp .env.example .env
yarn start
```

---

## 23. Production Build

```bash
cd frontend && yarn build          # static assets → frontend/build
cd backend  && uvicorn server:app --host 0.0.0.0 --port 8001
# or: docker compose up --build
```

---

## 24. Known Limitations

- Document vault stores **metadata only** (no file upload — needs a secure object-storage provider).
- Flight/hotel prices and live availability are intentionally not implemented (no booking API).
- Discovery destinations are **AI estimates**, clearly labelled; not verified listings.
- Collaboration is asynchronous (no realtime editing/websockets).
- Password-reset links are logged to the backend console (no email provider configured).

---

## 25. Future Improvements

Object storage for document files; email delivery (reset/invites); realtime collaboration; offline/PWA travel mode; richer optimizer that proposes concrete reordering; export itinerary to PDF/calendar; multi-currency expense normalization in settlements.

---

## 26. Change Log

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-06 | Initial production build: auth (JWT + Google), AI itineraries, itinerary/map/budget/expenses, chat, discovery, nearby, what-now, travel mode, packing, documents, collaboration, optimizer, memories, weather, docs. |
