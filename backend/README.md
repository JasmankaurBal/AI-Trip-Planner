# COCO Backend (FastAPI)

Modular FastAPI service for the COCO trip planner.

```
app/
├── core/        # config, security (bcrypt+JWT), logging, rate limiting
├── db/          # Motor client + index management
├── models/      # Pydantic base models / ObjectId handling
├── schemas/     # request/response validation
├── services/    # ai_service, weather_service, places_service, currency_service
├── api/         # routers: auth, trips, activities, expenses, chat, data, documents, collab, notifications, health
server.py        # app entry (uvicorn server:app)
```

## Run
```bash
pip install -r requirements.txt
cp .env.example .env
uvicorn server:app --reload --port 8001
```

## Health
`GET /api/health` → API + DB status.

## Tests
```bash
pytest
```

Interactive API docs at `/docs`.
