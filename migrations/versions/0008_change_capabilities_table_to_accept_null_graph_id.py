"""Change capabilities table to accept NULL graph_id

Revision ID: 0008
Revises: 0007
Branch Date: 2026-08-02

The capabilities table currently does not accept NULL graph_id values, and upon graph deletion it throws an error.
This migration will allow NULL graph_id values and migrate existing rows safely.
This will enable graph deletion, which will set the graph_id to NULL in the capabilities table,
but will retain graph_uuid so that a reference can be maintained, without database integrity issues.

Note: Upgradation is safe, but downgrade will lead to catastrophic data loss.
DO NOT ATTEMPT TO DOWNGRADE THIS MIGRATION WITHOUT SAVING BACKUPS.
"""
from alembic import op
from alembic.context import get_x_argument
from alembic.util import CommandError

# revision identifiers, used by Alembic.
revision = '0008'
down_revision = '0007'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Add the column nullable so existing rows are accepted.
    op.alter_column('capabilities', 'graph_id', nullable=True)

    # 2. On delete cascades
    op.alter_column('capabilities', 'graph_id', ondelete="SET NULL")
    op.alter_column('capabilities', 'user_id', ondelete="CASCADE")
    op.alter_column('graph_snapshots', 'graph_id', ondelete="SET NULL")     # graph_snapshots table, explicit set null

def downgrade() -> None:
    """
    DO NOT ATTEMPT TO DOWNGRADE THIS MIGRATION.
    Doing so will result in catastrophic data loss for capabilities table.
    """

    # 1. Block automatic downgrade unless explicitly allowed
    allow_destructive = get_x_argument(as_dictionary=True).get('I_KNOW_THIS_DELETES_DATA')
    
    if not allow_destructive:
        raise CommandError(
            "THIS IS A POTENTIAL DESTRUCTIVE MIGRATION. "
            "This downgrade will DELETE rows with NULL foreign keys! "
            "It might result in CATASTROPHIC DATA LOSS for the CAPABILITIES table. "
            "Save a backup of the database before proceeding. "
            "If you are sure, rerun with: alembic downgrade -x I_KNOW_THIS_DELETES_DATA=true <revision>"
        )

    # 2. Drop rows with NULL graph_id
    op.execute("DELETE FROM capabilities WHERE graph_id IS NULL")

    # 3. Remove the nullable constraint
    op.alter_column('capabilities', 'graph_id', nullable=False)

    # 4. Set the ondelete constraint back to CASCADE
    op.alter_column('capabilities', 'graph_id', ondelete="CASCADE")
    op.alter_column('capabilities', 'user_id', ondelete="CASCADE")