"""instrument check: repeat baseline scan, sealed spread, and image digests

Additive and nullable: existing trials have no repeat and keep their registered
band; existing scans have no digest, so the identical-photo check skips them.

Revision ID: 0003
Revises: 0002
Create Date: 2026-10-25 12:00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0003"
down_revision: str | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

REPEAT_FK = "fk_trials_repeat_scan_id_scans"
SPREAD_CHECK = ("ck_trial_repeat_spread", "repeat_spread is null or (repeat_spread >= 0 and repeat_spread <= 100)")


def _supports_alter_constraints() -> bool:
    # SQLite (local development only; tests use create_all) can't ALTER constraints.
    return op.get_bind().dialect.name != "sqlite"


def upgrade() -> None:
    op.add_column("scans", sa.Column("content_digest", sa.String(length=64), nullable=True))
    op.add_column("trials", sa.Column("repeat_scan_id", sa.String(length=32), nullable=True))
    op.add_column("trials", sa.Column("repeat_spread", sa.Integer(), nullable=True))
    if _supports_alter_constraints():
        op.create_foreign_key(REPEAT_FK, "trials", "scans", ["repeat_scan_id"], ["id"], ondelete="SET NULL")
        op.create_check_constraint(SPREAD_CHECK[0], "trials", SPREAD_CHECK[1])


def downgrade() -> None:
    if _supports_alter_constraints():
        op.drop_constraint(SPREAD_CHECK[0], "trials", type_="check")
        op.drop_constraint(REPEAT_FK, "trials", type_="foreignkey")
    op.drop_column("trials", "repeat_spread")
    op.drop_column("trials", "repeat_scan_id")
    op.drop_column("scans", "content_digest")
