"""
Pytest configuration and fixtures for backend tests
"""
import os
import sys

# IMPORTANT: Set test DATABASE_URL before importing database.py
# database.py requires DATABASE_URL at import time, but tests override it anyway
# Setting a test value here prevents the import error
if not os.getenv("DATABASE_URL"):
    os.environ["DATABASE_URL"] = "sqlite:///:memory:"

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from datetime import datetime, timedelta

from backend.core.database import Base, SessionLocal
from backend.main import app
from backend.core.deps import get_db
from backend.scheduler.routers.admin import router as admin_router
from backend.scheduler.routers.admin_v2 import router as admin_v2_router
from backend.scheduler.routers.control_panel import router as control_panel_router
from backend.scheduler.models import User, Device, Booking
from backend.core.hash import hash_password

# Import inventory models to ensure their tables are created during tests
# This is done via main.py import, but we explicitly import here to ensure
# metadata is registered before Base.metadata.create_all() in db_session fixture
from backend.inventory import models as inventory_models  # noqa: F401
from backend.inventory.router import get_db as inventory_get_db


# Safety check: Ensure we're not accidentally using production database
def _safety_check_production_database():
    """Prevent tests from accidentally using production database"""
    production_db_url = os.getenv("DATABASE_URL", "")
    
    # If DATABASE_URL is set and it's not a test database, warn/error
    if production_db_url:
        # Check if it's a MySQL/MariaDB connection (production likely uses MySQL)
        if any(keyword in production_db_url.lower() for keyword in ['mysql', 'mariadb', 'pymysql']):
            # Check if it's pointing to a production host
            production_indicators = ['production', 'prod', 'live', 'main']
            if any(indicator in production_db_url.lower() for indicator in production_indicators):
                raise RuntimeError(
                    f"🚨 SAFETY CHECK FAILED: Tests are configured to use production database!\n"
                    f"   DATABASE_URL: {production_db_url[:50]}...\n"
                    f"   Tests must use in-memory SQLite. Please unset DATABASE_URL or set it to a test database."
                )
        
        # Also check if it's not SQLite (which is safe for tests)
        if not production_db_url.startswith('sqlite'):
            # Allow it if explicitly marked as test database
            if 'test' not in production_db_url.lower():
                import warnings
                warnings.warn(
                    f"⚠️  WARNING: DATABASE_URL is set to non-SQLite database: {production_db_url[:50]}...\n"
                    f"   Tests will use in-memory SQLite instead, but this may indicate misconfiguration.",
                    UserWarning
                )

# Run safety check when tests are imported
_safety_check_production_database()


# Use in-memory SQLite for testing
TEST_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)

TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="function")
def db_session():
    """Create a fresh database for each test"""
    # Double-check we're using test database
    assert TEST_DATABASE_URL.startswith("sqlite"), "Tests must use SQLite database"
    
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def client(db_session):
    """Create a test client with database override"""
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    # Override get_db dependency (all routers use the same get_db from backend.core.deps)
    app.dependency_overrides[get_db] = override_get_db
    
    test_client = TestClient(app)
    
    # Verify the override is working
    assert get_db in app.dependency_overrides, "Database dependency override failed"
    
    yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def test_user(db_session):
    """Create a test user"""
    hashed_password = hash_password("testpassword123")
    user = User(
        username="testuser",
        email="test@example.com",
        password=hashed_password,
        is_admin=False,
        discord_id="123456789"
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def test_admin(db_session):
    """Create a test admin user"""
    hashed_password = hash_password("adminpassword123")
    admin = User(
        username="testadmin",
        email="admin@example.com",
        password=hashed_password,
        is_admin=True,
        discord_id="987654321"
    )
    db_session.add(admin)
    db_session.commit()
    db_session.refresh(admin)
    return admin


@pytest.fixture
def test_device(db_session):
    """Create a test device"""
    device = Device(
        deviceType="Router",
        deviceName="Router1",
        ip_address="192.168.1.1",
        status="Available",
        Out_Port=1,
        In_Port=2
    )
    db_session.add(device)
    db_session.commit()
    db_session.refresh(device)
    return device


@pytest.fixture
def test_booking(db_session, test_user, test_device):
    """Create a test booking"""
    start_time = datetime.now() + timedelta(days=1)
    end_time = start_time + timedelta(hours=5)
    
    booking = Booking(
        device_id=test_device.id,
        user_id=test_user.id,
        start_time=start_time,
        end_time=end_time,
        status="PENDING",
        comment="Test booking"
    )
    db_session.add(booking)
    db_session.commit()
    db_session.refresh(booking)
    return booking


@pytest.fixture
def authenticated_client(client, test_user):
    """Create an authenticated test client"""
    # Login to get session
    response = client.post(
        "/login",
        json={"username": test_user.username, "password": "testpassword123"}
    )
    assert response.status_code == 200
    return client


@pytest.fixture
def authenticated_admin_client(client, test_admin):
    """Create an authenticated admin test client"""
    # Login as admin
    response = client.post(
        "/admin/login",
        json={"username": test_admin.username, "password": "adminpassword123"}
    )
    assert response.status_code == 200
    return client

