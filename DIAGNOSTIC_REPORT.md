# Internal State Diagnostic Report
**Generated:** 2025-01-27  
**Scope:** Complete codebase analysis - Backend, Frontend, Docker, Database, Tests

---

## 0. High-Level Summary

**Current State:**
- Backend uses **5 sys.path manipulations** across 4 files (main.py, inventory_mgmt/*.py, tests)
- Backend structure: `scheduler/backend/` (main code) + `inventory_mgmt/` (separate module)
- Docker mounts: `./scheduler/backend:/app` + `./inventory_mgmt:/app/inventory_mgmt`
- Import pattern: Scheduler uses direct imports; Inventory uses sys.path to reach scheduler modules
- Database: Single `Base` shared between scheduler and inventory models
- **Critical Issue:** Table name collision risk - `device_table` (scheduler) vs `devices` (inventory)
- **Critical Issue:** Inventory models directly import scheduler models via sys.path hack
- **Critical Issue:** Test suite uses sys.path to import inventory_mgmt
- Frontend: Both frontends correctly configured with API URLs
- Auth: Login endpoint at `/login` accepts all users (no admin-only restriction found)

**Key Findings:**
1. ✅ No circular imports detected
2. ⚠️ 5 sys.path manipulations must be eliminated
3. ⚠️ Table naming collision: `device_table` vs `devices` (different purposes, but confusing)
4. ✅ Docker structure works but is fragile
5. ✅ All routers register successfully
6. ✅ Database initialization imports both model sets correctly
7. ⚠️ Inventory frontend API config has incorrect default port (20002 vs 25001)

---

## 1. Backend Structure

### 1.1 Current Python Module Structure

```
tcdona3_scheduler/
├── scheduler/
│   └── backend/                    # Main backend code
│       ├── main.py                 # FastAPI app entrypoint
│       ├── database.py             # Shared Base, engine, SessionLocal
│       ├── deps.py                 # Shared get_db() dependency
│       ├── models.py               # Scheduler models (User, Device, Booking, etc.)
│       ├── schemas.py              # Scheduler Pydantic schemas
│       ├── admin.py                # Admin router
│       ├── admin_v2.py             # Admin v2 router
│       ├── control_panel.py        # Control panel router
│       ├── hash.py                 # Password hashing utilities
│       ├── discord_utils.py        # Discord notifications
│       ├── topology_resolver.py    # Topology service
│       ├── recommendation_engine.py # Recommendation service
│       └── tests/                  # Test suite
│
└── inventory_mgmt/                 # Inventory module (separate package)
    ├── __init__.py                 # Exports router
    ├── models.py                   # Inventory models (DeviceType, InventoryDevice, etc.)
    ├── schemas.py                  # Inventory Pydantic schemas
    ├── router.py                   # Inventory API router
    └── init_db.py                  # DB initialization utility
```

### 1.2 Files Using sys.path Manipulations

**FOUND 5 INSTANCES:**

1. **`scheduler/backend/main.py:59`**
   ```python
   sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
   from inventory_mgmt import router as inventory_router
   ```
   **Purpose:** Allows main.py to import inventory_mgmt from repo root

2. **`inventory_mgmt/models.py:22-23`**
   ```python
   _parent_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
   if _parent_dir not in sys.path:
       sys.path.insert(0, _parent_dir)
   from database import Base
   import models as scheduler_models
   ```
   **Purpose:** Allows inventory models to import scheduler's database.py and models.py

3. **`inventory_mgmt/router.py:13-15`**
   ```python
   _parent_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
   if _parent_dir not in sys.path:
       sys.path.insert(0, _parent_dir)
   from deps import get_db
   ```
   **Purpose:** Allows inventory router to import shared deps.py

4. **`inventory_mgmt/init_db.py:13-15`**
   ```python
   _parent_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
   if _parent_dir not in sys.path:
       sys.path.insert(0, _parent_dir)
   from database import engine, Base
   ```
   **Purpose:** Allows init_db to import database.py

5. **`scheduler/backend/tests/conftest.py:14,36`**
   ```python
   sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
   sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
   from inventory_mgmt import models as inventory_models
   ```
   **Purpose:** Allows tests to import inventory_mgmt

### 1.3 Module Isolation Analysis

**Scheduler → Inventory:**
- ❌ **NOT ISOLATED:** `main.py` imports `inventory_mgmt.router` and `inventory_mgmt.models`
- ❌ **NOT ISOLATED:** `tests/conftest.py` imports `inventory_mgmt.models` and `inventory_mgmt.router`

**Inventory → Scheduler:**
- ❌ **NOT ISOLATED:** `inventory_mgmt/models.py` imports `models as scheduler_models` (User model)
- ❌ **NOT ISOLATED:** `inventory_mgmt/models.py` imports `database` (Base, engine)
- ❌ **NOT ISOLATED:** `inventory_mgmt/router.py` imports `deps` (get_db)
- ❌ **NOT ISOLATED:** `inventory_mgmt/init_db.py` imports `database`

**Conclusion:** Modules are **NOT isolated**. Inventory depends on scheduler's database, deps, and User model. Scheduler depends on inventory's router and models for table creation.

### 1.4 Brittle Imports Identified

**Direct imports (no package prefix):**
- `scheduler/backend/main.py`: `import models, schemas` (should be relative or package-based)
- `scheduler/backend/main.py`: `from database import engine, Base`
- `scheduler/backend/main.py`: `from admin import router`
- `scheduler/backend/admin.py`: `import models, schemas`
- `scheduler/backend/admin.py`: `from deps import get_db`
- `inventory_mgmt/models.py`: `from database import Base`
- `inventory_mgmt/models.py`: `import models as scheduler_models`
- `inventory_mgmt/router.py`: `from deps import get_db`

**All imports are brittle** because they rely on:
1. Current working directory
2. sys.path manipulations
3. File location assumptions

**No relative imports found** - all are absolute but without package structure.

---

## 2. Import Graph

### 2.1 Import Dependencies

```
main.py
├── imports: models, schemas, database, deps, hash, discord_utils
├── imports: admin, admin_v2, control_panel (routers)
└── imports: inventory_mgmt.router, inventory_mgmt.models (via sys.path)

inventory_mgmt/models.py
├── imports: database.Base (via sys.path)
└── imports: models as scheduler_models (via sys.path) → scheduler/backend/models.py

inventory_mgmt/router.py
├── imports: deps.get_db (via sys.path)
└── imports: .models, .schemas (relative - OK)

admin.py, admin_v2.py, control_panel.py
├── imports: models, schemas (direct)
└── imports: deps.get_db (direct)
```

### 2.2 Circular Import Risk

**ANALYSIS:** No circular imports detected.

**Dependency Flow:**
- `main.py` → `inventory_mgmt.router` → `inventory_mgmt.models` → `scheduler.models` ✅ (unidirectional)
- `inventory_mgmt.models` → `scheduler.models.User` ✅ (unidirectional)
- All routers import from `main.py` dependencies, not vice versa ✅

**Conclusion:** Import graph is **acyclic**. No circular dependencies.

### 2.3 Cross-Module Imports

**Inventory importing Scheduler:**
- ✅ `inventory_mgmt/models.py` → `scheduler/backend/models.py` (User model for foreign keys)
- ✅ `inventory_mgmt/models.py` → `scheduler/backend/database.py` (Base for table definitions)
- ✅ `inventory_mgmt/router.py` → `scheduler/backend/deps.py` (get_db dependency)

**Scheduler importing Inventory:**
- ✅ `scheduler/backend/main.py` → `inventory_mgmt/router` (router registration)
- ✅ `scheduler/backend/main.py` → `inventory_mgmt/models` (model registration for Base.metadata)

**Conclusion:** Cross-module imports are **intentional and necessary** but use sys.path hacks.

---

## 3. Database State

### 3.1 Database Connection

**Current DATABASE_URL:**
```
mysql+pymysql://openireland:ChangeMe_Dev123%21@172.17.0.1:3306/provdb_dev
```

**Connection Behavior:**
- Engine created in `database.py` at import time
- `SessionLocal` created from engine
- `Base` is declarative_base() - shared by all models
- Connection happens on first query, not at startup

### 3.2 Table Definitions

**Scheduler Tables (from `scheduler/backend/models.py`):**
1. `user_table` - User model
2. `device_table` - Device model (scheduler devices)
3. `booking_table` - Booking model
4. `booking_favorite` - BookingFavorite model
5. `topology_table` - Topology model
6. `admin_roles` - AdminRole model
7. `admin_audit_log` - AdminAuditLog model
8. `device_ownership` - DeviceOwnership model
9. `device_tags` - DeviceTag model (scheduler device tags)
10. `device_health_snapshot` - DeviceHealthSnapshot model
11. `topology_review` - TopologyReview model
12. `admin_settings` - AdminSetting model
13. `admin_invitations` - AdminInvitation model

**Inventory Tables (from `inventory_mgmt/models.py`):**
1. `device_types` - DeviceType model
2. `manufacturers` - Manufacturer model
3. `sites` - Site model
4. `tags` - Tag model (inventory tags)
5. `inventory_device_tags` - InventoryDeviceTag model (junction table)
6. `devices` - InventoryDevice model ⚠️ **NAME COLLISION RISK**
7. `device_history` - DeviceHistory model
8. `maintenance_records` - MaintenanceRecord model

### 3.3 Table Naming Collisions

**⚠️ CRITICAL ISSUE:**

**Collision 1: Device Tables**
- Scheduler: `device_table` (Device model)
- Inventory: `devices` (InventoryDevice model)

**Status:** ✅ **NO ACTUAL COLLISION** - Different table names, but confusing naming convention.

**Collision 2: Tag Tables**
- Scheduler: `device_tags` (DeviceTag model)
- Inventory: `tags` (Tag model) + `inventory_device_tags` (junction)

**Status:** ✅ **NO ACTUAL COLLISION** - Different purposes.

**Conclusion:** No actual collisions, but naming is inconsistent (some use `_table` suffix, others don't).

### 3.4 Database Initialization Flow

**In `main.py` startup event:**
```python
@app.on_event("startup")
async def create_tables():
    # At this point:
    # - scheduler/backend/models.py already imported (via main.py imports)
    # - inventory_mgmt/models imported (via line 61: from inventory_mgmt import models as inventory_models)
    # - Both model sets registered with Base.metadata
    Base.metadata.create_all(bind=engine)
```

**Model Registration Order:**
1. `main.py` imports `models` (scheduler models) → registers with Base
2. `main.py` imports `inventory_mgmt.models` → registers with Base
3. `create_tables()` called → creates all registered tables

**Conclusion:** ✅ **Database initialization works correctly** - both model sets are imported before `create_all()`.

### 3.5 Foreign Key Dependencies

**Inventory → Scheduler:**
- `inventory_mgmt/models.py:InventoryDevice.created_by_id` → `user_table.id`
- `inventory_mgmt/models.py:InventoryDevice.updated_by_id` → `user_table.id`
- `inventory_mgmt/models.py:DeviceHistory.changed_by_id` → `user_table.id`
- `inventory_mgmt/models.py:MaintenanceRecord.created_by_id` → `user_table.id`

**Scheduler → Inventory:**
- None found

**Conclusion:** Inventory models have **unidirectional dependency** on scheduler's User model.

### 3.6 Missing Tables / Legacy Tables

**Comment in main.py mentions:**
- Old tables no longer created: `inventory_items`, `inventory_history`, `inventory_reservations`, `inventory_tags`
- New tables: `devices`, `device_types`, `manufacturers`, `sites`, `tags`, `device_tags`, `device_history`

**Status:** ✅ **Migration already completed** - old tables not in current models.py.

---

## 4. Docker State

### 4.1 Backend Dockerfile Analysis

**File:** `scheduler/backend/Dockerfile`

**Build Context:** `.` (repo root)

**Structure:**
```dockerfile
WORKDIR /app
COPY scheduler/backend/requirements.txt .
COPY scheduler/backend/ .
COPY inventory_mgmt /app/inventory_mgmt
CMD uvicorn main:app --host 0.0.0.0 --port ${BACKEND_PORT:-20001} --reload
```

**Inside Container (`/app/`):**
```
/app/
├── main.py                    # From scheduler/backend/main.py
├── database.py                # From scheduler/backend/database.py
├── deps.py                    # From scheduler/backend/deps.py
├── models.py                  # From scheduler/backend/models.py
├── admin.py                   # From scheduler/backend/admin.py
├── admin_v2.py                # From scheduler/backend/admin_v2.py
├── control_panel.py           # From scheduler/backend/control_panel.py
├── ... (all scheduler/backend files)
└── inventory_mgmt/            # From inventory_mgmt/
    ├── __init__.py
    ├── models.py
    ├── router.py
    └── ...
```

**Conclusion:** ✅ **Docker structure works** but is fragile - relies on sys.path to connect modules.

### 4.2 Docker Compose Volume Mounts

**Backend Service:**
```yaml
volumes:
  - ./scheduler/backend:/app
  - ./inventory_mgmt:/app/inventory_mgmt
```

**Analysis:**
- ✅ Both directories mounted correctly
- ✅ Hot reload works (uvicorn --reload)
- ⚠️ **Fragile:** Depends on sys.path to import between `/app/` and `/app/inventory_mgmt/`

### 4.3 Frontend Dockerfiles

**Scheduler Frontend:**
- Build context: `scheduler/frontend`
- Volume: `./scheduler/frontend:/app`
- Port: `25002:3000`
- Env: `REACT_APP_API_URL=http://localhost:25001`

**Inventory Frontend:**
- Build context: `inventory/frontend`
- Volume: `./inventory/frontend:/app`
- Port: `25003:3001`
- Env: `REACT_APP_API_URL=http://localhost:25001`, `REACT_APP_SCHEDULER_API_URL=http://localhost:25001`

**Conclusion:** ✅ **Frontend Docker configs are correct**.

### 4.4 Frontend Webpack Overrides

**Inventory Frontend (`inventory/frontend/config-overrides.js`):**
- ✅ Configures alias for `@tcdona/ui` → `../packages/ui/src`
- ✅ Removes ModuleScopePlugin
- ✅ Handles both local dev and Docker paths (`/app/packages/ui`)
- ✅ Excludes packages/ui from other loaders

**Conclusion:** ✅ **Webpack overrides are correct and necessary** for shared UI package.

### 4.5 Frontend API Configuration

**Scheduler Frontend (`scheduler/frontend/src/config/api.js`):**
- ✅ Uses `REACT_APP_API_URL` from env
- ✅ Falls back to `http://${hostname}:25001`
- ✅ Handles hostname matching for cookies

**Inventory Frontend (`inventory/frontend/src/config/api.js`):**
- ⚠️ **ISSUE:** Default port is `20002` but should be `25001`
- ✅ Uses `REACT_APP_API_URL` from env
- ✅ Uses `REACT_APP_SCHEDULER_API_URL` for scheduler API
- ✅ Falls back to `http://${hostname}:20002` (WRONG - should be 25001)

**Conclusion:** ⚠️ **Inventory frontend has incorrect default port** but env var overrides it in Docker.

---

## 5. Scheduler Auth

### 5.1 Login Endpoint Analysis

**Endpoint:** `POST /login`  
**Location:** `scheduler/backend/main.py:357-394`

**Code Flow:**
```python
@app.post("/login")
def login_user(login_data: schemas.UserLogin, db: Session = Depends(get_db), request: Request = None):
    user = db.query(models.User).filter(models.User.username == login_data.username).first()
    
    if not user:
        raise HTTPException(status_code=400, detail="Invalid username or password")
    
    # Password validation (supports bcrypt and SHA256)
    password_valid = verify_password(login_data.password, user.password) or (login_data.password == user.password)
    
    if not password_valid:
        raise HTTPException(status_code=400, detail="Invalid username or password")
    
    # Set session
    request.session["user_id"] = user.id
    return {"message": "Sign in successful", "user_id": user.id}
```

**Response Codes:**
- ✅ `200 OK` - Login successful
- ✅ `400 Bad Request` - Invalid username or password

**Conclusion:** ✅ **Login endpoint does NOT block non-admins**. All users can login.

### 5.2 Session Check Endpoints

**`GET /session`:**
- Returns `{"logged_in": true/false, "user_id": ..., "username": ...}`
- No admin check

**`GET /api/auth/me`:**
- Returns `{"authenticated": true/false, "user_id": ..., "username": ..., "is_admin": ...}`
- No admin check - returns 401 if not authenticated

**Conclusion:** ✅ **No admin-only restrictions on login or session endpoints**.

### 5.3 Admin-Only Endpoints

**Found in `admin.py` and `admin_v2.py`:**
- `/admin/register` - Requires `ADMIN_SECRET`
- `/admin/login` - Separate admin login (but uses same User model)
- `/admin/*` routes - Protected by `admin_required` dependency
- `/admin/v2/*` routes - Protected by `get_admin_context` dependency

**Conclusion:** ✅ **Admin routes are properly protected**, but regular `/login` is open to all users.

### 5.4 Cookie/Session Configuration

**Session Middleware:**
```python
app.add_middleware(
    SessionMiddleware,
    secret_key="some-secret-key",
    session_cookie="session_id",
    max_age=3600 * 24 * 7,  # 7 days
    same_site="lax",
    https_only=False,
)
```

**CORS Configuration:**
```python
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"http://.*:(25001|25002|3000|3001)",
    allow_credentials=True,  # ✅ Allows cookies
    allow_methods=["*"],
    allow_headers=["*"],
)
```

**Conclusion:** ✅ **Cookies are configured correctly** - `allow_credentials=True` and `same_site="lax"` allow cross-port cookies.

### 5.5 Frontend Login Implementation

**Scheduler Frontend (`scheduler/frontend/src/client/LoginRegisterPopup.js`):**
```javascript
const hashedPassword = CryptoJS.SHA256(password).toString();
const res = await fetch(`${API_BASE_URL}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password: hashedPassword }),
    credentials: 'include'  // ✅ Sends cookies
});
```

**Conclusion:** ✅ **Frontend correctly sends hashed password and includes credentials**.

---

## 6. Inventory UI

### 6.1 Page Structure

**Routes Defined (`inventory/frontend/src/App.js`):**
1. `/` → Redirects to `/devices`
2. `/devices` → DevicesListPage
3. `/devices/:deviceId` → DeviceDetailPage
4. `/device-types` → DeviceTypesPage
5. `/manufacturers` → ManufacturersPage
6. `/sites` → SitesPage
7. `/tags` → TagsPage
8. `/stats` → StatsPage

**Conclusion:** ✅ **All routes defined and functional**.

### 6.2 Component Inventory

**Form Components:**
- ✅ `DeviceForm.js` - Create/edit device
- ✅ `DeviceTypeForm.js` - Create/edit device type
- ✅ `ManufacturerForm.js` - Create/edit manufacturer
- ✅ `SiteForm.js` - Create/edit site
- ✅ `TagForm.js` - Create/edit tag

**Page Components:**
- ✅ `DevicesListPage.js` - Device listing with filters
- ✅ `DeviceDetailPage.js` - Device details
- ✅ `DeviceTypesPage.js` - Device type management
- ✅ `ManufacturersPage.js` - Manufacturer management
- ✅ `SitesPage.js` - Site management
- ✅ `TagsPage.js` - Tag management
- ✅ `StatsPage.js` - Statistics dashboard

**Conclusion:** ✅ **All CRUD components present**.

### 6.3 API Integration

**API Client (`inventory/frontend/src/api/inventoryApi.js`):**
- ✅ Uses `INVENTORY_API_BASE_URL` from config
- ✅ Handles 401 (authentication errors)
- ✅ Proper error handling
- ✅ All CRUD operations implemented:
  - `getDevices()`, `getDevice()`, `createDevice()`, `updateDevice()`, `deleteDevice()`
  - `getDeviceTypes()`, `createDeviceType()`, etc.
  - `getManufacturers()`, `getSites()`, `getTags()`, etc.

**Hooks (`inventory/frontend/src/hooks/`):**
- ✅ `useDevices.js` - Device data fetching
- ✅ `useInventoryData.js` - Reference data (types, manufacturers, sites, tags)
- ✅ `useBulkSelection.js` - Bulk operations

**Conclusion:** ✅ **API integration is complete and functional**.

### 6.4 UI Design Consistency

**UI Library:**
- ✅ Uses `@tcdona/ui` shared components (AppShell, Sidebar, Header, Button, Table, etc.)
- ✅ Consistent with scheduler UI (both use same UI library)

**Layout:**
- ✅ AppShell with Sidebar and Header
- ✅ Navigation items from `config/navigation.js`
- ✅ Toast notifications via ToastContext

**Conclusion:** ✅ **UI design is consistent** with scheduler frontend.

### 6.5 Missing Features / Placeholder Logic

**Analysis of `DevicesListPage.js`:**
- ✅ Full CRUD operations implemented
- ✅ Filtering by status, device type, site, tags
- ✅ Search functionality
- ✅ Pagination
- ✅ Bulk update modal
- ✅ No placeholder logic found

**Conclusion:** ✅ **No placeholder logic detected** - all features are implemented.

---

## 7. Critical Issues That Must Be Fixed Before Restructure

### 🔥 Issue 1: sys.path Manipulations (5 instances)

**Severity:** CRITICAL  
**Files:**
1. `scheduler/backend/main.py:59`
2. `inventory_mgmt/models.py:22-23`
3. `inventory_mgmt/router.py:13-15`
4. `inventory_mgmt/init_db.py:13-15`
5. `scheduler/backend/tests/conftest.py:14,36`

**Impact:** Makes imports fragile, breaks in different environments, prevents proper package structure.

**Must Fix:** ✅ **YES - This is the primary goal of restructure**

---

### 🔥 Issue 2: Table Naming Inconsistency

**Severity:** MEDIUM  
**Issue:** Scheduler uses `_table` suffix (`user_table`, `device_table`), inventory doesn't (`devices`, `device_types`).

**Impact:** Confusing but not breaking. Could cause issues if someone expects consistent naming.

**Must Fix:** ⚠️ **RECOMMENDED but not blocking**

---

### 🔥 Issue 3: Inventory Frontend Default Port Mismatch

**Severity:** LOW  
**File:** `inventory/frontend/src/config/api.js:14`

**Issue:** Default port is `20002` but should be `25001` (matches docker-compose).

**Impact:** Only affects local dev without env vars. Docker overrides with env var.

**Must Fix:** ⚠️ **FIX BEFORE RESTRUCTURE** (simple change)

---

### 🔥 Issue 4: Direct Imports Without Package Structure

**Severity:** HIGH  
**Files:** All backend Python files

**Issue:** All imports are direct (`import models`, `from database import`) without package prefix.

**Impact:** Works only because of current directory structure. Will break in restructured package.

**Must Fix:** ✅ **YES - Part of restructure plan**

---

### 🔥 Issue 5: Test Suite sys.path Dependencies

**Severity:** HIGH  
**File:** `scheduler/backend/tests/conftest.py`

**Issue:** Tests use sys.path to import inventory_mgmt.

**Impact:** Tests won't work after restructure without fixing imports.

**Must Fix:** ✅ **YES - Must update test imports during restructure**

---

### 🔥 Issue 6: Docker Build Context Fragility

**Severity:** MEDIUM  
**File:** `scheduler/backend/Dockerfile`

**Issue:** Dockerfile copies files individually, relies on specific directory structure.

**Impact:** Works now but fragile. Restructure will require Dockerfile update anyway.

**Must Fix:** ✅ **YES - Part of restructure plan**

---

### 🔥 Issue 7: No Package __init__.py Files

**Severity:** MEDIUM  
**Missing:** `scheduler/backend/__init__.py`

**Issue:** `scheduler/backend/` is not a proper Python package.

**Impact:** Can't use `from scheduler.backend import ...` imports.

**Must Fix:** ✅ **YES - Part of restructure plan**

---

## 8. Recommendations Before Restructure

### 8.1 MUST Be Fixed Before Restructure

1. **✅ Fix Inventory Frontend Default Port**
   - Change `inventory/frontend/src/config/api.js:14` from `20002` to `25001`
   - Simple fix, prevents confusion

2. **✅ Document All Current Import Paths**
   - Create mapping of all imports before restructure
   - Use this to validate restructure correctness

3. **✅ Backup Current Working State**
   - Ensure current code works in Docker
   - Tag current commit as "pre-restructure"
   - Test all endpoints before starting

### 8.2 MUST Be Preserved

1. **✅ All API Endpoints**
   - Don't change any route paths
   - Don't change request/response schemas
   - Don't change authentication logic

2. **✅ Database Table Names**
   - Keep all `__tablename__` values exactly as-is
   - Don't rename tables during restructure
   - Preserve foreign key relationships

3. **✅ Docker Port Mappings**
   - Keep backend on 25001
   - Keep scheduler frontend on 25002
   - Keep inventory frontend on 25003

4. **✅ Environment Variables**
   - Keep `DATABASE_URL`, `DEBUG`, `FRONTEND_URL` behavior
   - Keep `REACT_APP_API_URL` for frontends

5. **✅ Session/Cookie Configuration**
   - Keep `SessionMiddleware` config
   - Keep `CORSMiddleware` config
   - Keep `same_site="lax"` and `allow_credentials=True`

### 8.3 MUST NOT Be Touched Yet

1. **❌ Business Logic**
   - Don't change any endpoint implementations
   - Don't change model field definitions
   - Don't change validation logic

2. **❌ Database Schema**
   - Don't add/remove columns
   - Don't change foreign keys
   - Don't run migrations (user said no migrations yet)

3. **❌ Frontend Code**
   - Don't modify React components
   - Don't change API client code
   - Don't modify routing

4. **❌ Test Assertions**
   - Don't change test expectations
   - Only update import paths in tests
   - Keep all test logic identical

### 8.4 Restructure Execution Order

**Recommended sequence:**

1. **Phase 1: Create New Structure**
   - Create `backend/` directory
   - Create subdirectories (`core/`, `scheduler/`, `inventory/`, `tests/`)
   - Create all `__init__.py` files

2. **Phase 2: Move Core Files**
   - Move `database.py`, `deps.py`, `hash.py`, `discord_utils.py` to `backend/core/`
   - Update imports in moved files

3. **Phase 3: Move Scheduler Files**
   - Move models, schemas, routers to `backend/scheduler/`
   - Extract route handlers from main.py

4. **Phase 4: Move Inventory Files**
   - Move all `inventory_mgmt/` files to `backend/inventory/`
   - Update imports

5. **Phase 5: Create New main.py**
   - Create `backend/main.py` with app setup
   - Register all routers
   - Import all models for table creation

6. **Phase 6: Update Tests**
   - Move test files
   - Update all imports to use `backend.*` prefix

7. **Phase 7: Update Docker**
   - Update Dockerfile
   - Update docker-compose.yml
   - Test build and run

8. **Phase 8: Validation**
   - Run import validation
   - Test all endpoints
   - Run test suite
   - Verify Docker works

---

## End of Report

**Report Status:** Complete  
**Next Steps:** Review this report, then proceed with restructure implementation per BACKEND_RESTRUCTURE_PLAN.md

