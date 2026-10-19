"""Relational model. No images are stored; scans hold scores and capture metadata only."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


def utcnow() -> datetime:
    return datetime.now(UTC)


def new_id() -> str:
    return uuid.uuid4().hex


class Base(DeclarativeBase):
    pass


class SessionRow(Base):
    __tablename__ = "sessions"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    scans: Mapped[list[ScanRow]] = relationship(
        back_populates="session", cascade="all, delete-orphan", passive_deletes=True
    )
    trials: Mapped[list[TrialRow]] = relationship(
        back_populates="session", cascade="all, delete-orphan", passive_deletes=True
    )


class ScanRow(Base):
    __tablename__ = "scans"
    __table_args__ = (
        UniqueConstraint("session_id", "idempotency_key", name="uq_scan_idempotency"),
        CheckConstraint("provenance in ('youcam','demo')", name="ck_scan_provenance"),
        CheckConstraint("status in ('processing','complete','failed')", name="ck_scan_status"),
    )
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    session_id: Mapped[str] = mapped_column(ForeignKey("sessions.id", ondelete="CASCADE"), index=True)
    trial_id: Mapped[str | None] = mapped_column(
        ForeignKey("trials.id", ondelete="SET NULL"), nullable=True, index=True
    )
    provenance: Mapped[str] = mapped_column(String(16))
    status: Mapped[str] = mapped_column(String(16), default="processing")
    stage: Mapped[str] = mapped_column(String(24), default="queued")
    failure_code: Mapped[str | None] = mapped_column(String(48), nullable=True)
    failure_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    failure_hint: Mapped[str | None] = mapped_column(Text, nullable=True)
    idempotency_key: Mapped[str | None] = mapped_column(String(64), nullable=True)

    source: Mapped[str] = mapped_column(String(16))  # camera | upload | sample
    width: Mapped[int | None] = mapped_column(Integer, nullable=True)
    height: Mapped[int | None] = mapped_column(Integer, nullable=True)
    luminance_mean: Mapped[float | None] = mapped_column(Float, nullable=True)

    requested_metrics: Mapped[str] = mapped_column(Text, default="[]")  # JSON list
    missing_metrics: Mapped[str] = mapped_column(Text, default="[]")  # JSON list
    provider_duration_s: Mapped[float | None] = mapped_column(Float, nullable=True)
    units_estimated: Mapped[int] = mapped_column(Integer, default=0)
    masks_expire_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # For demo-only synthetic follow-ups the observation date is simulated.
    synthetic_timeline: Mapped[bool] = mapped_column(Boolean, default=False)
    observed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    session: Mapped[SessionRow] = relationship(back_populates="scans")
    readings: Mapped[list[ReadingRow]] = relationship(
        back_populates="scan", cascade="all, delete-orphan", passive_deletes=True, lazy="selectin"
    )


class ReadingRow(Base):
    __tablename__ = "metric_readings"
    __table_args__ = (
        UniqueConstraint("scan_id", "metric", name="uq_reading_metric"),
        CheckConstraint("ui_score >= 0 AND ui_score <= 100", name="ck_reading_range"),
    )
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    scan_id: Mapped[str] = mapped_column(ForeignKey("scans.id", ondelete="CASCADE"), index=True)
    metric: Mapped[str] = mapped_column(String(24))
    ui_score: Mapped[int] = mapped_column(Integer)
    raw_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    mask_url: Mapped[str | None] = mapped_column(Text, nullable=True)

    scan: Mapped[ScanRow] = relationship(back_populates="readings")


class TrialRow(Base):
    __tablename__ = "trials"
    __table_args__ = (
        CheckConstraint("provenance in ('youcam','demo')", name="ck_trial_provenance"),
        CheckConstraint(
            "band_evidence is null or band_evidence in ('measured','assumed')", name="ck_trial_band_evidence"
        ),
        CheckConstraint("focus_band is null or (focus_band >= 0 and focus_band <= 100)", name="ck_trial_focus_band"),
    )
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    session_id: Mapped[str] = mapped_column(ForeignKey("sessions.id", ondelete="CASCADE"), index=True)
    provenance: Mapped[str] = mapped_column(String(16))
    goal: Mapped[str] = mapped_column(String(24))
    product_id: Mapped[str] = mapped_column(String(64))
    baseline_scan_id: Mapped[str] = mapped_column(ForeignKey("scans.id", ondelete="CASCADE"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    # Pre-registered protocol, fixed when the trial starts (migration 0002).
    # NULL on trials created before 0002; those fall back to the current table.
    focus_band: Mapped[int | None] = mapped_column(Integer, nullable=True)
    band_evidence: Mapped[str | None] = mapped_column(String(16), nullable=True)
    planned_checkin_days: Mapped[int | None] = mapped_column(Integer, nullable=True)

    session: Mapped[SessionRow] = relationship(back_populates="trials")


class ProviderCallRow(Base):
    """Usage ledger. Survives session deletion (session_id nulled) for budget accounting."""

    __tablename__ = "provider_calls"
    __table_args__ = (CheckConstraint("status in ('pending','success','error')", name="ck_call_status"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[str | None] = mapped_column(
        ForeignKey("sessions.id", ondelete="SET NULL"), nullable=True, index=True
    )
    kind: Mapped[str] = mapped_column(String(24))  # skin_analysis | skin_simulation
    status: Mapped[str] = mapped_column(String(16), default="pending")
    units_reserved: Mapped[int] = mapped_column(Integer)
    units_charged: Mapped[int] = mapped_column(Integer, default=0)
    error_code: Mapped[str | None] = mapped_column(String(48), nullable=True)
    duration_s: Mapped[float | None] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
