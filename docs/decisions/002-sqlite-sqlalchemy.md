# ADR-002: SQLite through SQLAlchemy, Postgres-ready, no migrations yet

**Decision.** Persist sessions, scans, readings, trials and the usage ledger with SQLAlchemy 2.0 on SQLite by default (`DATABASE_URL` accepts any SQLAlchemy URL). Tables are created on startup.

**Context.** The MVP kept everything in Python dicts with one global baseline shared by every visitor. Trials need durable, per-session history. Data is small and contains no images.

**Options.** In-memory; SQLite via stdlib `sqlite3`; SQLAlchemy + SQLite; Postgres from day one.

**Why.** SQLAlchemy gives constraints, cascades and a path to Postgres without code changes; SQLite needs no infrastructure for judges running locally. Foreign keys and WAL are enabled per connection.

**Trade-offs.** `create_all` cannot evolve an existing schema.

**Revisit when.** Deploying more than one backend instance (→ Postgres) or the schema changes after real users exist (→ Alembic migrations).
