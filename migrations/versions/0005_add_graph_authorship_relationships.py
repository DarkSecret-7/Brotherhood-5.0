"""Create relationships between graph snapshots and users in GraphAuthorship table

Revision ID: 0005
Revises: 0004
Create Date: 2026-05-26

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = '0005'
down_revision = '0004'
branch_labels = None
depends_on = None

def upgrade() -> None:
    """Add UUID columns and indexes to graph_authorship table for faster direct queries"""
    op.add_column('graph_authorship', sa.Column('graph_uuid', UUID(as_uuid=True), nullable=True))
    op.add_column('graph_authorship', sa.Column('user_uuid', UUID(as_uuid=True), nullable=True))

    op.create_index('ix_graph_authorship_graph_uuid', 'graph_authorship', ['graph_uuid'], unique=False)
    op.create_index('ix_graph_authorship_user_uuid', 'graph_authorship', ['user_uuid'], unique=False)
    # op.create_index('ix_graph_authorship_graph_id', 'graph_authorship', ['graph_id'], unique=False)
    # op.create_index('ix_graph_authorship_user_id', 'graph_authorship', ['user_id'], unique=False)

    # Existing rows need to have correct UUIDs from snapshot table
    op.execute("UPDATE graph_authorship ga SET graph_uuid = gs.public_uuid FROM graph_snapshots gs WHERE ga.graph_id = gs.id AND ga.graph_uuid IS NULL")
    op.execute("UPDATE graph_authorship ga SET user_uuid = us.public_uuid FROM users us WHERE ga.user_id = us.id AND ga.user_uuid IS NULL")

    # Add in nullable and server default values
    op.alter_column('graph_authorship', 'graph_uuid', nullable=False, server_default=sa.text("gen_random_uuid()"))
    op.alter_column('graph_authorship', 'user_uuid', nullable=False, server_default=sa.text("gen_random_uuid()"))

    op.create_unique_constraint('uq_graph_uuid_user_uuid', 'graph_authorship', ['graph_uuid', 'user_uuid'])

def downgrade() -> None:
    op.drop_constraint('uq_graph_uuid_user_uuid', 'graph_authorship', type_='unique')
    # op.drop_index('ix_graph_authorship_user_id', 'graph_authorship')
    # op.drop_index('ix_graph_authorship_graph_id', 'graph_authorship')
    op.drop_index('ix_graph_authorship_user_uuid', 'graph_authorship')
    op.drop_index('ix_graph_authorship_graph_uuid', 'graph_authorship')
    op.drop_column('graph_authorship', 'user_uuid')
    op.drop_column('graph_authorship', 'graph_uuid')