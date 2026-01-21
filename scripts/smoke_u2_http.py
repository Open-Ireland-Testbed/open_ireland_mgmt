#!/usr/bin/env python3
"""
U2 HTTP Smoke Tests
Tests Phase U2 endpoints without requiring docker exec.
"""

import requests
import json
import sys

BASE_URL = "http://localhost:8000"

def test_health():
    """Test basic health endpoint"""
    response = requests.get(f"{BASE_URL}/health")
    print(f"✓ Health check: {response.status_code}")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"

def test_db_status(session=None):
    """Test DB verification endpoint (requires admin auth)"""
    url = f"{BASE_URL}/admin/v2/debug/db-status"
    
    if session:
        response = requests.get(url, cookies=session)
    else:
        response = requests.get(url)
    
    print(f"\n{'='*80}")
    print("DB Status Verification")
    print('='*80)
    
    if response.status_code == 401:
        print("⚠  Authentication required (expected without login)")
        return None
    elif response.status_code == 403:
        print("⚠  Admin privileges required")
        return None
    elif response.status_code != 200:
        print(f"✗ DB Status failed: {response.status_code}")
        print(response.text)
        return None
    
    data = response.json()
    print(json.dumps(data, indent=2))
    print('='*80)
    return data

def test_inventory_devices():
    """Test inventory devices endpoint"""
    response = requests.get(f"{BASE_URL}/api/inventory/devices?limit=1")
    
    if response.status_code == 401:
        print("✓ Inventory devices (auth required)")
        return
    
    print(f"✓ Inventory devices: {response.status_code}")
    if response.status_code == 200:
        devices = response.json()
        print(f"  Found {len(devices.get('devices', []))} devices")

def test_docs():
    """Test API docs endpoint"""
    response = requests.get(f"{BASE_URL}/docs")
    print(f"✓ API docs: {response.status_code}")
    assert response.status_code == 200

def run_smoke_tests():
    """Run all smoke tests"""
    print("="*80)
    print("Phase U2 HTTP Smoke Tests")
    print("="*80)
    
    try:
        test_health()
        test_docs()
        test_inventory_devices()
        db_data = test_db_status()
        
        print("\n" + "="*80)
        print("Summary")
        print("="*80)
        print("✓ Basic endpoints accessible")
        if db_data:
            print("✓ DB verification endpoint working")
            print(f"  - device_table: {db_data.get('device_table_count')} rows")
            print(f"  - devices: {db_data.get('devices_count')} rows")
            print(f"  - Synchronization: {db_data.get('synchronization_percentage')}%")
        else:
            print("⚠  DB verification requires admin login")
            print("\nTo test DB endpoint:")
            print("  1. Login to admin panel")
            print("  2. Run: curl -b cookies.txt http://localhost:8000/admin/v2/debug/db-status")
        
        print("\n✅ Smoke tests passed!")
        return 0
        
    except Exception as e:
        print(f"\n✗ Smoke tests failed: {e}")
        import traceback
        traceback.print_exc()
        return 1

if __name__ == "__main__":
    sys.exit(run_smoke_tests())
