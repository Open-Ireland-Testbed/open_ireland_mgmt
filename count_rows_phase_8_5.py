
import sqlalchemy
from sqlalchemy import create_engine, text

DATABASE_URL = "mysql+pymysql://openireland:ChangeMe_Dev123%21@10.10.10.4:3306/provdb_dev"

def count_rows():
    try:
        engine = create_engine(DATABASE_URL)
        connection = engine.connect()
        
        for table in ["device_table", "devices"]:
            try:
                result = connection.execute(text(f"SELECT COUNT(*) FROM {table}"))
                count = result.scalar()
                print(f"{table}: {count} rows")
            except Exception as e:
                print(f"{table}: Error {e}")
                
        # Also grab a few rows from device_table if it has data
        try:
            print("\nSampling device_table:")
            result = connection.execute(text("SELECT * FROM device_table LIMIT 5"))
            keys = result.keys()
            print(f"Columns: {keys}")
            for row in result:
                print(row)
        except:
            pass
            
        connection.close()
    except Exception as e:
        print(f"Connection failed: {e}")

if __name__ == "__main__":
    count_rows()
