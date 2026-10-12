"""Anonymous sessions. The browser holds an opaque bearer token; only its hash is stored."""

from __future__ import annotations

import hashlib
import secrets

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import SessionRow, utcnow


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def create_session(db: Session) -> tuple[SessionRow, str]:
    token = secrets.token_urlsafe(32)
    row = SessionRow(token_hash=hash_token(token))
    db.add(row)
    db.flush()
    return row, token


def resolve_session(db: Session, token: str) -> SessionRow | None:
    if not token or len(token) > 128:
        return None
    row = db.scalar(select(SessionRow).where(SessionRow.token_hash == hash_token(token)))
    if row is not None:
        row.last_seen_at = utcnow()
    return row
