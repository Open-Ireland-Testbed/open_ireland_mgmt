# Test Suite Summary

## Overview

This document provides a quick reference to all tests in the Lab Scheduler application.

## Backend Tests (7 test files, ~50+ test cases)

### Test Files

1. **test_auth.py** - User Authentication (10 tests)
   - User registration (success, duplicate, validation)
   - User login (success, invalid credentials)
   - Session management
   - Logout

2. **test_admin_auth.py** - Admin Authentication (8 tests)
   - Admin registration with secret key
   - Admin login
   - Admin session checks
   - Authorization requirements

3. **test_bookings.py** - Booking Management (12 tests)
   - Create single/multi-device bookings
   - Cancel bookings
   - Delete bookings
   - Get user bookings
   - Get bookings for week
   - Auto-expire expired bookings
   - Conflict resolution

4. **test_conflicts.py** - Conflict Detection (7 tests)
   - No conflicts scenario
   - Booking overlaps
   - Maintenance period conflicts
   - Multiple device checks
   - Pending booking conflicts
   - Cancelled bookings ignored
   - Max 2 users per device rule

5. **test_devices.py** - Device Management (10 tests)
   - Get all devices (admin only)
   - Add device
   - Update device
   - Delete device
   - Device with maintenance periods
   - IP address validation
   - Polatis name uniqueness
   - Admin authorization

6. **test_approval.py** - Booking Approval (8 tests)
   - Get pending bookings
   - Get all bookings
   - Approve booking
   - Reject booking
   - Invalid status handling
   - Conflicting booking approval
   - Admin authorization

7. **test_pdu.py** - PDU Control Panel (9 tests)
   - Get all PDUs
   - Add PDU
   - Get PDU details
   - Delete PDU
   - Get sensor data
   - Control outlets
   - System status
   - Duplicate name handling
   - Admin authorization

8. **test_integration.py** - Integration Tests (4 tests)
   - Complete booking workflow
   - Admin device management workflow
   - User registration/login workflow
   - Booking conflict detection workflow

## Frontend Tests (4 test files, ~10+ test cases)

### Test Files

1. **App.test.js** - App Component (2 tests)
   - App rendering
   - Routing

2. **api.test.js** - API Configuration (2 tests)
   - Environment variable handling
   - Fallback configuration

3. **BookingService.test.js** - Booking Service (4 tests)
   - gatherAllIntervals function
   - submitAllBookings function
   - Error handling

4. **LoginRegisterPopup.test.js** - Login Component (4 tests)
   - Login form rendering
   - Register form rendering
   - Popup closing
   - Sign out option

## Test Infrastructure

### Backend
- **Framework**: pytest
- **Database**: In-memory SQLite
- **Mocking**: unittest.mock
- **Fixtures**: conftest.py with reusable fixtures

### Frontend
- **Framework**: Jest + React Testing Library
- **API Mocking**: Mock Service Worker (MSW)
- **Setup**: setupTests.js with MSW server

## Running Tests

### Quick Start
```bash
# Run all tests
./run-tests.sh

# Backend only
cd backend && pytest

# Frontend only
cd frontend && npm test
```

### Coverage
```bash
# Backend coverage
cd backend && pytest --cov=. --cov-report=html

# Frontend coverage
cd frontend && npm run test:coverage
```

## Test Coverage

### Critical Paths (100% Coverage Target)
- ✅ User authentication flows
- ✅ Booking creation and management
- ✅ Conflict detection
- ✅ Admin authorization
- ✅ Device management
- ✅ Booking approval workflow

### Overall Coverage Goals
- Backend: 80%+ code coverage
- Frontend: 70%+ component coverage

## Next Steps

To expand test coverage:
1. Add more frontend component tests
2. Add E2E tests with Playwright/Cypress
3. Add performance tests
4. Add security tests
5. Add load/stress tests

## Maintenance

- Keep tests updated when features change
- Run tests before committing
- Add tests for new features
- Review and update mocks as API changes

