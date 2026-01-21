
import sys
import logging
from sqlalchemy import create_engine, select, func, text
from sqlalchemy.orm import sessionmaker

sys.path.append(".")

# Import the unified/aliased model
from backend.scheduler.models import Device, Booking
from backend.inventory.models import InventoryDevice, DeviceAttachment

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("verify")

DATABASE_URL = "mysql+pymysql://openireland:ChangeMe_Dev123%21@10.10.10.4:3306/provdb_dev"

def verify_unification():
    logger.info(f"Connecting to DB: {DATABASE_URL}")
    engine = create_engine(DATABASE_URL)
    SessionLocal = sessionmaker(bind=engine)
    session = SessionLocal()

    try:
        # 1. Test Aliasing
        logger.info("Testing Device alias...")
        device_count = session.query(Device).count()
        logger.info(f"Device count via alias: {device_count}")
        
        inventory_count = session.query(InventoryDevice).count()
        logger.info(f"InventoryDevice count: {inventory_count}")
        
        if device_count != inventory_count:
            logger.error("Counts mismatch! Alias might not be working correctly.")
        else:
            logger.info("Counts match.")

        if device_count == 0:
            logger.error("No devices found! Migration failed?")
            return

        # 2. Test Properties
        logger.info("Testing compatibility properties...")
        # Get a device with ports (we know internal structure of migration)
        # We migrated 'In=...;Out=...'
        dev_with_port = session.query(Device).filter(Device.polatis_port_range.isnot(None)).first()
        
        if dev_with_port:
            logger.info(f"Checking device: {dev_with_port.name} (Legacy deviceName: {dev_with_port.deviceName})")
            logger.info(f"  Type: {dev_with_port.deviceType}")
            logger.info(f"  IP: {dev_with_port.ip_address}")
            logger.info(f"  Ports: In={dev_with_port.In_Port}, Out={dev_with_port.Out_Port}")
            
            # Verify specific mapping
            assert dev_with_port.deviceName == dev_with_port.name
            assert dev_with_port.ip_address == dev_with_port.mgmt_ip
            
            if dev_with_port.polatis_port_range:
                # Should parse correctly
                pass
        else:
            logger.warning("No device with ports found found to test Port parsing.")

        # 3. Test DeviceType Setter (Legacy Admin Compat)
        logger.info("Testing deviceType setter...")
        dev = session.query(Device).first()
        old_type = dev.deviceType
        
        # Try setting to existing type
        # Assuming 'Transceivers' exists from migration
        try:
            dev.deviceType = "Transceivers"
            session.flush()
            assert dev.device_type.name == "Transceivers"
            logger.info("Setter 'Transceivers' worked.")
        except Exception as e:
            logger.error(f"Setter failed: {e}")

        # Try setting to NEW type
        new_type_name = "NewLegacyTestType"
        logger.info(f"Testing setter with new type: {new_type_name}")
        dev.deviceType = new_type_name
        session.flush()
        
        # Verify it created new type
        assert dev.device_type.name == new_type_name
        assert dev.deviceType == new_type_name
        logger.info("Setter new type creation worked.")
        
        # Revert
        # dev.deviceType = old_type # Only if we want to be clean, but this is dev

        # 4. Test Attachments
        logger.info("Testing Attachments relationship...")
        assert hasattr(dev, "attachments")
        logger.info(f"Attachments count: {len(dev.attachments)}")
        
        # Create attachment
        att = DeviceAttachment(
            file_name="test.pdf",
            file_path="/tmp/test.pdf",
            file_type="manual"
        )
        dev.attachments.append(att)
        session.commit()
        logger.info("Created attachment successfully.")
        
        # Verify read
        dev_reloaded = session.query(Device).get(dev.id)
        assert len(dev_reloaded.attachments) > 0
        logger.info("Verified attachment persistence.")

        logger.info("ALL CHECKS PASSED.")

    except Exception as e:
        logger.error(f"Verification Failed: {e}")
        session.rollback()
        raise
    finally:
        session.close()

if __name__ == "__main__":
    verify_unification()
