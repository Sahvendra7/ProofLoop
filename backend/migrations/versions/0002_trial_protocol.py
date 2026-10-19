"""trial protocol: pre-registered band and planned check-in

Additive and nullable: trials created before this revision keep NULLs and are
read with the current noise-band table (reported as not pre-registered).

Revision ID: 0002
Revises: 0001
Create Date: 2026-10-19 15:00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


CHECKS = {
    "ck_trial_band_evidence": "band_evidence is null or band_evidence in ('measured','assumed')",
    "ck_trial_focus_band": "focus_band is null or (focus_band >= 0 and focus_band <= 100)",
}


def _supports_alter_constraints() -> bool:
    # SQLite (local development only; tests use create_all) can't ALTER constraints.
    return op.get_bind().dialect.name != "sqlite"


def upgrade() -> None:
    op.add_column("trials", sa.Column("focus_band", sa.Integer(), nullable=True))
    op.add_column("trials", sa.Column("band_evidence", sa.String(length=16), nullable=True))
    op.add_column("trials", sa.Column("planned_checkin_days", sa.Integer(), nullable=True))
    if _supports_alter_constraints():
        for name, condition in CHECKS.items():
            op.create_check_constraint(name, "trials", condition)


def downgrade() -> None:
    if _supports_alter_constraints():
        for name in CHECKS:
            op.drop_constraint(name, "trials", type_="check")
    op.drop_column("trials", "planned_checkin_days")
    op.drop_column("trials", "band_evidence")
    op.drop_column("trials", "focus_band")
