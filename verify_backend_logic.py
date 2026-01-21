
import sys
import logging
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Mock permissions/deps if needed, or structured to just test query
sys.path.append(".")

from backend.scheduler import models, schemas
from backend.inventory import models as inventory_models
# We need to test the logic inside list_devices manually since we can't easily mock Request/Context
from sqlalchemy import func

DATABASE_URL = "mysql+pymysql://openireland:ChangeMe_Dev123%21@10.10.10.4:3306/provdb_dev"
logging.basicConfig()
# logging.getLogger('sqlalchemy.engine').setLevel(logging.INFO)

def test_backend_logic():
    print("Connecting to DB...")
    engine = create_engine(DATABASE_URL)
    SessionLocal = sessionmaker(bind=engine)
    session = SessionLocal()

    try:
        print("\n--- Testing Admin V2 Query Logic ---")
        Device = models.Device
        query = session.query(Device)
        
        # Simulate JOIN used in admin_v2
        print("Applying JOIN(Device.device_type)...")
        query = query.join(models.Device.device_type)
        
        # Simulate FILTER
        # query = query.filter(inventory_models.DeviceType.name.ilike("%Tera%"))
        
        count = query.count()
        print(f"Count after join: {count} (Expected ~202)")
        
        devices = query.order_by(models.Device.name.asc()).limit(5).all()
        print(f"Fetched {len(devices)} devices via V2 query.")
        
        print("\n--- Testing V2 Serialization (DeviceRow) ---")
        # Simulate _device_row mapping (simplified)
        for d in devices:
            try:
                row = schemas.DeviceRow(
                    id=d.id,
                    name=d.deviceName or f"Device {d.id}",
                    type=d.deviceType or "Unknown",
                    status=d.status or "Unknown",
                    deviceName=d.deviceName,
                    deviceType=d.deviceType,
                    owner=None,
                    tags=[]
                )
                print(f"Serialized ID {d.id}: Name='{row.name}', DeviceName='{row.deviceName}', Type='{row.type}'")
            except Exception as e:
                print(f"Failed to serialize V2 ID {d.id}: {e}")

        print("\n--- Testing V1 Serialization (DeviceResponse) ---")
        # Legacy Admin endpoint returns models.Device directly
        # Patch config for local run
        schemas.DeviceResponse.model_config['from_attributes'] = True
        
        for d in devices:
            try:
                # This tests the @validator logic
                resp = schemas.DeviceResponse.model_validate(d)
                print(f"Serialized V1 ID {d.id}: deviceName='{resp.deviceName}', deviceType='{resp.deviceType}'")
            except Exception as e:
                print(f"Failed to serialize V1 ID {d.id}: {e}")
                if hasattr(e, 'errors'):
                    print(f"Details: {e.errors()}")
                
    except Exception as e:
        print(f"CRITICAL FAILURE: {e}")
        import traceback
        traceback.print_exc()
    finally:
        session.close()

if __name__ == "__main__":
    test_backend_logic()
