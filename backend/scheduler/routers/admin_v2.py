from __future__ import annotations

import csv
import io
import uuid
from datetime import datetime, timedelta
from typing import Any, Dict, Iterable, List, Optional, Tuple

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    HTTPException,
    Query,
    Request,
    Response,
)
from fastapi.responses import StreamingResponse
from sqlalchemy import and_, asc, case, desc, func, or_
from sqlalchemy.orm import Session, aliased

from backend.scheduler import models, schemas
from backend.core.deps import get_db


router = APIRouter(prefix="/admin/v2", tags=["admin_v2"])


ROLE_PERMISSION_MATRIX: Dict[str, Dict[str, bool]] = {
    "Super Admin": {
        "bookings:read": True,
        "bookings:write": True,
        "bookings:export": True,
        "devices:read": True,
        "devices:write": True,
        "users:read": True,
        "users:write": True,
        "logs:read": True,
        "logs:export": True,
        "settings:write": True,
        "topologies:write": True,
    },
    "Admin": {
        "bookings:read": True,
        "bookings:write": True,
        "bookings:export": True,
        "devices:read": True,
        "devices:write": True,
        "users:read": True,
        "users:write": True,
        "logs:read": True,
        "logs:export": True,
        "settings:write": False,
        "topologies:write": True,
    },
    "Approver": {
        "bookings:read": True,
        "bookings:write": True,
        "bookings:export": True,
        "devices:read": True,
        "devices:write": False,
        "users:read": True,
        "users:write": False,
        "logs:read": True,
        "logs:export": False,
        "settings:write": False,
        "topologies:write": False,
    },
    "Viewer": {
        "bookings:read": True,
        "bookings:write": False,
        "bookings:export": False,
        "devices:read": True,
        "devices:write": False,
        "users:read": True,
        "users:write": False,
        "logs:read": True,
        "logs:export": False,
        "settings:write": False,
        "topologies:write": False,
    },
}


# Database dependency is now imported from deps.py


class AdminContext:
    def __init__(
        self,
        *,
        user: models.User,
        role: models.AdminRole,
        permissions: Dict[str, bool],
    ):
        self.user = user
        self.role = role
        self.permissions = permissions

    def require(self, capability: str) -> None:
        allowed = self.permissions.get(capability)
        if not allowed:
            raise HTTPException(status_code=403, detail="Insufficient permissions")


def _resolve_default_role(user: models.User) -> str:
    if getattr(user, "is_admin", False):
        return "Super Admin"
    return "Viewer"


def _ensure_admin_role(db: Session, user: models.User) -> models.AdminRole:
    role = db.query(models.AdminRole).filter(models.AdminRole.user_id == user.id).first()
    if role:
        return role

    default_role = _resolve_default_role(user)
    role = models.AdminRole(
        user_id=user.id,
        role=default_role,
        status="active",
        permissions=ROLE_PERMISSION_MATRIX.get(default_role, {}),
    )
    db.add(role)
    db.commit()
    db.refresh(role)
    return role


def _build_context(request: Request, db: Session) -> AdminContext:
    user_id = request.session.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Not authenticated")

    user = db.query(models.User).get(user_id)
    if not user:
        request.session.clear()
        raise HTTPException(status_code=401, detail="Not authenticated")

    role = _ensure_admin_role(db, user)
    if role.status != "active":
        raise HTTPException(
            status_code=403,
            detail="Your admin account is disabled. Contact a Super Admin.",
        )

    permissions = ROLE_PERMISSION_MATRIX.get(role.role, ROLE_PERMISSION_MATRIX["Viewer"])
    return AdminContext(user=user, role=role, permissions=permissions)


def get_admin_context(
    request: Request, db: Session = Depends(get_db)
) -> AdminContext:
    return _build_context(request, db)


def _log_admin_action(
    db: Session,
    *,
    ctx: AdminContext,
    action: str,
    entity_type: str,
    entity_id: Optional[str],
    outcome: str = "success",
    message: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> None:
    entry = models.AdminAuditLog(
        actor_id=ctx.user.id,
        actor_role=ctx.role.role,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        outcome=outcome,
        message=message,
        payload=metadata,
    )
    db.add(entry)
    db.commit()


def _week_boundaries(ref: Optional[datetime] = None) -> Tuple[datetime, datetime]:
    ref = ref or datetime.utcnow()
    ref = ref.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = ref - timedelta(days=ref.weekday())
    week_end = week_start + timedelta(days=7)
    return week_start, week_end


def _previous_week_boundaries(ref: Optional[datetime] = None) -> Tuple[datetime, datetime]:
    current_start, _ = _week_boundaries(ref)
    previous_start = current_start - timedelta(days=7)
    previous_end = current_start
    return previous_start, previous_end


def _count_pending_bookings(db: Session, start: datetime, end: datetime) -> int:
    return (
        db.query(func.count(models.Booking.booking_id))
        .filter(
            models.Booking.status.in_(["PENDING", "CONFLICTING"]),
            models.Booking.start_time >= start,
            models.Booking.start_time < end,
        )
        .scalar()
        or 0
    )


@router.get("/session")
def get_admin_session(
    ctx: AdminContext = Depends(get_admin_context),
) -> Dict[str, Any]:
    return {
        "user": {
            "id": ctx.user.id,
            "username": ctx.user.username,
            "email": ctx.user.email,
        },
        "role": ctx.role.role,
        "status": ctx.role.status,
        "permissions": ctx.permissions,
    }


@router.get("/dashboard", response_model=schemas.DashboardResponse)
def get_dashboard(
    ctx: AdminContext = Depends(get_admin_context),
    db: Session = Depends(get_db),
) -> schemas.DashboardResponse:
    now = datetime.utcnow()
    current_week_start, current_week_end = _week_boundaries(now)
    previous_week_start, previous_week_end = _previous_week_boundaries(now)

    current_pending = _count_pending_bookings(db, current_week_start, current_week_end)
    previous_pending = _count_pending_bookings(
        db, previous_week_start, previous_week_end
    )
    delta = current_pending - previous_pending

    device_counts = (
        db.query(
            func.count(models.Device.id),
            func.count(
                case((models.Device.status.ilike("available%"), 1))
            ),
            func.count(
                case((models.Device.status.ilike("maintenance%"), 1))
            ),
            func.count(
                case((models.Device.status.ilike("offline%"), 1))
            ),
        )
        .first()
        or (0, 0, 0, 0)
    )

    bookings_today = (
        db.query(func.count(func.distinct(models.Booking.user_id)))
        .filter(
            models.Booking.created_at >= now.replace(hour=0, minute=0, second=0, microsecond=0)
        )
        .scalar()
        or 0
    )

    new_signups = 0
    if hasattr(models.User, "created_at"):
        new_signups = (
            db.query(func.count(models.User.id))
            .filter(models.User.created_at >= now - timedelta(days=7))
            .scalar()
            or 0
        )

    recent_activity_rows = (
        db.query(models.AdminAuditLog)
        .order_by(models.AdminAuditLog.created_at.desc())
        .limit(15)
        .all()
    )

    recent_activity: List[schemas.ActivityItem] = []
    for row in recent_activity_rows:
        actor = None
        if row.actor:
            actor = schemas.ActivityActor(
                id=row.actor.id,
                name=row.actor.username,
                role=row.actor_role,
            )
        entity = None
        if row.entity_type:
            payload = row.payload or {}
            entity = schemas.ActivityEntity(
                type=row.entity_type,
                id=row.entity_id,
                label=payload.get("label"),
            )
        recent_activity.append(
            schemas.ActivityItem(
                id=row.id,
                timestamp=row.created_at,
                actor=actor,
                action=row.action,
                entity=entity,
                outcome=row.outcome,
                message=row.message,
                metadata=row.payload,
            )
        )

    topology_reviews = (
        db.query(models.TopologyReview, models.Topology, models.User)
        .join(models.Topology, models.TopologyReview.topology_id == models.Topology.id)
        .outerjoin(models.User, models.Topology.user_id == models.User.id)
        .filter(models.TopologyReview.conflict_count > 0, models.TopologyReview.status != "resolved")
        .order_by(models.TopologyReview.updated_at.desc())
        .limit(10)
        .all()
    )

    topology_conflicts = [
        schemas.TopologyConflictItem(
            topology_id=review.topology_id,
            name=topology.name,
            submitted_by=user.username if user else None,
            conflict_count=review.conflict_count,
            last_updated=review.updated_at,
        )
        for review, topology, user in topology_reviews
    ]

    cards = [
        schemas.DashboardCard(
            id="pending_approvals",
            label="Pending approvals",
            value=current_pending,
            delta=delta,
            delta_direction="up" if delta >= 0 else "down",
            hint="Requests waiting for administrator decisions",
        ),
        schemas.DashboardCard(
            id="active_users",
            label="Active users (today)",
            value=bookings_today,
            delta=None,
            delta_direction=None,
        ),
        schemas.DashboardCard(
            id="new_signups",
            label="New signups (7d)",
            value=new_signups,
            delta=None,
            delta_direction=None,
        ),
    ]

    return schemas.DashboardResponse(
        cards=cards,
        device_counts=schemas.DeviceSummaryCounts(
            total=device_counts[0],
            active=device_counts[1],
            maintenance=device_counts[2],
            offline=device_counts[3],
        ),
        recent_activity=recent_activity,
        topology_conflicts=topology_conflicts,
    )


def _parse_date(date_str: Optional[str]) -> Optional[datetime]:
    if not date_str:
        return None
    try:
        if len(date_str) == 10:
            return datetime.strptime(date_str, "%Y-%m-%d")
        return datetime.fromisoformat(date_str)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=f"Invalid date format: {date_str}") from exc


def _booking_conflicts(db: Session, booking: models.Booking) -> List[schemas.BookingConflictItem]:
    overlapping = (
        db.query(models.Booking, models.User)
        .join(models.User, models.Booking.user_id == models.User.id)
        .filter(
            models.Booking.device_id == booking.device_id,
            models.Booking.booking_id != booking.booking_id,
            models.Booking.status.notin_(["CANCELLED", "REJECTED", "DECLINED"]),
            models.Booking.start_time < booking.end_time,
            models.Booking.end_time > booking.start_time,
        )
        .all()
    )
    conflicts: List[schemas.BookingConflictItem] = []
    for overlap, owner in overlapping:
        overlap_start = max(overlap.start_time, booking.start_time)
        overlap_end = min(overlap.end_time, booking.end_time)
        conflicts.append(
            schemas.BookingConflictItem(
                booking_id=overlap.booking_id,
                status=overlap.status or "PENDING",
                owner=schemas.BookingUserSummary(
                    id=owner.id,
                    username=owner.username,
                    role=None,
                ),
                overlap_start=overlap_start,
                overlap_end=overlap_end,
            )
        )
    return conflicts


def _booking_row(
    booking: models.Booking, user: models.User, device: models.Device, ctx: AdminContext
) -> schemas.BookingRow:
    conflict = (booking.status or "").upper() == "CONFLICTING"
    awaiting_my_action = conflict or (booking.status or "").upper() == "PENDING"
    return schemas.BookingRow(
        booking_id=booking.booking_id,
        grouped_booking_id=booking.grouped_booking_id,
        user=schemas.BookingUserSummary(
            id=user.id,
            username=user.username,
            role=None,
        ),
        device=schemas.BookingDeviceSummary(
            id=device.id,
            name=device.deviceName or f"Device {device.id}",
            type=device.deviceType or "Unknown",
            status=device.status,
        ),
        start_time=booking.start_time,
        end_time=booking.end_time,
        status=booking.status or "PENDING",
        comment=booking.comment,
        conflict=conflict,
        conflict_notes=["Conflict detected"] if conflict else None,
        awaiting_my_action=awaiting_my_action and ctx.permissions.get("bookings:write", False),
        created_at=booking.created_at,
        updated_at=None,
    )


@router.get("/bookings", response_model=schemas.BookingListResponse)
def list_bookings(
    ctx: AdminContext = Depends(get_admin_context),
    db: Session = Depends(get_db),
    status: Optional[str] = Query(None, description="Filter by status"),
    date_start: Optional[str] = Query(None),
    date_end: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    device_type: Optional[str] = Query(None),
    device_name: Optional[str] = Query(None),
    user: Optional[str] = Query(None, alias="user_name"),
    conflict_only: bool = Query(False),
    awaiting_my_action: bool = Query(False),
    limit: int = Query(25, ge=1, le=200),
    offset: int = Query(0, ge=0),
    sort: Optional[str] = Query("start_time:asc"),
) -> schemas.BookingListResponse:
    Booking = models.Booking
    Device = models.Device
    User = models.User

    query = (
        db.query(Booking, User, Device)
        .join(User, Booking.user_id == User.id)
        .join(Device, Booking.device_id == Device.id)
    )

    if status:
        statuses = [s.strip().upper() for s in status.split(",")]
        query = query.filter(func.upper(Booking.status).in_(statuses))

    if conflict_only:
        query = query.filter(func.upper(Booking.status) == "CONFLICTING")

    if awaiting_my_action and ctx.permissions.get("bookings:write", False):
        query = query.filter(func.upper(Booking.status).in_(["PENDING", "CONFLICTING"]))

    start_dt = _parse_date(date_start)
    end_dt = _parse_date(date_end)
    if start_dt:
        query = query.filter(Booking.start_time >= start_dt)
    if end_dt:
        end_dt = end_dt + timedelta(days=1)
        query = query.filter(Booking.start_time < end_dt)

    if device_type:
        query = query.filter(Device.deviceType.ilike(f"%{device_type}%"))
    if device_name:
        query = query.filter(Device.deviceName.ilike(f"%{device_name}%"))
    if user:
        query = query.filter(User.username.ilike(f"%{user}%"))

    if search:
        pattern = f"%{search}%"
        query = query.filter(
            or_(
                User.username.ilike(pattern),
                Device.deviceName.ilike(pattern),
                Device.deviceType.ilike(pattern),
                Booking.comment.ilike(pattern),
            )
        )

    sort_field = "start_time"
    sort_dir = asc
    if sort:
        try:
            field, direction = sort.split(":")
        except ValueError:
            field, direction = sort, "asc"
        direction = direction.lower()
        sort_dir = asc if direction != "desc" else desc
        sort_field = field

    sort_column = {
        "start_time": Booking.start_time,
        "end_time": Booking.end_time,
        "status": Booking.status,
        "created_at": Booking.created_at,
    }.get(sort_field, Booking.start_time)

    total = query.count()
    rows = (
        query.order_by(sort_dir(sort_column), Booking.booking_id.asc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    items = [_booking_row(booking, booking_user, booking_device, ctx) for booking, booking_user, booking_device in rows]

    return schemas.BookingListResponse(
        items=items,
        meta=schemas.PaginationMeta(total=total, limit=limit, offset=offset),
    )


@router.get("/bookings/{booking_id}", response_model=schemas.BookingDetailResponse)
def get_booking_detail(
    booking_id: int,
    ctx: AdminContext = Depends(get_admin_context),
    db: Session = Depends(get_db),
) -> schemas.BookingDetailResponse:
    Booking = models.Booking
    booking_tuple = (
        db.query(Booking, models.User, models.Device)
        .join(models.User, Booking.user_id == models.User.id)
        .join(models.Device, Booking.device_id == models.Device.id)
        .filter(Booking.booking_id == booking_id)
        .first()
    )
    if not booking_tuple:
        raise HTTPException(status_code=404, detail="Booking not found")

    booking, user, device = booking_tuple
    booking_row = _booking_row(booking, user, device, ctx)

    window_start = booking.start_time - timedelta(hours=12)
    window_end = booking.end_time + timedelta(hours=12)

    timeline_rows = (
        db.query(models.Booking, models.User)
        .join(models.User, models.Booking.user_id == models.User.id)
        .filter(
            models.Booking.device_id == booking.device_id,
            models.Booking.start_time >= window_start,
            models.Booking.start_time <= window_end,
        )
        .order_by(models.Booking.start_time.asc())
        .all()
    )

    timeline: List[schemas.BookingDetailTimelineItem] = []
    for row, owner in timeline_rows:
        timeline.append(
            schemas.BookingDetailTimelineItem(
                booking_id=row.booking_id,
                start_time=row.start_time,
                end_time=row.end_time,
                status=row.status or "PENDING",
                owner=schemas.BookingUserSummary(
                    id=owner.id,
                    username=owner.username,
                    role=None,
                ),
            )
        )

    conflicts = _booking_conflicts(db, booking)

    history_rows = (
        db.query(models.Booking, models.User)
        .join(models.User, models.Booking.user_id == models.User.id)
        .filter(
            models.Booking.device_id == booking.device_id,
            models.Booking.end_time < booking.start_time,
        )
        .order_by(models.Booking.end_time.desc())
        .limit(10)
        .all()
    )

    history: List[schemas.BookingDetailTimelineItem] = []
    for record, owner in history_rows:
        history.append(
            schemas.BookingDetailTimelineItem(
                booking_id=record.booking_id,
                start_time=record.start_time,
                end_time=record.end_time,
                status=record.status or "PENDING",
                owner=schemas.BookingUserSummary(
                    id=owner.id,
                    username=owner.username,
                    role=None,
                ),
            )
        )

    health_snapshot = (
        db.query(models.DeviceHealthSnapshot)
        .filter(models.DeviceHealthSnapshot.device_id == booking.device_id)
        .order_by(models.DeviceHealthSnapshot.updated_at.desc())
        .first()
    )

    device_health = None
    if health_snapshot:
        device_health = {
            "status": health_snapshot.status,
            "heartbeat_at": health_snapshot.heartbeat_at,
            "metrics": health_snapshot.metrics,
        }

    return schemas.BookingDetailResponse(
        booking=booking_row,
        timeline=timeline,
        conflicts=conflicts,
        device_health=device_health,
        history=history,
    )


@router.post(
    "/bookings/approve",
    response_model=schemas.BookingBulkActionResult,
)
def approve_bookings(
    payload: schemas.BookingBulkActionRequest,
    ctx: AdminContext = Depends(get_admin_context),
    db: Session = Depends(get_db),
) -> schemas.BookingBulkActionResult:
    ctx.require("bookings:write")

    if not payload.booking_ids:
        raise HTTPException(status_code=400, detail="No booking IDs provided")

    succeeded: List[int] = []
    failed: List[Dict[str, Any]] = []

    for booking_id in payload.booking_ids:
        booking = db.query(models.Booking).get(booking_id)
        if not booking:
            failed.append({"id": booking_id, "reason": "Not found"})
            continue

        if (booking.status or "").upper() == "CONFIRMED":
            failed.append({"id": booking_id, "reason": "Already confirmed"})
            continue

        booking.status = "CONFIRMED"
        booking.comment = payload.comment or booking.comment
        succeeded.append(booking_id)

    db.commit()

    if succeeded:
        _log_admin_action(
            db,
            ctx=ctx,
            action="approve_bookings",
            entity_type="booking",
            entity_id=",".join(str(bid) for bid in succeeded),
            metadata={"count": len(succeeded)},
        )

    return schemas.BookingBulkActionResult(succeeded=succeeded, failed=failed)


@router.post(
    "/bookings/decline",
    response_model=schemas.BookingBulkActionResult,
)
def decline_bookings(
    payload: schemas.BookingBulkActionRequest,
    ctx: AdminContext = Depends(get_admin_context),
    db: Session = Depends(get_db),
) -> schemas.BookingBulkActionResult:
    ctx.require("bookings:write")

    if not payload.booking_ids:
        raise HTTPException(status_code=400, detail="No booking IDs provided")

    succeeded: List[int] = []
    failed: List[Dict[str, Any]] = []

    for booking_id in payload.booking_ids:
        booking = db.query(models.Booking).get(booking_id)
        if not booking:
            failed.append({"id": booking_id, "reason": "Not found"})
            continue

        if (booking.status or "").upper() in {"DECLINED", "REJECTED"}:
            failed.append({"id": booking_id, "reason": "Already declined"})
            continue

        booking.status = "DECLINED"
        booking.comment = payload.comment or booking.comment
        succeeded.append(booking_id)

    db.commit()

    if succeeded:
        _log_admin_action(
            db,
            ctx=ctx,
            action="decline_bookings",
            entity_type="booking",
            entity_id=",".join(str(bid) for bid in succeeded),
            metadata={"count": len(succeeded)},
        )

    return schemas.BookingBulkActionResult(succeeded=succeeded, failed=failed)


@router.post(
    "/bookings/conflicts/resolve",
    response_model=schemas.BookingBulkActionResult,
)
def resolve_booking_conflicts(
    payload: schemas.BookingConflictResolutionRequest,
    ctx: AdminContext = Depends(get_admin_context),
    db: Session = Depends(get_db),
) -> schemas.BookingBulkActionResult:
    ctx.require("bookings:write")

    succeeded: List[int] = []
    failed: List[Dict[str, Any]] = []

    for entry in payload.resolution:
        booking = db.query(models.Booking).get(entry.booking_id)
        if not booking:
            failed.append({"id": entry.booking_id, "reason": "Not found"})
            continue

        booking.status = entry.status.upper()
        if entry.comment:
            booking.comment = entry.comment
        succeeded.append(entry.booking_id)

    db.commit()

    if succeeded:
        _log_admin_action(
            db,
            ctx=ctx,
            action="resolve_conflicts",
            entity_type="booking",
            entity_id=",".join(str(bid) for bid in succeeded),
            metadata={
                "count": len(succeeded),
                "message": payload.audit_message,
            },
        )

    return schemas.BookingBulkActionResult(succeeded=succeeded, failed=failed)


@router.get("/bookings/export")
def export_bookings(
    ctx: AdminContext = Depends(get_admin_context),
    db: Session = Depends(get_db),
    status: Optional[str] = Query(None),
    date_start: Optional[str] = Query(None),
    date_end: Optional[str] = Query(None),
) -> StreamingResponse:
    ctx.require("bookings:export")

    Booking = models.Booking
    Device = models.Device
    User = models.User

    query = (
        db.query(Booking, User, Device)
        .join(User, Booking.user_id == User.id)
        .join(Device, Booking.device_id == Device.id)
    )

    if status:
        statuses = [s.strip().upper() for s in status.split(",")]
        query = query.filter(func.upper(Booking.status).in_(statuses))

    start_dt = _parse_date(date_start)
    end_dt = _parse_date(date_end)
    if start_dt:
        query = query.filter(Booking.start_time >= start_dt)
    if end_dt:
        end_dt = end_dt + timedelta(days=1)
        query = query.filter(Booking.start_time < end_dt)

    rows = query.order_by(Booking.start_time.asc()).all()

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(
        [
            "Booking ID",
            "Grouped ID",
            "User",
            "Device Type",
            "Device Name",
            "Start",
            "End",
            "Status",
            "Comment",
        ]
    )

    for booking, user, device in rows:
        writer.writerow(
            [
                booking.booking_id,
                booking.grouped_booking_id,
                user.username,
                device.deviceType,
                device.deviceName,
                booking.start_time.isoformat(),
                booking.end_time.isoformat(),
                booking.status,
                booking.comment or "",
            ]
        )

    buffer.seek(0)
    filename = f"bookings-export-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}.csv"

    _log_admin_action(
        db,
        ctx=ctx,
        action="export_bookings",
        entity_type="booking",
        entity_id=None,
        metadata={"rows": len(rows)},
    )

    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
        },
    )


def _device_row(
    device: models.Device,
    owner_username: Optional[str],
    owner_id: Optional[int],
    tags: Optional[List[str]],
    health: Optional[models.DeviceHealthSnapshot],
) -> schemas.DeviceRow:
    owner_summary = None
    if owner_id:
        owner_summary = schemas.DeviceOwnerSummary(id=owner_id, username=owner_username)

    health_meta = None
    if health:
        health_meta = schemas.DeviceHealthMeta(
            status=health.status,
            heartbeat_at=health.heartbeat_at,
            metrics=health.metrics,
        )

    return schemas.DeviceRow(
        id=device.id,
        name=device.deviceName or f"Device {device.id}",
        type=device.deviceType or "Unknown",
        status=device.status or "Unknown",
        owner=owner_summary,
        last_updated=health.updated_at if health else None,
        tags=tags or [],
        site=None,
        location_path=None,
        health=health_meta,
    )


@router.get("/devices", response_model=schemas.DeviceListResponse)
def list_devices(
    ctx: AdminContext = Depends(get_admin_context),
    db: Session = Depends(get_db),
    status: Optional[str] = Query(None),
    device_type: Optional[str] = Query(None),
    owner: Optional[str] = Query(None),
    tag: Optional[str] = Query(None),
    limit: int = Query(25, ge=1, le=200),
    offset: int = Query(0, ge=0),
) -> schemas.DeviceListResponse:
    Device = models.Device
    query = db.query(Device)

    if status:
        statuses = [s.strip().lower() for s in status.split(",")]
        query = query.filter(func.lower(Device.status).in_(statuses))
    if device_type:
        query = query.filter(Device.deviceType.ilike(f"%{device_type}%"))
    if owner:
        owner_exists = (
            db.query(models.DeviceOwnership.id)
            .join(models.User, models.DeviceOwnership.owner_id == models.User.id)
            .filter(
                models.DeviceOwnership.device_id == Device.id,
                models.DeviceOwnership.revoked_at.is_(None),
                models.User.username.ilike(f"%{owner}%"),
            )
            .exists()
        )
        query = query.filter(owner_exists)
    if tag:
        tag_exists = (
            db.query(models.DeviceTag.id)
            .filter(
                models.DeviceTag.device_id == Device.id,
                models.DeviceTag.tag == tag,
            )
            .exists()
        )
        query = query.filter(tag_exists)

    total = query.count()
    devices = (
        query.order_by(Device.deviceName.asc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    device_ids = [device.id for device in devices]

    owners_map: Dict[int, Tuple[Optional[int], Optional[str]]] = {}
    if device_ids:
        ownership_rows = (
            db.query(models.DeviceOwnership, models.User)
            .join(models.User, models.DeviceOwnership.owner_id == models.User.id)
            .filter(
                models.DeviceOwnership.device_id.in_(device_ids),
                models.DeviceOwnership.revoked_at.is_(None),
            )
            .order_by(models.DeviceOwnership.assigned_at.desc())
            .all()
        )
        for ownership_row, owner_user in ownership_rows:
            if ownership_row.device_id not in owners_map:
                owners_map[ownership_row.device_id] = (owner_user.id, owner_user.username)

    tags_map: Dict[int, List[str]] = {device_id: [] for device_id in device_ids}
    if device_ids:
        tag_rows = (
            db.query(models.DeviceTag)
            .filter(models.DeviceTag.device_id.in_(device_ids))
            .all()
        )
        for tag_row in tag_rows:
            tags_map.setdefault(tag_row.device_id, []).append(tag_row.tag)

    health_map: Dict[int, models.DeviceHealthSnapshot] = {}
    if device_ids:
        health_rows = (
            db.query(models.DeviceHealthSnapshot)
            .filter(models.DeviceHealthSnapshot.device_id.in_(device_ids))
            .order_by(
                models.DeviceHealthSnapshot.device_id,
                models.DeviceHealthSnapshot.updated_at.desc(),
            )
            .all()
        )
        for row in health_rows:
            if row.device_id not in health_map:
                health_map[row.device_id] = row

    items: List[schemas.DeviceRow] = []
    for device in devices:
        owner_info = owners_map.get(device.id, (None, None))
        items.append(
            _device_row(
                device=device,
                owner_username=owner_info[1],
                owner_id=owner_info[0],
                tags=tags_map.get(device.id, []),
                health=health_map.get(device.id),
            )
        )

    return schemas.DeviceListResponse(
        items=items,
        meta=schemas.PaginationMeta(total=total, limit=limit, offset=offset),
    )


@router.post(
    "/devices/status",
    response_model=schemas.DeviceBulkActionResponse,
)
def update_device_status(
    payload: schemas.DeviceStatusUpdateRequest,
    ctx: AdminContext = Depends(get_admin_context),
    db: Session = Depends(get_db),
) -> schemas.DeviceBulkActionResponse:
    ctx.require("devices:write")

    if not payload.device_ids:
        raise HTTPException(status_code=400, detail="No device IDs provided")

    succeeded: List[int] = []
    failed: List[Dict[str, Any]] = []

    for device_id in payload.device_ids:
        device = db.query(models.Device).get(device_id)
        if not device:
            failed.append({"id": device_id, "reason": "Not found"})
            continue
        device.status = payload.status
        succeeded.append(device_id)

    db.commit()

    if succeeded:
        _log_admin_action(
            db,
            ctx=ctx,
            action="update_device_status",
            entity_type="device",
            entity_id=",".join(str(did) for did in succeeded),
            metadata={"status": payload.status, "count": len(succeeded)},
        )

    return schemas.DeviceBulkActionResponse(succeeded=succeeded, failed=failed)


@router.post(
    "/devices/assign-owner",
    response_model=schemas.DeviceBulkActionResponse,
)
def assign_device_owner(
    payload: schemas.DeviceOwnerUpdateRequest,
    ctx: AdminContext = Depends(get_admin_context),
    db: Session = Depends(get_db),
) -> schemas.DeviceBulkActionResponse:
    ctx.require("devices:write")

    if not payload.device_ids:
        raise HTTPException(status_code=400, detail="No device IDs provided")

    owner_user = None
    if payload.owner_id is not None:
        owner_user = db.query(models.User).get(payload.owner_id)
        if not owner_user:
            raise HTTPException(status_code=404, detail="Owner not found")

    succeeded: List[int] = []
    failed: List[Dict[str, Any]] = []

    now = datetime.utcnow()

    for device_id in payload.device_ids:
        device = db.query(models.Device).get(device_id)
        if not device:
            failed.append({"id": device_id, "reason": "Not found"})
            continue

        existing = (
            db.query(models.DeviceOwnership)
            .filter(
                models.DeviceOwnership.device_id == device_id,
                models.DeviceOwnership.revoked_at.is_(None),
            )
            .all()
        )
        for record in existing:
            record.revoked_at = now

        if owner_user:
            db.add(
                models.DeviceOwnership(
                    device_id=device_id,
                    owner_id=owner_user.id,
                    assigned_by=ctx.user.id,
                    assigned_at=now,
                )
            )

        succeeded.append(device_id)

    db.commit()

    if succeeded:
        _log_admin_action(
            db,
            ctx=ctx,
            action="assign_device_owner",
            entity_type="device",
            entity_id=",".join(str(did) for did in succeeded),
            metadata={
                "owner_id": payload.owner_id,
                "count": len(succeeded),
            },
        )

    return schemas.DeviceBulkActionResponse(succeeded=succeeded, failed=failed)


@router.post(
    "/devices/tags",
    response_model=schemas.DeviceBulkActionResponse,
)
def update_device_tags(
    payload: schemas.DeviceTagUpdateRequest,
    ctx: AdminContext = Depends(get_admin_context),
    db: Session = Depends(get_db),
) -> schemas.DeviceBulkActionResponse:
    ctx.require("devices:write")

    if not payload.device_ids:
        raise HTTPException(status_code=400, detail="No device IDs provided")

    mode = payload.mode.lower()
    if mode not in {"set", "add", "remove"}:
        raise HTTPException(status_code=400, detail="Invalid tag mode")

    succeeded: List[int] = []
    failed: List[Dict[str, Any]] = []

    now = datetime.utcnow()

    for device_id in payload.device_ids:
        device = db.query(models.Device).get(device_id)
        if not device:
            failed.append({"id": device_id, "reason": "Not found"})
            continue

        existing_tags = (
            db.query(models.DeviceTag)
            .filter(models.DeviceTag.device_id == device_id)
            .all()
        )

        if mode == "set":
            for tag in existing_tags:
                db.delete(tag)
            for tag in payload.tags:
                db.add(models.DeviceTag(device_id=device_id, tag=tag, created_at=now))
        elif mode == "add":
            current = {tag.tag for tag in existing_tags}
            for tag in payload.tags:
                if tag not in current:
                    db.add(models.DeviceTag(device_id=device_id, tag=tag, created_at=now))
        else:  # remove
            for tag in existing_tags:
                if tag.tag in payload.tags:
                    db.delete(tag)

        succeeded.append(device_id)

    db.commit()

    if succeeded:
        _log_admin_action(
            db,
            ctx=ctx,
            action="update_device_tags",
            entity_type="device",
            entity_id=",".join(str(did) for did in succeeded),
            metadata={"mode": mode, "tags": payload.tags},
        )

    return schemas.DeviceBulkActionResponse(succeeded=succeeded, failed=failed)


@router.get("/users", response_model=schemas.AdminUserListResponse)
def list_users(
    ctx: AdminContext = Depends(get_admin_context),
    db: Session = Depends(get_db),
    role: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    limit: int = Query(25, ge=1, le=200),
    offset: int = Query(0, ge=0),
) -> schemas.AdminUserListResponse:
    User = models.User
    Role = models.AdminRole

    role_query = (
        db.query(User, Role)
        .outerjoin(Role, User.id == Role.user_id)
    )

    if role:
        role_query = role_query.filter(func.lower(Role.role) == role.lower())
    if status:
        role_query = role_query.filter(func.lower(Role.status) == status.lower())
    if search:
        pattern = f"%{search}%"
        role_query = role_query.filter(
            or_(
                User.username.ilike(pattern),
                User.email.ilike(pattern),
            )
        )

    total = role_query.count()
    rows = (
        role_query.order_by(User.username.asc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    booking_counts = dict(
        db.query(models.Booking.user_id, func.count(models.Booking.booking_id))
        .group_by(models.Booking.user_id)
        .all()
    )

    user_rows: List[schemas.AdminUserRow] = []
    for user, role_row in rows:
        effective_role = role_row.role if role_row else _resolve_default_role(user)
        effective_status = role_row.status if role_row else "active"
        approval_limits = role_row.approval_limits if role_row else None
        last_active = (
            db.query(func.max(models.Booking.created_at))
            .filter(models.Booking.user_id == user.id)
            .scalar()
        )
        user_rows.append(
            schemas.AdminUserRow(
                id=user.id,
                username=user.username,
                email=user.email,
                role=schemas.AdminRoleType(effective_role),
                status=schemas.AdminStatus(effective_status),
                bookings_count=booking_counts.get(user.id, 0),
                last_active=last_active,
                approval_limits=approval_limits,
                devices_operated=None,
            )
        )

    return schemas.AdminUserListResponse(
        items=user_rows,
        meta=schemas.PaginationMeta(total=total, limit=limit, offset=offset),
    )


@router.post("/users/invite", status_code=201)
def invite_user(
    payload: schemas.AdminUserInviteRequest,
    ctx: AdminContext = Depends(get_admin_context),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    ctx.require("users:write")

    token = uuid.uuid4().hex
    expires_at = datetime.utcnow() + timedelta(days=7)

    invitation = models.AdminInvitation(
        email=payload.email,
        handle=payload.handle,
        role=payload.role.value,
        invited_by=ctx.user.id,
        token=token,
        expires_at=expires_at,
    )
    db.add(invitation)
    db.commit()
    db.refresh(invitation)

    _log_admin_action(
        db,
        ctx=ctx,
        action="invite_user",
        entity_type="invitation",
        entity_id=str(invitation.id),
        metadata={"email": payload.email, "role": payload.role.value},
    )

    return {
        "invitation_id": invitation.id,
        "token": invitation.token,
        "expires_at": invitation.expires_at,
    }


@router.post("/users/{user_id}/role")
def update_user_role(
    user_id: int,
    payload: schemas.AdminUserRoleUpdateRequest,
    ctx: AdminContext = Depends(get_admin_context),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    ctx.require("users:write")

    user = db.query(models.User).get(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    role_row = _ensure_admin_role(db, user)
    role_row.role = payload.role.value
    role_row.permissions = ROLE_PERMISSION_MATRIX.get(payload.role.value, {})
    role_row.approval_limits = payload.approval_limits
    role_row.updated_at = datetime.utcnow()
    db.commit()

    _log_admin_action(
        db,
        ctx=ctx,
        action="update_user_role",
        entity_type="user",
        entity_id=str(user_id),
        metadata={
            "role": payload.role.value,
            "approval_limits": payload.approval_limits,
        },
    )

    return {"success": True}


@router.post("/users/{user_id}/status")
def update_user_status(
    user_id: int,
    payload: schemas.AdminUserStatusUpdateRequest,
    ctx: AdminContext = Depends(get_admin_context),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    ctx.require("users:write")

    user = db.query(models.User).get(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    role_row = _ensure_admin_role(db, user)
    role_row.status = payload.status.value
    role_row.updated_at = datetime.utcnow()
    db.commit()

    _log_admin_action(
        db,
        ctx=ctx,
        action="update_user_status",
        entity_type="user",
        entity_id=str(user_id),
        metadata={"status": payload.status.value},
    )

    return {"success": True}


@router.get("/topologies", response_model=schemas.TopologyListResponse)
def list_topologies(
    ctx: AdminContext = Depends(get_admin_context),
    db: Session = Depends(get_db),
    status: Optional[str] = Query(None),
    limit: int = Query(25, ge=1, le=200),
    offset: int = Query(0, ge=0),
) -> schemas.TopologyListResponse:
    Topology = models.Topology
    Review = models.TopologyReview
    User = models.User

    query = (
        db.query(Topology, Review, User)
        .outerjoin(Review, Review.topology_id == Topology.id)
        .outerjoin(User, User.id == Topology.user_id)
    )

    if status:
        query = query.filter(func.lower(Review.status) == status.lower())

    total = query.count()
    rows = (
        query.order_by(Topology.updated_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    items: List[schemas.TopologyRow] = []
    for topology, review, user in rows:
        review_status = review.status if review else "submitted"
        conflict_count = review.conflict_count if review else 0
        items.append(
            schemas.TopologyRow(
                id=topology.id,
                name=topology.name,
                status=review_status,
                submitted_by=user.username if user else None,
                submitted_at=topology.created_at,
                resolved_at=review.resolved_at if review else None,
                conflict_count=conflict_count,
            )
        )

    return schemas.TopologyListResponse(
        items=items,
        meta=schemas.PaginationMeta(total=total, limit=limit, offset=offset),
    )


@router.post("/topologies/{topology_id}/action")
def act_on_topology(
    topology_id: int,
    payload: schemas.TopologyActionRequest,
    ctx: AdminContext = Depends(get_admin_context),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    if payload.action in {"resolve", "archive"}:
        ctx.require("topologies:write")

    topology = db.query(models.Topology).get(topology_id)
    if not topology:
        raise HTTPException(status_code=404, detail="Topology not found")

    review = (
        db.query(models.TopologyReview)
        .filter(models.TopologyReview.topology_id == topology_id)
        .first()
    )
    if not review:
        review = models.TopologyReview(
            topology_id=topology_id,
            status="submitted",
            conflict_count=0,
        )
        db.add(review)
        db.commit()
        db.refresh(review)

    action = payload.action.lower()
    now = datetime.utcnow()

    if action == "resolve":
        review.status = "resolved"
        review.resolved_at = now
        review.resolved_by = ctx.user.id
    elif action == "archive":
        review.status = "archived"
    elif action == "check":
        review.last_checked_at = now
    elif action == "export":
        ctx.require("topologies:write")
    else:
        raise HTTPException(status_code=400, detail="Unsupported topology action")

    review.updated_at = now
    db.commit()

    _log_admin_action(
        db,
        ctx=ctx,
        action=f"topology_{action}",
        entity_type="topology",
        entity_id=str(topology_id),
        metadata={"comment": payload.comment},
    )

    return {"success": True}


@router.get("/logs", response_model=schemas.AuditLogListResponse)
def list_logs(
    ctx: AdminContext = Depends(get_admin_context),
    db: Session = Depends(get_db),
    actor: Optional[int] = Query(None),
    action: Optional[str] = Query(None),
    entity_type: Optional[str] = Query(None),
    outcome: Optional[str] = Query(None),
    date_start: Optional[str] = Query(None),
    date_end: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
) -> schemas.AuditLogListResponse:
    ctx.require("logs:read")

    Log = models.AdminAuditLog
    User = models.User

    query = db.query(Log, User).outerjoin(User, Log.actor_id == User.id)

    if actor:
        query = query.filter(Log.actor_id == actor)
    if action:
        query = query.filter(Log.action == action)
    if entity_type:
        query = query.filter(Log.entity_type == entity_type)
    if outcome:
        query = query.filter(Log.outcome == outcome)

    start_dt = _parse_date(date_start)
    end_dt = _parse_date(date_end)
    if start_dt:
        query = query.filter(Log.created_at >= start_dt)
    if end_dt:
        end_dt = end_dt + timedelta(days=1)
        query = query.filter(Log.created_at < end_dt)

    total = query.count()
    rows = (
        query.order_by(Log.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    items: List[schemas.AuditLogRow] = []
    for log, actor_row in rows:
        actor = None
        if actor_row:
            actor = schemas.ActivityActor(
                id=actor_row.id,
                name=actor_row.username,
                role=log.actor_role,
            )
        entity = None
        if log.entity_type:
            payload = log.payload or {}
            entity = schemas.ActivityEntity(
                type=log.entity_type,
                id=log.entity_id,
                label=payload.get("label"),
            )
        items.append(
            schemas.AuditLogRow(
                id=log.id,
                timestamp=log.created_at,
                actor=actor,
                action=log.action,
                entity=entity,
                outcome=log.outcome,
                message=log.message,
                metadata=log.payload,
            )
        )

    return schemas.AuditLogListResponse(
        items=items,
        meta=schemas.PaginationMeta(total=total, limit=limit, offset=offset),
    )


@router.get("/logs/export")
def export_logs(
    ctx: AdminContext = Depends(get_admin_context),
    db: Session = Depends(get_db),
    date_start: Optional[str] = Query(None),
    date_end: Optional[str] = Query(None),
) -> StreamingResponse:
    ctx.require("logs:export")

    Log = models.AdminAuditLog
    User = models.User

    query = db.query(Log, User).outerjoin(User, Log.actor_id == User.id)

    start_dt = _parse_date(date_start)
    end_dt = _parse_date(date_end)
    if start_dt:
        query = query.filter(Log.created_at >= start_dt)
    if end_dt:
        end_dt = end_dt + timedelta(days=1)
        query = query.filter(Log.created_at < end_dt)

    rows = query.order_by(Log.created_at.desc()).all()

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["Timestamp", "Actor", "Role", "Action", "Entity", "Outcome", "Message"])

    for log, actor_row in rows:
        writer.writerow(
            [
                log.created_at.isoformat(),
                actor_row.username if actor_row else "",
                log.actor_role or "",
                log.action,
                f"{log.entity_type}:{log.entity_id}" if log.entity_type else "",
                log.outcome,
                log.message or "",
            ]
        )

    buffer.seek(0)
    filename = f"audit-log-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}.csv"

    _log_admin_action(
        db,
        ctx=ctx,
        action="export_logs",
        entity_type="log",
        entity_id=None,
        metadata={"rows": len(rows)},
    )

    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/settings", response_model=schemas.AdminSettingsResponse)
def get_settings(
    ctx: AdminContext = Depends(get_admin_context),
    db: Session = Depends(get_db),
) -> schemas.AdminSettingsResponse:
    settings = db.query(models.AdminSetting).all()
    values = {setting.key: setting.value for setting in settings}
    return schemas.AdminSettingsResponse(values=values)


@router.put("/settings", response_model=schemas.AdminSettingsResponse)
def update_settings(
    payload: schemas.AdminSettingsUpdateRequest,
    ctx: AdminContext = Depends(get_admin_context),
    db: Session = Depends(get_db),
) -> schemas.AdminSettingsResponse:
    ctx.require("settings:write")

    now = datetime.utcnow()
    for key, value in payload.values.items():
        setting = (
            db.query(models.AdminSetting)
            .filter(models.AdminSetting.key == key)
            .first()
        )
        if setting:
            setting.value = value
            setting.updated_at = now
            setting.updated_by = ctx.user.id
        else:
            db.add(
                models.AdminSetting(
                    key=key,
                    value=value,
                    updated_at=now,
                    updated_by=ctx.user.id,
                )
            )

    db.commit()

    _log_admin_action(
        db,
        ctx=ctx,
        action="update_settings",
        entity_type="settings",
        entity_id=None,
        metadata={"keys": list(payload.values.keys())},
    )

    return get_settings(ctx=ctx, db=db)


@router.get("/search")
def global_search(
    q: str = Query(..., min_length=2),
    scope: Optional[str] = Query(None),
    ctx: AdminContext = Depends(get_admin_context),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    if not q:
        raise HTTPException(status_code=400, detail="Query cannot be empty")

    pattern = f"%{q}%"
    results: Dict[str, List[Dict[str, Any]]] = {}

    scopes = {scope.lower()} if scope else {"bookings", "devices", "users", "topologies"}

    if "bookings" in scopes:
        rows = (
            db.query(models.Booking.booking_id, models.User.username, models.Device.deviceName)
            .join(models.User, models.Booking.user_id == models.User.id)
            .join(models.Device, models.Booking.device_id == models.Device.id)
            .filter(
                or_(
                    models.User.username.ilike(pattern),
                    models.Device.deviceName.ilike(pattern),
                    models.Device.deviceType.ilike(pattern),
                )
            )
            .limit(10)
            .all()
        )
        results["bookings"] = [
            {"id": booking_id, "label": f"{username} – {device_name}"}
            for booking_id, username, device_name in rows
        ]

    if "devices" in scopes:
        rows = (
            db.query(models.Device.id, models.Device.deviceName, models.Device.deviceType)
            .filter(
                or_(
                    models.Device.deviceName.ilike(pattern),
                    models.Device.deviceType.ilike(pattern),
                )
            )
            .limit(10)
            .all()
        )
        results["devices"] = [
            {"id": device_id, "label": f"{device_type} – {device_name}"}
            for device_id, device_name, device_type in rows
        ]

    if "users" in scopes:
        rows = (
            db.query(models.User.id, models.User.username, models.User.email)
            .filter(
                or_(
                    models.User.username.ilike(pattern),
                    models.User.email.ilike(pattern),
                )
            )
            .limit(10)
            .all()
        )
        results["users"] = [
            {"id": user_id, "label": username, "email": email}
            for user_id, username, email in rows
        ]

    if "topologies" in scopes:
        rows = (
            db.query(models.Topology.id, models.Topology.name)
            .filter(models.Topology.name.ilike(pattern))
            .limit(10)
            .all()
        )
        results["topologies"] = [
            {"id": topology_id, "label": name} for topology_id, name in rows
        ]

    return results

