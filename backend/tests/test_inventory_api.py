"""
Tests for inventory management API endpoints
"""
import pytest
from fastapi.testclient import TestClient


# Import inventory models to ensure tables are created
# This is done via main.py import, but we explicitly import here for clarity
from backend.inventory import models as inventory_models


def test_create_device_type(client):
    """Test 1: Create DeviceType"""
    response = client.post(
        "/api/inventory/device-types",
        json={
            "name": "EDFA",
            "category": "OPTICAL",
            "description": "Erbium Doped Fiber Amplifier",
            "is_schedulable": True,
            "has_ports": True
        }
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "EDFA"
    assert data["category"] == "OPTICAL"
    assert data["is_schedulable"] is True
    assert data["has_ports"] is True
    assert "id" in data
    assert "created_at" in data
    return data["id"]


def test_create_manufacturer(client):
    """Test 2: Create Manufacturer"""
    response = client.post(
        "/api/inventory/manufacturers",
        json={
            "name": "Ciena",
            "website": "https://www.ciena.com",
            "notes": "Optical networking equipment"
        }
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Ciena"
    assert data["website"] == "https://www.ciena.com"
    assert "id" in data
    return data["id"]


def test_create_site(client):
    """Test 3: Create Site"""
    response = client.post(
        "/api/inventory/sites",
        json={
            "name": "Dublin Lab",
            "address": "Trinity College Dublin",
            "notes": "Main research lab"
        }
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Dublin Lab"
    assert data["address"] == "Trinity College Dublin"
    assert "id" in data
    return data["id"]


@pytest.fixture
def device_type_id(client):
    """Fixture: Create and return device type ID"""
    response = client.post(
        "/api/inventory/device-types",
        json={
            "name": "ROADM",
            "category": "OPTICAL",
            "description": "Reconfigurable Optical Add-Drop Multiplexer",
            "is_schedulable": True,
            "has_ports": True
        }
    )
    assert response.status_code == 201
    return response.json()["id"]


@pytest.fixture
def manufacturer_id(client):
    """Fixture: Create and return manufacturer ID"""
    response = client.post(
        "/api/inventory/manufacturers",
        json={
            "name": "Juniper",
            "website": "https://www.juniper.net"
        }
    )
    assert response.status_code == 201
    return response.json()["id"]


@pytest.fixture
def site_id(client):
    """Fixture: Create and return site ID"""
    response = client.post(
        "/api/inventory/sites",
        json={
            "name": "Test Site",
            "address": "Test Address"
        }
    )
    assert response.status_code == 201
    return response.json()["id"]


def test_create_device(client, device_type_id, manufacturer_id, site_id):
    """Test 4: Create Device"""
    response = client.post(
        "/api/inventory/devices",
        json={
            "name": "EDFA-001",
            "device_type_id": device_type_id,
            "manufacturer_id": manufacturer_id,
            "model": "EDFA-1000",
            "serial_number": "SN123456",
            "status": "active",
            "site_id": site_id,
            "rack": "Rack-A",
            "u_position": 5,
            "hostname": "edfa-001.lab.local",
            "mgmt_ip": "192.168.1.100",
            "notes": "Test device"
        }
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "EDFA-001"
    assert data["device_type_id"] == device_type_id
    assert data["manufacturer_id"] == manufacturer_id
    assert data["site_id"] == site_id
    assert data["status"] == "active"
    assert data["serial_number"] == "SN123456"
    assert data["hostname"] == "edfa-001.lab.local"
    assert "id" in data
    assert "created_at" in data
    assert "device_type_name" in data
    assert "manufacturer_name" in data
    assert "site_name" in data
    return data["id"]


def test_get_device_by_id(client, device_type_id, manufacturer_id, site_id):
    """Test 5: Get Device by ID"""
    # First create a device
    create_response = client.post(
        "/api/inventory/devices",
        json={
            "name": "Device-Get-Test",
            "device_type_id": device_type_id,
            "manufacturer_id": manufacturer_id,
            "status": "active",
            "site_id": site_id
        }
    )
    assert create_response.status_code == 201
    device_id = create_response.json()["id"]
    
    # Now get it
    response = client.get(f"/api/inventory/devices/{device_id}")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == device_id
    assert data["name"] == "Device-Get-Test"
    assert data["device_type_id"] == device_type_id
    assert data["status"] == "active"


def test_get_device_by_oi_id(client, device_type_id, manufacturer_id, site_id):
    """Test 6: Get Device by oi_id"""
    # Create device with oi_id
    create_response = client.post(
        "/api/inventory/devices",
        json={
            "name": "Device-OI-Test",
            "oi_id": "OI-DEV-999999",
            "device_type_id": device_type_id,
            "manufacturer_id": manufacturer_id,
            "status": "active",
            "site_id": site_id
        }
    )
    assert create_response.status_code == 201
    oi_id = create_response.json()["oi_id"]
    assert oi_id == "OI-DEV-999999"
    
    # Get by oi_id
    response = client.get(f"/api/inventory/devices/oi/{oi_id}")
    assert response.status_code == 200
    data = response.json()
    assert data["oi_id"] == oi_id
    assert data["name"] == "Device-OI-Test"


def test_list_devices(client, device_type_id, manufacturer_id, site_id):
    """Test 7: List Devices (basic)"""
    # Create a device first
    create_response = client.post(
        "/api/inventory/devices",
        json={
            "name": "Device-List-Test",
            "device_type_id": device_type_id,
            "manufacturer_id": manufacturer_id,
            "status": "active",
            "site_id": site_id
        }
    )
    assert create_response.status_code == 201
    
    # List devices
    response = client.get("/api/inventory/devices")
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert "total" in data
    assert "limit" in data
    assert "offset" in data
    assert isinstance(data["items"], list)
    assert data["total"] >= 1
    
    # Check that our device is in the list
    device_names = [item["name"] for item in data["items"]]
    assert "Device-List-Test" in device_names


def test_filter_devices(client, device_type_id, manufacturer_id, site_id):
    """Test 8: Filter Devices"""
    # Create two devices with different statuses
    device1_response = client.post(
        "/api/inventory/devices",
        json={
            "name": "Device-Active",
            "device_type_id": device_type_id,
            "manufacturer_id": manufacturer_id,
            "status": "active",
            "site_id": site_id
        }
    )
    assert device1_response.status_code == 201
    
    device2_response = client.post(
        "/api/inventory/devices",
        json={
            "name": "Device-Maintenance",
            "device_type_id": device_type_id,
            "manufacturer_id": manufacturer_id,
            "status": "in_maintenance",
            "site_id": site_id
        }
    )
    assert device2_response.status_code == 201
    
    # Filter by status=active
    response = client.get("/api/inventory/devices?status=active")
    assert response.status_code == 200
    data = response.json()
    assert all(item["status"] == "active" for item in data["items"])
    device_names = [item["name"] for item in data["items"]]
    assert "Device-Active" in device_names
    assert "Device-Maintenance" not in device_names
    
    # Filter by device_type_id
    response = client.get(f"/api/inventory/devices?device_type_id={device_type_id}")
    assert response.status_code == 200
    data = response.json()
    assert all(item["device_type_id"] == device_type_id for item in data["items"])
    assert len(data["items"]) >= 2
    
    # Filter by site_id
    response = client.get(f"/api/inventory/devices?site_id={site_id}")
    assert response.status_code == 200
    data = response.json()
    assert all(item["site_id"] == site_id for item in data["items"])
    assert len(data["items"]) >= 2
    
    # Search by name
    response = client.get("/api/inventory/devices?search=Active")
    assert response.status_code == 200
    data = response.json()
    assert any("Active" in item["name"] for item in data["items"])


def test_update_device(client, device_type_id, manufacturer_id, site_id):
    """Test 9: Update Device"""
    # Create a device
    create_response = client.post(
        "/api/inventory/devices",
        json={
            "name": "Device-Update-Test",
            "device_type_id": device_type_id,
            "manufacturer_id": manufacturer_id,
            "status": "active",
            "site_id": site_id
        }
    )
    assert create_response.status_code == 201
    device_id = create_response.json()["id"]
    
    # Update the device
    update_response = client.put(
        f"/api/inventory/devices/{device_id}",
        json={
            "status": "in_maintenance",
            "hostname": "updated-hostname.lab.local",
            "notes": "Updated notes"
        }
    )
    assert update_response.status_code == 200
    data = update_response.json()
    assert data["status"] == "in_maintenance"
    assert data["hostname"] == "updated-hostname.lab.local"
    assert data["notes"] == "Updated notes"
    
    # Verify by reading back
    get_response = client.get(f"/api/inventory/devices/{device_id}")
    assert get_response.status_code == 200
    verify_data = get_response.json()
    assert verify_data["status"] == "in_maintenance"
    assert verify_data["hostname"] == "updated-hostname.lab.local"


def test_delete_device(client, device_type_id, manufacturer_id, site_id):
    """Test 10: Delete Device"""
    # Create a device
    create_response = client.post(
        "/api/inventory/devices",
        json={
            "name": "Device-Delete-Test",
            "device_type_id": device_type_id,
            "manufacturer_id": manufacturer_id,
            "status": "active",
            "site_id": site_id
        }
    )
    assert create_response.status_code == 201
    device_id = create_response.json()["id"]
    
    # Delete the device
    delete_response = client.delete(f"/api/inventory/devices/{device_id}")
    assert delete_response.status_code == 204
    
    # Verify it's gone
    get_response = client.get(f"/api/inventory/devices/{device_id}")
    assert get_response.status_code == 404


def test_create_tag(client):
    """Test 11: Create Tag"""
    response = client.post(
        "/api/inventory/tags",
        json={
            "name": "production",
            "description": "Production environment",
            "color": "#FF5733"
        }
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "production"
    assert data["description"] == "Production environment"
    assert data["color"] == "#FF5733"
    assert "id" in data
    return data["id"]


@pytest.fixture
def tag_id(client):
    """Fixture: Create and return tag ID"""
    response = client.post(
        "/api/inventory/tags",
        json={
            "name": "test-tag",
            "description": "Test tag",
            "color": "#00FF00"
        }
    )
    assert response.status_code == 201
    return response.json()["id"]


def test_assign_tag_to_device(client, device_type_id, manufacturer_id, site_id, tag_id):
    """Test 12: Assign Tag to Device"""
    # Create a device
    create_response = client.post(
        "/api/inventory/devices",
        json={
            "name": "Device-Tag-Test",
            "device_type_id": device_type_id,
            "manufacturer_id": manufacturer_id,
            "status": "active",
            "site_id": site_id
        }
    )
    assert create_response.status_code == 201
    device_id = create_response.json()["id"]
    
    # Assign tag to device
    assign_response = client.post(
        f"/api/inventory/devices/{device_id}/tags",
        json={
            "tag_ids": [tag_id]
        }
    )
    assert assign_response.status_code == 200
    tags_data = assign_response.json()
    assert isinstance(tags_data, list)
    assert len(tags_data) >= 1
    tag_ids = [tag["id"] for tag in tags_data]
    assert tag_id in tag_ids
    
    # Verify via device GET
    device_response = client.get(f"/api/inventory/devices/{device_id}")
    assert device_response.status_code == 200
    device_data = device_response.json()
    assert "tags" in device_data
    assert len(device_data["tags"]) >= 1
    device_tag_ids = [tag["id"] for tag in device_data["tags"]]
    assert tag_id in device_tag_ids


def test_remove_tag_from_device(client, device_type_id, manufacturer_id, site_id, tag_id):
    """Test 13: Remove Tag from Device"""
    # Create a device
    create_response = client.post(
        "/api/inventory/devices",
        json={
            "name": "Device-Remove-Tag-Test",
            "device_type_id": device_type_id,
            "manufacturer_id": manufacturer_id,
            "status": "active",
            "site_id": site_id
        }
    )
    assert create_response.status_code == 201
    device_id = create_response.json()["id"]
    
    # Assign tag first
    client.post(
        f"/api/inventory/devices/{device_id}/tags",
        json={"tag_ids": [tag_id]}
    )
    
    # Verify tag is assigned
    device_response = client.get(f"/api/inventory/devices/{device_id}")
    device_data = device_response.json()
    device_tag_ids = [tag["id"] for tag in device_data["tags"]]
    assert tag_id in device_tag_ids
    
    # Remove tag
    remove_response = client.delete(f"/api/inventory/devices/{device_id}/tags/{tag_id}")
    assert remove_response.status_code == 204
    
    # Verify tag is removed
    device_response = client.get(f"/api/inventory/devices/{device_id}")
    device_data = device_response.json()
    device_tag_ids = [tag["id"] for tag in device_data["tags"]]
    assert tag_id not in device_tag_ids


def test_list_tags(client, tag_id):
    """Test 14: List Tags"""
    response = client.get("/api/inventory/tags")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 1
    
    # Check that our tag is in the list
    tag_ids = [tag["id"] for tag in data]
    assert tag_id in tag_ids


def test_device_history(client, device_type_id, manufacturer_id, site_id):
    """Test 15: Device History Endpoint"""
    # Create a device
    create_response = client.post(
        "/api/inventory/devices",
        json={
            "name": "Device-History-Test",
            "device_type_id": device_type_id,
            "manufacturer_id": manufacturer_id,
            "status": "active",
            "site_id": site_id
        }
    )
    assert create_response.status_code == 201
    device_id = create_response.json()["id"]
    
    # Update the device to generate history
    client.put(
        f"/api/inventory/devices/{device_id}",
        json={"status": "in_maintenance"}
    )
    
    # Get history
    history_response = client.get(f"/api/inventory/devices/{device_id}/history")
    assert history_response.status_code == 200
    history_data = history_response.json()
    assert isinstance(history_data, list)
    # Should have at least create and update entries
    assert len(history_data) >= 1
    
    # Check history entry structure
    if len(history_data) > 0:
        entry = history_data[0]
        assert "id" in entry
        assert "device_id" in entry
        assert "action" in entry
        assert "created_at" in entry
        assert entry["device_id"] == device_id


def test_stats_summary(client, device_type_id, manufacturer_id, site_id):
    """Test 16: Stats Summary"""
    # Create a few devices with different statuses
    client.post(
        "/api/inventory/devices",
        json={
            "name": "Device-Stats-1",
            "device_type_id": device_type_id,
            "manufacturer_id": manufacturer_id,
            "status": "active",
            "site_id": site_id
        }
    )
    client.post(
        "/api/inventory/devices",
        json={
            "name": "Device-Stats-2",
            "device_type_id": device_type_id,
            "manufacturer_id": manufacturer_id,
            "status": "spare",
            "site_id": site_id
        }
    )
    
    # Get stats
    response = client.get("/api/inventory/stats/summary")
    assert response.status_code == 200
    data = response.json()
    
    assert "total_devices" in data
    assert "by_status" in data
    assert "by_device_type" in data
    assert "by_site" in data
    
    assert isinstance(data["total_devices"], int)
    assert data["total_devices"] >= 2
    
    assert isinstance(data["by_status"], dict)
    assert "active" in data["by_status"] or data["by_status"].get("active", 0) >= 1
    assert "spare" in data["by_status"] or data["by_status"].get("spare", 0) >= 1
    
    assert isinstance(data["by_device_type"], dict)
    assert isinstance(data["by_site"], dict)


def test_filter_devices_by_tags(client, device_type_id, manufacturer_id, site_id):
    """Test: Filter devices by tags"""
    # Create two tags
    tag1_response = client.post(
        "/api/inventory/tags",
        json={"name": "tag1", "color": "#FF0000"}
    )
    tag1_id = tag1_response.json()["id"]
    
    tag2_response = client.post(
        "/api/inventory/tags",
        json={"name": "tag2", "color": "#00FF00"}
    )
    tag2_id = tag2_response.json()["id"]
    
    # Create two devices
    device1_response = client.post(
        "/api/inventory/devices",
        json={
            "name": "Device-With-Tag1",
            "device_type_id": device_type_id,
            "manufacturer_id": manufacturer_id,
            "status": "active",
            "site_id": site_id
        }
    )
    device1_id = device1_response.json()["id"]
    
    device2_response = client.post(
        "/api/inventory/devices",
        json={
            "name": "Device-With-Tag2",
            "device_type_id": device_type_id,
            "manufacturer_id": manufacturer_id,
            "status": "active",
            "site_id": site_id
        }
    )
    device2_id = device2_response.json()["id"]
    
    # Assign tags
    client.post(f"/api/inventory/devices/{device1_id}/tags", json={"tag_ids": [tag1_id]})
    client.post(f"/api/inventory/devices/{device2_id}/tags", json={"tag_ids": [tag2_id]})
    
    # Filter by tag1
    response = client.get(f"/api/inventory/devices?tag_ids={tag1_id}")
    assert response.status_code == 200
    data = response.json()
    device_names = [item["name"] for item in data["items"]]
    assert "Device-With-Tag1" in device_names
    assert "Device-With-Tag2" not in device_names


def test_bulk_update_devices(client, device_type_id, manufacturer_id, site_id):
    """Test: Bulk update devices"""
    # Create two devices
    device1_response = client.post(
        "/api/inventory/devices",
        json={
            "name": "Device-Bulk-1",
            "device_type_id": device_type_id,
            "manufacturer_id": manufacturer_id,
            "status": "active",
            "site_id": site_id
        }
    )
    device1_id = device1_response.json()["id"]
    
    device2_response = client.post(
        "/api/inventory/devices",
        json={
            "name": "Device-Bulk-2",
            "device_type_id": device_type_id,
            "manufacturer_id": manufacturer_id,
            "status": "active",
            "site_id": site_id
        }
    )
    device2_id = device2_response.json()["id"]
    
    # Bulk update
    response = client.post(
        "/api/inventory/devices/bulk-update",
        json={
            "device_ids": [device1_id, device2_id],
            "updates": {
                "status": "in_maintenance",
                "notes": "Bulk updated"
            }
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert "succeeded" in data
    assert "failed" in data
    assert len(data["succeeded"]) == 2
    assert device1_id in data["succeeded"]
    assert device2_id in data["succeeded"]
    
    # Verify updates
    device1_response = client.get(f"/api/inventory/devices/{device1_id}")
    assert device1_response.json()["status"] == "in_maintenance"
    assert device1_response.json()["notes"] == "Bulk updated"

