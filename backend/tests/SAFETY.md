# Test Safety: Production Database Protection

## Overview

The test suite includes multiple layers of protection to ensure **tests never touch production data**.

## Safety Mechanisms

### 1. Automatic Safety Check (Import-Time)

When tests are imported, a safety check automatically runs that:

- **Detects Production Databases**: Scans `DATABASE_URL` for production indicators:
  - Keywords: `production`, `prod`, `live`, `main`
  - Database types: `mysql`, `mariadb`, `pymysql` (production uses MySQL)
  
- **Raises Error on Production**: If a production database is detected, tests **fail immediately** with:
  ```
  🚨 SAFETY CHECK FAILED: Tests are configured to use production database!
  ```

- **Warns on Non-SQLite**: If `DATABASE_URL` points to a non-SQLite database (and isn't explicitly marked as "test"), a warning is shown (tests still use in-memory SQLite).

### 2. Hardcoded Test Database

Tests use **in-memory SQLite** that is completely separate from production:

```python
TEST_DATABASE_URL = "sqlite:///:memory:"  # In-memory, not production
```

This database:
- Exists only in RAM during test execution
- Is destroyed when tests finish
- Never touches disk or network

### 3. Database Dependency Override

Tests completely override the production database connection:

```python
app.dependency_overrides[get_db] = override_get_db  # Uses test DB, not production
```

Even if `DATABASE_URL` is set, tests **never use it** because the dependency is overridden.

### 4. Runtime Assertions

Each test fixture includes assertions that verify:
- Test database is SQLite (not MySQL/PostgreSQL)
- Database override is working correctly

## What Happens If Production Database is Detected?

### Scenario 1: Production Database URL Detected

```bash
# If DATABASE_URL contains "production" or "prod"
export DATABASE_URL="mysql://user:pass@production-server/db"

# Running tests will immediately fail:
pytest
# 🚨 SAFETY CHECK FAILED: Tests are configured to use production database!
```

### Scenario 2: Non-Production MySQL Database

```bash
# If DATABASE_URL is MySQL but not marked as production
export DATABASE_URL="mysql://user:pass@test-server/db"

# Running tests will show a warning but continue:
pytest
# ⚠️  WARNING: DATABASE_URL is set to non-SQLite database...
# Tests will use in-memory SQLite instead
```

### Scenario 3: Normal Operation (No DATABASE_URL or Test Database)

```bash
# Unset DATABASE_URL or set to test database
unset DATABASE_URL
# OR
export DATABASE_URL="sqlite:///test.db"

# Tests run normally with in-memory SQLite
pytest
# ✅ All tests pass
```

## Verification

You can verify the safety checks are working by:

1. **Check the safety check runs**: Look for any warnings/errors when importing tests
2. **Verify test database**: Check that `TEST_DATABASE_URL` is `sqlite:///:memory:`
3. **Check override**: The `client` fixture asserts that database override is in place

## Best Practices

1. **Always unset DATABASE_URL** when running tests locally
2. **Use test environment variables** in CI/CD
3. **Never run tests with production database credentials**
4. **Trust the safety checks** - they're designed to prevent accidents

## Summary

✅ **Tests are completely isolated from production**
✅ **Multiple safety layers prevent accidental production access**
✅ **In-memory database ensures no data persistence**
✅ **Automatic checks catch misconfigurations early**

You can run tests with complete confidence that production data is safe!

