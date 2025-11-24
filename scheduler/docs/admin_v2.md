# Admin Console v2 Overview

The admin experience now lives at `/admin` and mirrors the client v2 look-and-feel. This document summarizes the major pieces and how to operate them during the rollout.

## Feature Highlights

- **Dashboard:** Pending approvals, device health summary, recent activity feed, and topology conflict widget. Every metric links into the relevant workspace.
- **Bookings:** Approval queue + full booking history with date presets, chip filters, bulk actions (approve/decline/resolve), CSV export, and a slide-over details drawer.
- **Devices:** Inventory, health snapshots, owners, and tags with bulk status/owner/tag updates and inline progress feedback.
- **Users & Roles:** Invite, promote/demote, disable/enable administrators, and view activity stats. A simple permissions matrix is enforced in both UI and API.
- **Topologies:** Review submitted topologies, resolve conflicts, archive entries, and drill into context.
- **Logs & Audit:** Filterable audit feed with CSV export (Super Admin only).
- **Settings:** Super Admins can update conflict rules, notification preferences, and other platform policies.

## Access & Roles

- The session endpoint is `/admin/v2/session` and returns the resolved role (`Super Admin`, `Admin`, `Approver`, `Viewer`) plus effective permissions.
- Existing admins are automatically mapped to **Super Admin** when they sign in. Non-admin users get the **Viewer** role (read-only) when accessing `/admin`.
- The legacy UI remains reachable at `/admin/legacy` for the duration of the transition.

## Initialisation Checklist

1. Run the backend once after deploying the new code so `Base.metadata.create_all` can create the new tables (`admin_roles`, `admin_audit_log`, `device_tags`, `device_health_snapshot`, etc.).
2. Verify admin sessions via `GET /admin/v2/session` and double-check that roles/permissions look correct.
3. Exercise the main workflows:
   - Approve and decline sample bookings (check the audit log for entries).
   - Bulk update device status/owners/tags.
   - Invite a user and update their role.
   - Resolve a topology conflict and confirm the status change.
4. If you rely on CSV flows, hit `/admin/v2/bookings/export` and `/admin/v2/logs/export` to validate downloads.

## Running Tests

The backend test suite now includes admin v2 coverage. From the repository root:

```bash
cd backend
source venv/bin/activate
pytest
```

To target the new admin endpoints specifically:

```bash
pytest backend/tests/test_admin_v2.py
```

## Troubleshooting

- **Login loop / blank dashboard:** Ensure the backend is running and can import the new models. The most common cause is a database that hasn’t been initialised with the new tables; restart the backend once to run `Base.metadata.create_all`.
- **Insufficient permissions banner:** The UI surfaces disabled controls with tooltips when the session role lacks the capability. Promote the user via `/admin/v2/users` or the Users tab.
- **CSV export blocked:** Only roles with the `bookings:export` or `logs:export` capabilities can download. Super Admins have the superset of permissions.
- **Tests failing with missing tables:** Make sure `admin_v2.get_db` is overridden in your test harness (already handled in the updated `backend/tests/conftest.py`).

For questions or issues during the rollout, reach out to the platform crew – the new audit log makes it easy to see who performed each action.

