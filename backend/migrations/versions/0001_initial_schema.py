"""initial schema

Mirrors app/db/models.py as of the first hosted release. scans.trial_id and
trials.baseline_scan_id reference each other, so the scans -> trials foreign key
is added after both tables exist.

Revision ID: 0001
Revises:
Create Date: 2026-10-12 17:18:38
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SCANS_TRIAL_FK = "fk_scans_trial_id_trials"


def upgrade() -> None:
    op.create_table(
        "sessions",
        sa.Column("id", sa.String(length=32), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_sessions_token_hash"), "sessions", ["token_hash"], unique=True)

    op.create_table(
        "scans",
        sa.Column("id", sa.String(length=32), nullable=False),
        sa.Column("session_id", sa.String(length=32), nullable=False),
        sa.Column("trial_id", sa.String(length=32), nullable=True),
        sa.Column("provenance", sa.String(length=16), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("stage", sa.String(length=24), nullable=False),
        sa.Column("failure_code", sa.String(length=48), nullable=True),
        sa.Column("failure_message", sa.Text(), nullable=True),
        sa.Column("failure_hint", sa.Text(), nullable=True),
        sa.Column("idempotency_key", sa.String(length=64), nullable=True),
        sa.Column("source", sa.String(length=16), nullable=False),
        sa.Column("width", sa.Integer(), nullable=True),
        sa.Column("height", sa.Integer(), nullable=True),
        sa.Column("luminance_mean", sa.Float(), nullable=True),
        sa.Column("requested_metrics", sa.Text(), nullable=False),
        sa.Column("missing_metrics", sa.Text(), nullable=False),
        sa.Column("provider_duration_s", sa.Float(), nullable=True),
        sa.Column("units_estimated", sa.Integer(), nullable=False),
        sa.Column("masks_expire_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("synthetic_timeline", sa.Boolean(), nullable=False),
        sa.Column("observed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("provenance in ('youcam','demo')", name="ck_scan_provenance"),
        sa.CheckConstraint("status in ('processing','complete','failed')", name="ck_scan_status"),
        sa.ForeignKeyConstraint(["session_id"], ["sessions.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("session_id", "idempotency_key", name="uq_scan_idempotency"),
    )
    op.create_index(op.f("ix_scans_session_id"), "scans", ["session_id"], unique=False)
    op.create_index(op.f("ix_scans_trial_id"), "scans", ["trial_id"], unique=False)

    op.create_table(
        "trials",
        sa.Column("id", sa.String(length=32), nullable=False),
        sa.Column("session_id", sa.String(length=32), nullable=False),
        sa.Column("provenance", sa.String(length=16), nullable=False),
        sa.Column("goal", sa.String(length=24), nullable=False),
        sa.Column("product_id", sa.String(length=64), nullable=False),
        sa.Column("baseline_scan_id", sa.String(length=32), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("provenance in ('youcam','demo')", name="ck_trial_provenance"),
        sa.ForeignKeyConstraint(["baseline_scan_id"], ["scans.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["session_id"], ["sessions.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_trials_session_id"), "trials", ["session_id"], unique=False)
    op.create_foreign_key(SCANS_TRIAL_FK, "scans", "trials", ["trial_id"], ["id"], ondelete="SET NULL")

    op.create_table(
        "metric_readings",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("scan_id", sa.String(length=32), nullable=False),
        sa.Column("metric", sa.String(length=24), nullable=False),
        sa.Column("ui_score", sa.Integer(), nullable=False),
        sa.Column("raw_score", sa.Float(), nullable=True),
        sa.Column("mask_url", sa.Text(), nullable=True),
        sa.CheckConstraint("ui_score >= 0 AND ui_score <= 100", name="ck_reading_range"),
        sa.ForeignKeyConstraint(["scan_id"], ["scans.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("scan_id", "metric", name="uq_reading_metric"),
    )
    op.create_index(op.f("ix_metric_readings_scan_id"), "metric_readings", ["scan_id"], unique=False)

    op.create_table(
        "provider_calls",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("session_id", sa.String(length=32), nullable=True),
        sa.Column("kind", sa.String(length=24), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("units_reserved", sa.Integer(), nullable=False),
        sa.Column("units_charged", sa.Integer(), nullable=False),
        sa.Column("error_code", sa.String(length=48), nullable=True),
        sa.Column("duration_s", sa.Float(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("status in ('pending','success','error')", name="ck_call_status"),
        sa.ForeignKeyConstraint(["session_id"], ["sessions.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_provider_calls_session_id"), "provider_calls", ["session_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_provider_calls_session_id"), table_name="provider_calls")
    op.drop_table("provider_calls")
    op.drop_index(op.f("ix_metric_readings_scan_id"), table_name="metric_readings")
    op.drop_table("metric_readings")
    op.drop_constraint(SCANS_TRIAL_FK, "scans", type_="foreignkey")
    op.drop_index(op.f("ix_trials_session_id"), table_name="trials")
    op.drop_table("trials")
    op.drop_index(op.f("ix_scans_trial_id"), table_name="scans")
    op.drop_index(op.f("ix_scans_session_id"), table_name="scans")
    op.drop_table("scans")
    op.drop_index(op.f("ix_sessions_token_hash"), table_name="sessions")
    op.drop_table("sessions")
