
import sys
from sqlalchemy import create_engine, inspect, text

# Database connection URL from docker-compose.yml
DATABASE_URL = "mysql+pymysql://openireland:ChangeMe_Dev123%21@10.10.10.4:3306/provdb_dev"

def check_safety():
    print(f"Checking DB: {DATABASE_URL}")
    
    try:
        engine = create_engine(DATABASE_URL)
        with engine.connect() as connection:
            result = connection.execute(text("SELECT DATABASE()")).scalar()
            print(f"Connected to Database: {result}")
            
            # Check distinct status values
            print("Legacy Statuses:")
            statuses = connection.execute(text("SELECT DISTINCT status FROM device_table")).fetchall()
            print(statuses)

            print("Current Inventory Statuses:")
            inv_statuses = connection.execute(text("SELECT DISTINCT status FROM devices")).fetchall()
            print(inv_statuses)

    except Exception as e:
        print(f"Connection failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    check_safety()
