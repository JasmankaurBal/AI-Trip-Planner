"""Lightweight in-memory rate limiter for expensive endpoints."""
import time
from collections import defaultdict

from fastapi import HTTPException, Request

_hits: dict[str, list[float]] = defaultdict(list)


def rate_limit(key_prefix: str, max_calls: int, window_seconds: int):
    async def _dep(request: Request):
        ident = request.client.host if request.client else "anon"
        key = f"{key_prefix}:{ident}"
        now = time.time()
        _hits[key] = [t for t in _hits[key] if now - t < window_seconds]
        if len(_hits[key]) >= max_calls:
            raise HTTPException(status_code=429, detail="Rate limit exceeded. Please slow down.")
        _hits[key].append(now)
    return _dep
