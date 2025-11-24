# Scheduler Database Schema - Complete Documentation

## Database Configuration
- **Database Type**: SQLite (development) / MySQL (production)
- **Database File**: `scheduler/backend/scheduler.db` (SQLite)
- **Connection String**: `sqlite:///./scheduler.db` (from `DATABASE_URL` environment variable)

## Schema Overview

The scheduler database consists of **13 tables** organized into the following categories:
1. **User Management**: `user_table`
2. **Device Management**: `device_table`, `device_ownership`, `device_tags`, `device_health_snapshot`
3. **Booking Management**: `booking_table`, `booking_favorite`
4. **Topology Management**: `topology_table`, `topology_review`
5. **Admin Management**: `admin_roles`, `admin_audit_log`, `admin_settings`, `admin_invitations`

---

## Table Details

### 1. `user_table` - User Accounts

**Purpose**: Stores user account information and authentication data.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PRIMARY KEY, NOT NULL, INDEXED | Unique user identifier |
| `discord_id` | VARCHAR(20) | UNIQUE, NULLABLE | Discord integration ID |
| `username` | VARCHAR(50) | UNIQUE, NOT NULL, INDEXED | Username for login |
| `email` | VARCHAR(100) | UNIQUE, NULLABLE | User email address |
| `password` | VARCHAR(100) | NOT NULL | Password hash (bcrypt or SHA256) |
| `is_admin` | BOOLEAN | DEFAULT FALSE | Admin flag |

**Relationships**:
- One-to-Many: `bookings` → `booking_table.user_id`
- One-to-Many: `topologies` → `topology_table.user_id`
- One-to-Many: `booking_favorites` → `booking_favorite.user_id`
- One-to-One: `admin_roles` → `admin_roles.user_id` (unique)

---

### 2. `device_table` - Network Devices

**Purpose**: Stores information about network devices (switches, routers, optical equipment).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PRIMARY KEY, NOT NULL, INDEXED | Unique device identifier |
| `polatis_name` | VARCHAR(100) | NULLABLE | Polatis switch name |
| `deviceType` | VARCHAR(50) | NULLABLE | Device type/category |
| `deviceName` | VARCHAR(50) | NULLABLE | Device name |
| `ip_address` | VARCHAR(50) | NULLABLE | Device IP address |
| `status` | VARCHAR(50) | NULLABLE | Device status |
| `maintenance_start` | VARCHAR(100) | NULLABLE | Maintenance start time (string) |
| `maintenance_end` | VARCHAR(100) | NULLABLE | Maintenance end time (string) |
| `Out_Port` | INTEGER | NOT NULL | Output port number |
| `In_Port` | INTEGER | NOT NULL | Input port number |

**Relationships**:
- One-to-Many: `bookings` → `booking_table.device_id`
- One-to-Many: `device_ownership` → `device_ownership.device_id`
- One-to-Many: `device_tags` → `device_tags.device_id`
- One-to-Many: `device_health_snapshot` → `device_health_snapshot.device_id`

---

### 3. `booking_table` - Device Bookings

**Purpose**: Stores time-based reservations/bookings for devices.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `booking_id` | INTEGER | PRIMARY KEY, NOT NULL, INDEXED | Unique booking identifier |
| `device_id` | INTEGER | FOREIGN KEY → `device_table.id`, NOT NULL | Device being booked |
| `user_id` | INTEGER | FOREIGN KEY → `user_table.id`, NOT NULL | User who created the booking |
| `is_collaborator` | BOOLEAN | NOT NULL, DEFAULT FALSE | Whether this is a collaborator entry |
| `grouped_booking_id` | VARCHAR(64) | NOT NULL, INDEXED, DEFAULT UUID | Groups related bookings together |
| `start_time` | DATETIME | NOT NULL | Booking start time |
| `end_time` | DATETIME | NOT NULL | Booking end time |
| `status` | VARCHAR(50) | NULLABLE | Booking status |
| `comment` | TEXT | NULLABLE | Booking comments/notes |
| `collaborators` | JSON | NULLABLE, DEFAULT [] | List of collaborator user IDs |
| `created_at` | DATETIME | NOT NULL, DEFAULT UTC_NOW | Booking creation timestamp |

**Relationships**:
- Many-to-One: `device` → `device_table` (via `device_id`)
- Many-to-One: `user` → `user_table` (via `user_id`)

**Indexes**:
- `grouped_booking_id` (for grouping related bookings)

---

### 4. `booking_favorite` - Saved Booking Templates

**Purpose**: Stores user's favorite/saved booking configurations for quick reuse.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PRIMARY KEY, NOT NULL, INDEXED | Unique favorite identifier |
| `user_id` | INTEGER | FOREIGN KEY → `user_table.id`, NOT NULL | Owner of the favorite |
| `name` | VARCHAR(200) | NOT NULL | Favorite name |
| `grouped_booking_id` | VARCHAR(64) | NOT NULL, INDEXED | Reference to original booking group |
| `device_snapshot` | JSON | NOT NULL | Snapshot of device configuration at time of save |
| `created_at` | DATETIME | NOT NULL, DEFAULT UTC_NOW | Creation timestamp |
| `updated_at` | DATETIME | NOT NULL, DEFAULT UTC_NOW, ON UPDATE UTC_NOW | Last update timestamp |

**Relationships**:
- Many-to-One: `user` → `user_table` (via `user_id`)

---

### 5. `topology_table` - Network Topologies

**Purpose**: Stores user-created network topology diagrams.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PRIMARY KEY, NOT NULL, INDEXED | Unique topology identifier |
| `user_id` | INTEGER | FOREIGN KEY → `user_table.id`, NOT NULL | Owner of the topology |
| `name` | VARCHAR(200) | NOT NULL | Topology name |
| `nodes` | JSON | NOT NULL | Topology nodes (devices, connections) |
| `edges` | JSON | NOT NULL | Topology edges (connections between nodes) |
| `created_at` | DATETIME | NOT NULL, DEFAULT UTC_NOW | Creation timestamp |
| `updated_at` | DATETIME | NOT NULL, DEFAULT UTC_NOW, ON UPDATE UTC_NOW | Last update timestamp |

**Relationships**:
- Many-to-One: `user` → `user_table` (via `user_id`)
- One-to-One: `topology_review` → `topology_review.topology_id` (unique)

---

### 6. `admin_roles` - Admin Role Assignments

**Purpose**: Manages admin role assignments and permissions for users.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PRIMARY KEY, NOT NULL, INDEXED | Unique role assignment identifier |
| `user_id` | INTEGER | FOREIGN KEY → `user_table.id`, UNIQUE, NOT NULL | User with admin role |
| `role` | VARCHAR(50) | NOT NULL, DEFAULT 'Viewer' | Role name (Viewer, Approver, Admin, etc.) |
| `status` | VARCHAR(20) | NOT NULL, DEFAULT 'active' | Role status (active, inactive, suspended) |
| `permissions` | JSON | NULLABLE | Custom permissions object |
| `approval_limits` | JSON | NULLABLE | Limits for approval actions |
| `created_at` | DATETIME | NOT NULL, DEFAULT UTC_NOW | Assignment creation timestamp |
| `updated_at` | DATETIME | NOT NULL, DEFAULT UTC_NOW, ON UPDATE UTC_NOW | Last update timestamp |

**Relationships**:
- One-to-One: `user` → `user_table` (via `user_id`, unique constraint)

---

### 7. `admin_audit_log` - Admin Action Audit Trail

**Purpose**: Logs all admin actions for audit and compliance.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PRIMARY KEY, NOT NULL, INDEXED | Unique log entry identifier |
| `actor_id` | INTEGER | FOREIGN KEY → `user_table.id`, NULLABLE | User who performed the action |
| `actor_role` | VARCHAR(50) | NULLABLE | Role of the actor at time of action |
| `action` | VARCHAR(100) | NOT NULL | Action performed (e.g., 'approve_booking', 'delete_user') |
| `entity_type` | VARCHAR(50) | NOT NULL | Type of entity affected (e.g., 'booking', 'user') |
| `entity_id` | VARCHAR(64) | NULLABLE | ID of the affected entity |
| `payload` | JSON | NULLABLE | Additional action data |
| `outcome` | VARCHAR(20) | NOT NULL, DEFAULT 'success' | Action outcome (success, failure, error) |
| `message` | TEXT | NULLABLE | Human-readable log message |
| `created_at` | DATETIME | NOT NULL, DEFAULT UTC_NOW | Action timestamp |

**Relationships**:
- Many-to-One: `actor` → `user_table` (via `actor_id`)

---

### 8. `device_ownership` - Device Ownership Assignments

**Purpose**: Tracks which users own/are assigned to specific devices.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PRIMARY KEY, NOT NULL, INDEXED | Unique ownership record identifier |
| `device_id` | INTEGER | FOREIGN KEY → `device_table.id`, NOT NULL | Device being assigned |
| `owner_id` | INTEGER | FOREIGN KEY → `user_table.id`, NOT NULL | User who owns the device |
| `assigned_by` | INTEGER | FOREIGN KEY → `user_table.id`, NULLABLE | User who made the assignment |
| `assigned_at` | DATETIME | NOT NULL, DEFAULT UTC_NOW | Assignment timestamp |
| `revoked_at` | DATETIME | NULLABLE | Revocation timestamp (NULL = active) |

**Relationships**:
- Many-to-One: `device` → `device_table` (via `device_id`)
- Many-to-One: `owner` → `user_table` (via `owner_id`)
- Many-to-One: `assigned_by_user` → `user_table` (via `assigned_by`)

---

### 9. `device_tags` - Device Tags/Labels

**Purpose**: Stores tags/labels associated with devices for categorization.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PRIMARY KEY, NOT NULL, INDEXED | Unique tag record identifier |
| `device_id` | INTEGER | FOREIGN KEY → `device_table.id`, NOT NULL | Device being tagged |
| `tag` | VARCHAR(50) | NOT NULL | Tag name/label |
| `created_at` | DATETIME | NOT NULL, DEFAULT UTC_NOW | Tag creation timestamp |

**Relationships**:
- Many-to-One: `device` → `device_table` (via `device_id`)

**Note**: This is a simple tag system. Multiple tags can be associated with one device.

---

### 10. `device_health_snapshot` - Device Health Monitoring

**Purpose**: Stores periodic health check snapshots for devices.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PRIMARY KEY, NOT NULL, INDEXED | Unique snapshot identifier |
| `device_id` | INTEGER | FOREIGN KEY → `device_table.id`, NOT NULL | Device being monitored |
| `status` | VARCHAR(50) | NOT NULL | Device health status |
| `heartbeat_at` | DATETIME | NULLABLE | Last heartbeat timestamp |
| `metrics` | JSON | NULLABLE | Health metrics data |
| `updated_at` | DATETIME | NOT NULL, DEFAULT UTC_NOW | Last update timestamp |

**Relationships**:
- Many-to-One: `device` → `device_table` (via `device_id`)

---

### 11. `topology_review` - Topology Review Status

**Purpose**: Tracks review/approval status for topology submissions.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PRIMARY KEY, NOT NULL, INDEXED | Unique review record identifier |
| `topology_id` | INTEGER | FOREIGN KEY → `topology_table.id`, UNIQUE, NOT NULL | Topology being reviewed |
| `status` | VARCHAR(20) | NOT NULL, DEFAULT 'submitted' | Review status (submitted, approved, rejected) |
| `conflict_count` | INTEGER | NOT NULL, DEFAULT 0 | Number of conflicts detected |
| `last_checked_at` | DATETIME | NULLABLE | Last conflict check timestamp |
| `resolved_at` | DATETIME | NULLABLE | Resolution timestamp |
| `resolved_by` | INTEGER | FOREIGN KEY → `user_table.id`, NULLABLE | User who resolved conflicts |
| `notes` | TEXT | NULLABLE | Review notes/comments |
| `created_at` | DATETIME | NOT NULL, DEFAULT UTC_NOW | Review creation timestamp |
| `updated_at` | DATETIME | NOT NULL, DEFAULT UTC_NOW, ON UPDATE UTC_NOW | Last update timestamp |

**Relationships**:
- One-to-One: `topology` → `topology_table` (via `topology_id`, unique constraint)
- Many-to-One: `resolver` → `user_table` (via `resolved_by`)

---

### 12. `admin_settings` - System Settings

**Purpose**: Stores system-wide configuration settings.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PRIMARY KEY, NOT NULL, INDEXED | Unique setting identifier |
| `key` | VARCHAR(100) | UNIQUE, NOT NULL | Setting key/name |
| `value` | JSON | NOT NULL | Setting value (can be any JSON structure) |
| `updated_at` | DATETIME | NOT NULL, DEFAULT UTC_NOW, ON UPDATE UTC_NOW | Last update timestamp |
| `updated_by` | INTEGER | FOREIGN KEY → `user_table.id`, NULLABLE | User who last updated the setting |

**Relationships**:
- Many-to-One: `updater` → `user_table` (via `updated_by`)

---

### 13. `admin_invitations` - Admin Invitation System

**Purpose**: Manages invitations for new admin users.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PRIMARY KEY, NOT NULL, INDEXED | Unique invitation identifier |
| `email` | VARCHAR(200) | NOT NULL | Invitee email address |
| `handle` | VARCHAR(100) | NULLABLE | Invitee handle/username |
| `role` | VARCHAR(50) | NOT NULL, DEFAULT 'Viewer' | Role to be assigned |
| `invited_by` | INTEGER | FOREIGN KEY → `user_table.id`, NULLABLE | User who sent the invitation |
| `token` | VARCHAR(64) | NOT NULL, UNIQUE | Invitation token for verification |
| `expires_at` | DATETIME | NOT NULL | Invitation expiration timestamp |
| `created_at` | DATETIME | NOT NULL, DEFAULT UTC_NOW | Invitation creation timestamp |
| `accepted_at` | DATETIME | NULLABLE | Acceptance timestamp (NULL = pending) |

**Relationships**:
- Many-to-One: `inviter` → `user_table` (via `invited_by`)

---

## Entity Relationship Summary

### Core Relationships

1. **User** → **Bookings**: One user can have many bookings
2. **User** → **Topologies**: One user can have many topologies
3. **User** → **Booking Favorites**: One user can have many saved favorites
4. **User** → **Admin Role**: One user can have one admin role (1:1)
5. **Device** → **Bookings**: One device can have many bookings
6. **Device** → **Ownership**: One device can have many ownership records (history)
7. **Device** → **Tags**: One device can have many tags
8. **Device** → **Health Snapshots**: One device can have many health snapshots
9. **Topology** → **Review**: One topology has one review record (1:1)

### Key Design Patterns

- **Grouped Bookings**: Multiple booking records can share the same `grouped_booking_id` to represent multi-device bookings
- **Collaborators**: Stored as JSON array in `booking_table.collaborators`
- **Soft Deletes**: Some tables use `revoked_at` or `status` fields instead of hard deletes
- **Audit Trail**: `admin_audit_log` tracks all admin actions
- **JSON Storage**: Flexible data stored as JSON (topology nodes/edges, permissions, metrics, etc.)

---

## Indexes

The following indexes are automatically created:

- **Primary Keys**: All tables have indexed primary keys
- **Foreign Keys**: Foreign key columns are typically indexed for join performance
- **Unique Constraints**: 
  - `user_table.username` (unique, indexed)
  - `user_table.email` (unique)
  - `user_table.discord_id` (unique)
  - `admin_roles.user_id` (unique)
  - `admin_settings.key` (unique)
  - `admin_invitations.token` (unique)
  - `topology_review.topology_id` (unique)
- **Business Logic Indexes**:
  - `booking_table.grouped_booking_id` (for grouping queries)
  - `booking_favorite.grouped_booking_id` (for lookup)

---

## Notes

1. **Password Storage**: Passwords are stored as hashes:
   - Old format: `bcrypt(SHA256(plain_password))`
   - New format: `bcrypt(SHA256_hash)` (client sends SHA256, backend bcrypts it)

2. **DateTime Fields**: All datetime fields use UTC by default via `datetime.utcnow()`

3. **JSON Fields**: Used for flexible schema:
   - `booking_table.collaborators`: List of user IDs
   - `booking_favorite.device_snapshot`: Device state snapshot
   - `topology_table.nodes` and `edges`: Graph data
   - `admin_roles.permissions` and `approval_limits`: Role configuration
   - `admin_audit_log.payload`: Action-specific data
   - `device_health_snapshot.metrics`: Health metrics
   - `admin_settings.value`: Any configuration value

4. **UUID Usage**: `grouped_booking_id` uses UUID strings to group related bookings

5. **Cascade Deletes**: `booking_favorite` has cascade delete from `user_table` (when user is deleted, favorites are deleted)

---

## Database File Location

- **Development (SQLite)**: `scheduler/backend/scheduler.db`
- **Container Path**: `/app/scheduler.db`
- **Connection String**: `sqlite:///./scheduler.db` (relative to working directory)

---

## Migration Notes

- This schema does **NOT** include the old inventory tables (`inventory_items`, `inventory_history`, `inventory_reservations`, `inventory_tags`)
- New inventory tables are in a separate module (`inventory_mgmt/models.py`) and use the same `Base` but different table names:
  - `devices`, `device_types`, `manufacturers`, `sites`, `tags`, `device_tags`, `device_history`

