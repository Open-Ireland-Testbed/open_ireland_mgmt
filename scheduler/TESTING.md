# Testing Guide for Lab Scheduler

This document provides comprehensive information about running and writing tests for the Lab Scheduler application.

## Overview

The test suite is divided into:
- **Backend Tests** - FastAPI endpoints and business logic (pytest)
- **Frontend Tests** - React components and services (Jest + React Testing Library)

## Quick Start

### Docker-Based Testing (Recommended)

The easiest way to run tests is using Docker, which ensures consistent environments:

```bash
./run-tests-docker.sh
```

This will:
- Build Docker containers with all dependencies
- Run backend tests in a Python 3.12 container
- Run frontend tests in a Node.js 16 container
- Clean up containers after tests complete

### Host System Testing (Optional)

If you prefer running tests directly on your system (requires local Node.js and Python setup):

#### Backend Tests

```bash
cd backend
pip install -r requirements.txt
pytest
```

#### Frontend Tests

```bash
cd frontend
npm install
npm test
```

**Note:** For consistent testing, Docker-based testing is recommended. Host system testing requires manual setup of Node.js, npm, and Python dependencies.

## Running Tests

### Using Docker (Recommended)

```bash
# Run all tests in Docker containers
./run-tests-docker.sh

# This ensures:
# - Consistent environments (no local dependency issues)
# - Isolated test environments
# - No need to install Node.js or Python dependencies locally
```

### Backend (Host System)

```bash
# Run all tests
cd backend
pytest

# Run with verbose output
pytest -v

# Run specific test file
pytest tests/test_auth.py

# Run specific test function
pytest tests/test_auth.py::test_user_login_success

# Run with coverage report
pytest --cov=. --cov-report=html
pytest --cov=. --cov-report=term

# Run only unit tests (exclude integration)
pytest -m unit

# Run only integration tests
pytest -m integration
```

### Frontend

```bash
# Run all tests in watch mode
cd frontend
npm test

# Run tests once (CI mode)
npm test -- --watchAll=false

# Run with coverage
npm run test:coverage

# Run specific test file
npm test -- BookingService.test.js

# Run tests matching pattern
npm test -- --testNamePattern="login"
```

## Test Coverage

### Backend Test Files

- `tests/test_auth.py` - User authentication (registration, login, session)
- `tests/test_admin_auth.py` - Admin authentication and authorization
- `tests/test_bookings.py` - Booking creation, cancellation, management
- `tests/test_conflicts.py` - Conflict detection and resolution
- `tests/test_devices.py` - Device CRUD operations (admin)
- `tests/test_approval.py` - Booking approval/rejection workflow
- `tests/test_pdu.py` - PDU control panel functionality

### Frontend Test Files

- `__tests__/components/` - Component tests
  - `LoginRegisterPopup.test.js` - Login/register UI
- `__tests__/services/` - Service tests
  - `BookingService.test.js` - Booking submission logic
- `__tests__/config/` - Configuration tests
  - `api.test.js` - API configuration

## Test Infrastructure

### Backend

- **Framework**: pytest
- **Test Client**: FastAPI TestClient
- **Database**: In-memory SQLite (isolated per test)
- **Mocking**: unittest.mock for external services
- **Fixtures**: Defined in `conftest.py`
- **Safety Checks**: Production database protection built-in

### Production Database Protection

The test suite includes multiple layers of protection to ensure tests never touch production data:

1. **Automatic Safety Check**: When tests are imported, a safety check runs that:
   - Detects if `DATABASE_URL` points to a production database
   - Raises an error if production indicators are detected (e.g., "production", "prod", "live")
   - Warns if non-SQLite database is configured (tests will still use in-memory SQLite)

2. **Database Override**: Tests completely override the production database dependency:
   - All tests use `sqlite:///:memory:` (in-memory database)
   - Production `DATABASE_URL` is never used during tests
   - Each test gets a fresh, isolated database

3. **Runtime Assertions**: Fixtures include assertions to verify:
   - Test database is SQLite (not MySQL/PostgreSQL)
   - Database dependency override is working correctly

**Result**: Tests are completely isolated from production data. You can run tests safely without any risk of affecting production.

Key fixtures:
- `client` - Test client with database override
- `db_session` - Database session
- `test_user` - Regular user fixture
- `test_admin` - Admin user fixture
- `test_device` - Device fixture
- `test_booking` - Booking fixture
- `authenticated_client` - Authenticated test client
- `authenticated_admin_client` - Authenticated admin client

### Frontend

- **Framework**: Jest
- **Component Testing**: React Testing Library
- **API Mocking**: Mock Service Worker (MSW)
- **User Interaction**: @testing-library/user-event

Mock handlers are in `__tests__/mocks/handlers.js` and automatically loaded via `setupTests.js`.

## Writing New Tests

### Backend Test Example

```python
def test_create_booking(client, test_user, test_device):
    """Test creating a booking"""
    response = client.post(
        "/bookings",
        json={
            "user_id": test_user.id,
            "bookings": [{
                "device_type": test_device.deviceType,
                "device_name": test_device.deviceName,
                "start_time": "2025-01-15T07:00:00",
                "end_time": "2025-01-15T12:00:00",
                "status": "PENDING"
            }]
        }
    )
    assert response.status_code == 200
    assert response.json()["count"] == 1
```

### Frontend Test Example

```javascript
import { render, screen } from '@testing-library/react';
import MyComponent from '../MyComponent';

test('renders component correctly', () => {
  render(<MyComponent />);
  expect(screen.getByText('Expected Text')).toBeInTheDocument();
});
```

## Test Best Practices

1. **Isolation**: Each test should be independent
2. **Naming**: Use descriptive test names
3. **Arrange-Act-Assert**: Structure tests clearly
4. **Mocking**: Mock external dependencies (Discord, PDU SDK, etc.)
5. **Coverage**: Aim for 80%+ coverage on critical paths
6. **Speed**: Keep tests fast (use in-memory DB for backend)

## Continuous Integration

Tests should be run:
- Before committing code
- In CI/CD pipeline
- Before deploying to production

### GitHub Actions Example

```yaml
- name: Run Backend Tests
  run: |
    cd backend
    pip install -r requirements.txt
    pytest --cov=. --cov-report=xml

- name: Run Frontend Tests
  run: |
    cd frontend
    npm install
    npm run test:ci
```

## Troubleshooting

### Backend Tests

**Issue**: Tests fail with database errors
- **Solution**: Ensure you're using the test database (in-memory SQLite)

**Issue**: Import errors
- **Solution**: Make sure you're running from the backend directory or PYTHONPATH is set

### Frontend Tests

**Issue**: MSW handlers not working
- **Solution**: Check that `setupTests.js` imports the server correctly

**Issue**: Component not rendering
- **Solution**: Ensure all required context providers are included in test render

## Test Coverage Goals

- **Backend**: 80%+ overall coverage
- **Frontend**: 70%+ component coverage
- **Critical Paths**: 100% coverage
  - Authentication flows
  - Booking creation
  - Conflict detection
  - Admin operations

## Additional Resources

- [pytest Documentation](https://docs.pytest.org/)
- [React Testing Library](https://testing-library.com/react)
- [Mock Service Worker](https://mswjs.io/)
- Backend tests: `backend/tests/README.md`
- Frontend tests: `frontend/src/__tests__/README.md`

