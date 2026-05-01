"""Create correct bookmarks table with UUIDs and IDs

Revision ID: 0003
Revises: 0001
Create Date: 2026-04-23

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

# revision identifiers, used by Alembic.
revision = '0003'
down_revision = '0001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'bookmarks',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('graph_id', sa.Integer(), nullable=False),
        sa.Column('user_uuid', UUID(as_uuid=True), nullable=False),
        sa.Column('graph_uuid', UUID(as_uuid=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['graph_id'], ['graph_snapshots.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('graph_id', 'user_id', name='uq_user_graph_bookmark_id'),
        sa.UniqueConstraint('graph_uuid', 'user_uuid', name='uq_user_graph_bookmark_uuid')
    )
    
    # Create indexes
    op.create_index('ix_bookmarks_graph_id', 'bookmarks', ['graph_id'], unique=False)
    op.create_index('ix_bookmarks_graph_uuid', 'bookmarks', ['graph_uuid'], unique=False)
    op.create_index('ix_bookmarks_user_id', 'bookmarks', ['user_id'], unique=False)
    op.create_index('ix_bookmarks_user_uuid', 'bookmarks', ['user_uuid'], unique=False)


def downgrade() -> None:
    # Drop indices first
    op.drop_index('ix_bookmarks_graph_id', table_name='bookmarks')
    op.drop_index('ix_bookmarks_graph_uuid', table_name='bookmarks')
    op.drop_index('ix_bookmarks_user_id', table_name='bookmarks')
    op.drop_index('ix_bookmarks_user_uuid', table_name='bookmarks')

    # Drop added table
    op.drop_table('bookmarks')
