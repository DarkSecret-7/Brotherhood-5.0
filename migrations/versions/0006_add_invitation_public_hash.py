"""Add public_hash column to authorship_invitations with deterministic backfill.

Revision ID: 0006
Revises: 0005
Create Date: 2026-06-22

The public_hash mirrors the hash scheme used for proposals, sources and
assessments: sha256 over a structured string. For invitations we encode the
graph, initiator, recipient and the timestamp so that multiple invitations
between the same parties (e.g. after decline) remain uniquely identifiable.

Backfill is deterministic: each existing row's stored created_at is used to
recompute its hash. This makes the migration idempotent and safe to re-run
on partially-failed environments.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

# revision identifiers, used by Alembic.
revision = '0006'
down_revision = '0005'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Add the column nullable so existing rows are accepted.
    op.add_column(
        'authorship_invitations',
        sa.Column('public_hash', sa.String(length=64), nullable=True),
    )

    # 2. Backfill hashes for existing rows. The hash encodes the timestamp so
    #    multiple invitations between the same parties remain unique.
    conn = op.get_bind()
    from app.utils import generate_hash  # env.py adds project root to sys.path

    rows = conn.execute(
        sa.text(
            "SELECT id, graph_uuid, initiator_uuid, recipient_uuid, created_at "
            "FROM authorship_invitations WHERE public_hash IS NULL"
        )
    ).fetchall()

    for row in rows:
        hash_data = (
            f"invitation:{row.graph_uuid}:{row.initiator_uuid}:"
            f"{row.recipient_uuid}:{row.created_at.isoformat()}"
        )
        public_hash = generate_hash(hash_data)
        conn.execute(
            sa.text("UPDATE authorship_invitations SET public_hash = :h WHERE id = :i"),
            {"h": public_hash, "i": row.id},
        )

    # 3. Enforce NOT NULL and a unique index now that every row has a value.
    op.alter_column('authorship_invitations', 'public_hash', nullable=False)
    op.create_index(
        'ix_authorship_invitations_public_hash',
        'authorship_invitations',
        ['public_hash'],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index('ix_authorship_invitations_public_hash', table_name='authorship_invitations')
    op.drop_column('authorship_invitations', 'public_hash')
