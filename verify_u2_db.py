#!/usr/bin/env python3
"""
Step 1: DB State Verification for U2 Stability Pass
"""
import sys
import os

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

try:
    from sqlalchemy import create_engine, text
    from backend.core.database import DATABASE_URL
    
    engine = create_engine(DATABASE_URL)
    
    print('=' * 80)
    print('Phase U2 Database Verification')
    print('=' * 80)
    
    with engine.connect() as conn:
        # Check device_table
        try:
            result = conn.execute(text('SELECT COUNT(*) FROM device_table;'))
            device_table_count = result.scalar()
            print(f'\n✓ device_table: {device_table_count} rows')
        except Exception as e:
            print(f'\n✗ device_table error: {e}')
            device_table_count = 0
        
        # Check devices
        try:
            result = conn.execute(text('SELECT COUNT(*) FROM devices;'))
            devices_count = result.scalar()
            print(f'✓ devices table: {devices_count} rows')
        except Exception as e:
            print(f'✗ devices error: {e}')
            devices_count = 0
        
        # Check maintenance columns
        try:
            result = conn.execute(text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'devices' 
                AND column_name IN ('maintenance_start', 'maintenance_end');
            """))
            cols = [r[0] for r in result]
            if len(cols) == 2:
                print(f'✓ Maintenance columns exist: {cols}')
            else:
                print(f'✗ Maintenance columns missing: {set(["maintenance_start", "maintenance_end"]) - set(cols)}')
        except Exception as e:
            print(f'✗ Column check error: {e}')
        
        # Check ID overlap
        if device_table_count > 0 and devices_count > 0:
            try:
                result = conn.execute(text("""
                    SELECT COUNT(*) FROM device_table dt
                    INNER JOIN devices d ON dt.id = d.id;
                """))
                matching = result.scalar()
                print(f'\n✓ Matching IDs: {matching} devices')
                print(f'  (device_table={device_table_count}, devices={devices_count})')
            except Exception as e:
                print(f'✗ ID overlap error: {e}')
        
        # Sample bookings
        try:
            result = conn.execute(text("""
                SELECT b.booking_id, b.device_id, d.name, d.status
                FROM booking_table b
                LEFT JOIN devices d ON b.device_id = d.id
                LIMIT 5;
            """))
            bookings = list(result)
            print(f'\n✓ Sample 5 bookings joined to devices:')
            for b in bookings:
                status_display = 'NOT_FOUND' if b[2] is None else f'{b[2]} (status={b[3]})'
                print(f'  Booking {b[0]}: device_id={b[1]} → {status_display}')
        except Exception as e:
            print(f'✗ Booking sample error: {e}')
    
    print('\n' + '=' * 80)
    
except ModuleNotFoundError as e:
    print(f"ERROR: {e}")
    print("Database verification requires sqlalchemy. Run inside backend container.")
    sys.exit(1)
except Exception as e:
    print(f"ERROR: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
