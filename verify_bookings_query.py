
import sys
from datetime import datetime, timedelta
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

sys.path.append(".")

# Import models
from backend.scheduler import models
from backend.inventory import models as inventory_models

DATABASE_URL = "mysql+pymysql://openireland:ChangeMe_Dev123%21@10.10.10.4:3306/provdb_dev"

def test_query():
    print("Connecting to DB...")
    engine = create_engine(DATABASE_URL)
    SessionLocal = sessionmaker(bind=engine)
    session = SessionLocal()

    try:
        print("Testing /bookings/for-week query...")
        start = "2025-12-15" # Future date
        week_start = datetime.strptime(start, "%Y-%m-%d")
        week_end = week_start + timedelta(days=7)
        
        # Exact query structure from main.py
        rows = (
            session.query(
                models.Booking.booking_id,
                models.Booking.device_id,
                models.Booking.user_id,
                models.Booking.start_time,
                models.Booking.end_time,
                models.Booking.status,
                models.Booking.grouped_booking_id,
                models.Booking.collaborators,
                models.Booking.is_collaborator,
                inventory_models.DeviceType.name.label("device_type_name"),
                models.Device.name,
                models.User.username,
            )
            .outerjoin(models.Device, models.Booking.device_id == models.Device.id)
            .outerjoin(inventory_models.DeviceType, models.Device.device_type_id == inventory_models.DeviceType.id)
            .outerjoin(models.User, models.Booking.user_id == models.User.id)
            .filter(
                models.Booking.start_time < week_end,
                models.Booking.end_time > week_start,
            )
            .all()
        )
        print(f"Query Success! Rows returned: {len(rows)}")
        if rows:
            print(f"Sample row: {rows[0]}")

    except Exception as e:
        print(f"Query FAILED: {e}")
        import traceback
        traceback.print_exc()
    finally:
        session.close()

if __name__ == "__main__":
    test_query()
