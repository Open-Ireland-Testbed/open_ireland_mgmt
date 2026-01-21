
import os
import sqlalchemy
from sqlalchemy import create_engine, text, inspect

# Database connection URL from docker-compose.yml
DATABASE_URL = "mysql+pymysql://openireland:ChangeMe_Dev123%21@10.10.10.4:3306/provdb_dev"

def inspect_db():
    print(f"Connecting to: {DATABASE_URL}")
    try:
        engine = create_engine(DATABASE_URL)
        connection = engine.connect()
        print("Successfully connected to database!")
    except Exception as e:
        print(f"FAILED to connect: {e}")
        return

    inspector = inspect(engine)
    tables = inspector.get_table_names()
    print(f"\nTables found: {tables}")

    target_tables = ["device_table", "devices"]
    
    for table in target_tables:
        print(f"\n{'='*40}")
        if table in tables:
            print(f"Table Found: {table}")
            
            # Get Schema/Columns
            columns = inspector.get_columns(table)
            print(f"\nColumns in {table}:")
            for col in columns:
                print(f" - {col['name']}: {col['type']} (Nullable: {col['nullable']}, Default: {col.get('default')})")
            
            # Get CREATE TABLE statement approximation
            try:
                # This syntax depends on MySQL
                result = connection.execute(text(f"SHOW CREATE TABLE {table}"))
                create_stmt = result.fetchone()[1]
                print(f"\nCREATE TABLE Statement:\n{create_stmt}")
            except Exception as e:
                print(f"Could not get CREATE TABLE: {e}")

            # Get Sample Data
            try:
                result = connection.execute(text(f"SELECT * FROM {table} LIMIT 20"))
                rows = result.fetchall()
                print(f"\nSample Data (First {len(rows)} rows):")
                if rows:
                    keys = result.keys()
                    print(f"  {keys}")
                    for row in rows:
                        print(f"  {row}")
                else:
                    print("  [Table is empty]")
            except Exception as e:
                print(f"Error fetching data: {e}")

        else:
            print(f"Table MISSING: {table}")
    
    connection.close()

if __name__ == "__main__":
    inspect_db()
