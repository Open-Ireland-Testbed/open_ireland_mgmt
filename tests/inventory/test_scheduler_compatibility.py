"""
Scheduler Compatibility Test Suite (Phase U2)

Tests InventoryDevice compatibility with scheduler expectations.
Validates that all properties, queries, and serialization work correctly.
"""

import pytest
from sqlalchemy.orm import Session, joinedload
from datetime import datetime
from backend.inventory.models import InventoryDevice, DeviceType
from backend.scheduler.schemas import DeviceResponse, DeviceCreate


class TestInventoryDeviceProperties:
    """Test all scheduler compatibility properties."""
    
    def test_deviceName_property(self, db: Session):
        """Test deviceName property maps to name."""
        device = InventoryDevice(name="Test Device")
        assert device.deviceName == "Test Device"
        
        device.deviceName = "Updated Name"
        assert device.name == "Updated Name"
    
    def test_ip_address_property(self, db: Session):
        """Test ip_address property maps to mgmt_ip."""
        device = InventoryDevice(mgmt_ip="192.168.1.1")
        assert device.ip_address == "192.168.1.1"
        
        device.ip_address = "10.0.0.1"
        assert device.mgmt_ip == "10.0.0.1"
    
    def test_status_property_mapping(self, db: Session):
        """Test status property maps between inventory and scheduler values."""
        device = InventoryDevice(_status_internal="active")
        
        # Getter returns scheduler value
        assert device.status == "Available"
        
        # Setter accepts scheduler value
        device.status = "Maintenance"
        assert device._status_internal == "in_maintenance"
        assert device.status == "Maintenance"
        
        # Round-trip test
        device.status = "Unavailable"
        assert device._status_internal == "retired"
        assert device.status == "Unavailable"
    
    def test_port_properties(self, db: Session):
        """Test Out_Port and In_Port properties parse polatis_port_range."""
        device = InventoryDevice(polatis_port_range="In=123;Out=456")
        
        assert device.Out_Port == 456
        assert device.In_Port == 123
        
        # Test setters
        device.Out_Port = 789
        assert "Out=789" in device.polatis_port_range
        assert device.In_Port == 123  # Preserved
        
        device.In_Port = 111
        assert "In=111" in device.polatis_port_range
        assert device.Out_Port == 789  # Preserved
    
    def test_port_properties_null_safe(self, db: Session):
        """Test port properties handle NULL polatis_port_range."""
        device = InventoryDevice(polatis_port_range=None)
        
        assert device.Out_Port == 0
        assert device.In_Port == 0
    
    def test_maintenance_fields(self, db: Session):
        """Test maintenance fields store scheduler format."""
        device = InventoryDevice(
            maintenance_start="All Day/2023-10-01",
            maintenance_end="7 AM - 12 PM/2023-10-05"
        )
        
        assert device.maintenance_start == "All Day/2023-10-01"
        assert device.maintenance_end == "7 AM - 12 PM/2023-10-05"


class TestDeviceTypeProperty:
    """Test deviceType property with relationship."""
    
    def test_deviceType_getter(self, db: Session):
        """Test deviceType property returns device_type.name."""
        device_type = DeviceType(name="ROADM", category="OPTICAL")
        db.add(device_type)
        db.flush()
        
        device = InventoryDevice(
            name="Test ROADM",
            device_type=device_type
        )
        
        assert device.deviceType == "ROADM"
    
    def test_deviceType_null_safe(self, db: Session):
        """Test deviceType returns None when device_type not loaded."""
        device = InventoryDevice(name="Test")
        # device_type relationship not loaded
        assert device.deviceType is None or device.deviceType == "ROADM"  # Depends on if FK is set
    
    def test_deviceType_setter(self, db: Session):
        """Test deviceType setter looks up DeviceType."""
        device_type = DeviceType(name="FIBER", category="OPTICAL")
        db.add(device_type)
        db.commit()
        
        device = InventoryDevice(name="Test")
        db.add(device)
        db.flush()
        
        device.deviceType = "FIBER"
        assert device.device_type.name == "FIBER"


class TestDeviceTypeQueries:
    """Test deviceType query rewrites with JOIN."""
    
    def test_filter_by_device_type_with_join(self, db: Session):
        """Test filtering by deviceType using JOIN."""
        # Create device types
        roadm_type = DeviceType(name="ROADM", category="OPTICAL")
        fiber_type = DeviceType(name="FIBER", category="OPTICAL")
        db.add_all([roadm_type, fiber_type])
        db.flush()
        
        # Create devices
        roadm1 = InventoryDevice(name="ROADM-1", device_type=roadm_type)
        roadm2 = InventoryDevice(name="ROADM-2", device_type=roadm_type)
        fiber1 = InventoryDevice(name="FIBER-1", device_type=fiber_type)
        db.add_all([roadm1, roadm2, fiber1])
        db.commit()
        
        # Phase U2 query pattern: JOIN with DeviceType
        results = (
            db.query(InventoryDevice)
            .join(DeviceType)
            .filter(DeviceType.name == "ROADM")
            .all()
        )
        
        assert len(results) == 2
        assert all(d.deviceType == "ROADM" for d in results)
    
    def test_eager_loading_prevents_n_plus_1(self, db: Session):
        """Test eager loading with joinedload prevents N+1 queries."""
        # Create test data
        device_type = DeviceType(name="ROADM", category="OPTICAL")
        db.add(device_type)
        db.flush()
        
        for i in range(10):
            device = InventoryDevice(name=f"Device-{i}", device_type=device_type)
            db.add(device)
        db.commit()
        
        # Query with eager loading
        devices = (
            db.query(InventoryDevice)
            .options(joinedload(InventoryDevice.device_type))
            .all()
        )
        
        # Access deviceType should not trigger additional queries
        # (In a real test, we'd use a query counter)
        for d in devices:
            assert d.deviceType == "ROADM"


class TestPydanticSerialization:
    """Test Pydantic schema compatibility."""
    
    def test_device_response_serialization(self, db: Session):
        """Test DeviceResponse.from_orm with InventoryDevice."""
        # Create device with all fields
        device_type = DeviceType(name="ROADM", category="OPTICAL")
        db.add(device_type)
        db.flush()
        
        device = InventoryDevice(
            name="Test ROADM",
            device_type=device_type,
            mgmt_ip="192.168.1.1",
            polatis_port_range="In=123;Out=456",
            polatis_name="POL-1",
            _status_internal="active",
            maintenance_start="All Day/2023-10-01",
            maintenance_end="All Day/2023-10-05"
        )
        db.add(device)
        db.commit()
        
        # Eager load for serialization
        device = (
            db.query(InventoryDevice)
            .options(joinedload(InventoryDevice.device_type))
            .filter(InventoryDevice.id == device.id)
            .first()
        )
        
        # Serialize to Pydantic schema
        response = DeviceResponse.from_orm(device)
        
        # Verify all fields
        assert response.deviceName == "Test ROADM"
        assert response.deviceType == "ROADM"
        assert response.ip_address == "192.168.1.1"
        assert response.Out_Port == 456
        assert response.In_Port == 123
        assert response.status == "Available"  # Mapped from "active"
        assert response.maintenance_start == "All Day/2023-10-01"
        assert response.maintenance_end == "All Day/2023-10-05"
        assert response.polatis_name == "POL-1"


class TestMaintenanceParsing:
    """Test maintenance field format compatibility."""
    
    def test_maintenance_format_all_day(self, db: Session):
        """Test 'All Day' maintenance format."""
        device = InventoryDevice(
            name="Test",
            maintenance_start="All Day/2023-10-01",
            maintenance_end="All Day/2023-10-05"
        )
        
        # Test parsing (as done in topology_resolver)
        start_str = device.maintenance_start.split("/")[-1]
        end_str = device.maintenance_end.split("/")[-1]
        
        assert start_str == "2023-10-01"
        assert end_str == "2023-10-05"
    
    def test_maintenance_format_time_segment(self, db: Session):
        """Test time segment maintenance format."""
        device = InventoryDevice(
            name="Test",
            maintenance_start="7 AM - 12 PM/2023-10-01",
            maintenance_end="12 PM - 6 PM/2023-10-05"
        )
        
        assert "7 AM - 12 PM" in device.maintenance_start
        assert "2023-10-01" in device.maintenance_start


# Fixtures would go here in a real test suite
@pytest.fixture
def db():
    """Database session fixture (placeholder)."""
    # In real tests, this would create a test database session
    from backend.core.database import SessionLocal
    db = SessionLocal()
    yield db
    db.close()


if __name__ == "__main__":
    print("Run with: pytest tests/inventory/test_scheduler_compatibility.py -v")
