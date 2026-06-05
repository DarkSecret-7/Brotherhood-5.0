"""Create authorship_invitations table

Revision ID: 0004
Revises: 0003
Create Date: 2026-05-26

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = '0004'
down_revision = '0003'
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.create_table(
        'authorship_invitations',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('graph_id', sa.Integer(), nullable=False),
        sa.Column('graph_uuid', UUID(as_uuid=True), nullable=False),
        sa.Column('initiator_id', sa.Integer(), nullable=False),
        sa.Column('initiator_uuid', UUID(as_uuid=True), nullable=False),
        sa.Column('recipient_id', sa.Integer(), nullable=False),
        sa.Column('recipient_uuid', UUID(as_uuid=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('answered', sa.Boolean(), nullable=False, server_default='false'),
        sa.ForeignKeyConstraint(['graph_id'], ['graph_snapshots.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['initiator_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['recipient_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )

    op.create_index('ix_authorship_invitations_graph_id', 'authorship_invitations', ['graph_id'], unique=False)
    op.create_index('ix_authorship_invitations_graph_uuid', 'authorship_invitations', ['graph_uuid'], unique=False)
    op.create_index('ix_authorship_invitations_initiator_id', 'authorship_invitations', ['initiator_id'], unique=False)
    op.create_index('ix_authorship_invitations_initiator_uuid', 'authorship_invitations', ['initiator_uuid'], unique=False)
    op.create_index('ix_authorship_invitations_recipient_id', 'authorship_invitations', ['recipient_id'], unique=False)
    op.create_index('ix_authorship_invitations_recipient_uuid', 'authorship_invitations', ['recipient_uuid'], unique=False)

def downgrade() -> None:
    op.drop_index('ix_authorship_invitations_graph_id', table_name='authorship_invitations')
    op.drop_index('ix_authorship_invitations_graph_uuid', table_name='authorship_invitations')
    op.drop_index('ix_authorship_invitations_initiator_id', table_name='authorship_invitations')
    op.drop_index('ix_authorship_invitations_initiator_uuid', table_name='authorship_invitations')
    op.drop_index('ix_authorship_invitations_recipient_id', table_name='authorship_invitations')
    op.drop_index('ix_authorship_invitations_recipient_uuid', table_name='authorship_invitations')

    op.drop_table('authorship_invitations')