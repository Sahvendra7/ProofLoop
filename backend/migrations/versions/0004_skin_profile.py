"""checked skin profile: the skin-type reading per scan and the frozen profile per trial

Additive and nullable: existing scans have no reading and existing trials no profile,
and neither column is read by the plan, band, verdict or next step.

Revision ID: 0004
Revises: 0003
Create Date: 2026-10-26 12:00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0004"
down_revision: str | None = "0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("scans", sa.Column("skin_type_json", sa.Text(), nullable=True))
    op.add_column("trials", sa.Column("profile_json", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("trials", "profile_json")
    op.drop_column("scans", "skin_type_json")
