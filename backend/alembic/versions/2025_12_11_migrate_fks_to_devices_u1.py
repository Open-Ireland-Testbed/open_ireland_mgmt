"""
Phase U1: Foreign Key Migration Script (DO NOT EXECUTE YET)

This script prepares the migration of all Foreign Keys from device_table to devices.
It will update the following tables:
- booking_table (Booking.device_id)
- device_ownership (DeviceOwnership.device_id)
- device_tags (DeviceTag.device_id)
- device_health_snapshot (DeviceHealthSnapshot.device_id)

WARNING: This script should only be executed after:
1. All Device data from device_table has been migrated to devices table
2. Scheduler code has been updated to use InventoryDevice
3. Full testing and validation is complete
4. A database backup has been created

DO NOT RUN THIS SCRIPT IN PHASE U1!
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic
revision = 'migrate_fks_to_devices_u1'
down_revision = 'add_maintenance_fields_u1'  # Depends on maintenance fields migration
branch_labels = None
depends_on = None


def upgrade():
    """
    Migrate Foreign Keys from device_table to devices.
    
    PREREQUISITES (must be completed before running this):
    1. All device data migrated from device_table to devices
    2. Device IDs aligned between tables
    3. Scheduler updated to use InventoryDevice
    4. Full backup created
    """
    
    print("=" * 80)
    print("WARNING: This migration will change FK constraints for scheduler tables!")
    print("Ensure all prerequisites are met before proceeding.")
    print("=" * 80)
    
    # =========================================================================
    # 1. Migrate booking_table.device_id FK
    # =========================================================================
    print("\n[1/4] Migrating booking_table.device_id FK...")
    
    # Drop existing FK constraint
    op.drop_constraint(
        'booking_table_device_id_fkey',
        'booking_table',
        type_='foreignkey'
    )
    
    # Add new FK constraint pointing to devices table
    op.create_foreign_key(
        'booking_table_device_id_fkey',
        'booking_table',
        'devices',
        ['device_id'],
        ['id'],
        ondelete='CASCADE'  # Cascade delete bookings if device is deleted
    )
    
    print("   ✓ booking_table.device_id now points to devices.id")
    
    # =========================================================================
    # 2. Migrate device_ownership.device_id FK
    # =========================================================================
    print("\n[2/4] Migrating device_ownership.device_id FK...")
    
    # Drop existing FK constraint
    op.drop_constraint(
        'device_ownership_device_id_fkey',
        'device_ownership',
        type_='foreignkey'
    )
    
    # Add new FK constraint pointing to devices table
    op.create_foreign_key(
        'device_ownership_device_id_fkey',
        'device_ownership',
        'devices',
        ['device_id'],
        ['id'],
        ondelete='CASCADE'
    )
    
    print("   ✓ device_ownership.device_id now points to devices.id")
    
    # =========================================================================
    # 3. Migrate device_tags.device_id FK
    # =========================================================================
    print("\n[3/4] Migrating device_tags.device_id FK...")
    
    # Drop existing FK constraint
    op.drop_constraint(
        'device_tags_device_id_fkey',
        'device_tags',
        type_='foreignkey'
    )
    
    # Add new FK constraint pointing to devices table
    op.create_foreign_key(
        'device_tags_device_id_fkey',
        'device_tags',
        'devices',
        ['device_id'],
        ['id'],
        ondelete='CASCADE'
    )
    
    print("   ✓ device_tags.device_id now points to devices.id")
    
    # =========================================================================
    # 4. Migrate device_health_snapshot.device_id FK
    # =========================================================================
    print("\n[4/4] Migrating device_health_snapshot.device_id FK...")
    
    # Drop existing FK constraint
    op.drop_constraint(
        'device_health_snapshot_device_id_fkey',
        'device_health_snapshot',
        type_='foreignkey'
    )
    
    # Add new FK constraint pointing to devices table
    op.create_foreign_key(
        'device_health_snapshot_device_id_fkey',
        'device_health_snapshot',
        'devices',
        ['device_id'],
        ['id'],
        ondelete='CASCADE'
    )
    
    print("   ✓ device_health_snapshot.device_id now points to devices.id")
    
    print("\n" + "=" * 80)
    print("FK migration completed successfully!")
    print("All scheduler tables now reference devices instead of device_table.")
    print("=" * 80)


def downgrade():
    """
    Rollback FK migrations - point back to device_table.
    
    WARNING: This assumes device_table still exists!
    """
    
    print("=" * 80)
    print("Rolling back FK migrations - pointing back to device_table...")
    print("=" * 80)
    
    # =========================================================================
    # Rollback 4: device_health_snapshot.device_id
    # =========================================================================
    print("\n[1/4] Rolling back device_health_snapshot.device_id FK...")
    
    op.drop_constraint(
        'device_health_snapshot_device_id_fkey',
        'device_health_snapshot',
        type_='foreignkey'
    )
    
    op.create_foreign_key(
        'device_health_snapshot_device_id_fkey',
        'device_health_snapshot',
        'device_table',
        ['device_id'],
        ['id'],
        ondelete='CASCADE'
    )
    
    print("   ✓ device_health_snapshot.device_id reverted to device_table.id")
    
    # =========================================================================
    # Rollback 3: device_tags.device_id
    # =========================================================================
    print("\n[2/4] Rolling back device_tags.device_id FK...")
    
    op.drop_constraint(
        'device_tags_device_id_fkey',
        'device_tags',
        type_='foreignkey'
    )
    
    op.create_foreign_key(
        'device_tags_device_id_fkey',
        'device_tags',
        'device_table',
        ['device_id'],
        ['id'],
        ondelete='CASCADE'
    )
    
    print("   ✓ device_tags.device_id reverted to device_table.id")
    
    # =========================================================================
    # Rollback 2: device_ownership.device_id
    # =========================================================================
    print("\n[3/4] Rolling back device_ownership.device_id FK...")
    
    op.drop_constraint(
        'device_ownership_device_id_fkey',
        'device_ownership',
        type_='foreignkey'
    )
    
    op.create_foreign_key(
        'device_ownership_device_id_fkey',
        'device_ownership',
        'device_table',
        ['device_id'],
        ['id'],
        ondelete='CASCADE'
    )
    
    print("   ✓ device_ownership.device_id reverted to device_table.id")
    
    # =========================================================================
    # Rollback 1: booking_table.device_id
    # =========================================================================
    print("\n[4/4] Rolling back booking_table.device_id FK...")
    
    op.drop_constraint(
        'booking_table_device_id_fkey',
        'booking_table',
        type_='foreignkey'
    )
    
    op.create_foreign_key(
        'booking_table_device_id_fkey',
        'booking_table',
        'device_table',
        ['device_id'],
        ['id'],
        ondelete='CASCADE'
    )
    
    print("   ✓ booking_table.device_id reverted to device_table.id")
    
    print("\n" + "=" * 80)
    print("FK rollback completed successfully!")
    print("All scheduler tables now reference device_table again.")
    print("=" * 80)


# =========================================================================
# Safety Check Functions
# =========================================================================

def verify_prerequisites():
    """
    Verify that all prerequisites are met before running migration.
    
    Call this before upgrade() to validate system state.
    """
    from sqlalchemy import create_engine, text
    from backend.core.database import DATABASE_URL
    
    print("\nVerifying migration prerequisites...")
    engine = create_engine(DATABASE_URL)
    
    with engine.connect() as conn:
        # Check 1: devices table exists and has data
        result = conn.execute(text("SELECT COUNT(*) FROM devices;"))
        devices_count = result.scalar()
        print(f"  ✓ devices table: {devices_count} rows")
        
        if devices_count == 0:
            print("  ✗ ERROR: devices table is empty! Cannot migrate FKs.")
            return False
        
        # Check 2: device_table exists
        result = conn.execute(text("SELECT COUNT(*) FROM device_table;"))
        legacy_count = result.scalar()
        print(f"  ✓ device_table: {legacy_count} rows")
        
        # Check 3: Row counts match
        if devices_count != legacy_count:
            print(f"  ⚠ WARNING: Row count mismatch!")
            print(f"    device_table: {legacy_count}, devices: {devices_count}")
            print(f"    Ensure data migration is complete before proceeding.")
            return False
        
        # Check 4: Confirm all bookings have valid device_id in devices
        result = conn.execute(text("""
            SELECT COUNT(*) FROM booking_table b
            WHERE NOT EXISTS (
                SELECT 1 FROM devices d WHERE d.id = b.device_id
            );
        """))
        orphaned_bookings = result.scalar()
        
        if orphaned_bookings > 0:
            print(f"  ✗ ERROR: {orphaned_bookings} bookings reference non-existent devices!")
            print(f"    Cannot proceed with FK migration.")
            return False
        
        print("  ✓ All bookings have valid device references")
        
    print("\n✓ All prerequisites verified. Safe to proceed with FK migration.")
    return True


if __name__ == "__main__":
    print(__doc__)
    print("\nThis script is for Alembic migration only.")
    print("To run verification:")
    print("  python -c 'from migrate_fks_to_devices_u1 import verify_prerequisites; verify_prerequisites()'")
