
import sys
import logging
from sqlalchemy import create_engine, select, func, text
from sqlalchemy.orm import sessionmaker, Session

# Import models
# We need to ensure we can import from backend. 
# We'll run this from the root directory.
sys.path.append(".")

from backend.inventory.models import InventoryDevice, DeviceType, Manufacturer, Site
from backend.scheduler.models import Device as LegacyDevice
from backend.core.database import Base

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("migration")

DATABASE_URL = "mysql+pymysql://openireland:ChangeMe_Dev123%21@10.10.10.4:3306/provdb_dev"

def migrate_devices():
    logger.info(f"Connecting to DB: {DATABASE_URL}")
    engine = create_engine(DATABASE_URL)
    SessionLocal = sessionmaker(bind=engine)
    session = SessionLocal()

    try:
        # 1. Fetch all legacy devices
        logger.info("Fetching legacy devices...")
        legacy_devices = session.execute(text("SELECT * FROM device_table")).fetchall()
        logger.info(f"Found {len(legacy_devices)} legacy devices.")

        if len(legacy_devices) == 0:
            logger.warning("No legacy devices found. Exiting.")
            return

        # 2. Check if target table is empty
        target_count = session.query(func.count(InventoryDevice.id)).scalar()
        if target_count > 0:
            logger.error(f"Target 'devices' table is NOT empty ({target_count} rows). Aborting to prevent duplicates.")
            return

        # 3. Create Device Types cache
        device_types = {}
        
        # 4. Process each device
        new_devices = []
        
        # Keep track of IDs to ensure we don't duplicate if script reruns partially (though we checked count)
        processed_ids = set()

        for row in legacy_devices:
            # Row access by key (SQLAlchemy Row)
            # Keys: id, polatis_name, deviceType, deviceName, ip_address, status, maintenance_start, maintenance_end, Out_Port, In_Port
            
            legacy_id = row.id
            name = row.deviceName
            legacy_type = row.deviceType
            ip = row.ip_address
            status = row.status
            polatis_name = row.polatis_name
            in_port = row.In_Port
            out_port = row.Out_Port
            
            if legacy_id in processed_ids:
                continue
            
            # Resolve Device Type
            if legacy_type not in device_types:
                # Check DB first
                dt = session.query(DeviceType).filter(DeviceType.name == legacy_type).first()
                if not dt:
                    logger.info(f"Creating new DeviceType: {legacy_type}")
                    dt = DeviceType(
                        name=legacy_type,
                        category="OPTICAL", # Default
                        is_schedulable=True,
                        has_ports=True # Defaulting to true as most legacy devices seem to have ports
                    )
                    session.add(dt)
                    session.flush() # Get ID
                device_types[legacy_type] = dt.id
            
            type_id = device_types[legacy_type]
            
            # Format Port Range
            polatis_port_range = None
            if in_port is not None and out_port is not None:
                polatis_port_range = f"In={in_port};Out={out_port}"
            
            # Create new device
            new_device = InventoryDevice(
                id=legacy_id, # PRESERVE ID
                name=name,
                device_type_id=type_id,
                mgmt_ip=ip,
                status=status,
                polatis_name=polatis_name,
                polatis_port_range=polatis_port_range,
                # Fields not in legacy:
                serial_number=None,
                model=None,
                site_id=None,
                rack=None,
                u_position=None,
                owner_group=None,
                hostname=None,
                oi_id=None,
                manufacturer_id=None
            )
            
            # Add to session
            # We strictly set ID, so we use merge or add. 
            # Since table is empty, add is fine.
            # But we must be careful with auto-increment if we insert explicitly.
            # MySQL usually handles explicit ID inserts fine.
            session.add(new_device)
            processed_ids.add(legacy_id)

        logger.info(f"Staging {len(processed_ids)} devices for insertion...")
        session.commit()
        logger.info("Migration committed successfully!")
        
        # Verify
        final_count = session.query(func.count(InventoryDevice.id)).scalar()
        logger.info(f"Final 'devices' count: {final_count}")
        
    except Exception as e:
        logger.error(f"Migration Failed: {e}")
        session.rollback()
        raise
    finally:
        session.close()

if __name__ == "__main__":
    migrate_devices()
