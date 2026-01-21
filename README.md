# Open Ireland Lab Scheduler & Inventory Management

A comprehensive lab booking and inventory management system for the Open Ireland Lab (Open Ireland Testbed). This platform enables researchers and administrators to reserve and manage lab equipment, track hardware assets, and maintain a centralized device inventory.

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
  - [Scheduler Features](#scheduler-features)
  - [Inventory Management Features](#inventory-management-features)
  - [Admin Features](#admin-features)
- [Architecture](#architecture)
- [Technology Stack](#technology-stack)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Quick Start with Docker](#quick-start-with-docker)
  - [Services & URLs](#services--urls)
  - [Environment Variables](#environment-variables)
- [Development Workflow](#development-workflow)
  - [Running Services](#running-services)
  - [Code Changes & Hot Reload](#code-changes--hot-reload)
- [Database Schema](#database-schema)
- [API Documentation](#api-documentation)
- [Testing](#testing)
- [Project Structure](#project-structure)
- [Implemented Features](#implemented-features)
- [Pending Features & Roadmap](#pending-features--roadmap)
- [Known Issues & Limitations](#known-issues--limitations)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [Additional Documentation](#additional-documentation)

---

## Overview

The Open Ireland Lab Management System consists of:

| Component | Description |
|-----------|-------------|
| **Scheduler** | Lab booking system for managing device reservations with conflict detection |
| **Inventory Management** | Hardware asset tracking, device lifecycle management, and categorization |
| **Backend API** | FastAPI application serving both scheduler and inventory REST endpoints |
| **Scheduler Frontend** | React-based UI for booking devices and managing reservations |
| **Inventory Frontend** | React-based UI for device inventory and asset management |

---

## Features

### Scheduler Features

#### User Features
- ✅ User registration and login with session management
- ✅ Single and multi-device booking with visual schedule table
- ✅ Booking conflict detection (max 2 users per device at same time)
- ✅ Personal booking record management (view, cancel, delete)
- ✅ Booking favorites - save and reuse booking configurations
- ✅ Collaborator support - add collaborators to bookings
- ✅ Booking extension and rebooking functionality
- ✅ Fuzzy search for device selection (Fuse.js)
- ✅ Dark/Light mode toggle
- ✅ Discord notifications for booking events

#### Admin Features
- ✅ Admin authentication with secret key
- ✅ Device lifecycle management (CRUD operations)
- ✅ Booking approval/rejection dashboard
- ✅ Full booking history with advanced filters
- ✅ Device maintenance window management
- ✅ Conflict resolution dashboard
- ✅ Priority season toggle
- ✅ PDU (Power Distribution Unit) control panel
- ✅ Admin Control Panel with unified dashboard

### Inventory Management Features

- ✅ Device CRUD operations with full history tracking
- ✅ Device type categorization (ROADM, TeraFlex, Transponder, etc.)
- ✅ Manufacturer management
- ✅ Site/location management (physical rack positions)
- ✅ Tag-based device organization
- ✅ Device status tracking (Available, Maintenance, Unavailable)
- ✅ Serial number and asset ID (oi_id) tracking
- ✅ File attachments for device manuals/documentation
- ✅ Device history audit log
- ✅ Pagination and filtering for large device lists

### Admin Features

- ✅ Unified Admin Dashboard with key metrics
- ✅ Pending approvals overview
- ✅ Conflict management interface
- ✅ Device utilization insights (placeholder)
- ✅ Rules engine (placeholder for future automation)
- ✅ User and role management

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Docker Network                          │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │  Scheduler UI   │  │  Inventory UI   │  │  Backend API    │ │
│  │  (React:25002)  │  │  (React:25003)  │  │ (FastAPI:25001) │ │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘ │
│           │                    │                    │          │
│           └────────────────────┼────────────────────┘          │
│                                │                               │
│                      ┌─────────▼─────────┐                     │
│                      │   MySQL Database  │                     │
│                      │   (provdb_dev)    │                     │
│                      │   @ 10.10.10.4    │                     │
│                      └───────────────────┘                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## Technology Stack

### Backend
| Technology | Purpose |
|------------|---------|
| **Python 3.12** | Core programming language |
| **FastAPI** | RESTful API framework |
| **SQLAlchemy 2.0** | ORM for database operations |
| **MySQL/MariaDB** | Production database |
| **Pydantic** | Request/response validation |
| **bcrypt/Passlib** | Password security |
| **APScheduler** | Background task scheduling |
| **Uvicorn** | ASGI server |

### Frontend
| Technology | Purpose |
|------------|---------|
| **React 19** | UI framework |
| **React Router v7** | Client-side routing |
| **Tailwind CSS 3.4** | Utility-first CSS |
| **Zustand** | State management |
| **React Query** | Server state management |
| **Fuse.js** | Fuzzy search |
| **Day.js** | Date/time handling |
| **ReactFlow** | Topology visualization |

### DevOps
| Technology | Purpose |
|------------|---------|
| **Docker** | Containerization |
| **Docker Compose** | Multi-container orchestration |
| **pytest** | Backend testing |
| **Jest** | Frontend testing |
| **React Testing Library** | Component testing |
| **MSW** | API mocking for tests |

---

## Getting Started

### Prerequisites

- **Docker** (version 20.10 or later)
- **Docker Compose** (version 2.0 or later)
- **MySQL/MariaDB** database server accessible from Docker containers
- Network access to the database host (default: `10.10.10.4:3306`)

### Quick Start with Docker

1. **Clone the repository**:
   ```bash
   git clone https://github.com/agastya-raj/open_ireland_mgmt.git
   cd open_ireland_mgmt
   ```

2. **Configure database connection** (if needed):
   
   Edit `docker-compose.yml` to update the `DATABASE_URL`:
   ```yaml
   environment:
     - DATABASE_URL=mysql+pymysql://username:password@host:3306/provdb_dev
   ```
   
   > ⚠️ **Important**: Always use `provdb_dev` (development database), never `provdb` (production).

3. **Build and start all services**:
   ```bash
   docker compose build
   docker compose up
   ```

   Or run in detached mode:
   ```bash
   docker compose up -d
   ```

4. **Access the applications**:
   
   | Application | URL |
   |-------------|-----|
   | Scheduler UI | http://localhost:25002 |
   | Inventory UI | http://localhost:25003 |
   | Backend API Docs | http://localhost:25001/docs |

### Services & URLs

| Service | Container Name | Port | URL |
|---------|---------------|------|-----|
| Backend API | `openireland-backend` | 25001 | http://localhost:25001 |
| Scheduler Frontend | `openireland-scheduler-frontend` | 25002 | http://localhost:25002 |
| Inventory Frontend | `openireland-inventory-frontend` | 25003 | http://localhost:25003 |

### Environment Variables

#### Backend Service
| Variable | Description | Default |
|----------|-------------|---------|
| `BACKEND_PORT` | FastAPI server port | `20001` |
| `FRONTEND_URL` | Scheduler frontend URL | `http://localhost:25002` |
| `DEBUG` | Enable debug mode | `True` |
| `DATABASE_URL` | MySQL connection string | Required |
| `ADMIN_SECRET` | Secret key for admin registration | `""` |
| `DISCORD_WEBHOOK_URL` | Discord notifications webhook | Optional |

#### Frontend Services
| Variable | Description | Default |
|----------|-------------|---------|
| `REACT_APP_API_URL` | Backend API URL | `http://localhost:25001` |
| `REACT_APP_SCHEDULER_API_URL` | Scheduler API URL | Same as above |
| `PORT` | React dev server port | `3000`/`3001` |

---

## Development Workflow

### Running Services

```bash
# Start all services
docker compose up

# Start in background
docker compose up -d

# View logs
docker compose logs -f

# View logs for specific service
docker compose logs -f backend

# Stop all services
docker compose down

# Rebuild after changes
docker compose up --build
```

### Code Changes & Hot Reload

The Docker setup includes volume mounts for live code reloading:

- **Backend**: Python file changes trigger uvicorn auto-reload
- **Frontends**: React dev servers watch for changes and hot-reload

#### Running Individual Services

```bash
# Backend only
docker compose up backend

# Scheduler frontend only (requires backend)
docker compose up scheduler-frontend

# Inventory frontend only (requires backend)
docker compose up inventory-frontend
```

---

## Database Schema

### Core Tables

#### User Table (`user_table`)
| Column | Type | Description |
|--------|------|-------------|
| `id` | INT | Primary Key |
| `username` | VARCHAR(50) | Unique username |
| `email` | VARCHAR(100) | Email address |
| `password` | VARCHAR(100) | Hashed password |
| `is_admin` | BOOLEAN | Admin privileges flag |
| `discord_id` | VARCHAR(20) | Discord user ID for notifications |

#### Device Tables

**Legacy Table (`device_table`)** - Still in use for scheduler bookings
| Column | Type | Description |
|--------|------|-------------|
| `id` | INT | Primary Key |
| `deviceType` | VARCHAR(50) | Type of device |
| `deviceName` | VARCHAR(50) | Device name |
| `ip_address` | VARCHAR(50) | Management IP |
| `status` | VARCHAR(50) | Available/Maintenance/Unavailable |
| `maintenance_start` | VARCHAR(100) | Maintenance window start |
| `maintenance_end` | VARCHAR(100) | Maintenance window end |
| `Out_Port` / `In_Port` | INT | Polatis switch ports |

**Unified Device Table (`devices`)** - Primary inventory table
| Column | Type | Description |
|--------|------|-------------|
| `id` | INT | Primary Key |
| `oi_id` | VARCHAR(50) | Open Ireland asset ID |
| `name` | VARCHAR(200) | Device name |
| `device_type_id` | INT | FK to device_types |
| `manufacturer_id` | INT | FK to manufacturers |
| `model` | VARCHAR(100) | Device model |
| `serial_number` | VARCHAR(100) | Unique serial |
| `status` | VARCHAR(50) | Device status |
| `site_id` | INT | FK to sites |
| `rack` | VARCHAR(50) | Rack location |
| `u_position` | INT | Rack unit position |
| `hostname` | VARCHAR(100) | Network hostname |
| `mgmt_ip` | VARCHAR(50) | Management IP |
| `polatis_name` | VARCHAR(100) | Polatis switch reference |
| `notes` | TEXT | Additional notes |

#### Booking Table (`booking_table`)
| Column | Type | Description |
|--------|------|-------------|
| `booking_id` | INT | Primary Key |
| `device_id` | INT | FK to device_table |
| `user_id` | INT | FK to user_table |
| `grouped_booking_id` | VARCHAR(64) | UUID for multi-device bookings |
| `start_time` | DATETIME | Booking start |
| `end_time` | DATETIME | Booking end |
| `status` | VARCHAR(50) | PENDING/CONFIRMED/CANCELLED/EXPIRED |
| `comment` | TEXT | User comments |
| `collaborators` | JSON | List of collaborator usernames |
| `is_collaborator` | BOOLEAN | Collaborator booking flag |

#### Supporting Tables
- `device_types` - Device type definitions with scheduling flags
- `manufacturers` - Manufacturer information
- `sites` - Physical locations
- `tags` - Device categorization tags
- `inventory_device_tags` - Device-tag associations
- `device_history` - Audit log for device changes
- `booking_favorite` - Saved booking configurations

---

## API Documentation

### Base URLs
- **Scheduler API**: `http://localhost:25001/api/`
- **Inventory API**: `http://localhost:25001/api/inventory/`
- **Admin API**: `http://localhost:25001/admin/`
- **Interactive Docs**: `http://localhost:25001/docs`

### Key Endpoints

#### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/register` | User registration |
| POST | `/login` | User login |
| GET | `/check-session` | Verify session |
| POST | `/logout` | User logout |

#### Bookings
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/bookings` | Create booking(s) |
| GET | `/bookings?user_id=X` | Get user's bookings |
| DELETE | `/bookings/{id}` | Cancel booking |
| PUT | `/bookings/{id}/extend` | Extend booking |
| PUT | `/bookings/{id}/rebook` | Rebook to new time |

#### Devices (Admin)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/devices` | List all devices |
| POST | `/admin/devices` | Create device |
| PUT | `/admin/devices/{id}` | Update device |
| DELETE | `/admin/devices/{id}` | Delete device |

#### Inventory Devices
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/inventory/devices` | List devices (paginated) |
| POST | `/api/inventory/devices` | Create device |
| GET | `/api/inventory/devices/{id}` | Get device details |
| PUT | `/api/inventory/devices/{id}` | Update device |
| DELETE | `/api/inventory/devices/{id}` | Delete device |
| GET | `/api/inventory/device-types` | List device types |
| GET | `/api/inventory/manufacturers` | List manufacturers |
| GET | `/api/inventory/sites` | List sites |
| GET | `/api/inventory/tags` | List tags |

---

## Testing

### Running Tests

#### Docker-Based Testing (Recommended)
```bash
./scheduler/run-tests-docker.sh
```

#### Local Testing

**Backend Tests:**
```bash
cd backend
pip install -r requirements.txt
pytest -v

# With coverage
pytest --cov=. --cov-report=html

# Specific test file
pytest tests/test_auth.py

# Specific test
pytest tests/test_auth.py::test_user_login_success
```

**Frontend Tests:**
```bash
cd scheduler/frontend
npm install
npm test

# CI mode (no watch)
npm run test:ci

# With coverage
npm run test:coverage
```

### Test Coverage

#### Backend Test Files
| File | Coverage Area |
|------|---------------|
| `test_auth.py` | User authentication |
| `test_admin_auth.py` | Admin authentication |
| `test_bookings.py` | Booking CRUD |
| `test_conflicts.py` | Conflict detection |
| `test_devices.py` | Device management |
| `test_approval.py` | Approval workflow |
| `test_pdu.py` | PDU control |
| `test_inventory_api.py` | Inventory endpoints |

#### Safety Features
- Tests use in-memory SQLite database (never production)
- Production database protection built-in
- Each test gets isolated database state

---

## Project Structure

```
open_ireland_mgmt/
├── backend/                    # FastAPI Backend
│   ├── main.py                 # Application entry point
│   ├── requirements.txt        # Python dependencies
│   ├── Dockerfile              # Backend container
│   ├── core/                   # Core utilities
│   │   ├── database.py         # Database connection
│   │   ├── deps.py             # Dependency injection
│   │   ├── hash.py             # Password hashing
│   │   └── discord_utils.py    # Discord notifications
│   ├── scheduler/              # Scheduler module
│   │   ├── models.py           # SQLAlchemy models
│   │   ├── schemas.py          # Pydantic schemas
│   │   ├── routers/            # API routes
│   │   │   ├── admin.py        # Admin endpoints
│   │   │   ├── admin_debug.py  # Debug endpoints
│   │   │   └── control_panel.py# PDU control
│   │   └── services/           # Business logic
│   │       ├── topology_resolver.py
│   │       └── recommendation_engine.py
│   ├── inventory/              # Inventory module
│   │   ├── models.py           # Inventory models
│   │   ├── schemas.py          # Inventory schemas
│   │   └── router.py           # Inventory API
│   └── tests/                  # Backend tests
│       ├── conftest.py         # Test fixtures
│       └── test_*.py           # Test files
├── scheduler/
│   └── frontend/               # Scheduler React App
│       ├── package.json
│       ├── Dockerfile
│       └── src/
│           ├── admin/          # Admin components
│           ├── adminv2/        # New admin UI
│           ├── client/         # User components
│           ├── components/     # Shared components
│           ├── services/       # API services
│           └── store/          # Zustand stores
├── inventory/
│   └── frontend/               # Inventory React App
│       ├── package.json
│       ├── Dockerfile
│       └── src/
│           ├── routes/         # Page components
│           ├── components/     # UI components
│           └── api/            # API client
├── packages/
│   └── ui/                     # Shared UI components
├── docs/                       # Documentation
├── scripts/                    # Utility scripts
├── docker-compose.yml          # Docker orchestration
└── README.md                   # This file
```

---

## Implemented Features

### Phase U2 (Device Unification) - ✅ Complete
- Migrated scheduler to use unified `devices` table
- 100% device synchronization (202 devices)
- 11 queries rewritten with proper JOINs
- Maintenance columns added
- Eager loading for performance
- Full backward API compatibility

### Scheduler Core - ✅ Complete
- User registration/login
- Multi-device booking with conflict detection
- Booking approval workflow
- Maintenance window management
- Discord notifications
- PDU control integration
- Admin dashboard

### Inventory Management - ✅ Complete
- Device CRUD with history
- Device type/manufacturer/site management
- Tag-based organization
- File attachments
- Pagination and filtering

---

## Pending Features & Roadmap

### Phase U3 (FK Migration) - 🔄 Planned
- [ ] Migrate `Booking.device_id` FK from `device_table` to `devices`
- [ ] Remove legacy `Device` model from scheduler
- [ ] Drop `device_table` after validation
- [ ] Update architecture documentation

### Future Enhancements
- [ ] Automated test execution (fix import path issues)
- [ ] Rules engine for booking automation
- [ ] Utilization analytics and reporting
- [ ] Email notifications (in addition to Discord)
- [ ] Calendar integration (iCal export)
- [ ] Mobile-responsive UI improvements
- [ ] API rate limiting
- [ ] Audit log UI

---

## Known Issues & Limitations

### Current Issues

| Issue | Impact | Status | Workaround |
|-------|--------|--------|------------|
| **Dual Device Tables** | Data must stay synchronized | Phase U3 planned | IDs match 100% |
| **Test Suite Import Errors** | Cannot run automated tests in container | Investigation needed | Manual testing |
| **DeviceType Validation** | Device creation fails if type doesn't exist | By design | Pre-populate DeviceTypes |
| **Legacy FK References** | `Booking` still references `device_table` | Phase U3 planned | None needed (IDs match) |

### Database Considerations

⚠️ **Important Database Notes:**
- Always use `provdb_dev` (development) database
- Never point to `provdb` (production) in development
- Database is external (not containerized)
- Tables auto-create on startup

---

## Troubleshooting

### Common Issues

#### Services Won't Start
```bash
# Check if ports are in use
lsof -i :25001
lsof -i :25002
lsof -i :25003

# Check Docker status
docker ps
docker compose version

# View service logs
docker compose logs backend
docker compose logs scheduler-frontend
docker compose logs inventory-frontend
```

#### Frontend Can't Reach Backend
1. Verify backend is running: `docker compose ps`
2. Check backend logs: `docker compose logs backend`
3. Verify `REACT_APP_API_URL` is correct
4. Check CORS settings in `backend/main.py`

#### Database Connection Errors
1. Verify `DATABASE_URL` points to `provdb_dev`
2. Check database server is accessible from Docker
3. Verify credentials are correct
4. Check network connectivity to database host

#### Code Changes Not Reflecting
1. Verify volume mounts in `docker-compose.yml`
2. Backend: uvicorn `--reload` should auto-restart
3. Frontend: React hot reload should work
4. Try: `docker compose restart <service-name>`

#### 404 Errors on API
1. Check if routes are mounted correctly in `main.py`
2. Verify router imports aren't failing
3. Check backend startup logs for errors
4. Access `/docs` to see available endpoints

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make changes and test locally
4. Run tests: `./scheduler/run-tests-docker.sh`
5. Commit: `git commit -am 'Add my feature'`
6. Push: `git push origin feature/my-feature`
7. Create a Pull Request

### Code Style
- Backend: Follow PEP 8 guidelines
- Frontend: ESLint + Prettier
- Use meaningful commit messages
- Add tests for new features

---

## Additional Documentation

| Document | Location | Description |
|----------|----------|-------------|
| Scheduler Guide | [scheduler/README.md](scheduler/README.md) | Detailed scheduler documentation |
| Testing Guide | [scheduler/TESTING.md](scheduler/TESTING.md) | Complete testing documentation |
| Admin UI Guide | [docs/admin_ui.md](docs/admin_ui.md) | Admin interface documentation |
| U2 Phase Report | [docs/U2_FINAL_REPORT.md](docs/U2_FINAL_REPORT.md) | Device unification details |
| Current State | [docs/CURRENT_STATE_REPORT_DECEMBER_15.md](docs/CURRENT_STATE_REPORT_DECEMBER_15.md) | Infrastructure status |
| Backend Tests | [backend/tests/README.md](backend/tests/README.md) | Test documentation |

---

## License

See [LICENSE](scheduler/LICENSE) file for details.

---

## Contact

For issues and questions, please open a GitHub issue or contact the Open Ireland Lab team.

---

*Last updated: January 2026*