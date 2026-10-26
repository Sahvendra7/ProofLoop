"""In-memory limits for free-text asks.

Render runs one uvicorn worker, so process memory is the whole picture there; the
counters reset when the process restarts. They protect the Gemini free tier, not
YouCam units (the assistant never spends those).
"""

from __future__ import annotations

import time
from collections import defaultdict, deque
from collections.abc import Callable
from threading import Lock

HOUR = 3600.0
DAY = 86400.0


class AskLimiter:
    def __init__(self, per_session_per_hour: int, per_day: int, clock: Callable[[], float] = time.monotonic) -> None:
        self._per_session = per_session_per_hour
        self._per_day = per_day
        self._clock = clock
        self._sessions: dict[str, deque[float]] = defaultdict(deque)
        self._day: deque[float] = deque()
        self._lock = Lock()

    def allow(self, session_id: str) -> bool:
        """Record and allow the ask if both windows have room."""
        with self._lock:
            now = self._clock()
            mine = self._sessions[session_id]
            while mine and now - mine[0] >= HOUR:
                mine.popleft()
            while self._day and now - self._day[0] >= DAY:
                self._day.popleft()
            if len(mine) >= self._per_session or len(self._day) >= self._per_day:
                return False
            mine.append(now)
            self._day.append(now)
            return True
