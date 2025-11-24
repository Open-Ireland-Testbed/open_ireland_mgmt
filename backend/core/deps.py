# deps.py - Shared FastAPI dependencies

from sqlalchemy.orm import Session
from backend.core.database import SessionLocal


def get_db():
    """
    Dependency to get database session.
    Yields a database session and ensures it's closed after use.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

