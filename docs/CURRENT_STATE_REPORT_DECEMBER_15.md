# Current State Report: Open Ireland Project
**Date**: 2025-12-15  
**Context**: New Server Loopback, Remote DB (Old Server)  
**Scope**: Infrastructure, Database, Codebase Authentication

---

## 1. Run Status (Now) on This Machine

| Service | Host Port | Internal Port | Status | API Base URL |
|---------|-----------|---------------|--------|--------------|
| **Backend** | `25001` | `20001` | ⚠️ Running (404 on endpoints)* | `http://localhost:25001` |
| **Scheduler Frontend** | `25002` | `3000` | ✅ Up | `http://localhost:25001` |
| **Inventory Frontend** | `25003` | `3001` | ✅ Up | `http://localhost:25001` |

* **Route Health**:
  * `/docs`: 404 (Accessible but path might be different or app misconfigured)
  * `/api/inventory/devices`: 404
  * `/health`: 404
  * **Note**: Service accepts connections (TCP UP), but returns HTTP 404. This suggests a mounting/path issue or internal app misconfiguration in the docker container.

---

## 2. Database Connection & Location

*   **Connection URL**: `mysql+pymysql://openireland:***@10.10.10.4:3306/provdb_dev`
    *   Source: `docker-compose.yml` (environment `DATABASE_URL`)
*   **Location**: **Remote Legacy Server** (`10.10.10.4`)
*   **Startup Creation**:
    *   `backend/main.py` contains `Base.metadata.create_all(bind=engine)`.
    *   This runs on every startup.
    *   Since DB is remote and persistent, this is safe (idempotent), but ensures new tables (`device_attachments` in future) will be auto-created.

---

## 3. Schema Reality Check (Verified via SQL)

*   **devices table**: 202 rows ✅
*   **device_table**: 202 rows ✅
*   **Synchronization**: 100% (202 matching IDs).
*   **Maintenance Columns**: `maintenance_start` and `maintenance_end` **EXIST** in `devices` table. ✅
*   **Booking FKs**: Technically pointing to `device_table.id` (Legacy).

---

## 4. Code Truth: Device Source of Truth

**Warning: "Split Personality" Detected**

1.  **Admin Logic (`admin.py`)**:
    *   Uses: `backend.inventory.models.InventoryDevice` (Table: `devices`)
    *   Line 6: `from backend.inventory.models import InventoryDevice as Device`
    *   **Writes to**: `devices` table ONLY.

2.  **Booking Logic (`scheduler/models.py`)**:
    *   Uses: `backend.scheduler.models.Device` (Table: `device_table`)
    *   Line 43: `__tablename__ = "device_table"`
    *   Line 73: `ForeignKey("device_table.id")`
    *   **Reads/Links**: `device_table` ONLY.

3.  **Legacy Usage**:
    *   `device_table` is still hardcoded in `backend/scheduler/models.py`.

4.  **Compatibility Layer**:
    *   `InventoryDevice` (in `inventory/models.py`) has properties for `deviceName`, `ip_address`, `deviceType`.
    *   **Status**: Safe. Properties map to real columns/relationships.
    *   `status` is a real column (Safe for SQL filtering).

**Critical Risk**: New devices created via Admin will exist in `devices` but **NOT** in `device_table`. Note that `admin.py` *does not* dual-write. Bookings for new devices will fail.

---

## 5. Unification Status (U2+)

| Requirement | Status | Evidence |
|-------------|--------|----------|
| **deviceType Setter** | ✅ **PASS** | Removed from `inventory/models.py`. No DB session usage in model. |
| **Status Column** | ✅ **PASS** | `status` is a real Column (String(50)). |
| **Debug Endpoints** | ✅ **PASS** | `admin_debug.py` exists (verified in file view). |
| **Smoke Script** | ⚠️ **PARTIAL** | Script exists (`smoke_u2_http.py`) but fails with 404 due to backend path/config issue. |

---

## 6. Attachments / Manuals Support Plan (Minimum Viable)

**1. Database Schema**
Create new table `device_attachments`:
```python
class DeviceAttachment(Base):
    __tablename__ = "device_attachments"
    id = Column(Integer, primary_key=True)
    device_id = Column(Integer, ForeignKey("devices.id"))
    file_name = Column(String(255))
    file_path = Column(String(512)) # Local path
    mime_type = Column(String(100))
    file_size = Column(Integer)
    created_at = Column(DateTime)
```

**2. Storage Approach**
*   **Recommendation**: **Local Volume** (Simplest for "on this machine").
*   **Config**:
    *   Docker Volume: `- ./uploads:/app/uploads`
    *   Python: `UPLOAD_DIR = "/app/uploads"`

**3. Backend Endpoints**
*   `POST /api/inventory/devices/{id}/attachments`: Upload file (multipart/form-data).
*   `GET /api/inventory/devices/{id}/attachments`: List files.
*   `DELETE /api/inventory/attachments/{id}`: Delete file.
*   `GET /api/inventory/attachments/{id}/download`: Stream file.

**4. Frontend Changes**
*   Add "Attachments" tab to Device Detail view.
*   Simple list with "Download" and "Delete" (Admin only) buttons.
*   "Upload" button opening file picker.

---

## 7. Immediate Next Actions (Prioritized)

1.  **🚀 EXECUTE PHASE U3 (CRITICAL)**: Migrate `Booking` model to use `devices` table.
    *   **Why**: Current "Split Personality" means new devices break scheduler.
    *   **How**: Update `scheduler/models.py` to point ForeignKey to `devices.id` and remove `device_table` dependencies.

2.  **Debug Backend 404s**:
    *   Investigate why verify endpoints return 404. Check `main.py` router inclusion and Uvicorn startup logs.

3.  **Implement Attachments**:
    *   Add `DeviceAttachment` model.
    *   Add endpoints/volume.
    *   Update Frontend.

4.  **Finalize Cleanup**:
    *   Once U3 is done, drop `device_table` (backup first!).
