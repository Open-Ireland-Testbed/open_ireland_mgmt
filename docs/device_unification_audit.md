# Phase U0: Legacy Device Dependency Audit

**Date**: 2025-12-11  
**Status**: READ-ONLY AUDIT (No code modifications)  
**Objective**: Map all dependencies on legacy `Device` model (device_table) vs inventory `InventoryDevice` (devices) to prepare for safe unification.

---

## Executive Summary

The Open Ireland scheduler currently operates on a **legacy Device model** (`device_table`) that is completely separate from the inventory system's InventoryDevice model (`devices`). Both models exist in the database, but the scheduler uses **only device_table** for all operations.

**Current State**:
- ✅ Scheduler is STABLE and uses legacy `Device` from `backend.scheduler.models`
- ⚠️  Frontend is tightly coupled to legacy field names (`deviceName`, `deviceType`, `maintenance_start`, etc.)
- ⚠️  `devices` table exists but is **unused** by the scheduler
- ⚠️  InventoryDevice has compatibility properties but no active scheduler integration

**Risk Level**: 🔴 HIGH — Any unification attempt must preserve exact legacy field names and behaviors.

---

## 1. Device ORM Models

### 1.1 Legacy Scheduler Device Model

**Location**: `/home/ajag/open_ireland_mgmt/backend/scheduler/models.py` (Lines 42-58)

**Table Name**: `device_table`

**Class Definition**:
```python
class Device(Base):
    __tablename__ = "device_table"
    
    id = Column(Integer, primary_key=True, index=True)
    polatis_name = Column(String(100), nullable=True)
    deviceType = Column(String(50), nullable=True)
    deviceName = Column(String(50), nullable=True)
    ip_address = Column(String(50), nullable=True)
    status = Column(String(50), nullable=True)
    maintenance_start = Column(String(100), nullable=True)
    maintenance_end = Column(String(100), nullable=True)
    Out_Port = Column(Integer, nullable=False)
    In_Port = Column(Integer, nullable=False)
    
    bookings = relationship("Booking", back_populates="device")
```

**Column Schema**:

| Column Name | Type | Nullable | Default | FK | Constraints |
|------------|------|----------|---------|----|----|
| `id` | Integer | No | Auto | - | Primary Key, Indexed |
| `polatis_name` | String(100) | Yes | NULL | - | - |
| `deviceType` | String(50) | Yes | NULL | - | - |
| `deviceName` | String(50) | Yes | NULL | - | - |
| `ip_address` | String(50) | Yes | NULL | - | - |
| `status` | String(50) | Yes | NULL | - | - |
| `maintenance_start` | String(100) | Yes | NULL | - | Format: "All Day/2023-10-01" or "7 AM - 12 PM/2023-10-01" |
| `maintenance_end` | String(100) | Yes | NULL | - | Same format as maintenance_start |
| `Out_Port` | Integer | No | - | - | - |
| `In_Port` | Integer | No | - | - |

**Relationships**:
- `bookings` → `Booking` (back_populates="device")

**Referenced By**:
- `Booking.device_id` → ForeignKey("device_table.id")
- `DeviceOwnership.device_id` → ForeignKey("device_table.id")
- `DeviceTag.device_id` → ForeignKey("device_table.id")
- `DeviceHealthSnapshot.device_id` → ForeignKey("device_table.id")

---

### 1.2 Inventory Device Model

**Location**: `/home/ajag/open_ireland_mgmt/backend/inventory/models.py` (Lines 124-271)

**Table Name**: `devices`

**Class Definition**:
```python
class InventoryDevice(Base):
    __tablename__ = "devices"
    
    id = Column(Integer, primary_key=True, index=True)
    oi_id = Column(String(50), unique=True, nullable=True, index=True)
    name = Column(String(200), nullable=False, index=True)
    device_type_id = Column(Integer, ForeignKey("device_types.id"), nullable=False, index=True)
    manufacturer_id = Column(Integer, ForeignKey("manufacturers.id"), nullable=True, index=True)
    model = Column(String(100), nullable=True)
    serial_number = Column(String(100), unique=True, nullable=True, index=True)
    status = Column(String(50), nullable=False, default="active", index=True)
    site_id = Column(Integer, ForeignKey("sites.id"), nullable=True, index=True)
    rack = Column(String(50), nullable=True)
    u_position = Column(Integer, nullable=True)
    hostname = Column(String(100), nullable=True)
    mgmt_ip = Column(String(50), nullable=True)
    polatis_name = Column(String(100), nullable=True)
    polatis_port_range = Column(String(100), nullable=True)  # "In=123;Out=456"
    owner_group = Column(String(100), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by_id = Column(Integer, ForeignKey("user_table.id"), nullable=True)
    updated_by_id = Column(Integer, ForeignKey("user_table.id"), nullable=True)
```

**Column Schema**:

| Column Name | Type | Nullable | Default | FK | Constraints |
|------------|------|----------|---------|----|----|
| `id` | Integer | No | Auto | - | Primary Key, Indexed |
| `oi_id` | String(50) | Yes | NULL | - | Unique, Indexed |
| `name` | String(200) | No | - | - | Indexed |
| `device_type_id` | Integer | No | - | device_types.id | Indexed |
| `manufacturer_id` | Integer | Yes | NULL | manufacturers.id | Indexed |
| `model` | String(100) | Yes | NULL | - | - |
| `serial_number` | String(100) | Yes | NULL | - | Unique, Indexed |
| `status` | String(50) | No | "active" | - | Indexed |
| `site_id` | Integer | Yes | NULL | sites.id | Indexed |
| `rack` | String(50) | Yes | NULL | - | - |
| `u_position` | Integer | Yes | NULL | - | - |
| `hostname` | String(100) | Yes | NULL | - | - |
| `mgmt_ip` | String(50) | Yes | NULL | - | - |
| `polatis_name` | String(100) | Yes | NULL | - | - |
| `polatis_port_range` | String(100) | Yes | NULL | - | Format: "In=123;Out=456" |
| `owner_group` | String(100) | Yes | NULL | - | - |
| `notes` | Text | Yes | NULL | - | - |
| `created_at` | DateTime | No | utcnow | - | - |
| `updated_at` | DateTime | No | utcnow | - | onupdate=utcnow |
| `created_by_id` | Integer | Yes | NULL | user_table.id | - |
| `updated_by_id` | Integer | Yes | NULL | user_table.id | - |

**Relationships**:
- `device_type` → `DeviceType` (back_populates="devices")
- `manufacturer` → `Manufacturer` (back_populates="devices")
- `site` → `Site` (back_populates="devices")
- `device_tags` → `InventoryDeviceTag[]` (back_populates="device", cascade delete-orphan)
- `history_entries` → `DeviceHistory[]` (back_populates="device", cascade delete-orphan)
- `attachments` → `DeviceAttachment[]` (back_populates="device", cascade delete-orphan)
- `created_by` → `User` (foreign_keys=[created_by_id])
- `updated_by` → `User` (foreign_keys=[updated_by_id])

**Compatibility Properties** (Lines 181-271):

The InventoryDevice model includes @property decorators to provide legacy-compatible interfaces:

```python
@property
def deviceName(self) -> str:
    return self.name

@property
def ip_address(self) -> str:
    return self.mgmt_ip

@property
def deviceType(self) -> str:
    return self.device_type.name if self.device_type else None

@property
def Out_Port(self) -> int:
    # Parses "In=123;Out=456" format from polatis_port_range
    if not self.polatis_port_range:
        return 0
    m = re.search(r"Out=(\d+)", self.polatis_port_range)
    return int(m.group(1)) if m else 0

@property
def In_Port(self) -> int:
    # Parses "In=123;Out=456" format from polatis_port_range
    if not self.polatis_port_range:
        return 0
    m = re.search(r"In=(\d+)", self.polatis_port_range)
    return int(m.group(1)) if m else 0

@property
def maintenance_start(self) -> None:
    return None  # Not implemented

@property
def maintenance_end(self) -> None:
    return None  # Not implemented
```

**⚠️  CRITICAL**: Maintenance fields are not implemented on InventoryDevice — they currently return `None`.

---

## 2. Backend Code Dependencies

### 2.1 Import Locations

All imports of the legacy Device model:

| File | Import Statement | Usage Type |
|------|-----------------|------------|
| `backend/scheduler/routers/admin.py` | `from backend.scheduler import models` | Router (Admin CRUD) |
| `backend/scheduler/routers/control_panel.py` | N/A (no direct Device usage) | Router (PDU control) |
| `backend/scheduler/services/topology_resolver.py` | `from backend.scheduler import models` | Service (Topology resolution) |
| `backend/scheduler/services/recommendation_engine.py` | `from backend.scheduler import models` | Service (ML recommendations) |
| `backend/inventory/migrate_devices_dev.py` | `from backend.scheduler.models import Device as LegacyDevice` | Migration script (unused in production) |

### 2.2 Field-by-Field Usage Matrix

This matrix shows **every location** where legacy Device fields are accessed in the backend:

#### `deviceType`

| File | Lines | Usage Context |
|------|-------|---------------|
| **admin.py** | L105-106 | Filter query: `models.Device.deviceType == device.deviceType` |
| **admin.py** | L116 | Filter query: conflict check for IP address |
| **admin.py** | L126 | CREATE: `deviceType=device.deviceType` |
| **admin.py** | L164 | Local variable storage for update |
| **admin.py** | L179-180 | UPDATE query filter |
| **admin.py** | L191-192 | UPDATE query filter |
| **admin.py** | L200-201 | UPDATE query: set deviceType |
| **admin.py** | L208 | Entity assignment: `device.deviceType = update.deviceType` |
| **admin.py** | L234, L266, L304 | Response payload in pending/all bookings |
| **topology_resolver.py** | L75 | Graph node attribute: `device.deviceType` |
| **topology_resolver.py** | L171 | Logical node type matching |
| **topology_resolver.py** | L186, L189, L209 | Type matching and scoring |
| **topology_resolver.py** | L345, L403, L472 | Type-based device filtering |
| **recommendation_engine.py** | L64 | JOIN filter: `models.Device.deviceType == device_type` |
| **recommendation_engine.py** | L106, L410 | Historical stats and fit score adjustments |

#### `deviceName`

| File | Lines | Usage Context |
|------|-------|---------------|
| **admin.py** | L106-107 | Filter query: `models.Device.deviceName == device.deviceName` |
| **admin.py** | L117 | Filter query: conflict check for IP address |
| **admin.py** | L127 | CREATE: `deviceName=device.deviceName` |
| **admin.py** | L164 | Local variable storage for update |
| **admin.py** | L180-181 | UPDATE query filter |
| **admin.py** | L192 | UPDATE query filter |
| **admin.py** | L201 | UPDATE query: set deviceName |
| **admin.py** | L209 | Entity assignment: `device.deviceName = update.deviceName` |
| **admin.py** | L235, L267, L305 | Response payload in pending/all bookings |
| **topology_resolver.py** | L76 | Graph node attribute: `device.deviceName` |
| **topology_resolver.py** | L199 | Device name in mapping candidates |

#### `ip_address`

| File | Lines | Usage Context |
|------|-------|---------------|
| **admin.py** | L114 | Filter query: IP conflict check |
| **admin.py** | L129 | CREATE: `ip_address=str(device.ip_address)` |
| **admin.py** | L188-189 | UPDATE query: IP conflict check |
| **admin.py** | L203 | UPDATE bulk set: IP address |
| **admin.py** | L236, L268, L306 | Response payload in pending/all bookings |
| **topology_resolver.py** | L77 | Graph node attribute: `device.ip_address` |

#### `status`

| File | Lines | Usage Context |
|------|-------|---------------|
| **admin.py** | L128 | CREATE: `status=device.status` |
| **admin.py** | L207 | UPDATE: `device.status = update.status` |
| **topology_resolver.py** | L78 | Graph node attribute: `device.status` |
| **topology_resolver.py** | L107-108, L120-121 | Availability checking (maintenance, unavailable, broken) |
| **recommendation_engine.py** | L252-253 | Availability checking |

#### `maintenance_start` / `maintenance_end`

| File | Lines | Usage Context |
|------|-------|---------------|
| **admin.py** | L130-131 | CREATE: `maintenance_start=device.maintenance_start, maintenance_end=device.maintenance_end` |
| **admin.py** | L210-211 | UPDATE: `device.maintenance_start = update.maintenance_start, device.maintenance_end = update.maintenance_end` |
| **topology_resolver.py** | L123-137 | Parse and check maintenance overlap with booking window |

**⚠️  CRITICAL**: Maintenance fields use a **custom string format**:
- Format 1: `"All Day/2023-10-01"` (all-day maintenance)
- Format 2: `"7 AM - 12 PM/2023-10-01"` (time-segment maintenance)

This parsing logic exists in:
- `backend/scheduler/services/topology_resolver.py` (L126-134)
- Frontend: multiple locations (see Section 4)

#### `Out_Port` / `In_Port`

| File | Lines | Usage Context |
|------|-------|---------------|
| **admin.py** | L132-133 | CREATE: `Out_Port=device.Out_Port, In_Port=device.In_Port` |
| **admin.py** | L212-213 | UPDATE: `device.Out_Port = update.Out_Port, device.In_Port = update.In_Port` |
| **topology_resolver.py** | L79-80 | Graph node attributes: `out_port=device.Out_Port, in_port=device.In_Port` |

#### `polatis_name`

| File | Lines | Usage Context |
|------|-------|---------------|
| **admin.py** | L107 | Filter query: `models.Device.polatis_name == device.polatis_name` |
| **admin.py** | L125 | CREATE: `polatis_name=device.polatis_name` |
| **admin.py** | L181 | UPDATE query filter |

### 2.3 Query Patterns

**Most common query patterns**:

1. **Get all devices**:
   ```python
   db.query(models.Device).all()
   ```
   Used in: `admin.py` (L96), `topology_resolver.py` (L44)

2. **Get device by ID**:
   ```python
   db.query(models.Device).get(device_id)
   ```
   Used in: `admin.py` (L146, L159), `recommendation_engine.py` (L195)

3. **Filter by type + name**:
   ```python
   db.query(models.Device).filter(
       models.Device.deviceType == type_value,
       models.Device.deviceName == name_value
   ).first()
   ```
   Used in: `admin.py` (L104-108, L177-182)

4. **JOIN with Booking**:
   ```python
   db.query(models.Booking).join(models.Device).filter(...)
   ```
   Used in: `admin.py` (L224-227, L293-296), `recommendation_engine.py` (L63-64)

---

## 3. Pydantic Schemas (API Contracts)

### 3.1 Device Schemas

**Location**: `backend/scheduler/schemas.py`

#### `DeviceCreate` (Lines 434-451)

```python
class DeviceCreate(BaseModel):
    polatis_name: Optional[str] = None
    deviceType: str
    deviceName: str
    ip_address: Optional[IPvAnyAddress] = None
    status: str
    maintenance_start: Optional[str] = Field(
        None,
        pattern=r"^(7 AM - 12 PM|12 PM - 6 PM|6 PM - 11 PM|All Day)/\d{4}-\d{2}-\d{2}$"
    )
    maintenance_end: Optional[str] = Field(
        None,
        pattern=r"^(7 AM - 12 PM|12 PM - 6 PM|6 PM - 11 PM|All Day)/\d{4}-\d{2}-\d{2}$"
    )
    Out_Port: int
    In_Port: int
```

#### `DeviceResponse` (Lines 454-477)

```python
class DeviceResponse(BaseModel):
    id: int
    polatis_name: Optional[str] = None
    deviceType: str
    deviceName: str
    ip_address: Optional[IPvAnyAddress] = None
    status: str
    maintenance_start: Optional[str] = Field(...)
    maintenance_end: Optional[str] = Field(...)
    Out_Port: int
    In_Port: int
    
    class Config:
        orm_mode = True
```

#### `DeviceUpdateFull` (Lines 484-501)

Same structure as `DeviceCreate`.

**⚠️  API Contract**: All API endpoints return these exact field names. Changing them would break the frontend.

### 3.2 Booking Schemas (Device References)

#### `BookingDeviceSummary` (Lines 232-236)

```python
class BookingDeviceSummary(BaseModel):
    id: int
    name: str
    type: str
    status: Optional[str] = None
```

Used in `BookingRow` for nested device info.

#### `DeviceRow` (Lines 316-328)

Used in admin device management:

```python
class DeviceRow(BaseModel):
    id: int
    name: str
    type: str
    status: str
    owner: Optional[DeviceOwnerSummary] = None
    last_updated: Optional[datetime] = None
    tags: List[str] = Field(default_factory=list)
    site: Optional[str] = None
    location_path: Optional[str] = None
    health: Optional[DeviceHealthMeta] = None
```

**Note**: Uses generic `name` / `type` instead of `deviceName` / `deviceType` (admin v2 style).

---

## 4. Frontend Field Dependencies

### 4.1 Search Results Summary

Frontend references to legacy device fields (case-sensitive):

| Field Name | Occurrences | File Count |
|-----------|-------------|------------|
| `deviceName` | 137 matches | 50+ files |
| `deviceType` | 132 matches | 50+ files |
| `maintenance_start` | 51 matches | 8 files |
| `maintenance_end` | 47 matches | 8 files |
| `Out_Port` | 5 matches | 2 files |
| `In_Port` | 5 matches | 2 files |
| `ip_address` | 27 matches | 14 files |
| `polatis_name` | 21 matches | 5 files |

### 4.2 Critical Frontend Files

#### **Device Management UI**

**File**: `scheduler/frontend/src/admin/ManageDevices.js` (684 lines)

- **Lines 18-26**: Form state with all legacy fields
  ```javascript
  const [newDevice, setNewDevice] = useState({
      polatis_name: '',
      deviceType: '',
      deviceName: '',
      ip_address: '',
      status: 'Available',
      maintenance_start_segment: '',
      maintenance_start_date: '',
      maintenance_end_segment: '',
      maintenance_end_date: ''
  });
  ```

- **Lines 62-66**: Validation checks for `deviceType`, `deviceName`, `ip_address`, `Out_Port`, `In_Port`

- **Lines 86-96**: Maintenance field assembly (converts segment + date to legacy format)
  ```javascript
  if (!newDevice.maintenance_start_segment && !newDevice.maintenance_end_segment) {
      deviceToSubmit.maintenance_start = `All Day/${newDevice.maintenance_start_date}`;
      deviceToSubmit.maintenance_end = `All Day/${newDevice.maintenance_end_date}`;
  } else {
      deviceToSubmit.maintenance_start = 
          `${newDevice.maintenance_start_segment}/${newDevice.maintenance_start_date}`;
      deviceToSubmit.maintenance_end = 
          `${newDevice.maintenance_end_segment}/${newDevice.maintenance_end_date}`;
  }
  ```

- **Lines 399-404**: Table display using `dev.deviceType`, `dev.deviceName`, `dev.In_Port`, `dev.Out_Port`, `dev.ip_address`, `dev.polatis_name`

- **Lines 498-550**: Edit form with all legacy field names

**Usage**: Full CRUD operations on devices. **Must preserve exact field names**.

#### **Schedule Tables**

**File**: `scheduler/frontend/src/client/ScheduleTable.js`

- **Lines 264-266**: Device grouping structure
  ```javascript
  {
      deviceName: dev.deviceName,
      maintenance_start: dev.maintenance_start,
      maintenance_end: dev.maintenance_end
  }
  ```

- **Lines 588-590**: Maintenance parsing
  ```javascript
  if (device && device.status === 'Maintenance' && device.maintenance_start && device.maintenance_end) {
      const maintenanceStart = parseMaintenanceTime(device.maintenance_start);
      const maintenanceEnd = parseMaintenanceTime(device.maintenance_end, true);
      // ...
  }
  ```

- **Lines 852-870**: Maintenance blocking logic (renders red cells for maintenance periods)

**File**: `scheduler/frontend/src/admin/AdminScheduleTable.js`

Similar usage patterns for admin view.

#### **Booking Flows**

**File**: `scheduler/frontend/src/services/bookingServiceV2.js`

- **Lines 44-45**: Booking request payload
  ```javascript
  device_type: device.deviceType,
  device_name: device.deviceName,
  ```

**File**: `scheduler/frontend/src/client/BookingAllDay.js`

- **Lines 112-114**: Fuzzy search keys
  ```javascript
  keys: [
      { name: 'deviceType', weight: 0.4 },
      { name: 'deviceName', weight: 0.5 },
      { name: 'ip_address', weight: 0.1 }
  ]
  ```

- **Lines 226, 335, 442, 461**: Device filtering and selection using `deviceName` and `deviceType`

#### **Timeline Panel (v2 UI)**

**File**: `scheduler/frontend/src/client/v2/TimelinePanel.js`

- **Lines 85-88**: Search keys
  ```javascript
  { name: 'polatis_name', weight: 0.3 },
  { name: 'deviceName', weight: 0.5 },
  { name: 'ip_address', weight: 0.2 },
  ```

- **Lines 160-163**: Device grouping with maintenance tracking
  ```javascript
  {
      ip_address: device.ip_address,
      maintenance_start: device.maintenance_start,
      maintenance_end: device.maintenance_end,
      // ...
  }
  ```

- **Lines 179-185**: Maintenance start/end comparison logic

#### **Patch List Panel**

**File**: `scheduler/frontend/src/client/v2/PatchListPanel.js`

- **Lines 102-113**: Maps `polatis_name` to device IDs
  ```javascript
  // Create a map of polatis_name to device IDs
  const map = new Map();
  devices.forEach(device => {
      if (device.polatis_name) {
          if (!map.has(device.polatis_name)) {
              map.set(device.polatis_name, []);
          }
          map.get(device.polatis_name).push(device.id);
      }
  });
  ```

### 4.3 UI Component Summary

| Component | Usage |
|-----------|-------|
| **ManageDevices** | Full CRUD with all legacy fields |
| **ScheduleTable** | Displays `deviceName`, `deviceType`, parses maintenance |
| **AdminScheduleTable** | Same as ScheduleTable (admin view) |
| **BookingAllDay** | Uses `deviceName`, `deviceType` for search/filtering |
| **BookingCartPanel** | Displays `deviceName` |
| **TimelinePanel** | Uses `deviceName`, `polatis_name`, `ip_address`, maintenance fields |
| **HeatmapView** | Displays `deviceName` |
| **PatchListPanel** | Uses `polatis_name` for device mapping |
| **FiltersPanel** | Searches on `deviceName`, `polatis_name`, `ip_address` |

**⚠️  CRITICAL**: All frontend components expect exact legacy field names in API responses.

---

## 5. Field Mapping Matrix

This matrix maps legacy Device fields to InventoryDevice fields:

| Legacy Field (device_table) | Type | Inventory Field (devices) | Type | Notes |
|------------------------------|------|---------------------------|------|-------|
| `id` | Integer | `id` | Integer | ✅ Direct match |
| `polatis_name` | String(100) | `polatis_name` | String(100) | ✅ Direct match |
| `deviceType` | String(50) | `device_type.name` | *Relational* | ⚠️  Requires JOIN to `device_types` table |
| `deviceName` | String(50) | `name` | String(200) | ✅ Property exists: `@property deviceName` |
| `ip_address` | String(50) | `mgmt_ip` | String(50) | ✅ Property exists: `@property ip_address` |
| `status` | String(50) | `status` | String(50) | ⚠️  Different semantics (legacy: Available/Maintenance; inventory: active/inactive) |
| `maintenance_start` | String(100) | *MISSING* | - | 🔴 **NOT IMPLEMENTED** — property returns `None` |
| `maintenance_end` | String(100) | *MISSING* | - | 🔴 **NOT IMPLEMENTED** — property returns `None` |
| `Out_Port` | Integer | *Parsed from `polatis_port_range`* | - | ✅ Property exists: parses "Out=456" |
| `In_Port` | Integer | *Parsed from `polatis_port_range`* | - | ✅ Property exists: parses "In=123" |

### 5.1 Missing Fields in InventoryDevice

**🔴 HIGH RISK**:

1. **Maintenance fields** (`maintenance_start`, `maintenance_end`):
   - Current implementation returns `None`
   - Required format: `"All Day/2023-10-01"` or `"7 AM - 12 PM/2023-10-01"`
   - Used extensively in:
     - Backend: `topology_resolver.py` (maintenance overlap checking)
     - Frontend: `ScheduleTable.js`, `AdminScheduleTable.js`, `ManageDevices.js`
   - **Must implement**: Either as columns or computed from a separate `device_maintenance` table

2. **Status semantics**:
   - Legacy: `"Available"` | `"Maintenance"`
   - Inventory: `"active"` | `"inactive"` | others
   - **Must harmonize**: Ensure status values align with scheduler expectations

### 5.2 Additional Inventory Fields (Not in Legacy)

**Enrichment opportunities** (fields that exist in InventoryDevice but not in legacy Device):

- `oi_id` (Open Ireland ID)
- `device_type_id` (FK to device_types)
- `manufacturer_id` (FK to manufacturers)
- `model`, `serial_number`
- `site_id` (FK to sites), `rack`, `u_position`
- `hostname`
- `owner_group`, `notes`
- `created_at`, `updated_at`, `created_by_id`, `updated_by_id`

These fields provide richer metadata but are **not currently used by the scheduler**.

---

## 6. Database Status

**Connection Issue**: Unable to query database directly via docker-compose due to permission errors.

**Inferred from codebase**:
- `device_table` is the **active source of truth** for the scheduler
- `devices` table exists (based on migrations and ORM definitions)
- Previous migration attempts suggest `devices` table may be **empty or out-of-sync** with `device_table`

**Recommendations**:
1. Before unification, users should run: `SELECT COUNT(*) FROM device_table;` and `SELECT COUNT(*) FROM devices;`
2. Verify data sync status: Are all `device_table` rows represented in `devices`?
3. Check for orphaned records in either table

---

## 7. Risk Assessment

### 7.1 High-Risk Dependencies (🔴)

**Must address before unification**:

1. **Maintenance field implementation** (Lines 257-270 in `inventory/models.py`)
   - Current: Returns `None`
   - Required: Implement storage and parsing for maintenance windows
   - Impact: Breaks scheduler maintenance blocking, breaks UI rendering

2. **Status value mismatch**
   - Legacy: `"Available"` / `"Maintenance"`
   - Inventory: `"active"` / `"inactive"`
   - Impact: Status-based filtering breaks, maintenance checks fail

3. **deviceType relational dependency**
   - Legacy: Simple string column
   - Inventory: FK to `device_types` table
   - Impact: All queries using `deviceType` must JOIN or use the property
   - Performance: N+1 query risk if not properly eager-loaded

4. **API response field names**
   - All Pydantic schemas use legacy field names
   - Frontend expects exact match
   - Impact: Any field rename breaks all frontend components

5. **Port parsing logic**
   - Legacy: Direct integer columns
   - Inventory: Parses from `polatis_port_range` string
   - Impact: Write operations must maintain `"In=X;Out=Y"` format

### 7.2 Medium-Risk Dependencies (⚠️)

1. **Booking FK constraint**
   - `Booking.device_id` → `device_table.id`
   - Must migrate FK to point to `devices.id`
   - Impact: Database migration required, potential data integrity issues

2. **Related tables referencing device_table**
   - `DeviceOwnership`, `DeviceTag`, `DeviceHealthSnapshot`
   - All FK to `device_table.id`
   - Impact: Must migrate all FK constraints

3. **Frontend maintenance parsing**
   - Multiple files parse `"All Day/2023-10-01"` format
   - Format must remain identical
   - Impact: Any change to format breaks UI

### 7.3 Low-Risk Dependencies (⚡)

1. **polatis_name usage**
   - Direct column match
   - No transformation needed

2. **IP address mapping**
   - Simple rename: `ip_address` → `mgmt_ip`
   - Property exists for compatibility

3. **Device name mapping**
   - Simple rename: `deviceName` → `name`
   - Property exists for compatibility

---

## 8. Recommended Unification Path (Next Phase)

Based on this audit, the recommended approach for Phase U1 (implementation) is:

### Step 1: Fix InventoryDevice Gaps

1. **Add maintenance columns** to `devices` table:
   - Option A: Add `maintenance_start` and `maintenance_end` String columns
   - Option B: Create `device_maintenance` table with start/end/segment columns
   - **Recommended**: Option A (simpler, matches legacy exactly)

2. **Harmonize status values**:
   - Update InventoryDevice to accept `"Available"` / `"Maintenance"` status values
   - OR: Map legacy values in the compatibility property

3. **Test compatibility properties**:
   - Ensure `deviceType` property works correctly with eager loading
   - Verify port parsing from `polatis_port_range`

### Step 2: Create Unified Device Model

Create a new model or modify InventoryDevice to:
- Keep all existing inventory fields
- Add/implement maintenance fields
- Ensure all compatibility properties work
- Map to `devices` table

### Step 3: Update Booking FK

- Migrate `Booking.device_id` FK from `device_table.id` to `devices.id`
- Update related tables: `DeviceOwnership`, `DeviceTag`, `DeviceHealthSnapshot`

### Step 4: Update Scheduler Imports

- Change `from backend.scheduler.models import Device` to point to InventoryDevice
- Verify all queries work (especially JOINs)
- Test all endpoints

### Step 5: Data Migration

- Populate `devices` table from `device_table` (if not already synced)
- Preserve all legacy field values
- Verify row counts match

### Step 6: Deprecate device_table

- Once fully validated, drop `device_table` and legacy Device model
- Update all documentation

---

## 9. Summary

**Current Dependencies**:

- ✅ **2 ORM models**: Legacy Device (device_table) and InventoryDevice (devices)
- ✅ **5 backend files** using legacy Device model
- ✅ **10 legacy fields** accessed across backend (deviceType, deviceName, ip_address, status, maintenance_start, maintenance_end, Out_Port, In_Port, polatis_name)
- ✅ **3 Pydantic schemas** exposing legacy field names (DeviceCreate, DeviceResponse, DeviceUpdateFull)
- ✅ **50+ frontend files** referencing device fields
- ✅ **8 critical frontend components** with hardcoded legacy field expectations

**Gaps in InventoryDevice**:

- 🔴 **Maintenance fields not implemented** (returns None)
- ⚠️  **deviceType requires JOIN** (relational, not string)
- ⚠️  **Status semantics differ** (active/inactive vs Available/Maintenance)

**Next Steps**:

1. Implement maintenance fields on InventoryDevice
2. Harmonize status values
3. Create comprehensive migration plan
4. Test compatibility properties end-to-end
5. Migrate FKs and data
6. Deprecate device_table

**Estimated Complexity**: 🔴 HIGH — Significant testing and validation required before production deployment.

---

**End of Phase U0 Audit Report**
