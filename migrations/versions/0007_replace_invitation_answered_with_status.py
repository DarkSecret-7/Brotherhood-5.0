"""Replace AuthorshipInvitation.answered (bool) with invitation_status (str).

The previous schema used a boolean `answered` flag (meaning 'has the recipient
replied to this invitation'). For consistency with proposals (which carry a
proposal_status string like 'Pending' / 'Executed' / 'Rejected'), we now use a
string `invitation_status` whose values are 'Pending', 'Accepted', 'Rejected'.

Migration:
  1. Add invitation_status column (nullable initially).
  2. Backfill from answered: True  -> 'Accepted', False -> 'Pending'.
  3. Set NOT NULL with server default 'Pending' so future inserts are safe.
  4. Drop the answered column.

The downgrade reverses these steps.
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0007'
down_revision = '0006'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'authorship_invitations',
        sa.Column('invitation_status', sa.String(length=32), nullable=True),
    )
    op.execute(
        "UPDATE authorship_invitations "
        "SET invitation_status = CASE WHEN answered THEN 'Accepted' ELSE 'Pending' END"
    )
    op.alter_column(
        'authorship_invitations',
        'invitation_status',
        nullable=False,
        server_default='Pending',
    )
    op.drop_column('authorship_invitations', 'answered')


def downgrade() -> None:
    op.add_column(
        'authorship_invitations',
        sa.Column('answered', sa.Boolean(), nullable=False, server_default=sa.text('false')),
    )
    op.execute(
        "UPDATE authorship_invitations "
        "SET answered = (invitation_status = 'Accepted')"
    )
    op.drop_column('authorship_invitations', 'invitation_status')
