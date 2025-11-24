"""
Integration tests for the new admin v2 API surface.
"""
from datetime import UTC, datetime, timedelta

import pytest

from models import (
    AdminAuditLog,
    AdminRole,
    Booking,
    Device,
    Topology,
    TopologyReview,
    User,
)


def _make_booking(db, user, device, *, status="PENDING", delta_hours=1):
    start = datetime.now(UTC) + timedelta(hours=delta_hours)
    end = start + timedelta(hours=2)
    booking = Booking(
        device_id=device.id,
        user_id=user.id,
        start_time=start,
        end_time=end,
        status=status,
        comment=f"{status.title()} booking",
    )
    db.add(booking)
    db.commit()
    db.refresh(booking)
    return booking


def test_admin_v2_session_returns_permissions(authenticated_admin_client, test_admin):
    response = authenticated_admin_client.get("/admin/v2/session")
    assert response.status_code == 200
    data = response.json()
    assert data["user"]["username"] == test_admin.username
    assert data["role"] == "Super Admin"
    assert data["status"] == "active"
    assert data["permissions"]["bookings:read"] is True
    assert data["permissions"]["settings:write"] is True


def test_admin_v2_dashboard_with_sample_data(
    authenticated_admin_client, db_session, test_admin, test_device, test_user
):
    # Populate the database with a couple of bookings and an audit log entry.
    _make_booking(db_session, test_user, test_device, status="PENDING", delta_hours=4)
    _make_booking(db_session, test_user, test_device, status="CONFIRMED", delta_hours=8)

    log = AdminAuditLog(
        actor_id=test_admin.id,
        actor_role="Super Admin",
        action="approve_bookings",
        entity_type="booking",
        entity_id="1",
        payload={"label": "Booking #1"},
        message="Approved booking #1",
    )
    db_session.add(log)
    db_session.commit()

    topo = Topology(
        user_id=test_user.id,
        name="Lab Topology",
        nodes=[],
        edges=[],
    )
    db_session.add(topo)
    db_session.flush()

    review = TopologyReview(
        topology_id=topo.id,
        status="submitted",
        conflict_count=2,
    )
    db_session.add(review)
    db_session.commit()

    response = authenticated_admin_client.get("/admin/v2/dashboard")
    assert response.status_code == 200
    data = response.json()

    assert len(data["cards"]) == 3
    assert data["cards"][0]["id"] == "pending_approvals"
    assert "device_counts" in data
    assert "recent_activity" in data
    assert "topology_conflicts" in data
    assert data["topology_conflicts"][0]["conflict_count"] == 2


def test_admin_v2_bookings_listing_and_bulk_actions(
    authenticated_admin_client, db_session, test_admin, test_user, test_device
):
    pending = _make_booking(db_session, test_user, test_device, status="PENDING")
    conflicting = _make_booking(db_session, test_user, test_device, status="CONFLICTING", delta_hours=2)

    start_date = pending.start_time.date().isoformat()
    end_date = (pending.end_time.date() + timedelta(days=1)).isoformat()

    response = authenticated_admin_client.get(
        f"/admin/v2/bookings?date_start={start_date}&date_end={end_date}"
    )
    assert response.status_code == 200
    data = response.json()
    assert data["meta"]["total"] >= 2
    booking_ids = {item["booking_id"] for item in data["items"]}
    assert pending.booking_id in booking_ids
    assert conflicting.booking_id in booking_ids

    approve_resp = authenticated_admin_client.post(
        "/admin/v2/bookings/approve",
        json={"booking_ids": [pending.booking_id]},
    )
    assert approve_resp.status_code == 200
    db_session.refresh(pending)
    assert pending.status == "CONFIRMED"

    decline_resp = authenticated_admin_client.post(
        "/admin/v2/bookings/decline",
        json={"booking_ids": [conflicting.booking_id]},
    )
    assert decline_resp.status_code == 200
    db_session.refresh(conflicting)
    assert conflicting.status == "DECLINED"


def test_admin_v2_logs_endpoint(authenticated_admin_client, db_session, test_admin):
    entry = AdminAuditLog(
        actor_id=test_admin.id,
        actor_role="Super Admin",
        action="update_settings",
        entity_type="settings",
        entity_id=None,
        payload={"label": "Settings"},
        message="Updated default rules",
    )
    db_session.add(entry)
    db_session.commit()

    response = authenticated_admin_client.get("/admin/v2/logs")
    assert response.status_code == 200
    data = response.json()
    assert data["meta"]["total"] >= 1
    row = data["items"][0]
    assert row["action"] == "update_settings"
    assert row["metadata"]["label"] == "Settings"

