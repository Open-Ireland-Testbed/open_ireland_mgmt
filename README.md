# Open Ireland Lab Scheduler & Inventory Management

A comprehensive lab booking and inventory management system for the Open Ireland Lab.

## Overview

This system consists of:
- **Scheduler**: Lab booking system for managing device reservations
- **Inventory Management**: Hardware asset tracking and management
- **Backend API**: FastAPI application serving both scheduler and inventory endpoints
- **Frontend Applications**: React-based UIs for scheduler and inventory management

## Running with Docker

The easiest way to run the entire system is using Docker Compose.

### Prerequisites

- Docker (version 20.10 or later)
- Docker Compose (version 2.0 or later, or `docker compose` v2)

### Quick Start

1. **Clone the repository** (if you haven't already):
   ```bash
   git clone <repository-url>
   cd tcdona3_scheduler
   ```

2. **Set up environment variables** (if needed):
   ```bash
   # The backend may need DATABASE_URL and other configuration
   # You can either:
   # 1. Create a .env file in the repo root with your variables
   # 2. Set environment variables directly in docker-compose.yml
   # 3. Uncomment the env_file section in docker-compose.yml if you create .env
   ```

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
   - **Scheduler UI**: http://localhost:25002
   - **Inventory UI**: http://localhost:25003
   - **Backend API**: http://localhost:25001
     - Scheduler endpoints: `/api/...`
     - Inventory endpoints: `/api/inventory/...`
     - API docs: http://localhost:25001/docs

### Services & URLs

| Service | Container Name | Port | URL |
|---------|---------------|------|-----|
| Backend API | `openireland-backend` | 25001 | http://localhost:25001 |
| Scheduler Frontend | `openireland-scheduler-frontend` | 25002 | http://localhost:25002 |
| Inventory Frontend | `openireland-inventory-frontend` | 25003 | http://localhost:25003 |

### Environment Variables

#### Backend Service
- `BACKEND_PORT`: Port for the FastAPI server (default: 20001)
- `FRONTEND_URL`: URL of the scheduler frontend (default: http://localhost:25002)
- `DEBUG`: Enable debug mode (default: True)
- `DATABASE_URL`: Database connection string (configured in `docker-compose.yml` to use `provdb_dev`)
  - **Must use `provdb_dev` database, never `provdb`**
  - Example: `mysql+pymysql://openireland:ChangeMe_Dev123%21@172.17.0.1:3306/provdb_dev`

#### Scheduler Frontend
- `REACT_APP_API_URL`: Backend API URL (set to `http://localhost:25001` in Docker)
- `PORT`: React dev server port (default: 3000)

#### Inventory Frontend
- `REACT_APP_API_URL`: Inventory API URL (set to `http://localhost:25001` in Docker)
- `REACT_APP_SCHEDULER_API_URL`: Scheduler API URL (optional, for future cross-app features)
- `PORT`: React dev server port (default: 3001)

### Development Workflow

#### Running All Services
```bash
# Start all services
docker compose up

# Start in background
docker compose up -d

# View logs
docker compose logs -f

# Stop all services
docker compose down
```

#### Rebuilding After Code Changes

**Option 1: Automatic Reload (Recommended for Development)**
- The Docker setup includes volume mounts for live code reloading
- Backend: Changes to Python files trigger uvicorn auto-reload
- Frontends: React dev servers watch for changes and hot-reload

**Option 2: Manual Rebuild**
```bash
# Rebuild a specific service
docker compose build backend
docker compose build scheduler-frontend
docker compose build inventory-frontend

# Rebuild and restart
docker compose up --build
```

#### Running Individual Services

You can also run services individually:

```bash
# Backend only
docker compose up backend

# Frontend only (requires backend to be running)
docker compose up scheduler-frontend
docker compose up inventory-frontend
```

### Quick Sanity Test

After starting all services, verify everything is working:

  1. **Scheduler UI**:
     - Open http://localhost:25002
     - Should load the scheduler interface

  2. **Inventory UI**:
     - Open http://localhost:25003
     - Should load the inventory management interface
     - Navigate to Devices list
   - Check browser network tab: should see calls to `http://localhost:25001/api/inventory/devices`

3. **Backend API**:
   - Open http://localhost:25001/docs
   - Should see FastAPI interactive API documentation
   - Test a simple endpoint (e.g., GET `/api/inventory/device-types`)

### Notes

- **Development Mode**: This Docker setup uses development servers (CRA dev server for frontends, uvicorn with `--reload` for backend). This is suitable for development but not production-hardened.
- **Database**: 
  - **IMPORTANT**: The Docker stack uses `provdb_dev` (a development clone of the original `provdb` database)
  - `provdb` is the original production database and **should NOT be pointed to in Docker**
  - `provdb_dev` is the development clone used by the Dockerized backend
  - Ensure your MySQL server has `provdb_dev` created and accessible
  - The `DATABASE_URL` in `docker-compose.yml` is configured to connect to `provdb_dev`
  - **All DATABASE_URL examples should use `provdb_dev`, never `provdb`**
- **Port Conflicts**: If ports 25001, 25002, or 25003 are already in use, modify the port mappings in `docker-compose.yml`.
- **Network**: Services communicate via Docker's internal network (`openireland-network`). The React apps are served to your browser on http://localhost:25002 and http://localhost:25003, and the browser calls the backend at http://localhost:25001.

### Troubleshooting

**Services won't start:**
- Check if ports are already in use: `lsof -i :25001`, `lsof -i :25002`, `lsof -i :25003`
- Verify Docker and Docker Compose are running: `docker ps`, `docker compose version`

**Frontend can't reach backend:**
- Verify backend is running: `docker compose ps`
- Check backend logs: `docker compose logs backend`
- Ensure `REACT_APP_API_URL` is set correctly in docker-compose.yml

**Database connection errors:**
- Verify `DATABASE_URL` in `docker-compose.yml` points to `provdb_dev` (never `provdb`)
- Ensure `provdb_dev` database exists on your MySQL server
- Ensure database is accessible from the Docker container (check `host.docker.internal` connectivity)
- Check backend logs for connection errors

**Code changes not reflecting:**
- Verify volume mounts are correct in docker-compose.yml
- Check that files are being watched (backend uses `--reload`, frontends use CRA hot reload)
- Try restarting the service: `docker compose restart <service-name>`

## Project Structure

```
tcdona3_scheduler/
├── scheduler/
│   ├── backend/          # FastAPI backend (scheduler + inventory API)
│   └── frontend/          # Scheduler React frontend
├── inventory/
│   └── frontend/          # Inventory React frontend
├── inventory_mgmt/        # Inventory management Python module
├── packages/
│   └── ui/                # Shared UI components
└── docker-compose.yml     # Docker Compose configuration
```

## Additional Documentation

- [Scheduler Documentation](scheduler/README.md)
- [Inventory Management Documentation](inventory_mgmt/README.md)
- [Testing Guide](scheduler/TESTING.md)

