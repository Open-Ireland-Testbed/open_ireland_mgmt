"""Add maintenance fields to devices table for scheduler compatibility

Revision ID: add_maintenance_fields_u1
Revises: (will be filled by alembic)
Create Date: 2025-12-11 19:30:00

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_maintenance_fields_u1'
down_revision = None  # User should update this to the latest revision
branch_labels = None
depends_on = None


def upgrade():
    """Add maintenance_start and maintenance_end columns to devices table."""
    # Add maintenance_start column
    op.add_column(
        'devices',
        sa.Column('maintenance_start', sa.String(length=100), nullable=True)
    )
    
    # Add maintenance_end column
    op.add_column(
        'devices',
        sa.Column('maintenance_end', sa.String(length=100), nullable=True)
    )


def downgrade():
    """Remove maintenance_start and maintenance_end columns from devices table."""
    op.drop_column('devices', 'maintenance_end')
    op.drop_column('devices', 'maintenance_start')
