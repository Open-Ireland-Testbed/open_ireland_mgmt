# Database Schema Audit Report
## Phase 8.5 Schema Alignment - Current State Analysis

**Generated:** 2024  
**Database:** `provdb_dev` (via `DATABASE_URL`)  
**Initialization Method:** `Base.metadata.create_all(bind=engine)` in `backend/main.py` startup  
**Migration Framework:** None (no Alembic detected)

---

## 1. Scheduler Tables

### `user_table`
- **Model:** `backend.scheduler.models.User`
- **Key Columns:**
  - `id` (Integer, PK, indexed)
  - `discord_id` (String(20), unique, nullable)
  - `username` (String(50), unique, indexed, NOT NULL)
  - `email` (String(100), unique, nullable)
  - `password` (String(100), NOT NULL)
  - `is_admin` (Boolean, default=False)
- **Relationships:**
  - One-to-many: `bookings` → `booking_table`
  - One-to-many: `topologies` → `topology_table`
  - One-to-many: `booking_favorites` → `booking_favorite`
  - One-to-one: `admin_roles` (via `user_id` unique FK)
  - Referenced by: `admin_audit_log`, `device_ownership`, `topology_review`, `admin_settings`, `admin_invitations`
  - Also referenced by inventory models: `devices` (created_by_id, updated_by_id), `device_history` (changed_by_id), `maintenance_records` (created_by_id)

### `device_table`
- **Model:** `backend.scheduler.models.Device`
- **Key Columns:**
  - `id` (Integer, PK, indexed)
  - `polatis_name` (String(100), nullable) - **Note: Also exists in inventory `devices` table**
  - `deviceType` (String(50), nullable) - **Note: Should be FK to `device_types` but is string**
  - `deviceName` (String(50), nullable)
  - `ip_address` (String(50), nullable)
  - `status` (String(50), nullable)
  - `maintenance_start` (String(100), nullable) - **Note: String, not DateTime**
  - `maintenance_end` (String(100), nullable) - **Note: String, not DateTime**
  - `Out_Port` (Integer, NOT NULL)
  - `In_Port` (Integer, NOT NULL)
- **Relationships:**
  - One-to-many: `bookings` → `booking_table`
  - One-to-many: `device_ownership` → `device_ownership`
  - One-to-many: `device_tags` → `device_tags`
  - One-to-many: `device_health_snapshot` → `device_health_snapshot`
- **Issues:**
  - No FK to inventory `devices` table (potential duplicate concept)
  - `deviceType` is a string instead of FK to `device_types`
  - Maintenance dates stored as strings instead of DateTime
  - No FK to `manufacturers` or `sites` from inventory domain

### `booking_table`
- **Model:** `backend.scheduler.models.Booking`
- **Key Columns:**
  - `booking_id` (Integer, PK, indexed)
  - `device_id` (Integer, FK → `device_table.id`, NOT NULL)
  - `user_id` (Integer, FK → `user_table.id`, NOT NULL)
  - `is_collaborator` (Boolean, NOT NULL, default=False)
  - `grouped_booking_id` (String(64), NOT NULL, indexed, UUID default)
  - `start_time` (DateTime, NOT NULL)
  - `end_time` (DateTime, NOT NULL)
  - `status` (String(50), nullable)
  - `comment` (Text, nullable)
  - `collaborators` (JSON, nullable, default=list)
  - `created_at` (DateTime, NOT NULL, default=utcnow)
- **Relationships:**
  - Many-to-one: `device` → `device_table`
  - Many-to-one: `user` → `user_table`
- **Indexes:**
  - Primary key on `booking_id`
  - Index on `grouped_booking_id`
- **Issues:**
  - FK points to `device_table`, not inventory `devices` table
  - No composite index on (device_id, start_time, end_time) for conflict queries

### `booking_favorite`
- **Model:** `backend.scheduler.models.BookingFavorite`
- **Key Columns:**
  - `id` (Integer, PK, indexed)
  - `user_id` (Integer, FK → `user_table.id`, NOT NULL)
  - `name` (String(200), NOT NULL)
  - `grouped_booking_id` (String(64), NOT NULL, indexed)
  - `device_snapshot` (JSON, NOT NULL) - **Note: Stores device data as JSON**
  - `created_at` (DateTime, NOT NULL, default=utcnow)
  - `updated_at` (DateTime, NOT NULL, default=utcnow, onupdate=utcnow)
- **Relationships:**
  - Many-to-one: `user` → `user_table`
- **Issues:**
  - `device_snapshot` stores denormalized device data instead of referencing devices

### `topology_table`
- **Model:** `backend.scheduler.models.Topology`
- **Key Columns:**
  - `id` (Integer, PK, indexed)
  - `user_id` (Integer, FK → `user_table.id`, NOT NULL)
  - `name` (String(200), NOT NULL)
  - `nodes` (JSON, NOT NULL)
  - `edges` (JSON, NOT NULL)
  - `created_at` (DateTime, NOT NULL, default=utcnow)
  - `updated_at` (DateTime, NOT NULL, default=utcnow, onupdate=utcnow)
- **Relationships:**
  - Many-to-one: `user` → `user_table`
  - One-to-one: `topology_review` (via `topology_id` unique FK)

### `topology_review`
- **Model:** `backend.scheduler.models.TopologyReview`
- **Key Columns:**
  - `id` (Integer, PK, indexed)
  - `topology_id` (Integer, FK → `topology_table.id`, unique, NOT NULL)
  - `status` (String(20), NOT NULL, default="submitted")
  - `conflict_count` (Integer, NOT NULL, default=0)
  - `last_checked_at` (DateTime, nullable)
  - `resolved_at` (DateTime, nullable)
  - `resolved_by` (Integer, FK → `user_table.id`, nullable)
  - `notes` (Text, nullable)
  - `created_at` (DateTime, NOT NULL, default=utcnow)
  - `updated_at` (DateTime, NOT NULL, default=utcnow, onupdate=utcnow)
- **Relationships:**
  - One-to-one: `topology` → `topology_table`
  - Many-to-one: `resolver` → `user_table`

### `admin_roles`
- **Model:** `backend.scheduler.models.AdminRole`
- **Key Columns:**
  - `id` (Integer, PK, indexed)
  - `user_id` (Integer, FK → `user_table.id`, unique, NOT NULL)
  - `role` (String(50), NOT NULL, default="Viewer")
  - `status` (String(20), NOT NULL, default="active")
  - `permissions` (JSON, nullable)
  - `approval_limits` (JSON, nullable)
  - `created_at` (DateTime, NOT NULL, default=utcnow)
  - `updated_at` (DateTime, NOT NULL, default=utcnow, onupdate=utcnow)
- **Relationships:**
  - One-to-one: `user` → `user_table` (unique FK)

### `admin_audit_log`
- **Model:** `backend.scheduler.models.AdminAuditLog`
- **Key Columns:**
  - `id` (Integer, PK, indexed)
  - `actor_id` (Integer, FK → `user_table.id`, nullable)
  - `actor_role` (String(50), nullable)
  - `action` (String(100), NOT NULL)
  - `entity_type` (String(50), NOT NULL)
  - `entity_id` (String(64), nullable) - **Note: String, not Integer**
  - `payload` (JSON, nullable)
  - `outcome` (String(20), NOT NULL, default="success")
  - `message` (Text, nullable)
  - `created_at` (DateTime, NOT NULL, default=utcnow)
- **Relationships:**
  - Many-to-one: `actor` → `user_table`
- **Issues:**
  - `entity_id` is String instead of typed (could be Integer for most entities)

### `admin_settings`
- **Model:** `backend.scheduler.models.AdminSetting`
- **Key Columns:**
  - `id` (Integer, PK, indexed)
  - `key` (String(100), unique, NOT NULL)
  - `value` (JSON, NOT NULL)
  - `updated_at` (DateTime, NOT NULL, default=utcnow, onupdate=utcnow)
  - `updated_by` (Integer, FK → `user_table.id`, nullable)
- **Relationships:**
  - Many-to-one: `updater` → `user_table`

### `admin_invitations`
- **Model:** `backend.scheduler.models.AdminInvitation`
- **Key Columns:**
  - `id` (Integer, PK, indexed)
  - `email` (String(200), NOT NULL)
  - `handle` (String(100), nullable)
  - `role` (String(50), NOT NULL, default="Viewer")
  - `invited_by` (Integer, FK → `user_table.id`, nullable)
  - `token` (String(64), NOT NULL, unique)
  - `expires_at` (DateTime, NOT NULL)
  - `created_at` (DateTime, NOT NULL, default=utcnow)
  - `accepted_at` (DateTime, nullable)
- **Relationships:**
  - Many-to-one: `inviter` → `user_table`

### `device_ownership`
- **Model:** `backend.scheduler.models.DeviceOwnership`
- **Key Columns:**
  - `id` (Integer, PK, indexed)
  - `device_id` (Integer, FK → `device_table.id`, NOT NULL)
  - `owner_id` (Integer, FK → `user_table.id`, NOT NULL)
  - `assigned_by` (Integer, FK → `user_table.id`, nullable)
  - `assigned_at` (DateTime, NOT NULL, default=utcnow)
  - `revoked_at` (DateTime, nullable)
- **Relationships:**
  - Many-to-one: `device` → `device_table`
  - Many-to-one: `owner` → `user_table` (via `owner_id`)
  - Many-to-one: `assigned_by_user` → `user_table` (via `assigned_by`)
- **Issues:**
  - No unique constraint on (device_id, owner_id) - could allow duplicate active ownerships
  - No soft-delete pattern enforced (relies on `revoked_at` check in application logic)

### `device_tags`
- **Model:** `backend.scheduler.models.DeviceTag`
- **Key Columns:**
  - `id` (Integer, PK, indexed)
  - `device_id` (Integer, FK → `device_table.id`, NOT NULL)
  - `tag` (String(50), NOT NULL) - **Note: String, not FK to `tags` table**
  - `created_at` (DateTime, NOT NULL, default=utcnow)
- **Relationships:**
  - Many-to-one: `device` → `device_table`
- **Issues:**
  - `tag` is a string instead of FK to inventory `tags` table
  - No unique constraint on (device_id, tag) - allows duplicate tags per device
  - **Duplicate concept:** Inventory has `tags` + `inventory_device_tags` with proper normalization

### `device_health_snapshot`
- **Model:** `backend.scheduler.models.DeviceHealthSnapshot`
- **Key Columns:**
  - `id` (Integer, PK, indexed)
  - `device_id` (Integer, FK → `device_table.id`, NOT NULL)
  - `status` (String(50), NOT NULL)
  - `heartbeat_at` (DateTime, nullable)
  - `metrics` (JSON, nullable)
  - `updated_at` (DateTime, NOT NULL, default=utcnow)
- **Relationships:**
  - Many-to-one: `device` → `device_table`
- **Issues:**
  - No unique constraint on `device_id` - allows multiple snapshots (intentional for history?)
  - If intended as latest-only, should have unique constraint or soft-delete pattern

---

## 2. Inventory Tables

### `device_types`
- **Model:** `backend.inventory.models.DeviceType`
- **Key Columns:**
  - `id` (Integer, PK, indexed)
  - `name` (String(100), unique, NOT NULL, indexed)
  - `category` (String(50), NOT NULL, indexed)
  - `description` (Text, nullable)
  - `is_schedulable` (Boolean, NOT NULL, default=False)
  - `is_has_ports` (Boolean, NOT NULL, default=False) - **Note: Typo in column name?**
  - `created_at` (DateTime, NOT NULL, default=utcnow)
  - `updated_at` (DateTime, NOT NULL, default=utcnow, onupdate=utcnow)
- **Relationships:**
  - One-to-many: `devices` → `devices`
- **Indexes:**
  - Unique on `name`
  - Index on `name`
  - Index on `category`

### `manufacturers`
- **Model:** `backend.inventory.models.Manufacturer`
- **Key Columns:**
  - `id` (Integer, PK, indexed)
  - `name` (String(100), unique, NOT NULL, indexed)
  - `website` (String(200), nullable)
  - `notes` (Text, nullable)
  - `created_at` (DateTime, NOT NULL, default=utcnow)
  - `updated_at` (DateTime, NOT NULL, default=utcnow, onupdate=utcnow)
- **Relationships:**
  - One-to-many: `devices` → `devices`
- **Indexes:**
  - Unique on `name`
  - Index on `name`

### `sites`
- **Model:** `backend.inventory.models.Site`
- **Key Columns:**
  - `id` (Integer, PK, indexed)
  - `name` (String(100), unique, NOT NULL, indexed)
  - `address` (Text, nullable)
  - `notes` (Text, nullable)
  - `created_at` (DateTime, NOT NULL, default=utcnow)
  - `updated_at` (DateTime, NOT NULL, default=utcnow, onupdate=utcnow)
- **Relationships:**
  - One-to-many: `devices` → `devices`
- **Indexes:**
  - Unique on `name`
  - Index on `name`

### `tags`
- **Model:** `backend.inventory.models.Tag`
- **Key Columns:**
  - `id` (Integer, PK, indexed)
  - `name` (String(50), unique, NOT NULL, indexed)
  - `description` (Text, nullable)
  - `color` (String(20), nullable) - Hex color for UI
  - `created_at` (DateTime, NOT NULL, default=utcnow)
- **Relationships:**
  - One-to-many: `device_tags` → `inventory_device_tags`
- **Indexes:**
  - Unique on `name`
  - Index on `name`

### `devices` (Inventory)
- **Model:** `backend.inventory.models.InventoryDevice`
- **Key Columns:**
  - `id` (Integer, PK, indexed)
  - `oi_id` (String(50), unique, nullable, indexed)
  - `name` (String(200), NOT NULL, indexed)
  - `device_type_id` (Integer, FK → `device_types.id`, NOT NULL, indexed)
  - `manufacturer_id` (Integer, FK → `manufacturers.id`, nullable, indexed)
  - `model` (String(100), nullable)
  - `serial_number` (String(100), unique, nullable, indexed)
  - `status` (String(50), NOT NULL, default="active", indexed)
  - `site_id` (Integer, FK → `sites.id`, nullable, indexed)
  - `rack` (String(50), nullable)
  - `u_position` (Integer, nullable)
  - `hostname` (String(100), nullable)
  - `mgmt_ip` (String(50), nullable)
  - `polatis_name` (String(100), nullable) - **Note: Also exists in scheduler `device_table`**
  - `polatis_port_range` (String(100), nullable)
  - `owner_group` (String(100), nullable)
  - `notes` (Text, nullable)
  - `created_at` (DateTime, NOT NULL, default=utcnow)
  - `updated_at` (DateTime, NOT NULL, default=utcnow, onupdate=utcnow)
  - `created_by_id` (Integer, FK → `user_table.id`, nullable)
  - `updated_by_id` (Integer, FK → `user_table.id`, nullable)
- **Relationships:**
  - Many-to-one: `device_type` → `device_types`
  - Many-to-one: `manufacturer` → `manufacturers`
  - Many-to-one: `site` → `sites`
  - Many-to-many: `device_tags` → `inventory_device_tags` → `tags`
  - One-to-many: `history_entries` → `device_history`
  - Many-to-one: `created_by` → `user_table` (scheduler)
  - Many-to-one: `updated_by` → `user_table` (scheduler)
- **Indexes:**
  - Unique on `oi_id`
  - Unique on `serial_number`
  - Index on `name`
  - Index on `device_type_id`
  - Index on `manufacturer_id`
  - Index on `site_id`
  - Index on `status`
- **Issues:**
  - No FK to scheduler `device_table` - these may represent the same physical devices
  - `polatis_name` suggests overlap with scheduler `device_table.polatis_name`

### `inventory_device_tags`
- **Model:** `backend.inventory.models.InventoryDeviceTag`
- **Key Columns:**
  - `device_id` (Integer, FK → `devices.id`, PK, NOT NULL, indexed, ondelete=CASCADE)
  - `tag_id` (Integer, FK → `tags.id`, PK, NOT NULL, indexed, ondelete=CASCADE)
  - `created_at` (DateTime, NOT NULL, default=utcnow)
- **Relationships:**
  - Many-to-one: `device` → `devices`
  - Many-to-one: `tag` → `tags`
- **Indexes:**
  - Composite primary key on (device_id, tag_id)
  - Index on `device_id`
  - Index on `tag_id`
- **Note:** Properly normalized junction table (unlike scheduler `device_tags`)

### `device_history`
- **Model:** `backend.inventory.models.DeviceHistory`
- **Key Columns:**
  - `id` (Integer, PK, indexed)
  - `device_id` (Integer, FK → `devices.id`, NOT NULL, indexed, ondelete=CASCADE)
  - `action` (String(50), NOT NULL)
  - `field_name` (String(100), nullable)
  - `old_value` (Text, nullable)
  - `new_value` (Text, nullable)
  - `changed_by_id` (Integer, FK → `user_table.id`, nullable)
  - `notes` (Text, nullable)
  - `extra` (JSON, nullable)
  - `created_at` (DateTime, NOT NULL, default=utcnow, indexed)
- **Relationships:**
  - Many-to-one: `device` → `devices`
  - Many-to-one: `changed_by` → `user_table` (scheduler)
- **Indexes:**
  - Index on `device_id`
  - Index on `created_at`

### `maintenance_records`
- **Model:** `backend.inventory.models.MaintenanceRecord`
- **Key Columns:**
  - `id` (Integer, PK, indexed)
  - `item_id` (Integer, NOT NULL, indexed) - **Note: No FK constraint, legacy field**
  - `maintenance_type` (String(50), NOT NULL)
  - `description` (Text, nullable)
  - `performed_by` (String(200), nullable) - **Note: String, not FK to user**
  - `scheduled_date` (DateTime, nullable)
  - `performed_date` (DateTime, nullable)
  - `next_due_date` (DateTime, nullable)
  - `cost` (Float, nullable)
  - `parts_used` (JSON, nullable)
  - `status` (String(50), NOT NULL, default="scheduled")
  - `notes` (Text, nullable)
  - `outcome` (String(50), nullable)
  - `extra` (JSON, nullable)
  - `created_at` (DateTime, NOT NULL, default=utcnow)
  - `updated_at` (DateTime, NOT NULL, default=utcnow, onupdate=utcnow)
  - `created_by_id` (Integer, FK → `user_table.id`, nullable)
- **Relationships:**
  - Many-to-one: `created_by` → `user_table` (scheduler)
- **Issues:**
  - `item_id` has no FK constraint (legacy, may reference old `inventory_items` table)
  - `performed_by` is string instead of FK to user
  - Comment in code says "legacy - kept for historical data"

---

## 3. Cross-Domain Linking (Scheduler ↔ Inventory)

### Current Explicit Foreign Keys

**Inventory → Scheduler:**
- `devices.created_by_id` → `user_table.id`
- `devices.updated_by_id` → `user_table.id`
- `device_history.changed_by_id` → `user_table.id`
- `maintenance_records.created_by_id` → `user_table.id`

**Scheduler → Inventory:**
- **None** - No scheduler tables have FKs to inventory tables

### Implicit Relationships in Code

1. **Device Duplication:**
   - Scheduler: `device_table` (table name) / `backend.scheduler.models.Device`
   - Inventory: `devices` (table name) / `backend.inventory.models.InventoryDevice`
   - Both have `polatis_name` field, suggesting they may represent the same physical devices
   - No FK or unique constraint linking them
   - Code likely matches by `polatis_name` or other heuristics (not verified in this audit)

2. **Device Type:**
   - Scheduler `device_table.deviceType` is a String(50)
   - Inventory has normalized `device_types` table with FK `devices.device_type_id`
   - No relationship enforced

3. **Tags:**
   - Scheduler `device_tags.tag` is a String(50)
   - Inventory has normalized `tags` table with junction table `inventory_device_tags`
   - No relationship enforced

4. **User Sharing:**
   - Both domains reference `user_table` (scheduler domain)
   - This is the only shared entity with proper FK relationships

### Known Duplication

1. **Device Concepts:**
   - `device_table` (scheduler) vs `devices` (inventory)
   - Both store device information
   - Both have `polatis_name` field
   - Scheduler device has `deviceType` (string), inventory has `device_type_id` (FK)
   - Scheduler device has `status` (string), inventory has `status` (string, indexed)
   - No FK linking them

2. **Tag Concepts:**
   - Scheduler `device_tags` stores tags as strings per device
   - Inventory `tags` + `inventory_device_tags` provides normalized tag system
   - No relationship between them

3. **Maintenance:**
   - Scheduler `device_table` has `maintenance_start` and `maintenance_end` (strings)
   - Inventory has `maintenance_records` table (properly structured)
   - No relationship between them

---

## 4. Issues & Constraints

### Critical Modeling Issues

1. **Duplicate Device Tables:**
   - Two separate device concepts (`device_table` and `devices`) with no FK relationship
   - Both have `polatis_name` suggesting they represent the same physical devices
   - Scheduler bookings reference `device_table`, not inventory `devices`
   - **Impact:** Cannot enforce referential integrity, risk of data inconsistency, difficult to query across domains

2. **Device Type Denormalization:**
   - Scheduler `device_table.deviceType` is a string instead of FK to `device_types`
   - **Impact:** Cannot enforce valid device types, no referential integrity, harder to query by type

3. **Tag System Duplication:**
   - Scheduler uses denormalized string tags (`device_tags.tag`)
   - Inventory uses normalized tag system (`tags` + `inventory_device_tags`)
   - **Impact:** Inconsistent tagging, cannot share tags across domains, harder to query

4. **Maintenance Data Fragmentation:**
   - Scheduler stores maintenance dates as strings in `device_table`
   - Inventory has proper `maintenance_records` table
   - **Impact:** Inconsistent maintenance tracking, no audit trail in scheduler

5. **Missing Foreign Keys:**
   - `maintenance_records.item_id` has no FK (legacy field)
   - No FK from scheduler `device_table` to inventory `devices`
   - **Impact:** Cannot enforce referential integrity, orphaned records possible

6. **String IDs in Audit Log:**
   - `admin_audit_log.entity_id` is String instead of typed
   - **Impact:** Cannot enforce FK relationships, harder to query by entity

### Query Performance Issues

1. **Missing Indexes:**
   - `booking_table` lacks composite index on (device_id, start_time, end_time) for conflict detection
   - `device_ownership` lacks unique constraint on (device_id, owner_id) for active ownership queries

2. **JSON Fields:**
   - Multiple JSON fields (`collaborators`, `device_snapshot`, `nodes`, `edges`, `permissions`, etc.)
   - **Impact:** Cannot index JSON content, harder to query/filter, no referential integrity

3. **String Status Fields:**
   - Multiple status fields as strings without check constraints
   - **Impact:** No enum enforcement, potential inconsistent values

### Data Integrity Issues

1. **No Unique Constraints:**
   - `device_tags` allows duplicate (device_id, tag) pairs
   - `device_ownership` allows duplicate active ownerships (no unique constraint)

2. **Soft-Delete Patterns:**
   - `device_ownership.revoked_at` relies on application logic, not DB constraints
   - No standard soft-delete pattern across tables

3. **Maintenance Dates as Strings:**
   - `device_table.maintenance_start` and `maintenance_end` are strings
   - **Impact:** Cannot query by date range, no date validation

### Rule Engine / Utilization Query Challenges

1. **Device Fragmentation:**
   - Bookings reference `device_table`, but device metadata is in `devices`
   - **Impact:** Must join across two device tables or duplicate queries

2. **No Device Type Linkage:**
   - Cannot easily query "all bookings for devices of type X" without string matching

3. **Status Inconsistency:**
   - Device status stored in both `device_table.status` and `devices.status`
   - **Impact:** Must check both, risk of inconsistency

4. **Tag Query Limitations:**
   - Scheduler tags are strings, inventory tags are normalized
   - **Impact:** Cannot easily query "all bookings for devices with tag X" across domains

5. **Site/Manufacturer Not Linked:**
   - Inventory has `sites` and `manufacturers`, but scheduler `device_table` has no FKs
   - **Impact:** Cannot query bookings by site or manufacturer without complex joins

---

## 5. Notes

### Migration Framework

- **No Alembic detected:** The codebase uses `Base.metadata.create_all(bind=engine)` exclusively
- **Initialization:** Tables are created on FastAPI startup in `backend/main.py` (`@app.on_event("startup")`)
- **Both domains imported:** `backend/main.py` imports both `backend.scheduler.models` and `backend.inventory.models` to ensure all tables are registered with `Base.metadata`
- **No versioning:** No migration history or version tracking

### Database Initialization

- **Database:** `provdb_dev` (development clone of `provdb`)
- **Connection:** Via `DATABASE_URL` environment variable
- **Engine:** SQLAlchemy engine created in `backend/core/database.py`
- **Base:** Single `Base = declarative_base()` shared by both scheduler and inventory models

### Special Considerations

1. **User Table Sharing:**
   - Inventory models import and reuse scheduler `User` model
   - This is the only properly shared entity with FK relationships
   - All user references point to `user_table` (scheduler domain)

2. **Legacy Fields:**
   - `maintenance_records.item_id` is documented as legacy (may reference old `inventory_items` table)
   - Code comments indicate some tables are "kept for historical data"

3. **Column Naming Inconsistencies:**
   - Scheduler uses snake_case (`device_id`, `user_id`)
   - Some scheduler fields use camelCase (`deviceType`, `deviceName`, `Out_Port`, `In_Port`)
   - Inventory uses consistent snake_case

4. **Table Naming:**
   - Scheduler uses `_table` suffix (`user_table`, `device_table`, `booking_table`, `topology_table`)
   - Inventory uses plural nouns (`devices`, `device_types`, `manufacturers`, `sites`, `tags`)
   - Admin tables use descriptive names (`admin_roles`, `admin_audit_log`, etc.)

---

## Summary Statistics

- **Total Tables:** 22
  - **Scheduler:** 13 tables
  - **Inventory:** 9 tables
  - **Shared:** 0 tables (user_table is scheduler domain, referenced by inventory)

- **Foreign Key Relationships:**
  - **Within Scheduler:** 11 FKs
  - **Within Inventory:** 6 FKs
  - **Inventory → Scheduler:** 4 FKs (all to `user_table`)
  - **Scheduler → Inventory:** 0 FKs

- **Duplicate Concepts:** 3
  1. Device tables (`device_table` vs `devices`)
  2. Tag systems (scheduler `device_tags` vs inventory `tags` + `inventory_device_tags`)
  3. Maintenance tracking (scheduler strings vs inventory `maintenance_records`)

---

**End of Audit Report**






