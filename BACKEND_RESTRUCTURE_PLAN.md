# Backend Restructure Plan
## Eliminating sys.path Manipulations

**Date:** 2025-01-27  
**Goal:** Restructure backend code into a unified package structure that eliminates all `sys.path` manipulations while maintaining all existing functionality.

---

## 1. Proposed New Folder Layout

### 1.1 New Backend Root Structure

```
backend/                          # New unified backend root
├── __init__.py                   # Package marker
├── main.py                       # FastAPI app entrypoint (moved from scheduler/backend/main.py)
│
├── core/                         # Shared backend code
│   ├── __init__.py
│   ├── database.py              # Database engine, SessionLocal, Base (from scheduler/backend/database.py)
│   ├── deps.py                  # get_db() dependency (from scheduler/backend/deps.py)
│   ├── hash.py                  # Password hashing utilities (from scheduler/backend/hash.py)
│   └── discord_utils.py         # Discord notification utilities (from scheduler/backend/discord_utils.py)
│
├── scheduler/                    # Scheduler-specific code
│   ├── __init__.py
│   ├── models.py                # Scheduler models (from scheduler/backend/models.py)
│   ├── schemas.py               # Scheduler Pydantic schemas (from scheduler/backend/schemas.py)
│   ├── routers/                  # Scheduler API routers
│   │   ├── __init__.py
│   │   ├── main.py              # Main scheduler routes (extracted from scheduler/backend/main.py)
│   │   ├── admin.py             # Admin router (from scheduler/backend/admin.py)
│   │   ├── admin_v2.py          # Admin v2 router (from scheduler/backend/admin_v2.py)
│   │   └── control_panel.py     # Control panel router (from scheduler/backend/control_panel.py)
│   └── services/                 # Scheduler business logic
│       ├── __init__.py
│       ├── topology_resolver.py  # (from scheduler/backend/topology_resolver.py)
│       └── recommendation_engine.py  # (from scheduler/backend/recommendation_engine.py)
│
├── inventory/                    # Inventory-specific code
│   ├── __init__.py
│   ├── models.py                # Inventory models (from inventory_mgmt/models.py)
│   ├── schemas.py               # Inventory Pydantic schemas (from inventory_mgmt/schemas.py)
│   ├── router.py                # Inventory API router (from inventory_mgmt/router.py)
│   └── init_db.py               # Inventory DB initialization (from inventory_mgmt/init_db.py)
│
├── tests/                        # All backend tests
│   ├── __init__.py
│   ├── conftest.py              # (from scheduler/backend/tests/conftest.py)
│   ├── test_admin_auth.py
│   ├── test_admin_v2.py
│   ├── test_approval.py
│   ├── test_auth.py
│   ├── test_bookings.py
│   ├── test_conflicts.py
│   ├── test_devices.py
│   ├── test_integration.py
│   ├── test_inventory_api.py
│   ├── test_pdu.py
│   └── test_safety_check.py
│
├── config.yaml                   # PDU config (from scheduler/backend/config.yaml)
├── requirements.txt              # Python dependencies (from scheduler/backend/requirements.txt)
├── pytest.ini                    # Pytest config (from scheduler/backend/pytest.ini)
├── Dockerfile                    # Backend Dockerfile (updated)
└── Dockerfile.test               # Test Dockerfile (from scheduler/backend/Dockerfile.test)
```

### 1.2 Repository Root Structure (After Restructure)

```
tcdona3_scheduler/
├── backend/                      # NEW: Unified backend (see structure above)
├── scheduler/
│   └── frontend/                 # Unchanged
├── inventory/
│   └── frontend/                 # Unchanged
├── inventory_mgmt/               # DEPRECATED: Will be removed after migration
├── packages/
│   └── ui/                       # Unchanged
├── docker-compose.yml            # Updated to reference backend/
└── README.md                     # Updated documentation
```

---

## 2. File Migration Mapping Table

### 2.1 Scheduler Backend Files

| Current Path | New Path | Notes |
|-------------|----------|-------|
| `scheduler/backend/main.py` | `backend/main.py` | Entrypoint - imports routers and sets up FastAPI app |
| `scheduler/backend/database.py` | `backend/core/database.py` | Shared database configuration |
| `scheduler/backend/deps.py` | `backend/core/deps.py` | Shared dependency injection |
| `scheduler/backend/hash.py` | `backend/core/hash.py` | Shared password utilities |
| `scheduler/backend/discord_utils.py` | `backend/core/discord_utils.py` | Shared Discord utilities |
| `scheduler/backend/models.py` | `backend/scheduler/models.py` | Scheduler-specific models |
| `scheduler/backend/schemas.py` | `backend/scheduler/schemas.py` | Scheduler-specific schemas |
| `scheduler/backend/admin.py` | `backend/scheduler/routers/admin.py` | Admin router |
| `scheduler/backend/admin_v2.py` | `backend/scheduler/routers/admin_v2.py` | Admin v2 router |
| `scheduler/backend/control_panel.py` | `backend/scheduler/routers/control_panel.py` | Control panel router |
| `scheduler/backend/topology_resolver.py` | `backend/scheduler/services/topology_resolver.py` | Topology service |
| `scheduler/backend/recommendation_engine.py` | `backend/scheduler/services/recommendation_engine.py` | Recommendation service |
| `scheduler/backend/pdu_manager.py` | `backend/scheduler/services/pdu_manager.py` | PDU management (if exists) |
| `scheduler/backend/config.yaml` | `backend/config.yaml` | PDU configuration |
| `scheduler/backend/requirements.txt` | `backend/requirements.txt` | Python dependencies |
| `scheduler/backend/pytest.ini` | `backend/pytest.ini` | Test configuration |
| `scheduler/backend/Dockerfile` | `backend/Dockerfile` | Updated Dockerfile |
| `scheduler/backend/Dockerfile.test` | `backend/Dockerfile.test` | Test Dockerfile |
| `scheduler/backend/reset_table.py` | `backend/reset_table.py` | Utility script (if needed) |

### 2.2 Inventory Management Files

| Current Path | New Path | Notes |
|-------------|----------|-------|
| `inventory_mgmt/models.py` | `backend/inventory/models.py` | Inventory models |
| `inventory_mgmt/schemas.py` | `backend/inventory/schemas.py` | Inventory schemas |
| `inventory_mgmt/router.py` | `backend/inventory/router.py` | Inventory API router |
| `inventory_mgmt/__init__.py` | `backend/inventory/__init__.py` | Package marker (updated) |
| `inventory_mgmt/init_db.py` | `backend/inventory/init_db.py` | DB initialization |

### 2.3 Test Files

| Current Path | New Path | Notes |
|-------------|----------|-------|
| `scheduler/backend/tests/__init__.py` | `backend/tests/__init__.py` | Test package marker |
| `scheduler/backend/tests/conftest.py` | `backend/tests/conftest.py` | Pytest configuration |
| `scheduler/backend/tests/test_*.py` | `backend/tests/test_*.py` | All test files (unchanged names) |

### 2.4 Files to Extract from main.py

The current `scheduler/backend/main.py` contains both:
- FastAPI app setup and router registration
- Scheduler-specific route handlers

**Extraction Plan:**
- Keep app setup, middleware, and router registration in `backend/main.py`
- Move scheduler route handlers to `backend/scheduler/routers/main.py`
- Import scheduler router in `backend/main.py`

---

## 3. New Import Structure

### 3.1 Core Module Imports (Shared)

**From `backend/core/database.py`:**
```python
# Used by: scheduler models, inventory models, main.py
from backend.core.database import engine, SessionLocal, Base
```

**From `backend/core/deps.py`:**
```python
# Used by: all routers (scheduler and inventory)
from backend.core.deps import get_db
```

**From `backend/core/hash.py`:**
```python
# Used by: scheduler routers (admin, main)
from backend.core.hash import hash_password, verify_password
```

**From `backend/core/discord_utils.py`:**
```python
# Used by: scheduler routers
from backend.core.discord_utils import send_booking_created_notification, send_admin_action_notification
```

### 3.2 Scheduler Module Imports

**Scheduler routers importing scheduler models/schemas:**
```python
# In backend/scheduler/routers/admin.py, admin_v2.py, control_panel.py, main.py
from backend.scheduler import models
from backend.scheduler import schemas
# Or specific imports:
from backend.scheduler.models import User, Device, Booking
from backend.scheduler.schemas import UserCreate, DeviceResponse
```

**Scheduler routers importing core:**
```python
# In backend/scheduler/routers/*.py
from backend.core.deps import get_db
from backend.core.hash import hash_password, verify_password
from backend.core.discord_utils import send_booking_created_notification
```

**Scheduler services importing:**
```python
# In backend/scheduler/services/topology_resolver.py
from backend.scheduler import models
from backend.core.database import SessionLocal
```

### 3.3 Inventory Module Imports

**Inventory router importing inventory models/schemas:**
```python
# In backend/inventory/router.py
from backend.inventory import models
from backend.inventory import schemas
# Or specific imports:
from backend.inventory.models import InventoryDevice, DeviceType
from backend.inventory.schemas import DeviceResponse
```

**Inventory router importing core:**
```python
# In backend/inventory/router.py
from backend.core.deps import get_db
```

**Inventory models importing scheduler models (for User reference):**
```python
# In backend/inventory/models.py
from backend.scheduler.models import User  # For foreign key relationships
from backend.core.database import Base
```

**Inventory init_db importing:**
```python
# In backend/inventory/init_db.py
from backend.core.database import engine, Base
from backend.inventory import models
```

### 3.4 Main Entrypoint Imports

**In `backend/main.py`:**
```python
# Core imports
from backend.core.database import engine, Base
from backend.core.deps import get_db

# Scheduler imports
from backend.scheduler import models as scheduler_models
from backend.scheduler import schemas as scheduler_schemas
from backend.scheduler.routers.main import router as scheduler_main_router
from backend.scheduler.routers.admin import router as admin_router
from backend.scheduler.routers.admin_v2 import router as admin_v2_router
from backend.scheduler.routers.control_panel import router as control_panel_router

# Inventory imports
from backend.inventory import models as inventory_models
from backend.inventory.router import router as inventory_router

# Import inventory models to ensure they're registered with Base
# (needed for table creation)
```

### 3.5 Test Imports

**In `backend/tests/conftest.py` and test files:**
```python
# Test configuration
from backend.core.database import Base, engine, SessionLocal
from backend.scheduler import models
from backend.inventory import models as inventory_models
```

**In individual test files:**
```python
# Example: backend/tests/test_auth.py
from backend.scheduler.routers.main import router
from backend.core.deps import get_db
from backend.scheduler import models
```

### 3.6 Import Path Validation

**All imports must:**
- Start with `backend.` (absolute imports)
- Never use relative imports (`from ..` or `.`)
- Never use `sys.path` manipulations
- Work in Docker without any path modifications

**Example valid import patterns:**
```python
✅ from backend.core.database import Base
✅ from backend.scheduler.models import User
✅ from backend.inventory.router import router
✅ from backend.core.deps import get_db

❌ from database import Base  # Missing package prefix
❌ from ..core.database import Base  # Relative import
❌ import sys; sys.path.append(...)  # Path manipulation
```

---

## 4. Router Registration in main.py

### 4.1 Current Structure (Before)

```python
# scheduler/backend/main.py
from admin import router as admin_router
from admin_v2 import router as admin_v2_router
from control_panel import router as control_panel_router
from inventory_mgmt import router as inventory_router

app.include_router(admin_router)
app.include_router(admin_v2_router)
app.include_router(control_panel_router)
app.include_router(inventory_router, prefix="/api/inventory", tags=["inventory"])
```

### 4.2 New Structure (After)

```python
# backend/main.py
from fastapi import FastAPI
from backend.scheduler.routers.main import router as scheduler_main_router
from backend.scheduler.routers.admin import router as admin_router
from backend.scheduler.routers.admin_v2 import router as admin_v2_router
from backend.scheduler.routers.control_panel import router as control_panel_router
from backend.inventory.router import router as inventory_router

app = FastAPI()

# Register scheduler routers
app.include_router(scheduler_main_router)  # Main scheduler routes (from extracted main.py routes)
app.include_router(admin_router, prefix="/admin", tags=["admin"])
app.include_router(admin_v2_router, prefix="/admin/v2", tags=["admin_v2"])
app.include_router(control_panel_router, prefix="/control-panel", tags=["control-panel"])

# Register inventory router
app.include_router(inventory_router, prefix="/api/inventory", tags=["inventory"])
```

**Note:** The current `main.py` contains both app setup AND route handlers. We need to:
1. Extract route handlers to `backend/scheduler/routers/main.py`
2. Keep app setup, middleware, and router registration in `backend/main.py`

---

## 5. Dockerfile Changes

### 5.1 New Dockerfile Structure

```dockerfile
# backend/Dockerfile
FROM python:3.11-slim

RUN apt-get update \
    && apt-get install -y curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements and install dependencies
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy entire backend package
COPY backend/ .

# Set default port if not provided
ENV BACKEND_PORT=20001

# Expose the backend port
EXPOSE 20001

# Use shell form to allow environment variable expansion
# Note: main.py is now at backend/main.py, so we import as backend.main:app
CMD sh -c "uvicorn backend.main:app --host 0.0.0.0 --port ${BACKEND_PORT:-20001} --reload"
```

**Key Changes:**
- Build context: `.` (repo root)
- Copy `backend/` directory to `/app/`
- Uvicorn command: `backend.main:app` (package.module:app)

### 5.2 Docker Compose Changes

```yaml
# docker-compose.yml
services:
  backend:
    container_name: openireland-backend
    build:
      context: .                    # Build from repo root
      dockerfile: backend/Dockerfile  # Updated path
    environment:
      - BACKEND_PORT=20001
      - FRONTEND_URL=http://localhost:25002
      - DEBUG=True
      - DATABASE_URL=mysql+pymysql://openireland:ChangeMe_Dev123%21@172.17.0.1:3306/provdb_dev
    volumes:
      - ./backend:/app              # Mount backend/ to /app/
      # No separate inventory_mgmt mount needed!
    ports:
      - "25001:20001"
    # ... rest unchanged
```

**Key Changes:**
- `dockerfile: backend/Dockerfile` (was `scheduler/backend/Dockerfile`)
- `volumes: ./backend:/app` (was `./scheduler/backend:/app` and `./inventory_mgmt:/app/inventory_mgmt`)

### 5.3 Docker Structure After Changes

**Inside Docker container (`/app/`):**
```
/app/
├── __init__.py
├── main.py
├── core/
│   ├── __init__.py
│   ├── database.py
│   ├── deps.py
│   ├── hash.py
│   └── discord_utils.py
├── scheduler/
│   ├── __init__.py
│   ├── models.py
│   ├── schemas.py
│   ├── routers/
│   └── services/
├── inventory/
│   ├── __init__.py
│   ├── models.py
│   ├── schemas.py
│   └── router.py
└── tests/
```

**All imports work because:**
- Python sees `/app/` as the `backend` package
- All imports use `backend.*` prefix
- No sys.path manipulation needed

---

## 6. Database Initialization

### 6.1 Current Initialization

Currently in `scheduler/backend/main.py`:
```python
from database import Base
from inventory_mgmt import models as inventory_models  # Import to register with Base

@app.on_event("startup")
async def create_tables():
    Base.metadata.create_all(bind=engine)
```

### 6.2 New Initialization

In `backend/main.py`:
```python
from backend.core.database import engine, Base
# Import all models to ensure they're registered with Base
from backend.scheduler import models as scheduler_models
from backend.inventory import models as inventory_models

@app.on_event("startup")
async def create_tables():
    """Create database tables on application startup"""
    # All models are already imported above, so Base.metadata includes them
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables created successfully")
```

**Key Points:**
- Import both `scheduler.models` and `inventory.models` before `create_all()`
- This ensures all model classes are registered with `Base.metadata`
- No changes to table creation logic

### 6.3 Inventory init_db.py

The `backend/inventory/init_db.py` can remain as a utility script:
```python
# backend/inventory/init_db.py
from backend.core.database import engine, Base
from backend.inventory import models

def create_tables():
    """Create all inventory management tables"""
    Base.metadata.create_all(bind=engine)
```

**Note:** This is now optional since `main.py` handles all table creation.

---

## 7. Risks & Mitigations

### 7.1 Import Path Errors

**Risk:** Incorrect import paths after migration could cause `ModuleNotFoundError`.

**Mitigation:**
1. Use automated find/replace with careful validation
2. Test imports in isolated Python environment before Docker
3. Create a migration script that validates all imports
4. Run linter (`pylint` or `mypy`) to catch import errors early

**Validation Script:**
```python
# scripts/validate_imports.py
import ast
import sys

def validate_imports(file_path):
    """Check that all imports use backend.* prefix"""
    with open(file_path) as f:
        tree = ast.parse(f.read())
    
    for node in ast.walk(tree):
        if isinstance(node, ast.ImportFrom):
            if node.module and not node.module.startswith('backend.'):
                print(f"ERROR: {file_path} uses non-backend import: {node.module}")
                sys.exit(1)
```

### 7.2 Breaking Scheduler Login

**Risk:** Authentication routes might break if imports are incorrect.

**Mitigation:**
1. **Preserve exact route paths:** All endpoints must keep same URLs
2. **Test authentication flow:** 
   - User registration (`/users/register`)
   - User login (`/login`)
   - Session check (`/session`)
3. **Verify session middleware:** Ensure `SessionMiddleware` configuration unchanged
4. **Check password hashing:** Verify `hash.py` imports work correctly

**Test Checklist:**
- [ ] User can register new account
- [ ] User can login with credentials
- [ ] Session persists across requests
- [ ] `/api/auth/me` returns correct user info
- [ ] Logout clears session

### 7.3 Inventory Routes Not Registering

**Risk:** Inventory router might not register correctly, breaking `/api/inventory/*` endpoints.

**Mitigation:**
1. **Verify router import:** Ensure `backend.inventory.router` imports correctly
2. **Check router prefix:** Confirm `prefix="/api/inventory"` is preserved
3. **Test inventory endpoints:**
   - `GET /api/inventory/devices`
   - `GET /api/inventory/device-types`
   - `POST /api/inventory/devices`
4. **Check FastAPI docs:** Verify inventory endpoints appear in `/docs`

**Validation:**
```python
# In backend/main.py, after router registration:
@app.get("/health")
def health_check():
    routes = [r.path for r in app.routes]
    assert "/api/inventory/devices" in routes, "Inventory routes not registered!"
    return {"status": "ok", "routes": len(routes)}
```

### 7.4 Database Table Creation Failures

**Risk:** Models might not register with `Base`, causing missing tables.

**Mitigation:**
1. **Import all models explicitly:** Import both scheduler and inventory models in `main.py`
2. **Verify Base.metadata:** Log all registered tables before `create_all()`
3. **Test in clean database:** Run against empty database to catch missing tables
4. **Check foreign keys:** Ensure cross-model references (e.g., `inventory.models` referencing `scheduler.models.User`) work

**Debug Code:**
```python
# In backend/main.py startup
@app.on_event("startup")
async def create_tables():
    # Debug: Log all registered tables
    logger.info(f"Registered tables: {list(Base.metadata.tables.keys())}")
    
    try:
        Base.metadata.create_all(bind=engine)
        logger.info("Database tables created successfully")
    except Exception as e:
        logger.error(f"Error creating database tables: {e}")
        if fail_fast:
            raise
```

### 7.5 Test Suite Breakage

**Risk:** Tests might break due to import path changes.

**Mitigation:**
1. **Update test imports:** Change all test imports to use `backend.*` prefix
2. **Update conftest.py:** Ensure test fixtures use correct imports
3. **Run test suite:** Execute all tests before merging
4. **Check test discovery:** Verify pytest finds all tests in `backend/tests/`

**Test Import Updates:**
```python
# Before: backend/tests/test_auth.py
from models import User
from database import SessionLocal

# After:
from backend.scheduler.models import User
from backend.core.database import SessionLocal
```

### 7.6 Docker Build Failures

**Risk:** Dockerfile might fail to copy files or start uvicorn.

**Mitigation:**
1. **Test Docker build locally:** `docker build -t test-backend -f backend/Dockerfile .`
2. **Verify file structure:** Check that all files are copied correctly
3. **Test uvicorn command:** Ensure `backend.main:app` resolves correctly
4. **Check working directory:** Verify `WORKDIR /app` and file paths match

**Docker Validation:**
```bash
# Build and inspect
docker build -t test-backend -f backend/Dockerfile .
docker run --rm test-backend ls -la /app/
docker run --rm test-backend python -c "import backend.main; print('OK')"
```

### 7.7 Circular Import Issues

**Risk:** Circular imports between scheduler and inventory modules.

**Mitigation:**
1. **Keep imports unidirectional:** 
   - `inventory.models` can import `scheduler.models` (for User reference)
   - `scheduler.models` should NOT import `inventory.models`
2. **Use type hints:** Use `TYPE_CHECKING` for forward references if needed
3. **Lazy imports:** Import models only when needed, not at module level

**Example Safe Import:**
```python
# backend/inventory/models.py
from typing import TYPE_CHECKING
if TYPE_CHECKING:
    from backend.scheduler.models import User

# At runtime, import normally:
from backend.scheduler.models import User
```

### 7.8 Volume Mount Issues in Development

**Risk:** Docker volume mounts might not work with new structure.

**Mitigation:**
1. **Update docker-compose.yml:** Change volume mount from `./scheduler/backend:/app` to `./backend:/app`
2. **Remove old mount:** Remove `./inventory_mgmt:/app/inventory_mgmt` mount
3. **Test hot reload:** Verify uvicorn auto-reload works with new structure
4. **Check file permissions:** Ensure mounted files are readable

---

## 8. Migration Steps (For Reference - Not Implementation)

### Phase 1: Create New Structure
1. Create `backend/` directory at repo root
2. Create subdirectories: `core/`, `scheduler/`, `inventory/`, `tests/`
3. Create all `__init__.py` files

### Phase 2: Move Core Files
1. Move `database.py`, `deps.py`, `hash.py`, `discord_utils.py` to `backend/core/`
2. Update imports in moved files (add `backend.core.` prefix)

### Phase 3: Move Scheduler Files
1. Move `models.py`, `schemas.py` to `backend/scheduler/`
2. Create `backend/scheduler/routers/` and move router files
3. Create `backend/scheduler/services/` and move service files
4. Extract route handlers from `main.py` to `backend/scheduler/routers/main.py`

### Phase 4: Move Inventory Files
1. Move `inventory_mgmt/*.py` to `backend/inventory/`
2. Update imports in inventory files

### Phase 5: Create New main.py
1. Create `backend/main.py` with app setup
2. Import and register all routers
3. Set up middleware and startup events

### Phase 6: Update Tests
1. Move test files to `backend/tests/`
2. Update all test imports

### Phase 7: Update Docker
1. Update `backend/Dockerfile`
2. Update `docker-compose.yml`
3. Test Docker build and run

### Phase 8: Validation
1. Run import validation script
2. Test authentication flow
3. Test inventory endpoints
4. Run test suite
5. Check FastAPI docs

---

## 9. Success Criteria

The restructure is successful when:

✅ **No sys.path manipulations:** Zero occurrences of `sys.path.append` or `sys.path.insert` in backend code  
✅ **All imports use `backend.*` prefix:** All imports are absolute and start with `backend.`  
✅ **Docker builds successfully:** `docker compose build backend` completes without errors  
✅ **Backend starts correctly:** `docker compose up backend` shows "Application startup complete"  
✅ **Scheduler login works:** Users can register, login, and maintain sessions  
✅ **Inventory endpoints work:** All `/api/inventory/*` endpoints respond correctly  
✅ **Tests pass:** All tests in `backend/tests/` pass  
✅ **FastAPI docs accessible:** `/docs` endpoint shows all routes including inventory  
✅ **Database tables created:** All tables from both scheduler and inventory models exist  

---

## 10. Rollback Plan

If migration fails:

1. **Keep old structure:** Don't delete `scheduler/backend/` or `inventory_mgmt/` until migration is validated
2. **Git branch:** Perform migration on separate branch
3. **Quick revert:** Can revert to old structure by:
   - Reverting docker-compose.yml
   - Reverting Dockerfile
   - Old code still exists in original locations

---

**End of Plan**

This plan provides a complete roadmap for restructuring the backend without sys.path manipulations while maintaining all existing functionality.

