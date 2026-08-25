"""Weather via Open-Meteo (keyless, real data)."""
import httpx

from app.core.logging import logger

GEO_URL = "https://geocoding-api.open-meteo.com/v1/search"
FORECAST_URL = "https://api.open-meteo.com/v1/forecast"

WEATHER_CODES = {
    0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
    45: "Fog", 48: "Rime fog", 51: "Light drizzle", 53: "Drizzle", 55: "Dense drizzle",
    61: "Light rain", 63: "Rain", 65: "Heavy rain", 71: "Light snow", 73: "Snow",
    75: "Heavy snow", 80: "Rain showers", 81: "Rain showers", 82: "Violent showers",
    95: "Thunderstorm", 96: "Thunderstorm w/ hail", 99: "Thunderstorm w/ hail",
}


async def geocode(place: str) -> dict | None:
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(GEO_URL, params={"name": place, "count": 1})
            r.raise_for_status()
            results = r.json().get("results") or []
            if not results:
                return None
            g = results[0]
            return {"lat": g["latitude"], "lng": g["longitude"], "name": g.get("name"), "country": g.get("country")}
    except Exception as exc:  # noqa: BLE001
        logger.error(f"Geocode failed for {place}: {exc}")
        return None


async def get_weather(lat: float, lng: float) -> dict:
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(FORECAST_URL, params={
                "latitude": lat, "longitude": lng,
                "current": "temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m",
                "daily": "temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max",
                "timezone": "auto", "forecast_days": 7,
            })
            r.raise_for_status()
            data = r.json()
            cur = data.get("current", {})
            daily = data.get("daily", {})
            days = []
            for i, date in enumerate(daily.get("time", [])):
                code = daily["weather_code"][i]
                days.append({
                    "date": date,
                    "max": daily["temperature_2m_max"][i],
                    "min": daily["temperature_2m_min"][i],
                    "code": code,
                    "condition": WEATHER_CODES.get(code, "Unknown"),
                    "precip_prob": daily.get("precipitation_probability_max", [None] * 7)[i],
                })
            return {
                "current": {
                    "temp": cur.get("temperature_2m"),
                    "condition": WEATHER_CODES.get(cur.get("weather_code"), "Unknown"),
                    "code": cur.get("weather_code"),
                    "wind": cur.get("wind_speed_10m"),
                    "humidity": cur.get("relative_humidity_2m"),
                },
                "daily": days,
            }
    except Exception as exc:  # noqa: BLE001
        logger.error(f"Weather fetch failed: {exc}")
        raise RuntimeError("Weather service unavailable") from exc
