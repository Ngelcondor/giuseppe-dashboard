"""Minimal in-process rate limiting for sensitive endpoints (login, admin init).

Sliding-window counter per key (tipicamente l'IP del client). In-memory: con
più worker ogni processo ha la sua finestra — protezione base contro brute
force, non un rate limiter distribuito. Per quello servirebbe Redis, ma per
una dashboard single-user è il compromesso giusto (zero dipendenze).
"""
import time
from collections import defaultdict, deque
from typing import Deque, Dict

from fastapi import HTTPException, Request, status


class SlidingWindowLimiter:
    def __init__(self, max_calls: int, window_seconds: float) -> None:
        self.max_calls = max_calls
        self.window = window_seconds
        self._hits: Dict[str, Deque[float]] = defaultdict(deque)

    def check(self, key: str) -> None:
        """Registra un hit per la chiave; solleva 429 oltre la soglia."""
        now = time.monotonic()
        hits = self._hits[key]
        while hits and now - hits[0] > self.window:
            hits.popleft()
        if len(hits) >= self.max_calls:
            retry_after = max(1, int(self.window - (now - hits[0])))
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Troppi tentativi. Riprova tra qualche secondo.",
                headers={"Retry-After": str(retry_after)},
            )
        hits.append(now)


def client_ip(request: Request) -> str:
    """IP del client, rispettando il primo X-Forwarded-For dietro nginx."""
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


# 10 tentativi di login al minuto per IP; init ancora più stretto.
login_limiter = SlidingWindowLimiter(max_calls=10, window_seconds=60)
init_limiter = SlidingWindowLimiter(max_calls=3, window_seconds=300)
