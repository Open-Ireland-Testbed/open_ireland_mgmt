"""
U2 Debug Endpoints for DB Verification and Status Migration
Admin-only endpoints to verify database state without docker exec.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from backend.core.deps import get_db
from backend.scheduler.routers.admin import admin_required

router = APIRouter(prefix="/admin/v2/debug", tags=["admin-debug"])


@router.get("/db-status")
def get_db_status(db: Session = Depends(get_db), auth: None = Depends(admin_required)):
    """
    Verify database state for U2 migration.
    Returns detailed synchronization status between device_table and devices.
    """
    try:
        # Count device_table rows
        device_table_count = db.execute(text("SELECT COUNT(*) FROM device_table;")).scalar()
        
        # Count devices rows
        devices_count = db.execute(text("SELECT COUNT(*) FROM devices;")).scalar()
        
        # Count matching IDs
        matching_ids_count = db.execute(text("""
            SELECT COUNT(*) FROM device_table dt
            INNER JOIN devices d ON dt.id = d.id;
        """)).scalar()
        
        # Find missing in devices (up to 20)
        missing_in_devices = db.execute(text("""
            SELECT dt.id FROM device_table dt
            LEFT JOIN devices d ON dt.id = d.id
            WHERE d.id IS NULL
            LIMIT 20;
        """)).fetchall()
        missing_in_devices_ids = [row[0] for row in missing_in_devices]
        
        # Find missing in device_table (up to 20)
        missing_in_device_table = db.execute(text("""
            SELECT d.id FROM devices d
            LEFT JOIN device_table dt ON d.id = dt.id
            WHERE dt.id IS NULL
            LIMIT 20;
        """)).fetchall()
        missing_in_device_table_ids = [row[0] for row in missing_in_device_table]
        
        # Check if maintenance columns exist
        maintenance_columns = db.execute(text("""
            SELECT column_name FROM information_schema.columns
            WHERE table_name = 'devices'
            AND column_name IN ('maintenance_start', 'maintenance_end');
        """)).fetchall()
        devices_has_maintenance_columns = len(maintenance_columns) == 2
        
        # Sample bookings JOIN devices
        bookings_sample = db.execute(text("""
            SELECT b.booking_id, b.device_id, d.id as device_table_id, d.name, d.status
            FROM booking_table b
            LEFT JOIN devices d ON b.device_id = d.id
            LIMIT 5;
        """)).fetchall()
        
        bookings_join_devices_sample = [
            {
                "booking_id": row[0],
                "booking_device_id": row[1],
                "device_id": row[2],
                "device_name": row[3],
                "device_status": row[4]
            }
            for row in bookings_sample
        ]
        
        return {
            "status": "success",
            "device_table_count": device_table_count,
            "devices_count": devices_count,
            "matching_ids_count": matching_ids_count,
            "synchronization_percentage": round((matching_ids_count / max(device_table_count, 1)) * 100, 2),
            "missing_in_devices_ids_sample": missing_in_devices_ids,
            "missing_in_device_table_ids_sample": missing_in_device_table_ids,
            "devices_has_maintenance_columns": devices_has_maintenance_columns,
            "bookings_join_devices_sample": bookings_join_devices_sample,
            "maintenance_columns_found": [row[0] for row in maintenance_columns]
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database verification failed: {str(e)}")


@router.post("/migrate-device-status")
def migrate_device_status(db: Session = Depends(get_db), auth: None = Depends(admin_required)):
    """
    Migrate device status values from inventory format to scheduler format.
    Idempotent operation.
    
    Mappings:
    - active -> Available
    - in_maintenance -> Maintenance
    - retired -> Unavailable
    """
    try:
        # Count current status values
        status_counts_before = db.execute(text("""
            SELECT status, COUNT(*) as count
            FROM devices
            GROUP BY status;
        """)).fetchall()
        
        counts_before = {row[0]: row[1] for row in status_counts_before}
        
        # Migrate active -> Available
        active_updated = db.execute(text("""
            UPDATE devices
            SET status = 'Available'
            WHERE status = 'active';
        """)).rowcount
        
        # Migrate in_maintenance -> Maintenance
        maintenance_updated = db.execute(text("""
            UPDATE devices
            SET status = 'Maintenance'
            WHERE status = 'in_maintenance';
        """)).rowcount
        
        # Migrate retired -> Unavailable
        retired_updated = db.execute(text("""
            UPDATE devices
            SET status = 'Unavailable'
            WHERE status = 'retired';
        """)).rowcount
        
        db.commit()
        
        # Count after migration
        status_counts_after = db.execute(text("""
            SELECT status, COUNT(*) as count
            FROM devices
            GROUP BY status;
        """)).fetchall()
        
        counts_after = {row[0]: row[1] for row in status_counts_after}
        
        return {
            "status": "success",
            "migrations": {
                "active_to_Available": active_updated,
                "in_maintenance_to_Maintenance": maintenance_updated,
                "retired_to_Unavailable": retired_updated
            },
            "total_migrated": active_updated + maintenance_updated + retired_updated,
            "status_counts_before": counts_before,
            "status_counts_after": counts_after
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Status migration failed: {str(e)}")
