
import sys
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

sys.path.append(".")

# Import models and schemas
from backend.scheduler.models import Device
from backend.scheduler.schemas import DeviceResponse

DATABASE_URL = "mysql+pymysql://openireland:ChangeMe_Dev123%21@10.10.10.4:3306/provdb_dev"

def test_serialization():
    print("Connecting to DB...")
    engine = create_engine(DATABASE_URL)
    SessionLocal = sessionmaker(bind=engine)
    session = SessionLocal()

    try:
        print("Fetching a device...")
        device = session.query(Device).first()
        if not device:
            print("No devices found!")
            return
            
        print(f"Device found: ID={device.id}, Name (prop)={device.deviceName}, Type={device.deviceType}")
        
        # Patch Config for Pydantic V2 local env
        DeviceResponse.model_config['from_attributes'] = True
        
        print("Attempting Pydantic serialization...")
        try:
            # use model_validate instead of from_orm for V2
            pydantic_obj = DeviceResponse.model_validate(device)
            print("Serialization SUCCESS!")
            print(f"Serialized Data: {pydantic_obj.json()}")
        except Exception as e:
            print(f"Serialization FAILED: {e}")
            # print dir to see what pydantic sees
            print(f"Dir: {dir(device)}")

    except Exception as e:
        print(f"Error: {e}")
    finally:
        session.close()

if __name__ == "__main__":
    test_serialization()
