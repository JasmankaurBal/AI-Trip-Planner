"""AI service: structured itinerary generation + conversational companion via Google Gemini."""
import json
import re
from typing import AsyncGenerator

from google import genai
from google.genai import types

from app.core.config import settings
from app.core.logging import logger

CATEGORIES = [
    "sightseeing", "food", "nature", "culture", "adventure", "shopping",
    "nightlife", "relaxation", "transport", "accommodation", "other",
]


def _client() -> genai.Client:
    if not settings.GOOGLE_API_KEY:
        raise RuntimeError("AI is not configured: GOOGLE_API_KEY missing")
    return genai.Client(api_key=settings.GOOGLE_API_KEY)


def _config(system_message: str) -> types.GenerateContentConfig:
    return types.GenerateContentConfig(system_instruction=system_message)


async def _generate(system_message: str, user_text: str):
    return await _client().aio.models.generate_content(
        model=settings.AI_MODEL,
        contents=user_text,
        config=_config(system_message),
    )


def _extract_json(text: str) -> dict:
    """Pull the first JSON object out of a model response, tolerating code fences."""
    text = text.strip()
    fenced = re.search(r"```(?:json)?\s*(\{.*\})\s*```", text, re.DOTALL)
    if fenced:
        text = fenced.group(1)
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1:
        raise ValueError("No JSON object found in AI response")
    return json.loads(text[start : end + 1])


ITINERARY_SYSTEM = (
    "You are COCO, an expert travel planner. You output ONLY valid JSON, no prose, no markdown. "
    "Design realistic, geographically sensible day-by-day itineraries that minimise backtracking. "
    "Use approximate real coordinates (lat/lng) for each activity in the destination. "
    "Never invent flight prices or booking data. Costs are rough per-person estimates in the trip currency."
)


def _itinerary_prompt(spec: dict, num_days: int) -> str:
    return f"""Create a {num_days}-day trip itinerary as JSON with EXACTLY this shape:
{{
  "summary": "one friendly sentence overview",
  "days": [
    {{
      "day_index": 0,
      "title": "short day theme",
      "activities": [
        {{
          "title": "string",
          "description": "1-2 sentences",
          "location": "place name, area",
          "lat": 0.0,
          "lng": 0.0,
          "start_time": "09:00",
          "duration_minutes": 90,
          "estimated_cost": 0,
          "category": "one of {CATEGORIES}",
          "transport": "walk|metro|taxi|bus|car|none"
        }}
      ]
    }}
  ]
}}
Trip request:
- Destination: {spec.get('destination')}
- Days: {num_days}
- Travelers: {spec.get('travelers', 1)}
- Total budget: {spec.get('budget', 'flexible')} {spec.get('currency', 'USD')}
- Travel style: {spec.get('travel_style', 'balanced')}
- Interests: {', '.join(spec.get('interests', []) or ['general'])}
- Pace: {spec.get('pace', 'moderate')}
- Dietary: {spec.get('dietary', 'none')}
- Accessibility: {spec.get('accessibility', 'none')}
- Food preference: {spec.get('food_pref', 'any')}
- Accommodation preference: {spec.get('accommodation_pref', 'any')}
- Walking tolerance: {spec.get('walking_level', 'moderate')}
- Luxury level: {spec.get('luxury_level', 'mid')}
- Tourist(0)-vs-Local(100): {spec.get('tourist_vs_local', 50)}
- Vibe: {spec.get('vibe', 'balanced')}
Rules: 3-5 activities per day, include meals, realistic times in order, coordinates within the destination.
Respect walking tolerance (low = fewer, closer stops), luxury level, and the tourist-vs-local slider (higher = more local/off-the-beaten-path).
Output ONLY the JSON object."""


def _normalize_itinerary(data: dict, num_days: int) -> dict:
    days = data.get("days") or []
    norm_days = []
    for i, day in enumerate(days[:num_days]):
        acts = []
        for a in (day.get("activities") or []):
            cat = str(a.get("category", "other")).lower()
            if cat not in CATEGORIES:
                cat = "other"
            try:
                lat = float(a.get("lat")) if a.get("lat") is not None else None
                lng = float(a.get("lng")) if a.get("lng") is not None else None
            except (TypeError, ValueError):
                lat = lng = None
            try:
                cost = float(a.get("estimated_cost", 0) or 0)
            except (TypeError, ValueError):
                cost = 0.0
            try:
                dur = int(a.get("duration_minutes", 60) or 60)
            except (TypeError, ValueError):
                dur = 60
            title = (a.get("title") or "").strip()
            if not title:
                continue
            acts.append({
                "title": title,
                "description": (a.get("description") or "").strip(),
                "location": (a.get("location") or "").strip(),
                "lat": lat,
                "lng": lng,
                "start_time": (a.get("start_time") or "").strip(),
                "duration_minutes": dur,
                "estimated_cost": round(cost, 2),
                "category": cat,
                "transport": (a.get("transport") or "none").strip(),
            })
        norm_days.append({
            "day_index": i,
            "title": (day.get("title") or f"Day {i + 1}").strip(),
            "activities": acts,
        })
    if not norm_days:
        raise ValueError("AI produced no valid days")
    return {"summary": (data.get("summary") or "").strip(), "days": norm_days}


async def generate_itinerary(spec: dict, num_days: int) -> dict:
    """Generate + validate a structured itinerary. Retries once on invalid output."""
    last_err = None
    for attempt in range(2):
        try:
            resp = await _generate(ITINERARY_SYSTEM, _itinerary_prompt(spec, num_days))
            data = _extract_json(resp.text or "")
            return _normalize_itinerary(data, num_days)
        except Exception as exc:  # noqa: BLE001
            last_err = exc
            logger.warning(f"Itinerary generation attempt {attempt + 1} failed: {exc}")
    raise RuntimeError(f"AI failed to produce a valid itinerary: {last_err}")


def build_chat_system(trip_context: str | None, history: list[dict]) -> str:
    base = (
        "You are COCO, a friendly, calm and knowledgeable travel companion. "
        "Keep replies concise, warm and practical. Give specific, actionable travel advice. "
        "Never invent live prices, flight availability or fake reviews."
    )
    if trip_context:
        base += f"\n\nACTIVE TRIP CONTEXT:\n{trip_context}"
    if history:
        convo = "\n".join(f"{m['role']}: {m['content']}" for m in history[-10:])
        base += f"\n\nRECENT CONVERSATION:\n{convo}"
    return base


async def chat_stream(session_id: str, system_message: str, user_text: str) -> AsyncGenerator[str, None]:
    if not settings.GOOGLE_API_KEY:
        raise RuntimeError("AI is not configured: GOOGLE_API_KEY missing")
    async for chunk in _client().aio.models.generate_content_stream(
        model=settings.AI_MODEL,
        contents=user_text,
        config=_config(system_message),
    ):
        if chunk.text:
            yield chunk.text


async def _ask_json(session_id: str, system: str, prompt: str) -> dict:
    resp = await _generate(system, prompt)
    return _extract_json(resp.text or "")


async def generate_discovery(category: str, limit: int = 8) -> list[dict]:
    system = (
        "You are COCO, a travel discovery engine. Output ONLY valid JSON. "
        "Suggest real, well-known destinations. Do NOT invent prices, ratings or reviews."
    )
    prompt = f"""Suggest {limit} real travel destinations for the theme "{category}".
Return JSON: {{"destinations": [{{"name": "City, Country", "country": "string",
"description": "1 sentence why it fits {category}", "best_season": "string",
"tags": ["tag1","tag2"], "lat": 0.0, "lng": 0.0}}]}}
Use approximate real coordinates. Output ONLY JSON."""
    data = await _ask_json(f"discovery-{category}", system, prompt)
    out = []
    for d in (data.get("destinations") or [])[:limit]:
        if not d.get("name"):
            continue
        try:
            lat = float(d.get("lat")) if d.get("lat") is not None else None
            lng = float(d.get("lng")) if d.get("lng") is not None else None
        except (TypeError, ValueError):
            lat = lng = None
        out.append({
            "name": d["name"], "country": d.get("country", ""),
            "description": d.get("description", ""), "best_season": d.get("best_season", ""),
            "tags": d.get("tags", []), "lat": lat, "lng": lng,
            "source": "ai_estimate",
        })
    return out


async def what_now(context: dict) -> list[dict]:
    system = (
        "You are COCO, a real-time travel companion. Output ONLY valid JSON. "
        "Suggest things to do RIGHT NOW given the traveller's live context. Be realistic and specific. "
        "Do not invent exact prices; give rough ranges only."
    )
    prompt = f"""Context:
- Location: {context.get('location')}
- Local time: {context.get('time')}
- Weather: {context.get('weather')}
- Budget note: {context.get('budget')}
- Interests: {context.get('interests')}
Return JSON: {{"suggestions": [{{"title": "string", "why": "1 sentence",
"category": "food|nature|culture|relax|adventure|shopping", "duration": "e.g. 1-2h",
"tip": "practical tip"}}]}}
Give 4-6 suggestions suited to the time and weather. Output ONLY JSON."""
    data = await _ask_json(f"whatnow-{context.get('location','x')}", system, prompt)
    return (data.get("suggestions") or [])[:6]



EDIT_SYSTEM = (
    "You are COCO, an expert itinerary editor. You output ONLY valid JSON, no prose. "
    "You MODIFY an EXISTING itinerary based on the user's instruction and MUST keep the parts "
    "not affected by the instruction intact (same titles/coords/times where unchanged). "
    "Never invent flight prices or bookings. Keep coordinates within the destination."
)


async def edit_itinerary(destination: str, currency: str, days: list[dict], instruction: str, prefs: dict | None = None) -> dict:
    """Apply a natural-language edit to the current itinerary and return the FULL updated plan."""
    compact = [
        {"day_index": d["day_index"], "title": d.get("title", ""),
         "activities": [
             {"title": a["title"], "description": a.get("description", ""), "location": a.get("location", ""),
              "lat": a.get("lat"), "lng": a.get("lng"), "start_time": a.get("start_time", ""),
              "duration_minutes": a.get("duration_minutes", 60), "estimated_cost": a.get("estimated_cost", 0),
              "category": a.get("category", "other"), "transport": a.get("transport", "none")}
             for a in d.get("activities", [])
         ]}
        for d in days
    ]
    prompt = f"""Destination: {destination}. Currency: {currency}. Traveller preferences: {prefs or {}}.
User instruction: "{instruction}"

CURRENT_ITINERARY (JSON):
{json.dumps(compact)}

Return the FULL updated itinerary in EXACTLY this JSON shape:
{{"summary": "1 sentence describing what you changed", "days": [{{"day_index": 0, "title": "string",
"activities": [{{"title","description","location","lat","lng","start_time","duration_minutes","estimated_cost","category","transport"}}]}}]}}
Only change what the instruction requires; keep everything else. Output ONLY the JSON object."""
    last_err = None
    for attempt in range(2):
        try:
            resp = await _generate(EDIT_SYSTEM, prompt)
            data = _extract_json(resp.text or "")
            out = _normalize_itinerary(data, num_days=max(len(days), len(data.get("days", []))))
            out["summary"] = (data.get("summary") or "Updated your itinerary.").strip()
            return out
        except Exception as exc:  # noqa: BLE001
            last_err = exc
            logger.warning(f"edit_itinerary attempt {attempt + 1} failed: {exc}")
    raise RuntimeError(f"AI could not edit the itinerary: {last_err}")
