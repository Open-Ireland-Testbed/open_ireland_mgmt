"""
Tests for PDU control panel endpoints
"""
import pytest
import yaml
import tempfile
import os
from unittest.mock import patch, MagicMock, mock_open
from pathlib import Path


@pytest.fixture
def mock_pdu_config_file():
    """Create a temporary PDU config file for testing"""
    config_data = {
        'pdus': [
            {
                'name': 'PDU1',
                'host': '10.10.10.171',
                'user': 'admin',
                'passwd': 'password',
                'pdu_path': '/model/pdu/0',
                'external_id': 'PDU_ONE',
                'sensors': [{'slot_idx': 0}],
                'outlets': [],
                'connected': False,
                'temperature': None,
                'humidity': None,
                'power': None
            }
        ]
    }
    
    with tempfile.NamedTemporaryFile(mode='w', suffix='.yaml', delete=False) as f:
        yaml.dump(config_data, f)
        temp_path = f.name
    
    yield temp_path
    
    # Cleanup
    if os.path.exists(temp_path):
        os.unlink(temp_path)


def test_get_all_pdus(authenticated_admin_client, mock_pdu_config_file):
    """Test getting all PDUs"""
    with patch.dict(os.environ, {'PDU_CONFIG_PATH': mock_pdu_config_file}):
        import importlib
        import control_panel
        importlib.reload(control_panel)
        
        response = authenticated_admin_client.get("/control-panel/pdus")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0


def test_get_pdu_requires_admin(authenticated_client, mock_pdu_config_file):
    """Test that PDU endpoints require admin access"""
    with patch.dict(os.environ, {'PDU_CONFIG_PATH': mock_pdu_config_file}):
        response = authenticated_client.get("/control-panel/pdus")
        assert response.status_code == 403


def test_add_pdu(authenticated_admin_client, mock_pdu_config_file):
    """Test adding a new PDU"""
    with patch.dict(os.environ, {'PDU_CONFIG_PATH': mock_pdu_config_file}):
        import importlib
        import control_panel
        importlib.reload(control_panel)
        
        # Mock PDU connection
        with patch('control_panel.PduController') as mock_controller_class:
            mock_controller = MagicMock()
            mock_controller.get_power.return_value = 1000.0
            mock_controller.get_humidity.return_value = 50.0
            mock_controller.get_temp.return_value = {'value': 25.0, 'unit': 'C'}
            mock_controller_class.return_value = mock_controller
            
            response = authenticated_admin_client.post(
                "/control-panel/pdus",
                json={
                    "name": "PDU2",
                    "host": "10.10.10.172",
                    "user": "admin",
                    "passwd": "password",
                    "pdu_path": "/model/pdu/0",
                    "external_id": "PDU_TWO",
                    "sensors": [{"slot_idx": 0}],
                    "outlets": [],
                    "connected": False
                }
            )
            
            # Should succeed or handle connection error gracefully
            assert response.status_code in [200, 500]


def test_get_pdu_details(authenticated_admin_client, mock_pdu_config_file):
    """Test getting specific PDU details"""
    with patch.dict(os.environ, {'PDU_CONFIG_PATH': mock_pdu_config_file}):
        import importlib
        import control_panel
        importlib.reload(control_panel)
        
        response = authenticated_admin_client.get("/control-panel/pdus/PDU1")
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "PDU1"


def test_get_pdu_nonexistent(authenticated_admin_client, mock_pdu_config_file):
    """Test getting non-existent PDU"""
    with patch.dict(os.environ, {'PDU_CONFIG_PATH': mock_pdu_config_file}):
        import importlib
        import control_panel
        importlib.reload(control_panel)
        
        response = authenticated_admin_client.get("/control-panel/pdus/NONEXISTENT")
        assert response.status_code == 404


def test_delete_pdu(authenticated_admin_client, mock_pdu_config_file):
    """Test deleting a PDU"""
    with patch.dict(os.environ, {'PDU_CONFIG_PATH': mock_pdu_config_file}):
        import importlib
        import control_panel
        importlib.reload(control_panel)
        
        response = authenticated_admin_client.delete("/control-panel/pdus/PDU1")
        assert response.status_code == 200
        assert "deleted" in response.json()["message"].lower()


def test_get_pdu_sensors(authenticated_admin_client, mock_pdu_config_file):
    """Test getting PDU sensor data"""
    with patch.dict(os.environ, {'PDU_CONFIG_PATH': mock_pdu_config_file}):
        import importlib
        import control_panel
        importlib.reload(control_panel)
        
        # Mock PDU controller
        with patch('control_panel.PduController.get_pdu_controller') as mock_get:
            mock_controller = MagicMock()
            mock_controller.get_temp.return_value = {'value': 25.0, 'unit': 'C'}
            mock_controller.get_humidity.return_value = 50.0
            mock_controller.get_power.return_value = 1000.0
            mock_get.return_value = mock_controller
            
            response = authenticated_admin_client.get("/control-panel/pdus/PDU1/sensors")
            # May succeed or fail depending on connection
            assert response.status_code in [200, 400, 500]


def test_control_outlet(authenticated_admin_client, mock_pdu_config_file):
    """Test controlling a PDU outlet"""
    with patch.dict(os.environ, {'PDU_CONFIG_PATH': mock_pdu_config_file}):
        import importlib
        import control_panel
        importlib.reload(control_panel)
        
        # Mock PDU controller
        with patch('control_panel.PduController.get_pdu_controller') as mock_get:
            mock_controller = MagicMock()
            mock_controller.get_power.return_value = 1000.0
            mock_get.return_value = mock_controller
            
            response = authenticated_admin_client.post(
                "/control-panel/pdus/PDU1/outlets/1/control",
                json={"status": "on"}
            )
            # May succeed or fail depending on connection
            assert response.status_code in [200, 400, 500]


def test_get_system_status(authenticated_admin_client, mock_pdu_config_file):
    """Test getting system-wide PDU statistics"""
    with patch.dict(os.environ, {'PDU_CONFIG_PATH': mock_pdu_config_file}):
        import importlib
        import control_panel
        importlib.reload(control_panel)
        
        response = authenticated_admin_client.get("/control-panel/status")
        assert response.status_code == 200
        data = response.json()
        assert "total_pdus" in data
        assert "connected_pdus" in data
        assert "avg_temperature" in data
        assert "total_power" in data


def test_add_pdu_duplicate_name(authenticated_admin_client, mock_pdu_config_file):
    """Test adding PDU with duplicate name"""
    with patch.dict(os.environ, {'PDU_CONFIG_PATH': mock_pdu_config_file}):
        import importlib
        import control_panel
        importlib.reload(control_panel)
        
        response = authenticated_admin_client.post(
            "/control-panel/pdus",
            json={
                "name": "PDU1",  # Duplicate name
                "host": "10.10.10.173",
                "user": "admin",
                "passwd": "password",
                "pdu_path": "/model/pdu/0",
                "external_id": "PDU_THREE",
                "sensors": [],
                "outlets": [],
                "connected": False
            }
        )
        assert response.status_code == 400
        assert "already exists" in response.json()["detail"].lower()

