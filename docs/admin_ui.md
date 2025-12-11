# Admin UI Documentation

## Overview

The new Admin Control experience replaces the old admin frontend with a unified system that reuses visual patterns from the client scheduler page while maintaining independent state.

## Entry Routes

- **Admin Root**: `/admin` - Redirects to Admin Dashboard
- **Admin Dashboard**: `/admin` (default landing page)
- **All admin routes require admin role** - Non-admins see an "Access Denied" page

## Admin vs Non-Admin Behavior

### Admin Users
- Can access all `/admin/*` routes
- See enabled "Admin Panel" button in client navbar
- Button navigates to `/admin` (Dashboard)

### Non-Admin Users
- See disabled/greyed-out "Admin Panel" button in client navbar
- Button shows tooltip: "Admin access required"
- Clicking shows a toast error message
- Manually navigating to `/admin/*` routes shows "Access Denied" page
- Access Denied page provides button to return to client view

## Authentication

- All users authenticate the same way (via `/login` endpoint)
- Login always lands on the client scheduler page (`/client`)
- Admin status is checked via `isAdmin` flag from `authStore`
- Admin routes are protected by `ProtectedAdminRoute` component

## Priority Season Toggle

- Located in Admin header (top right)
- Toggle ON/OFF stored in `adminStore` (Zustand)
- When ON:
  - Admin layout accent color changes from purple/blue to amber/orange
  - CSS class `priority-season` is applied to admin shell root
  - Shows "Priority Season Active" pill badge
- State is independent from client scheduler view
- Persisted to localStorage

## Theme & Customization

- Reuses same theme system as client scheduler:
  - Dark/light mode toggle
  - Background particle effects
  - Color customization (background and accent colors)
- Customization controls accessible via AccessibilityMenu in admin header
- Changes apply to admin views only (scoped state)
- Scheduler view state (week selection, filters) does NOT affect admin views

## Admin Shell Structure

### Left Sidebar Navigation
- Dashboard
- Approvals
- Conflicts
- Utilization Insights
- Rules Engine
- Priority Season
- Users & Roles
- Logs & Audit
- Settings

### Top Header
- Title: "Admin Control"
- Priority Season toggle
- User info
- Customization menu (AccessibilityMenu)
- "Client View" button (navigate back to scheduler)
- Logout button

## Pages

### Phase 1 Implemented Pages

#### Admin Dashboard (`/admin`)
- Card-based overview layout
- "Need Your Attention" card (pending approvals, conflicts, offline devices)
- "Today & This Week" card (usage summary)
- "Conflicts Snapshot" card (top conflicts preview)
- "Rules Summary" card (active rules - placeholder data)
- "Utilization & Fairness" card (top users - placeholder data)
- "Priority Season" card (status and quick actions)

#### Conflicts (`/admin/conflicts`)
- List page showing all active conflicts
- Table view with device, users, date range, status
- Row click opens Conflict Details Modal
- Modal shows:
  - Summary (users, device info)
  - Timeline visualization (placeholder)
  - Suggestions & Actions (alternative devices/slots - placeholder)
  - "Open Full View" button (↗ icon) routes to `/admin/conflicts/:id`
- Full-page conflict view (`/admin/conflicts/:id`)
  - Same content as modal but wider layout
  - More space for timeline and history details

### Placeholder Pages (Phase 1)

All other pages are structural stubs with:
- PageHeader component
- TODO comments indicating future implementation
- Consistent styling with glass-card layout

- **Approvals** (`/admin/approvals`) - TODO: Approval board
- **Utilization Insights** (`/admin/utilization`) - TODO: Charts and analytics
- **Rules Engine** (`/admin/rules`) - TODO: Rule builder UI
- **Priority Season** (`/admin/priority`) - TODO: Planning interface
- **Users & Roles** (`/admin/users`) - TODO: User management
- **Logs & Audit** (`/admin/logs`) - TODO: Log viewer
- **Settings** (`/admin/settings`) - TODO: System settings

## State Management

### Admin State (`adminStore.js`)
- Priority Season toggle state
- Independent from scheduler state
- Persisted to localStorage

### Auth State (`authStore.js`)
- Shared with client app
- Provides `isAdmin` flag for access control

### Scheduler State (`schedulerStore.js`)
- NOT used in admin views
- Admin and client views have independent state

## API Integration

- Uses existing backend APIs via `adminv2/api.js`
- No backend-breaking changes
- Stubs where backend work is needed (marked with TODO comments)

## Visual Design

- Reuses client scheduler visual patterns:
  - `glass-panel`, `glass-card`, `glass-button` CSS classes
  - Same color system (CSS variables for HSL colors)
  - Same sidebar look and feel
  - Same card styling with rounded corners
  - Same particle background animation (when enabled)

## Future Phases

### Phase 2+ (Not Implemented)
- Full Rules Engine UI
- Utilization Insights with charts
- Complete conflict resolution suggestions
- Priority Season planning interface
- Full approval board with filtering
- User management interface
- Log viewer with search/filter

## Files Created/Modified

### New Files
- `scheduler/frontend/src/store/adminStore.js` - Admin state management
- `scheduler/frontend/src/admin/AdminShell.js` - New admin layout shell
- `scheduler/frontend/src/admin/AdminApp.js` - New admin app entry point
- `scheduler/frontend/src/admin/pages/AdminDashboard.js` - Dashboard page
- `scheduler/frontend/src/admin/pages/ConflictsPage.js` - Conflicts page + modal + full-page view
- `scheduler/frontend/src/admin/pages/ApprovalsPage.js` - Placeholder
- `scheduler/frontend/src/admin/pages/UtilizationInsightsPage.js` - Placeholder
- `scheduler/frontend/src/admin/pages/RulesEnginePage.js` - Placeholder
- `scheduler/frontend/src/admin/pages/PrioritySeasonPage.js` - Placeholder
- `scheduler/frontend/src/admin/pages/UsersAndRolesPage.js` - Placeholder
- `scheduler/frontend/src/admin/pages/LogsPage.js` - Placeholder
- `scheduler/frontend/src/admin/pages/SettingsPage.js` - Placeholder
- `scheduler/frontend/src/admin/pages/AccessDeniedPage.js` - Access denied page

### Modified Files
- `scheduler/frontend/src/App.js` - Updated to use new AdminApp
- `scheduler/frontend/src/routes/ProtectedAdminRoute.js` - Shows AccessDeniedPage for non-admins
- `scheduler/frontend/src/client/ClientV2.js` - Updated Admin button tooltip
- `scheduler/frontend/src/index.css` - Added Priority Season accent color CSS

## Assumptions

1. **Auth System**: Uses existing `authStore` with `isAdmin` flag from `/api/auth/me` endpoint
2. **Admin Flag**: Backend returns `is_admin` boolean in auth response
3. **API Endpoints**: Existing `/admin/v2/*` endpoints are used (no changes to backend routes)
4. **Conflict Data**: Conflicts are fetched via `fetchBookings({ status: 'CONFLICTING' })`
5. **Dashboard Data**: Uses existing `/admin/v2/dashboard` endpoint

## TODOs for Future Phases

- Wire conflict timeline visualization to real data
- Implement alternative device/slot suggestions
- Build full approval board with filtering and bulk actions
- Create utilization charts and analytics
- Implement rules engine UI
- Build priority season planning interface
- Add user management features
- Create log viewer with search/filter/export

