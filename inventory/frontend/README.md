# Inventory Management Frontend

Frontend application for Open Ireland Lab Inventory Management system.

## Stack

- React 19
- React Router v7
- Tailwind CSS 3.4
- Shared UI Package (@tcdona/ui)

## Development

```bash
npm install
npm start
```

The app will run on `http://localhost:3000` (or next available port).

## Environment Variables

- `REACT_APP_API_URL` - Inventory API base URL (default: `http://localhost:20002`)
- `REACT_APP_SCHEDULER_API_URL` - Scheduler API base URL (optional, for future integration)

## Routes

- `/devices` - Devices list
- `/devices/:deviceId` - Device detail
- `/device-types` - Device types management
- `/manufacturers` - Manufacturers management
- `/sites` - Sites management
- `/tags` - Tags management
- `/stats` - Inventory overview

## Structure

- `src/routes/` - Page components
- `src/config/` - Configuration (API, navigation)
- Uses shared UI components from `packages/ui/`

