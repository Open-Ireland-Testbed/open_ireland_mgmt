
import sys
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

DATABASE_URL = "mysql+pymysql://openireland:ChangeMe_Dev123%21@10.10.10.4:3306/provdb_dev"

def inspect_data():
    engine = create_engine(DATABASE_URL)
    with engine.connect() as conn:
        print("--- Table Counts ---")
        devices_count = conn.execute(text("SELECT COUNT(*) FROM devices")).scalar()
        types_count = conn.execute(text("SELECT COUNT(*) FROM device_types")).scalar()
        print(f"Devices: {devices_count}")
        print(f"Device Types: {types_count}")

        print("\n--- Device Type Foreign Key Analysis ---")
        null_fk = conn.execute(text("SELECT COUNT(*) FROM devices WHERE device_type_id IS NULL")).scalar()
        print(f"Devices with NULL device_type_id: {null_fk}")

        invalid_fk = conn.execute(text("SELECT COUNT(*) FROM devices d LEFT JOIN device_types t ON d.device_type_id = t.id WHERE d.device_type_id IS NOT NULL AND t.id IS NULL")).scalar()
        print(f"Devices with INVALID device_type_id (FK mismatch): {invalid_fk}")
        
        print("\n--- Inner Join Simulation (What Admin V2 sees) ---")
        inner_join_count = conn.execute(text("SELECT COUNT(*) FROM devices d JOIN device_types t ON d.device_type_id = t.id")).scalar()
        print(f"Rows returned by INNER JOIN: {inner_join_count}")
        
        print("\n--- Sample Data (First 3) ---")
        result = conn.execute(text("SELECT id, name, device_type_id, status FROM devices LIMIT 3")).fetchall()
        for row in result:
             print(f"ID: {row[0]}, Name: {row[1]}, Type FK: {row[2]}, Status: {row[3]}")

if __name__ == "__main__":
    inspect_data()
