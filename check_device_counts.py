#!/usr/bin/env python3
"""Check database row counts for device tables."""

import os
import sys

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, text
from backend.core.database import DATABASE_URL

def check_device_counts():
    """Check row counts for device_table and devices."""
    engine = create_engine(DATABASE_URL)
    
    with engine.connect() as conn:
        # Count device_table rows
        result = conn.execute(text("SELECT COUNT(*) FROM device_table;"))
        device_table_count = result.scalar()
        
        # Count devices rows
        result = conn.execute(text("SELECT COUNT(*) FROM devices;"))
        devices_count = result.scalar()
        
        print(f"device_table (legacy scheduler): {device_table_count} rows")
        print(f"devices (inventory): {devices_count} rows")
        print(f"\nCurrent source of truth: device_table ({device_table_count} rows)")
        
        if devices_count > 0:
            print(f"devices table: {devices_count} rows (currently unused by scheduler)")
        else:
            print(f"devices table: empty / no data")

if __name__ == "__main__":
    check_device_counts()
