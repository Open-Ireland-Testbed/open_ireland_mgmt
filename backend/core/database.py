# database.py
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.pool import QueuePool


db_url = os.getenv("DATABASE_URL", "")

if not db_url:
    raise ValueError("database_url environment variable is not set")

# Configure connection pooling to prevent stale connections
# pool_size: number of connections to maintain
# max_overflow: additional connections that can be created on demand
# pool_recycle: recycle connections after this many seconds (prevents stale connections)
# pool_pre_ping: verify connections before using them (automatically reconnect if stale)
engine = create_engine(
    db_url,
    poolclass=QueuePool,
    pool_size=10,  # Maintain 10 connections
    max_overflow=20,  # Allow up to 20 additional connections
    pool_recycle=3600,  # Recycle connections after 1 hour
    pool_pre_ping=True,  # Verify connections before using (auto-reconnect)
    echo=False,  # Set to True for SQL query logging (useful for debugging)
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

