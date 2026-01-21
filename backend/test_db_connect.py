from sqlalchemy import create_engine, text
import os
import sys

# Connection string
# Correctly URL-encoded password if needed, but here simple replacement
DATABASE_URL = "mysql+pymysql://openireland:ChangeMe_Dev123%21@10.10.10.4:3306/provdb_dev"

print(f"Testing connection to: {DATABASE_URL}")

try:
    engine = create_engine(DATABASE_URL)
    with engine.connect() as connection:
        result = connection.execute(text("SELECT 1"))
        print("Connection successful! Result:", result.fetchone())
except Exception as e:
    print(f"Connection failed: {e}")
    sys.exit(1)
