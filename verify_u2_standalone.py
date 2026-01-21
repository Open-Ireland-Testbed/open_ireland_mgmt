import os
import sys
from sqlalchemy import create_engine, text

# Get DB URL from env
db_url = os.getenv("DATABASE_URL")
if not db_url:
    print("Error: DATABASE_URL not found in environment")
    sys.exit(1)

print(f"Connecting to DB: {db_url.split('@')[-1]}") # Hide password

try:
    engine = create_engine(db_url)
    with engine.connect() as conn:
        print("\n=== Schema Reality Check ===")
        
        # Check 1: Row Counts
        devices_count = conn.execute(text("SELECT COUNT(*) FROM devices")).scalar()
        device_table_count = conn.execute(text("SELECT COUNT(*) FROM device_table")).scalar()
        print(f"devices table count: {devices_count}")
        print(f"device_table count: {device_table_count}")
        
        # Check 2: Synchronization
        matching = conn.execute(text("SELECT COUNT(*) FROM device_table dt JOIN devices d ON dt.id = d.id")).scalar()
        print(f"Matching IDs: {matching}")
        
        if matching != devices_count or matching != device_table_count:
            print("⚠ MISMATCH DETECTED")
            
            # Find mismatches
            missing_in_devices = conn.execute(text("SELECT id FROM device_table WHERE id NOT IN (SELECT id FROM devices) LIMIT 5")).fetchall()
            if missing_in_devices:
                print(f"IDs in device_table but not devices: {[r[0] for r in missing_in_devices]}")

            missing_in_legacy = conn.execute(text("SELECT id FROM devices WHERE id NOT IN (SELECT id FROM device_table) LIMIT 5")).fetchall()
            if missing_in_legacy:
                print(f"IDs in devices but not device_table: {[r[0] for r in missing_in_legacy]}")
                
        # Check 3: Maintenance Columns
        print("\nChecking maintenance columns in 'devices'...")
        try:
            conn.execute(text("SELECT maintenance_start, maintenance_end FROM devices LIMIT 1"))
            print("✓ maintenance_start/end exist in 'devices'")
        except Exception as e:
            print(f"✗ maintenance columns MISSING in 'devices': {e}")
            
        # Check 4: Booking FKs
        # We can't easily check FK constraints via SELECT, but we can check checking validity
        # Assuming we migrated properly, bookings should point to device ids that exist in both if synced
        
        print("\n=== Booking FK Sample ===")
        bookings = conn.execute(text("SELECT device_id FROM booking_table LIMIT 5")).fetchall()
        print(f"Sample Booking device_ids: {[r[0] for r in bookings]}")

except Exception as e:
    print(f"FATAL ERROR: {e}")
    sys.exit(1)
