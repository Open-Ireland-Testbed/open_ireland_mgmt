"""
Tests for admin authentication endpoints
"""
import pytest
import os
from unittest.mock import patch
from models import User
import importlib


def test_admin_registration_success(client, db_session, monkeypatch):
    """Test successful admin registration with correct secret"""
    monkeypatch.setenv("ADMIN_SECRET", "test_secret_key")
    # Reload admin module to pick up new env var
    import importlib
    import admin
    importlib.reload(admin)
    
    response = client.post(
        "/admin/register",
        json={
            "username": "newadmin",
            "email": "admin@example.com",
            "password": "adminpass123",
            "password2": "adminpass123",
            "admin_secret": "test_secret_key",
            "discord_id": "999999999"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["username"] == "newadmin"
    assert data["is_admin"] is True


def test_admin_registration_invalid_secret(client, monkeypatch):
    """Test admin registration with invalid secret"""
    monkeypatch.setenv("ADMIN_SECRET", "correct_secret")
    import importlib
    import admin
    importlib.reload(admin)
    
    response = client.post(
        "/admin/register",
        json={
            "username": "newadmin",
            "email": "admin@example.com",
            "password": "adminpass123",
            "password2": "adminpass123",
            "admin_secret": "wrong_secret",
            "discord_id": "999999999"
        }
    )
    assert response.status_code == 403
    assert "secret" in response.json()["detail"].lower()


def test_admin_login_success(client, test_admin):
    """Test successful admin login"""
    response = client.post(
        "/admin/login",
        json={
            "username": "testadmin",
            "password": "adminpassword123"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["message"] == "Sign in successful"
    assert data["is_admin"] is True
    assert "user_id" in data


def test_admin_login_non_admin_user(client, test_user):
    """Test admin login with non-admin user"""
    response = client.post(
        "/admin/login",
        json={
            "username": "testuser",
            "password": "testpassword123"
        }
    )
    # Login succeeds but is_admin should be False
    assert response.status_code == 200
    data = response.json()
    assert data["is_admin"] is False


def test_admin_login_invalid_credentials(client):
    """Test admin login with invalid credentials"""
    response = client.post(
        "/admin/login",
        json={
            "username": "nonexistent",
            "password": "wrongpassword"
        }
    )
    assert response.status_code == 400
    assert "invalid" in response.json()["detail"].lower()


def test_admin_session_check(authenticated_admin_client, test_admin):
    """Test admin session check"""
    response = authenticated_admin_client.get("/admin/checkAdminSession")
    assert response.status_code == 200
    data = response.json()
    assert data["logged_in"] is True
    assert data["is_admin"] is True
    assert data["user_id"] == test_admin.id


def test_admin_session_check_non_admin(authenticated_client, test_user):
    """Test admin session check with non-admin user"""
    response = authenticated_client.get("/admin/checkAdminSession")
    assert response.status_code == 200
    data = response.json()
    assert data["logged_in"] is True
    assert data["is_admin"] is False


def test_admin_endpoint_requires_auth(client):
    """Test that admin endpoints require authentication"""
    response = client.get("/admin/devices")
    assert response.status_code == 401
    assert "authenticated" in response.json()["detail"].lower()


def test_admin_endpoint_requires_admin_role(authenticated_client):
    """Test that admin endpoints require admin role"""
    response = authenticated_client.get("/admin/devices")
    assert response.status_code == 403
    assert "admin" in response.json()["detail"].lower()

