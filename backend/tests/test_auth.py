"""
Tests for user authentication endpoints
"""
import pytest
from fastapi.testclient import TestClient
from models import User


def test_user_registration_success(client, db_session):
    """Test successful user registration"""
    response = client.post(
        "/users/register",
        json={
            "username": "newuser",
            "email": "newuser@example.com",
            "password": "password123",
            "password2": "password123",
            "discord_id": "111111111"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["username"] == "newuser"
    assert data["email"] == "newuser@example.com"
    assert "password" not in data
    assert data["is_admin"] is False


def test_user_registration_duplicate_username(client, test_user):
    """Test registration with duplicate username"""
    response = client.post(
        "/users/register",
        json={
            "username": "testuser",
            "email": "different@example.com",
            "password": "password123",
            "password2": "password123"
        }
    )
    assert response.status_code == 400
    assert "already taken" in response.json()["detail"].lower()


def test_user_registration_password_mismatch(client):
    """Test registration with mismatched passwords"""
    response = client.post(
        "/users/register",
        json={
            "username": "newuser",
            "email": "newuser@example.com",
            "password": "password123",
            "password2": "differentpassword"
        }
    )
    assert response.status_code == 422  # Validation error


def test_user_registration_short_password(client):
    """Test registration with password too short"""
    response = client.post(
        "/users/register",
        json={
            "username": "newuser",
            "email": "newuser@example.com",
            "password": "short",
            "password2": "short"
        }
    )
    assert response.status_code == 422  # Validation error


def test_user_login_success(client, test_user):
    """Test successful user login"""
    response = client.post(
        "/login",
        json={
            "username": "testuser",
            "password": "testpassword123"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["message"] == "Sign in successful"
    assert "user_id" in data


def test_user_login_invalid_username(client):
    """Test login with non-existent username"""
    response = client.post(
        "/login",
        json={
            "username": "nonexistent",
            "password": "password123"
        }
    )
    assert response.status_code == 400
    assert "invalid" in response.json()["detail"].lower()


def test_user_login_invalid_password(client, test_user):
    """Test login with wrong password"""
    response = client.post(
        "/login",
        json={
            "username": "testuser",
            "password": "wrongpassword"
        }
    )
    assert response.status_code == 400
    assert "invalid" in response.json()["detail"].lower()


def test_session_check_logged_in(authenticated_client, test_user):
    """Test session check when user is logged in"""
    response = authenticated_client.get("/session")
    assert response.status_code == 200
    data = response.json()
    assert data["logged_in"] is True
    assert data["user_id"] == test_user.id
    assert data["username"] == test_user.username


def test_session_check_not_logged_in(client):
    """Test session check when user is not logged in"""
    response = client.get("/session")
    assert response.status_code == 200
    data = response.json()
    assert data["logged_in"] is False


def test_user_logout(authenticated_client):
    """Test user logout"""
    response = authenticated_client.post("/logout")
    assert response.status_code == 200
    data = response.json()
    assert "successfully" in data["message"].lower()
    
    # Verify session is cleared
    session_response = authenticated_client.get("/session")
    assert session_response.json()["logged_in"] is False

