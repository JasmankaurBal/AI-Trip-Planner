LOCAL-ONLY FILE — DO NOT COMMIT OR PUSH

# COCO Trip Planner: Local API Migration Audit

Audit date: 2026-08-22

## Executive finding

The AI path was backend -> `emergentintegrations` -> Gemini using `EMERGENT_LLM_KEY`. It is now backend -> Google's official `google-genai` client -> Gemini using `GOOGLE_API_KEY`; `AI_MODEL` remains configurable and defaults to `gemini-3-flash-preview`. Itinerary generation, AI edits, discovery, what-now, and SSE chat continue to enter through the existing routes and service functions.

Google OAuth remains Emergent-managed and was deliberately not migrated. Email/password JWT authentication is already local to this backend.

## Emergent-related files discovered

- `backend/app/services/ai_service.py`: Emergent LLM import and key usage; changed to official Google GenAI.
- `backend/app/core/config.py`: `EMERGENT_LLM_KEY`; changed to `GOOGLE_API_KEY`.
- `backend/requirements.txt`: `emergentintegrations` and an Emergent-hosted `litellm` wheel; both removed.
- `docker-compose.yml`: Emergent AI variable; changed to `GOOGLE_API_KEY`.
- `backend/app/api/routes_auth.py`: Emergent OAuth session URL and session exchange; retained.
- `frontend/src/components/GoogleButton.jsx`: Emergent OAuth redirect; retained.
- `frontend/src/components/AuthCallback.jsx`, `frontend/src/App.js`, `frontend/src/context/AuthContext.js`: session-id callback flow; retained because it supports current Google sign-in.
- `backend/app/api/deps.py`: fallback for stored Emergent OAuth session tokens; retained with OAuth flow.
- `backend/server.py`: Emergent preview CORS origin and generated test-credential comment; retained for existing preview/auth behavior.
- Documentation and test reports contain historical or current Emergent descriptions; not all references should be deleted.
- Root `.gitconfig` contains Emergent author metadata. It was not modified, per request.

## Emergent-related environment variables

- `EMERGENT_LLM_KEY`: removed from the runnable backend AI path. Replace with `GOOGLE_API_KEY`.
- No OAuth secret is currently read by this backend; OAuth is delegated to Emergent's hosted flow.

## AI request flow

- Authenticated itinerary: frontend `frontend/src/services/api.js` -> `POST /api/trips/{id}/generate` -> `backend/app/api/routes_trips.py` -> `backend/app/services/ai_service.py` -> Google GenAI `generate_content` -> normalized itinerary stored by the route.
- AI edit: `frontend/src/services/api.js` -> `POST /api/trips/{id}/ai-edit` -> `backend/app/api/routes_trip_ai.py` -> `edit_itinerary` -> Google GenAI -> normalized plan.
- Authenticated chat: frontend chat UI/API -> `POST /api/chat` -> `backend/app/api/routes_chat.py` -> `chat_stream` -> Google GenAI streaming -> SSE. Messages remain persisted in MongoDB.
- Guest generation/discovery/what-now use `routes_explore.py` or `routes_data.py` and the same AI service.
- This is architecture B: frontend -> backend -> Google Gemini directly.

## APIs that remain unchanged

- MongoDB, local JWT/password auth, and all application routes.
- OpenStreetMap Nominatim and Overpass for geocoding, places, hotels, and emergency results.
- Open-Meteo for weather and geocoding/autocomplete.
- OSRM for routing with haversine fallback.
- Frankfurter for currency conversion.
- Amadeus flight search abstraction, when configured.
- Leaflet/OSM client maps.

## Keys to provide

| Variable | Purpose | Required? | Emergent-managed? | Read by |
|---|---|---:|---:|---|
| `MONGO_URL` | MongoDB connection | Yes | No | `backend/app/core/config.py`, `backend/app/db/mongo.py` |
| `DB_NAME` | Database name | Yes | No | `backend/app/core/config.py` |
| `JWT_SECRET` | Signs application JWTs | Yes | No | `backend/app/core/config.py`, security code |
| `FRONTEND_URL` | Backend CORS allow-list | Yes for deployment | No | `backend/app/core/config.py`, `backend/server.py` |
| `GOOGLE_API_KEY` | Direct Gemini API access for itinerary, edits, discovery, what-now, and chat | Yes for AI only | No, after migration | `backend/app/core/config.py`, `backend/app/services/ai_service.py` |
| `AI_MODEL` | Gemini model ID | No, default retained | No | `backend/app/core/config.py`, `backend/app/services/ai_service.py` |
| `AMADEUS_CLIENT_ID` | Live flight API OAuth client | Optional | No | `backend/app/services/flights_service.py` |
| `AMADEUS_CLIENT_SECRET` | Live flight API OAuth secret | Optional | No | `backend/app/services/flights_service.py` |
| `AMADEUS_ENV` | Amadeus test/production selection | Optional | No | `backend/app/services/flights_service.py` |
| `HOTEL_API_KEY` | Future/commercial hotel pricing provider flag | Optional; no pricing integration is implemented | No | `backend/app/services/hotels_service.py` |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Optional local admin seed | Optional | No | `backend/app/core/config.py`, `backend/server.py` |
| `REACT_APP_BACKEND_URL` | Frontend API base URL | Yes for frontend build | No | `frontend/src/api/client.js` |

Google OAuth currently does not require user-provided Google client credentials because the browser redirects to Emergent and the backend exchanges the returned session ID at Emergent's endpoint. Replacing it requires a new Google OAuth client ID/secret, redirect URI configuration, frontend authorization-code or PKCE flow, backend code-token exchange and ID-token validation, user upsert, and removal/replacement of the session-token fallback. Those changes were not made.

## Environment variables to add to `backend/.env`

Required for AI:

`GOOGLE_API_KEY=your_google_api_key_here`

Retain the existing required local values:

`MONGO_URL=...`
`DB_NAME=...`
`JWT_SECRET=...`
`FRONTEND_URL=http://localhost:3000`
`AI_MODEL=gemini-3-flash-preview`

Optional:

`AMADEUS_CLIENT_ID=your_amadeus_client_id_here`
`AMADEUS_CLIENT_SECRET=your_amadeus_client_secret_here`
`AMADEUS_ENV=test`
`HOTEL_API_KEY=your_hotel_api_key_here`
`ADMIN_EMAIL=...`
`ADMIN_PASSWORD=...`

Do not add real values to this file or source control.

## Safe cleanup status

### SAFE TO REMOVE

- `emergentintegrations==0.2.0` from `backend/requirements.txt`.
- The Emergent-hosted `litellm` wheel from `backend/requirements.txt`; no remaining runtime import uses it after the AI migration.

### MUST KEEP

- Emergent OAuth files and session handling until Google OAuth is independently implemented.
- Existing non-Emergent provider services and fallbacks.
- `AI_MODEL`, streaming SSE, JSON normalization, retries, and Mongo conversation persistence.

### REPLACE

- AI client/key path was replaced with official Google GenAI and `GOOGLE_API_KEY`.

### UNCERTAIN / NOT DELETED

- `server/` and its `.env.example` were not deleted without a repository history/runtime check. They appear separate from the FastAPI/Docker path and should be reviewed manually.
- Historical docs, reports, and comments were not mass-deleted.

## Files changed

- `backend/app/core/config.py`
- `backend/app/services/ai_service.py`
- `backend/requirements.txt`
- `docker-compose.yml`
- `backend/.env.example`
- `LOCAL_API_MIGRATION_AUDIT.md`
- `.git/info/exclude` could not be updated because this workspace has no `.git` directory.

## Files deleted

None.

## Remaining Emergent dependency

Google OAuth and its hosted session exchange remain dependent on Emergent. The backend also allows Emergent preview CORS origins. The root `.gitconfig` contains historical author metadata and was intentionally left unchanged.

## Manual steps

1. Create `backend/.env` from `backend/.env.example` and provide local Mongo/JWT values plus `GOOGLE_API_KEY`.
2. Install `backend/requirements.txt` in the backend environment so `google-genai` is available.
3. Verify Gemini model availability for the configured `AI_MODEL` in the Google project.
4. Configure Amadeus credentials only if live flights are wanted.
5. Decide whether to independently implement Google OAuth; do not remove the current OAuth flow before that replacement is tested.
6. Because no `.git` directory exists here, add `LOCAL_API_MIGRATION_AUDIT.md` to `.git/info/exclude` after initializing or attaching the repository locally.
