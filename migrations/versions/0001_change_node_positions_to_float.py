"""Change node positions from Integer to Float

Revision ID: 0001
Revises: 
Create Date: 2026-04-13

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '0001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Alter x column from Integer to Float
    op.alter_column('nodes', 'x',
               existing_type=sa.INTEGER(),
               type_=sa.Float(),
               existing_nullable=True)
    
    # Alter y column from Integer to Float
    op.alter_column('nodes', 'y',
               existing_type=sa.INTEGER(),
               type_=sa.Float(),
               existing_nullable=True)


def downgrade() -> None:
    # Revert x column from Float to Integer
    op.alter_column('nodes', 'x',
               existing_type=sa.Float(),
               type_=sa.INTEGER(),
               existing_nullable=True)
    
    # Revert y column from Float to Integer
    op.alter_column('nodes', 'y',
               existing_type=sa.Float(),
               type_=sa.INTEGER(),
               existing_nullable=True)
