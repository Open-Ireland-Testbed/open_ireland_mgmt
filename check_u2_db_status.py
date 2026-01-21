#!/usr/bin/env python3
"""
DB Status Check for Phase U2
Verify device_table and devices table synchronization before migration.
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, text
from backend.core.database import DATABASE_URL

def check_device_tables():
    """Check synchronization status between device_table and devices."""
    engine = create_engine(DATABASE_URL)
    
    print("=" * 80)
    print("Phase U2 Database Status Check")
    print("=" * 80)
    
    with engine.connect() as conn:
        # Check device_table
        try:
            result = conn.execute(text("SELECT COUNT(*) FROM device_table;"))
            device_table_count = result.scalar()
            print(f"\n✓ device_table exists: {device_table_count} rows")
        except Exception as e:
            print(f"\n✗ device_table error: {e}")
            device_table_count = 0
        
        # Check devices table
        try:
            result = conn.execute(text("SELECT COUNT(*) FROM devices;"))
            devices_count = result.scalar()
            print(f"✓ devices table exists: {devices_count} rows")
        except Exception as e:
            print(f"✗ devices table error: {e}")
            devices_count = 0
        
        # Check if maintenance columns exist
        try:
            result = conn.execute(text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'devices' 
                AND column_name IN ('maintenance_start', 'maintenance_end');
            """))
            maint_columns = [row[0] for row in result]
            if len(maint_columns) == 2:
                print(f"✓ Maintenance columns exist in devices table")
            else:
                print(f"⚠ Maintenance columns missing: {set(['maintenance_start', 'maintenance_end']) - set(maint_columns)}")
        except Exception as e:
            print(f"✗ Column check error: {e}")
        
        # Check ID overlap (are device IDs synchronized?)
        if device_table_count > 0 and devices_count > 0:
            try:
                result = conn.execute(text("""
                    SELECT COUNT(*) FROM device_table dt
                    INNER JOIN devices d ON dt.id = d.id;
                """))
                matching_ids = result.scalar()
                print(f"\n✓ Matching IDs: {matching_ids} devices have same ID in both tables")
                
                if matching_ids != min(device_table_count, devices_count):
                    print(f"⚠ WARNING: Not all IDs match between tables!")
                    print(f"  device_table: {device_table_count}, devices: {devices_count}, matching: {matching_ids}")
            except Exception as e:
                print(f"✗ ID overlap check error: {e}")
        
        # Check Booking FK target
        try:
            result = conn.execute(text("""
                SELECT 
                    tc.constraint_name,
                    ccu.table_name AS foreign_table_name
                FROM information_schema.table_constraints AS tc 
                JOIN information_schema.constraint_column_usage AS ccu
                    ON ccu.constraint_name = tc.constraint_name
                WHERE tc.table_name = 'booking_table' 
                AND tc.constraint_type = 'FOREIGN KEY'
                AND ccu.column_name = 'id';
            """))
            fks = list(result)
            for fk in fks:
                if 'device' in fk[0].lower():
                    print(f"\n✓ Booking FK: {fk[0]} → {fk[1]}")
        except Exception as e:
            print(f"✗ FK check error: {e}")
    
    print("\n" + "=" * 80)
    print("Database Status Summary")
    print("=" * 80)
    print(f"device_table: {device_table_count} rows")
    print(f"devices: {devices_count} rows")
    
    if device_table_count > 0 and devices_count == 0:
        print("\n⚠ WARNING: devices table is empty!")
        print("   Migration cannot proceed until data is populated.")
        return False
    
    if devices_count > 0:
        print("\n✓ READY: devices table has data, can proceed with U2 migration")
        print("  Note: device_table will remain as backup")
        return True
    
    return False

if __name__ == "__main__":
    ready = check_device_tables()
    sys.exit(0 if ready else 1)
