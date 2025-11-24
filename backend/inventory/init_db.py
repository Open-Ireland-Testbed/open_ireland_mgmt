# init_db.py - Initialize Inventory Management Database Tables

"""
Script to create inventory management database tables.
This can be run standalone or imported to create tables along with scheduler tables.
"""

from backend.core.database import engine, Base
from backend.inventory import models


def create_tables():
    """Create all inventory management tables"""
    print("Creating inventory management tables...")
    # Use the Base from database module
    Base.metadata.create_all(bind=engine)
    print("Inventory management tables created successfully!")


if __name__ == "__main__":
    create_tables()

