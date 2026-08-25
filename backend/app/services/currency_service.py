"""Currency conversion via Frankfurter (ECB, keyless, real data)."""
import os

import httpx

from app.core.logging import logger

BASE = os.environ.get("CURRENCY_API_BASE", "https://api.frankfurter.dev/v1")


async def convert(amount: float, from_cur: str, to_cur: str) -> dict:
    from_cur, to_cur = from_cur.upper(), to_cur.upper()
    if from_cur == to_cur:
        return {"amount": amount, "from": from_cur, "to": to_cur, "rate": 1.0, "result": amount}
    try:
        async with httpx.AsyncClient(timeout=10, follow_redirects=True) as client:
            r = await client.get(f"{BASE}/latest", params={"amount": amount, "from": from_cur, "to": to_cur})
            r.raise_for_status()
            data = r.json()
            result = data["rates"][to_cur]
            return {
                "amount": amount, "from": from_cur, "to": to_cur,
                "rate": round(result / amount, 6) if amount else 0,
                "result": round(result, 2),
            }
    except Exception as exc:  # noqa: BLE001
        logger.error(f"Currency convert failed: {exc}")
        raise RuntimeError("Currency service unavailable") from exc


async def rates(base_cur: str = "USD") -> dict:
    try:
        async with httpx.AsyncClient(timeout=10, follow_redirects=True) as client:
            r = await client.get(f"{BASE}/latest", params={"base": base_cur.upper()})
            r.raise_for_status()
            return r.json()
    except Exception as exc:  # noqa: BLE001
        logger.error(f"Currency rates failed: {exc}")
        raise RuntimeError("Currency service unavailable") from exc
