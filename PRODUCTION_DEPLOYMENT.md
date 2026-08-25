# COCO Production Deployment

## Architecture

- Frontend: React SPA, deploy to Vercel or another static host.
- Backend: FastAPI/Uvicorn, deploy to Render, Railway, Fly.io, or equivalent.
- Database: MongoDB Atlas.
- OAuth: Google OAuth authorization-code flow handled by FastAPI.
- Email: Resend transactional email API.
- AI: Google Gemini API.

## Required services

| Variable | Provider | Location | Secret | Purpose |
|---|---|---|---|---|
| `MONGO_URL` | MongoDB Atlas | Backend | Yes | Database connection |
| `JWT_SECRET` | Generated locally | Backend | Yes | Signs sessions; use 32+ random characters |
| `GOOGLE_CLIENT_ID` | Google Cloud | Backend | No | OAuth client identifier |
| `GOOGLE_CLIENT_SECRET` | Google Cloud | Backend | Yes | OAuth code exchange |
| `GOOGLE_REDIRECT_URI` | Google Cloud/backend | Backend | No | Exact callback URL |
| `RESEND_API_KEY` | Resend | Backend | Yes | Sends password reset mail |
| `EMAIL_FROM` | Resend verified domain | Backend | No | Verified sender address |
| `GOOGLE_API_KEY` | Google AI Studio | Backend | Yes | Gemini features |
| `REACT_APP_BACKEND_URL` | Your deployed backend | Frontend | No | Public API base URL |

Never put backend variables in frontend `.env` files.

## Manual setup required

1. Create a MongoDB Atlas cluster, database user, and network access rule; place its connection string in `MONGO_URL`.
2. Generate `JWT_SECRET` with `python -c "import secrets; print(secrets.token_urlsafe(48))"`.
3. Create a Google Cloud OAuth web client. Add `http://localhost:8001/api/auth/google/callback` and the deployed backend callback as authorized redirect URIs.
4. Create a Resend account, verify a sending domain or address, and create `RESEND_API_KEY`.
5. Create a Google AI Studio key for `GOOGLE_API_KEY`.
6. Copy `backend/.env.example` to `backend/.env` and fill placeholders. Copy `frontend/.env.example` to `frontend/.env`.
7. Deploy the backend and set its environment variables in the hosting provider.
8. Set `REACT_APP_BACKEND_URL` to the deployed backend URL and deploy the frontend.
9. Set production `FRONTEND_URL`, `ALLOWED_ORIGINS`, `GOOGLE_REDIRECT_URI`, `COOKIE_SECURE=true`, and `COOKIE_SAMESITE=lax`.
10. Test registration, login, logout, Google login, password reset email, trip creation, and AI features.

## Google OAuth

The browser starts `GET /api/auth/google/start`. The backend stores a short-lived CSRF state cookie, exchanges the authorization code server-side, validates Google userinfo including `email_verified`, creates or links the local user, then sets HTTP-only COCO cookies and redirects to `/app`. The callback URL must match Google Cloud exactly.

## Resend

Password reset tokens are generated with `secrets`, hashed with SHA-256 before MongoDB storage, expire after one hour, and are invalidated after use. Configure a verified `EMAIL_FROM`; no Gmail SMTP is used. If Resend is not configured, the endpoint remains generic but no email can be delivered, so configure it before production.

## Local commands

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

In another terminal:

```powershell
cd frontend
yarn install
copy .env.example .env
yarn start
```

## Docker

`docker compose up --build` remains a local stack. Set `JWT_SECRET` in the shell or a local ignored `.env`; secrets are not baked into images. For production, use the hosting provider's process command `uvicorn server:app --host 0.0.0.0 --port $PORT` and do not enable reload.

## Smoke test

- Register, login, invalid login, refresh, logout, and `/api/auth/me`
- Google login for a new account and an existing password account
- Forgot password returns the same generic response for known and unknown email
- Receive reset email; verify expired and reused tokens fail
- Create and persist a trip; exercise Gemini features
- Verify HTTPS cookies, CORS, mobile frontend, and deployed API URL

## Remaining risks and decisions

- `MANUAL DECISION REQUIRED`: choose and configure the production backend host, frontend domain, MongoDB Atlas network policy, and verified Resend sender domain.
- Google OAuth and Resend delivery require live provider credentials and cannot be fully verified offline.
- The current project has legacy historical Emergent references in documentation/tests; runtime authentication no longer uses Emergent. Review or archive those historical reports before publishing if you want a completely Emergent-free repository search.
- Run the full integration tests against a disposable MongoDB instance before production; tests that require external services need provider credentials or mocks.
