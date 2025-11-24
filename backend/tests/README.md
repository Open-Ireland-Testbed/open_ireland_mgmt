# Backend Tests

## Running Tests

```bash
# Run all tests
pytest

# Run with verbose output
pytest -v

# Run specific test file
pytest tests/test_auth.py

# Run specific test
pytest tests/test_auth.py::test_user_login_success

# Run with coverage
pytest --cov=. --cov-report=html
```

## Test Structure

- `conftest.py` - Pytest fixtures and configuration
- `test_auth.py` - User authentication tests
- `test_admin_auth.py` - Admin authentication tests
- `test_bookings.py` - Booking management tests
- `test_conflicts.py` - Conflict detection tests
- `test_devices.py` - Device management tests
- `test_approval.py` - Booking approval/rejection tests
- `test_pdu.py` - PDU control panel tests

## Test Database

Tests use an in-memory SQLite database that is created and destroyed for each test. No external database connection is required.

## Mocking

- Discord webhooks are mocked
- Raritan SDK calls are mocked
- External API calls are mocked

