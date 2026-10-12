"""Engine and session factory.

SQLite (local development and tests) creates its schema on startup. Any other database
is managed by Alembic (`alembic upgrade head`, run before the server starts).
"""

from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager

from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from app.db.models import Base

_engine: Engine | None = None
_factory: sessionmaker[Session] | None = None


def init_engine(url: str) -> Engine:
    global _engine, _factory
    kwargs: dict = {"future": True, "pool_pre_ping": True}
    if url.startswith("sqlite"):
        kwargs["connect_args"] = {"check_same_thread": False}
    else:
        # Serverless Postgres (e.g. Neon) suspends idle computes and drops idle connections:
        # keep the pool small and recycle connections before the server closes them.
        kwargs.update(pool_size=5, max_overflow=5, pool_recycle=240)
    engine = create_engine(url, **kwargs)
    if url.startswith("sqlite"):

        @event.listens_for(engine, "connect")
        def _sqlite_pragmas(dbapi_conn, _record) -> None:  # pragma: no cover - trivial
            cur = dbapi_conn.cursor()
            cur.execute("PRAGMA foreign_keys=ON")
            cur.execute("PRAGMA journal_mode=WAL")
            cur.close()

        Base.metadata.create_all(engine)
    _engine = engine
    _factory = sessionmaker(bind=engine, expire_on_commit=False)
    return engine


def get_engine() -> Engine:
    assert _engine is not None, "init_engine() not called"
    return _engine


@contextmanager
def db_session() -> Iterator[Session]:
    assert _factory is not None, "init_engine() not called"
    session = _factory()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def get_db() -> Iterator[Session]:
    """FastAPI dependency."""
    with db_session() as session:
        yield session
