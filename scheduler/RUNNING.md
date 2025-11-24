# Running the Lab Scheduler Application

## Prerequisites

1. **Docker and Docker Compose** - Make sure Docker and Docker Compose are installed
2. **MySQL Database** - You need a MySQL database accessible from the Docker container
3. **Environment Variables** - Create a `.env` file in the project root (see below)

## Quick Start

### 1. Create Environment File

Create a `.env` file in the project root directory:

```bash
# Required: Database connection
DATABASE_URL=mysql+pymysql://username:password@host:port/database_name

# Optional: Admin registration secret key
ADMIN_SECRET=your-secret-admin-key-here

# Optional: Discord webhook URLs (leave empty if not using Discord notifications)
BOOKING_WEBHOOK=https://discord.com/api/webhooks/...
ADMIN_WEBHOOK=https://discord.com/api/webhooks/...
```

**Example:**
```bash
DATABASE_URL=mysql+pymysql://root:mypassword@localhost:3306/lab_scheduler
ADMIN_SECRET=super-secret-admin-key-123
```

### 2. Build and Start the Application

```bash
# Build and start both frontend and backend
docker-compose up -d --build

# Or start without building (if already built)
docker-compose up -d
```

### 3. View Logs

```bash
# View all logs
docker-compose logs -f

# View only backend logs
docker-compose logs -f backend

# View only frontend logs
docker-compose logs -f frontend
```

### 4. Access the Application

- **Frontend (User Interface)**: http://100.111.63.95:20000/client
- **Backend API**: http://100.111.63.95:20001
- **API Documentation**: http://100.111.63.95:20001/docs (Swagger UI)

### 5. Stop the Application

```bash
# Stop containers
docker-compose down

# Stop and remove volumes (cleanup)
docker-compose down -v
```

## Port Configuration

The ports are configured in `docker-compose.yml`:

- **Frontend**: Port 20000
- **Backend**: Port 20001

To change ports, update the following in `docker-compose.yml`:
- `FRONTEND_PORT` and `PORT` for frontend service
- `BACKEND_PORT` for backend service
- `REACT_APP_API_URL` and `FRONTEND_URL` to match your new ports

## Troubleshooting

### Database Connection Issues

If you see database connection errors:

1. Verify your MySQL database is running and accessible
2. Check that `DATABASE_URL` in `.env` is correct
3. Ensure the database user has proper permissions
4. Check if the database exists (create it if needed):
   ```sql
   CREATE DATABASE lab_scheduler;
   ```

### Port Already in Use

If you get "port already in use" errors:

```bash
# Check what's using the port
sudo lsof -i :20000
sudo lsof -i :20001

# Or stop existing containers
docker-compose down
```

### View Container Status

```bash
# Check if containers are running
docker-compose ps

# Check container logs for errors
docker-compose logs backend
docker-compose logs frontend
```

### Rebuild After Code Changes

```bash
# Rebuild and restart
docker-compose up -d --build

# Or rebuild specific service
docker-compose build backend
docker-compose up -d backend
```

## Development Mode

The containers are configured for development with:
- Hot reload enabled for both frontend and backend
- Code mounted as volumes (changes reflect immediately)
- Debug mode enabled on backend

## First-Time Setup

1. **Create Admin Account**:
   - Access the admin interface at: http://100.111.63.95:20000/admin
   - Use the `ADMIN_SECRET` from your `.env` file to register the first admin account
   - The legacy tooling is still available at http://100.111.63.95:20000/admin/legacy during the rollout

2. **Enable the new admin console**:
   - After pulling the latest backend, run it once so `Base.metadata.create_all` can create the new admin tables (`admin_roles`, `admin_audit_log`, `device_tags`, etc.)
   - Existing admins are upgraded to **Super Admin** automatically; non-admin users are mapped to the **Viewer** role with read-only permissions

3. **Add Devices**:
   - Log in as admin
   - Navigate to the **Devices** tab in the new console (or `/admin/legacy` if you need the old workflows temporarily)
   - Add your lab equipment/devices and assign owners or tags as needed

4. **Create User Accounts**:
   - Users can register at: http://100.111.63.95:20000/client
   - No special secret required for regular user registration

## Production Deployment

For production, consider:
- Setting secure `ADMIN_SECRET`
- Using environment-specific database credentials
- Configuring proper CORS origins
- Setting up SSL/TLS
- Using a reverse proxy (nginx)
- Proper backup strategies for the database

## Testing

Run the complete backend test suite (which now includes coverage for the admin v2 API):

```bash
cd backend
source venv/bin/activate
pytest
```

To target only the admin console endpoints:

```bash
pytest backend/tests/test_admin_v2.py
```

