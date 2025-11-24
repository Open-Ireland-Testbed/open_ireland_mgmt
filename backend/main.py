# main.py
from fastapi import (
    FastAPI,
    Depends,
    HTTPException,
    Request,
    Response,
    BackgroundTasks,
    Query,
)
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware
from starlette.responses import JSONResponse

from sqlalchemy.exc import IntegrityError
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy import or_, and_, text, bindparam, inspect
from sqlalchemy.orm import Session

from backend.scheduler import models, schemas
import asyncio
import os
import logging

logger = logging.getLogger(__name__)

from backend.core.database import engine, Base
from backend.core.hash import hash_password, verify_password
from backend.core.deps import get_db
from backend.scheduler.schemas import (
    BookingsRequest,
    CollaboratorsUpdate,
    RebookRequest,
    ExtendBookingRequest,
    GroupActionRequest,
    GroupExtendRequest,
    GroupRebookRequest,
    BookingCancelRequest,
    BookingFavoriteCreate,
    BookingFavoriteUpdate,
)

from datetime import datetime
from datetime import timedelta
import uuid
from zoneinfo import ZoneInfo

from typing import List, Optional, Iterable

from backend.scheduler.routers.admin import router as admin_router
from backend.scheduler.routers.admin_v2 import router as admin_v2_router
from backend.scheduler.routers.control_panel import router as control_panel_router
from backend.core.discord_utils import send_booking_created_notification

# Import inventory management router
from backend.inventory.router import router as inventory_router
from backend.inventory import models as inventory_models  # noqa: F401

_TZ = ZoneInfo("Europe/Dublin")

app = FastAPI()

# Create all database tables on startup (scheduler models + inventory models)
# NOTE: This is a breaking change for inventory schema:
# - Old tables (inventory_items, inventory_history, inventory_reservations, inventory_tags) are no longer created
# - New tables (devices, device_types, manufacturers, sites, tags, device_tags, device_history) are created
# - Existing inventory data may need to be dropped or migrated manually
@app.on_event("startup")
async def create_tables():
    """Create database tables on application startup"""
    # Determine if we're in development/debug mode
    # In dev mode, fail fast on schema errors to catch issues early
    # In production, log and continue to avoid breaking running services
    is_debug = os.getenv("DEBUG", "False").lower() in ("true", "1", "yes")
    is_docker_dev = os.getenv("DOCKER_ENV", "").lower() == "dev"
    fail_fast = is_debug or is_docker_dev
    
    try:
        Base.metadata.create_all(bind=engine)
        logger.info("Database tables created successfully")
    except Exception as e:
        logger.error(f"Error creating database tables: {e}")
        if fail_fast:
            # In development/debug mode, fail fast to catch schema issues immediately
            logger.error("Failing startup due to table creation error (DEBUG mode)")
            raise
        else:
            # In production, log and continue - tables might already exist or be managed externally
            logger.warning("Continuing startup despite table creation error (production mode)")
            pass


app.include_router(admin_router)
app.include_router(admin_v2_router)
app.include_router(control_panel_router)
try:
    app.include_router(inventory_router, prefix="/api/inventory", tags=["inventory"])
except Exception as exc:
    logger.exception("Failed to include inventory router: %s", exc)
    raise
# Read frontend URL from environment variable, default to port 25001
frontend_url = os.getenv("FRONTEND_URL", "http://localhost:25001")
# Allow both the configured frontend URL and common development URLs
# Also allow requests from any hostname on the allowed ports (for Docker/remote access)
origins = [
    frontend_url,
    "http://localhost:25001",  # Scheduler frontend
    "http://localhost:25002",  # Inventory frontend
    "http://localhost:3000",   # Legacy/fallback
    "http://localhost:3001",   # Legacy/fallback
    # Allow any hostname on port 25001 (for remote access)
    "http://*:25001",
    "http://*:25002",
]
# For production, you might want to be more specific with allowed origins


app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"http://.*:(25001|25002|3000|3001)",  # Allow any hostname on these ports
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],  # Expose all headers including Set-Cookie
)

app.add_middleware(
    SessionMiddleware,
    secret_key="some-secret-key",
    session_cookie="session_id",
    max_age=3600 * 24 * 7,
    same_site="lax",  # Use "lax" for same-site requests (works for same domain, different ports)
    https_only=False,  # Allow cookies over HTTP for development
)


# Database dependency is now imported from deps.py


def _resolve_collaborators(
    db: Session, owner_username: str, collaborator_usernames: List[str]
) -> tuple[List[str], List[models.User]]:
    cleaned: List[str] = []
    seen = set()
    for raw in collaborator_usernames or []:
        if not raw:
            continue
        name = raw.strip()
        if not name:
            continue
        lower = name.lower()
        if lower == owner_username.lower():
            continue
        if lower in seen:
            continue
        seen.add(lower)
        cleaned.append(name)

    if not cleaned:
        return [], []

    users = db.query(models.User).filter(models.User.username.in_(cleaned)).all()
    found_map = {u.username: u for u in users}
    missing = sorted(set(cleaned) - set(found_map.keys()))
    if missing:
        raise HTTPException(
            status_code=400,
            detail="Collaborator{} {} not found.".format(
                "" if len(missing) == 1 else "s",
                ", ".join(missing),
            ),
        )

    ordered_names = sorted(found_map.keys(), key=lambda n: n.lower())
    ordered_users = [found_map[name] for name in ordered_names]
    return ordered_names, ordered_users


def _fetch_collaborator_rows_for_slot(
    db: Session, booking: models.Booking
) -> List[models.Booking]:
    return (
        db.query(models.Booking)
        .filter(
            models.Booking.grouped_booking_id == booking.grouped_booking_id,
            models.Booking.device_id == booking.device_id,
            models.Booking.start_time == booking.start_time,
            models.Booking.end_time == booking.end_time,
            models.Booking.is_collaborator.is_(True),
        )
        .all()
    )


def _create_collaborator_copies(
    db: Session,
    owner_booking: models.Booking,
    collaborator_users: List[models.User],
) -> int:
    created = 0
    for collaborator in collaborator_users:
        db.add(
            models.Booking(
                device_id=owner_booking.device_id,
                user_id=collaborator.id,
                is_collaborator=True,
                grouped_booking_id=owner_booking.grouped_booking_id,
                start_time=owner_booking.start_time,
                end_time=owner_booking.end_time,
                status=owner_booking.status,
                comment=owner_booking.comment,
                collaborators=None,
            )
        )
        created += 1
    return created


def _favorite_to_dict(favorite: models.BookingFavorite) -> dict:
    return {
        "id": favorite.id,
        "user_id": favorite.user_id,
        "name": favorite.name,
        "grouped_booking_id": favorite.grouped_booking_id,
        "device_snapshot": favorite.device_snapshot,
        "created_at": favorite.created_at.isoformat() if favorite.created_at else None,
        "updated_at": favorite.updated_at.isoformat() if favorite.updated_at else None,
    }


_DEVICE_BOOKING_SUPPORT: Optional[bool] = None


def _device_booking_supported(db: Session) -> bool:
    global _DEVICE_BOOKING_SUPPORT
    if _DEVICE_BOOKING_SUPPORT is not None:
        return _DEVICE_BOOKING_SUPPORT
    try:
        inspector = inspect(db.bind)
        _DEVICE_BOOKING_SUPPORT = "device_booking" in inspector.get_table_names()
    except Exception as exc:
        logger.warning("Failed to inspect device_booking table: %s", exc)
        _DEVICE_BOOKING_SUPPORT = False
    return _DEVICE_BOOKING_SUPPORT


def _delete_device_booking_rows(db: Session, booking_ids: Iterable[int]) -> None:
    ids = list(booking_ids)
    if not ids:
        return
    if not _device_booking_supported(db):
        return
    try:
        stmt = text(
            "DELETE FROM device_booking WHERE booking_id IN :booking_ids"
        ).bindparams(bindparam("booking_ids", expanding=True))
        db.execute(stmt, {"booking_ids": ids})
    except Exception as exc:
        logger.warning(
            "Unable to delete device_booking rows for booking_ids=%s: %s", ids, exc
        )


# ================== Check Session ==================
@app.get("/session")
def get_session(request: Request, db: Session = Depends(get_db)):
    user_id = request.session.get("user_id")
    if user_id:
        user = db.query(models.User).get(user_id)
        if user:
            return {"logged_in": True, "user_id": user.id, "username": user.username}
    return {"logged_in": False}


@app.get("/api/auth/me")
def get_current_user(request: Request, db: Session = Depends(get_db)):
    user_id = request.session.get("user_id")
    if not user_id:
        return JSONResponse({"authenticated": False}, status_code=401)

    user = db.query(models.User).get(user_id)
    if not user:
        request.session.clear()
        return JSONResponse({"authenticated": False}, status_code=401)

    return {
        "authenticated": True,
        "user_id": user.id,
        "username": user.username,
        "is_admin": bool(getattr(user, "is_admin", False)),
        "email": user.email,
    }


@app.get("/users/search")
@app.get("/api/users/search")
def search_users(q: str, limit: int = 10, db: Session = Depends(get_db)):
    if not q or not q.strip():
        return []

    limit = max(1, min(limit, 20))
    query = q.strip()

    users = (
        db.query(models.User)
        .filter(models.User.username.ilike(f"%{query}%"))
        .order_by(models.User.username.asc())
        .limit(limit)
        .all()
    )

    return [{"id": u.id, "username": u.username} for u in users]


# ================ Public Devices Endpoint (View Only) ================
@app.get("/api/devices")
@app.get("/devices")
def get_devices(request: Request, db: Session = Depends(get_db)):
    """
    Get all devices - public endpoint for viewing devices.
    All authenticated users can view devices to make bookings.
    Only admins can manage devices (via /admin/devices).
    """
    user_id = request.session.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    devices = db.query(models.Device).all()
    return devices


# ================ Client Registration ================
@app.post("/users/register", response_model=schemas.User)
def register_user(
    user: schemas.UserCreate, db: Session = Depends(get_db), request: Request = None
):

    # Check if username is taken
    existing_user = (
        db.query(models.User).filter(models.User.username == user.username).first()
    )
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already taken.")

    # Hash the password
    # Client sends SHA256 hash, so we store bcrypt(SHA256) for security
    # This way verify_password(SHA256, bcrypt(SHA256)) will work
    hashed_pass = hash_password(user.password)

    # Create new user
    new_user = models.User(
        username=user.username,
        email=user.email,
        password=hashed_pass,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    # Set the session
    request.session["user_id"] = new_user.id

    return new_user


# ================ User Login ================
@app.post("/login")
def login_user(
    login_data: schemas.UserLogin,
    db: Session = Depends(get_db),
    request: Request = None,
):

    user = (
        db.query(models.User)
        .filter(models.User.username == login_data.username)
        .first()
    )
    
    if not user:
        raise HTTPException(status_code=400, detail="Invalid username or password")
    
    # Client sends SHA256 hashed password
    # Check if stored password is bcrypt (starts with $2b$) or SHA256 (64 hex chars)
    password_valid = False
    
    if user.password.startswith('$2b$'):
        # Old bcrypt format - the old system likely stored bcrypt(SHA256(plain_password))
        # So we verify the received SHA256 hash against the bcrypt hash
        # verify_password(plain_password, bcrypt_hash) compares plain with bcrypt
        # Here: login_data.password is SHA256, user.password is bcrypt(SHA256)
        password_valid = verify_password(login_data.password, user.password)
    else:
        # SHA256 format - compare hashes directly (login_data.password is already SHA256 from client)
        password_valid = (login_data.password == user.password)

    if not password_valid:
        raise HTTPException(status_code=400, detail="Invalid username or password")

    # Store the user_id in Session
    request.session["user_id"] = user.id
    logger.info(f"User {user.username} (ID: {user.id}) logged in successfully. Session set.")

    return {"message": "Sign in successful", "user_id": user.id}


# ================ User Logout ================
@app.post("/logout")
def logout_user(request: Request, response: Response):
    request.session.clear()

    response = JSONResponse({"message": "Signed out successfully"})
    response.delete_cookie("session_id")
    return response


# ================ Bookings: Single & Multiple Time Slot ================
@app.post("/bookings")
@app.post("/api/bookings")
async def create_bookings(
    req: BookingsRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    # Check if the user exists
    user = db.query(models.User).get(req.user_id)
    if not user:
        raise HTTPException(status_code=400, detail="User not found")

    collaborator_usernames, collaborator_users = _resolve_collaborators(
        db, user.username, req.collaborators or []
    )

    if not req.bookings:
        raise HTTPException(status_code=400, detail="No booking slots provided.")

    grouped_booking_id = req.grouped_booking_id or str(uuid.uuid4())
    count_inserted = 0
    try:
        for b in req.bookings:
            # Use with_for_update to lock this recording
            device = (
                db.query(models.Device)
                .filter(
                    models.Device.deviceType == b.device_type,
                    models.Device.deviceName == b.device_name,
                )
                .with_for_update()
                .first()
            )

            # if this booking doesn't exist
            if not device:
                try:
                    device = models.Device(
                        deviceType=b.device_type,
                        deviceName=b.device_name,
                        status="Available",
                        Out_Port=0,  # Default port values for topology-created devices
                        In_Port=0,
                    )
                    db.add(device)
                    db.flush()
                except IntegrityError:
                    db.rollback()
                    device = (
                        db.query(models.Device)
                        .filter(
                            models.Device.deviceType == b.device_type,
                            models.Device.deviceName == b.device_name,
                        )
                        .with_for_update()
                        .first()
                    )
                except SQLAlchemyError as e:
                    db.rollback()
                    raise HTTPException(status_code=500, detail="Database error")

            # Create this booking
            new_booking = models.Booking(
                device_id=device.id,
                user_id=user.id,
                is_collaborator=False,
                start_time=b.start_time,
                end_time=b.end_time,
                status=b.status,
                comment=req.message,
                collaborators=collaborator_usernames
                if collaborator_usernames
                else None,
                grouped_booking_id=grouped_booking_id,
            )
            db.add(new_booking)
            count_inserted += 1

            if collaborator_users:
                count_inserted += _create_collaborator_copies(
                    db, new_booking, collaborator_users
                )

        db.commit()

        first_slot_str = req.bookings[0].start_time.strftime("%d/%m/%Y %H:%M")
        last_slot_str = req.bookings[-1].end_time.strftime("%d/%m/%Y %H:%M")

        # Get the devices booked
        unique_devices = sorted(
            {f"{b.device_type} - {b.device_name}" for b in req.bookings}
        )

        number_devices = len(unique_devices)

        # Check if need admin's intervention
        action_required = any(b.status.upper() == "CONFLICTING" for b in req.bookings)

        # Messages will be sent to admin through discord
        collaborators_str = (
            ", ".join(collaborator_usernames) if collaborator_usernames else "None"
        )

        content = (
            ":bell: **New Booking Created**\n"
            f"> User: **{user.username}**\n"
            f"> Action Required: **{'**🔴 Yes**' if action_required else '**🟢 No**'}**\n"
            f"> Number of devices requested: **{number_devices}**\n"
            f"> Devices: **{', '.join(unique_devices)}**\n"
            f"> First slot: **{first_slot_str}**\n"
            f"> Last slot: **{last_slot_str}**\n"
            f"> Collaborators: **{collaborators_str}**\n"
            f"> Message: {req.message or 'None'}"
        )

    except HTTPException as he:
        db.rollback()
        raise he
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

    background_tasks.add_task(send_booking_created_notification, content)

    return {
        "message": f"Created {count_inserted} booking(s) successfully.",
        "count": count_inserted,
        "grouped_booking_id": grouped_booking_id,
    }


# ================ Cancel Bookings ================
@app.put("/bookings/{booking_id}/cancel")
@app.put("/api/bookings/{booking_id}/cancel")
def cancel_booking(
    booking_id: int,
    payload: Optional[BookingCancelRequest] = None,
    request: Request = None,
    db: Session = Depends(get_db),
):
    booking = db.query(models.Booking).get(booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found.")

    owner_booking = (
        db.query(models.Booking)
        .filter(
            models.Booking.grouped_booking_id == booking.grouped_booking_id,
            models.Booking.device_id == booking.device_id,
            models.Booking.start_time == booking.start_time,
            models.Booking.end_time == booking.end_time,
            models.Booking.is_collaborator.is_(False),
        )
        .first()
    )
    if not owner_booking and not booking.is_collaborator:
        owner_booking = booking

    if not owner_booking:
        raise HTTPException(
            status_code=400,
            detail="Unable to locate booking owner for this reservation.",
        )

    acting_user_id = None
    if payload and payload.user_id is not None:
        acting_user_id = payload.user_id
    elif request is not None:
        acting_user_id = request.session.get("user_id")

    if acting_user_id is None:
        raise HTTPException(
            status_code=400, detail="User ID is required to cancel this booking."
        )

    if acting_user_id != owner_booking.user_id:
        raise HTTPException(
            status_code=403, detail="Only the booking owner can cancel this booking."
        )

    related_bookings = (
        db.query(models.Booking)
        .filter(
            models.Booking.grouped_booking_id == booking.grouped_booking_id,
            models.Booking.device_id == booking.device_id,
            models.Booking.start_time == booking.start_time,
            models.Booking.end_time == booking.end_time,
        )
        .all()
    )

    if all(rb.status == "CANCELLED" for rb in related_bookings):
        raise HTTPException(status_code=400, detail="Booking is already cancelled")

    updated_booking_ids: List[int] = []
    for record in related_bookings:
        if record.status != "CANCELLED":
            record.status = "CANCELLED"
            updated_booking_ids.append(record.booking_id)

    if updated_booking_ids:
        _delete_device_booking_rows(db, updated_booking_ids)
    db.commit()

    # Then re-check the same time-slot of device, if there is only one booking, change it to be pending
    overlapping = (
        db.query(models.Booking)
        .filter(
            models.Booking.device_id == booking.device_id,
            models.Booking.start_time < booking.end_time,
            models.Booking.end_time > booking.start_time,
            models.Booking.is_collaborator.is_(False),
            models.Booking.status.notin_(["CANCELLED", "EXPIRED"]),
        )
        .all()
    )

    if len(overlapping) == 1:
        remaining = overlapping[0]
        if remaining.status == "CONFLICTING":
            remaining.status = "PENDING"
            db.commit()

    return {"message": f"Booking {booking_id} has been cancelled"}


@app.patch("/bookings/{booking_id}/collaborators")
@app.patch("/api/bookings/{booking_id}/collaborators")
def update_booking_collaborators(
    booking_id: int,
    payload: CollaboratorsUpdate,
    db: Session = Depends(get_db),
):
    target_ids = payload.booking_ids or [booking_id]
    bookings = (
        db.query(models.Booking).filter(models.Booking.booking_id.in_(target_ids)).all()
    )
    if not bookings:
        raise HTTPException(status_code=404, detail="Booking not found.")

    owner = db.query(models.User).get(payload.owner_id)
    if not owner:
        raise HTTPException(status_code=404, detail="Owner not found.")

    owner_bookings = [b for b in bookings if not b.is_collaborator]
    if not owner_bookings:
        raise HTTPException(
            status_code=400,
            detail="Unable to update collaborators without owner bookings.",
        )

    for booking in owner_bookings:
        if booking.user_id != payload.owner_id:
            raise HTTPException(
                status_code=403,
                detail="Only the booking owner can update collaborators.",
            )
        if booking.status and booking.status.upper() == "CANCELLED":
            raise HTTPException(
                status_code=400, detail="Cannot update a cancelled booking."
            )

    collaborator_usernames, collaborator_users = _resolve_collaborators(
        db, owner.username, payload.collaborators or []
    )

    for owner_booking in owner_bookings:
        owner_booking.collaborators = (
            collaborator_usernames if collaborator_usernames else None
        )

        related_collaborators = _fetch_collaborator_rows_for_slot(db, owner_booking)
        existing_map = {row.user_id: row for row in related_collaborators}
        desired_ids = {user.id for user in collaborator_users}

        for user_id, row in list(existing_map.items()):
            if user_id not in desired_ids:
                db.delete(row)

        missing_users = [
            collaborator
            for collaborator in collaborator_users
            if collaborator.id not in existing_map
        ]
        if missing_users:
            _create_collaborator_copies(db, owner_booking, missing_users)

    db.commit()

    return {
        "message": "Collaborators updated successfully.",
        "collaborators": collaborator_usernames,
    }


@app.post("/bookings/rebook/{booking_id}")
def rebook_booking(
    booking_id: int,
    payload: RebookRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    base_booking = db.query(models.Booking).get(booking_id)
    if not base_booking:
        raise HTTPException(status_code=404, detail="Booking not found.")

    requester = db.query(models.User).get(payload.user_id)
    if not requester:
        raise HTTPException(status_code=404, detail="Requesting user not found.")

    target_ids = payload.booking_ids or [booking_id]
    bookings = (
        db.query(models.Booking).filter(models.Booking.booking_id.in_(target_ids)).all()
    )
    if not bookings:
        raise HTTPException(status_code=404, detail="Booking not found.")

    owner_id = base_booking.user_id
    owner = base_booking.user
    if any(b.user_id != owner_id for b in bookings):
        raise HTTPException(
            status_code=400, detail="All bookings must belong to the same owner."
        )

    allowed_users = {owner.username} if owner else set()
    if base_booking.collaborators:
        allowed_users.update(base_booking.collaborators)

    if requester.id != owner_id and requester.username not in allowed_users:
        raise HTTPException(
            status_code=403,
            detail="You do not have permission to rebook these devices.",
        )

    if payload.end_date < payload.start_date:
        raise HTTPException(
            status_code=400, detail="End date must be after the start date."
        )

    original_start_date = min(b.start_time.date() for b in bookings)
    original_end_date = max(b.end_time.date() for b in bookings)
    original_span = original_end_date - original_start_date
    requested_span = payload.end_date - payload.start_date
    if requested_span < original_span:
        raise HTTPException(
            status_code=400,
            detail="The new date range must be at least as long as the original booking window.",
        )

    day_offset = (payload.start_date - original_start_date).days

    collaborators_set = set(base_booking.collaborators or [])
    if owner and owner.username:
        collaborators_set.add(owner.username)
    collaborators_set.discard(requester.username)
    collaborators = sorted(collaborators_set)

    created = 0
    try:
        new_bookings = []
        for booking in owner_bookings:
            new_start = booking.start_time + timedelta(days=day_offset)
            duration = booking.end_time - booking.start_time
            new_end = new_start + duration

            if new_end.date() > payload.end_date:
                raise HTTPException(
                    status_code=400,
                    detail="Requested end date is too early for the original booking duration.",
                )

            conflict = (
                db.query(models.Booking)
                .filter(
                    models.Booking.device_id == booking.device_id,
                    models.Booking.booking_id.notin_(target_ids),
                    models.Booking.is_collaborator.is_(False),
                    models.Booking.status.notin_(["CANCELLED", "EXPIRED", "REJECTED"]),
                    models.Booking.start_time < new_end,
                    models.Booking.end_time > new_start,
                )
                .first()
            )
            if conflict:
                raise HTTPException(
                    status_code=409,
                    detail=(
                        f"Device '{booking.device.deviceName}' is already booked "
                        "within the requested time range."
                    ),
                )

            new_booking = models.Booking(
                device_id=booking.device_id,
                user_id=requester.id,
                is_collaborator=False,
                start_time=new_start,
                end_time=new_end,
                status="PENDING",
                comment=payload.message or booking.comment,
                collaborators=collaborator_usernames
                if collaborator_usernames
                else None,
            )
            db.add(new_booking)
            new_bookings.append(new_booking)
            created += 1

            if collaborator_users:
                created += _create_collaborator_copies(
                    db, new_booking, collaborator_users
                )

        db.commit()

        if new_bookings:
            devices_summary = sorted(
                {b.device.deviceType + " - " + b.device.deviceName for b in bookings}
            )
            content = (
                ":repeat: **Booking Re-created**\n"
                f"> User: **{requester.username}**\n"
                f"> Devices: **{', '.join(devices_summary)}**\n"
                f"> New window: **{payload.start_date.isoformat()} → {payload.end_date.isoformat()}**\n"
                f"> Collaborators: **{', '.join(collaborator_usernames) if collaborator_usernames else 'None'}**\n"
                f"> Message: {payload.message or owner_reference.comment or 'None'}"
            )
            background_tasks.add_task(send_booking_created_notification, content)

    except Exception:
        db.rollback()
        raise

    return {
        "message": f"Created {created} booking(s) successfully.",
        "count": created,
    }


@app.patch("/bookings/{booking_id}/extend")
def extend_booking(
    booking_id: int,
    payload: ExtendBookingRequest,
    db: Session = Depends(get_db),
):
    base_booking = db.query(models.Booking).get(booking_id)
    if not base_booking:
        raise HTTPException(status_code=404, detail="Booking not found.")

    requester = db.query(models.User).get(payload.user_id)
    if not requester:
        raise HTTPException(status_code=404, detail="Requesting user not found.")

    target_ids = payload.booking_ids or [booking_id]
    bookings = (
        db.query(models.Booking).filter(models.Booking.booking_id.in_(target_ids)).all()
    )
    if not bookings:
        raise HTTPException(status_code=404, detail="Booking not found.")

    owner_reference = (
        base_booking
        if not base_booking.is_collaborator
        else db.query(models.Booking)
        .filter(
            models.Booking.grouped_booking_id == base_booking.grouped_booking_id,
            models.Booking.device_id == base_booking.device_id,
            models.Booking.start_time == base_booking.start_time,
            models.Booking.end_time == base_booking.end_time,
            models.Booking.is_collaborator.is_(False),
        )
        .first()
    )
    if not owner_reference:
        raise HTTPException(
            status_code=400,
            detail="Unable to locate booking owner for this reservation.",
        )

    owner_id = owner_reference.user_id
    owner = owner_reference.user

    owner_bookings = [b for b in bookings if not b.is_collaborator]
    if not owner_bookings:
        owner_bookings = [owner_reference]

    if any(b.user_id != owner_id for b in owner_bookings):
        raise HTTPException(
            status_code=400, detail="All bookings must belong to the same owner."
        )

    allowed_users = {owner.username} if owner else set()
    if owner_reference.collaborators:
        allowed_users.update(owner_reference.collaborators)

    if requester.id != owner_id and requester.username not in allowed_users:
        raise HTTPException(
            status_code=403,
            detail="You do not have permission to extend these bookings.",
        )

    new_end_date = payload.new_end_date

    updated = 0
    try:
        for booking in owner_bookings:
            if new_end_date < booking.end_time.date():
                raise HTTPException(
                    status_code=400,
                    detail="New end date must be after the current booking end date.",
                )

            new_end = datetime.combine(new_end_date, booking.end_time.time()).replace(
                tzinfo=booking.end_time.tzinfo
            )

            if new_end <= booking.start_time:
                raise HTTPException(
                    status_code=400,
                    detail="New end time must be after the booking start time.",
                )

            related_collaborators = _fetch_collaborator_rows_for_slot(db, booking)

            conflict = (
                db.query(models.Booking)
                .filter(
                    models.Booking.device_id == booking.device_id,
                    models.Booking.booking_id.notin_(target_ids),
                    models.Booking.is_collaborator.is_(False),
                    models.Booking.status.notin_(["CANCELLED", "EXPIRED", "REJECTED"]),
                    models.Booking.start_time < new_end,
                    models.Booking.end_time > booking.end_time,
                )
                .first()
            )
            if conflict:
                raise HTTPException(
                    status_code=409,
                    detail=(
                        f"Device '{booking.device.deviceName}' is already booked "
                        "within the requested extension period."
                    ),
                )

            booking.end_time = new_end
            for collaborator_booking in related_collaborators:
                collaborator_booking.end_time = new_end
            updated += 1

        db.commit()
    except Exception:
        db.rollback()
        raise

    return {
        "message": f"Extended {updated} booking(s) successfully.",
        "count": updated,
    }


@app.delete("/api/bookings/group/{grouped_booking_id}")
def cancel_booking_group(
    grouped_booking_id: str,
    payload: GroupActionRequest,
    db: Session = Depends(get_db),
):
    bookings = (
        db.query(models.Booking)
        .filter(models.Booking.grouped_booking_id == grouped_booking_id)
        .all()
    )
    if not bookings:
        raise HTTPException(status_code=404, detail="Booking group not found.")

    owner_booking = next((b for b in bookings if not b.is_collaborator), None)
    if not owner_booking:
        raise HTTPException(
            status_code=400,
            detail="Unable to locate booking owner for this group.",
        )

    if payload.user_id != owner_booking.user_id:
        raise HTTPException(
            status_code=403,
            detail="Only the booking owner can cancel this booking group.",
        )

    updated_booking_ids: List[int] = []
    for booking in bookings:
        if booking.status != "CANCELLED":
            booking.status = "CANCELLED"
            updated_booking_ids.append(booking.booking_id)

    if updated_booking_ids:
        _delete_device_booking_rows(db, updated_booking_ids)
    db.commit()

    return {
        "message": f"Cancelled booking group {grouped_booking_id}.",
        "count": len(bookings),
    }


@app.patch("/api/bookings/group/{grouped_booking_id}/extend")
def extend_booking_group(
    grouped_booking_id: str,
    payload: GroupExtendRequest,
    db: Session = Depends(get_db),
):
    all_bookings = (
        db.query(models.Booking)
        .filter(models.Booking.grouped_booking_id == grouped_booking_id)
        .all()
    )
    if not all_bookings:
        raise HTTPException(status_code=404, detail="Booking group not found.")

    owner_booking = next((b for b in all_bookings if not b.is_collaborator), None)
    if not owner_booking:
        raise HTTPException(
            status_code=400,
            detail="Unable to locate booking owner for this group.",
        )

    if payload.user_id != owner_booking.user_id:
        raise HTTPException(
            status_code=403,
            detail="Only the booking owner can extend this booking group.",
        )

    owner_bookings = [b for b in all_bookings if not b.is_collaborator]

    current_end_date = max(booking.end_time.date() for booking in owner_bookings)
    if payload.new_end_date <= current_end_date:
        raise HTTPException(
            status_code=400,
            detail="New end date must be after the current booking range.",
        )

    templates = {}
    for booking in owner_bookings:
        if booking.device_id not in templates:
            templates[booking.device_id] = booking

    added = 0
    collaborator_cache: dict[tuple[str, ...], tuple[List[str], List[models.User]]] = {}
    try:
        for device_id, template in templates.items():
            start_time_template = template.start_time
            duration = template.end_time - template.start_time

            next_date = current_end_date + timedelta(days=1)
            while next_date <= payload.new_end_date:
                start_dt = datetime.combine(next_date, start_time_template.time())
                if start_time_template.tzinfo:
                    start_dt = start_dt.replace(tzinfo=start_time_template.tzinfo)
                end_dt = start_dt + duration

                conflict = (
                    db.query(models.Booking)
                    .filter(
                        models.Booking.device_id == device_id,
                        models.Booking.is_collaborator.is_(False),
                        models.Booking.status.notin_(
                            ["CANCELLED", "EXPIRED", "REJECTED"]
                        ),
                        models.Booking.start_time < end_dt,
                        models.Booking.end_time > start_dt,
                    )
                    .first()
                )
                if conflict:
                    raise HTTPException(
                        status_code=409,
                        detail=(
                            f"Device '{template.device.deviceName}' is already booked "
                            "within the requested extension period."
                        ),
                    )

                new_booking = models.Booking(
                    device_id=device_id,
                    user_id=owner_booking.user_id,
                    is_collaborator=False,
                    start_time=start_dt,
                    end_time=end_dt,
                    status="PENDING",
                    comment=template.comment,
                    collaborators=template.collaborators,
                    grouped_booking_id=grouped_booking_id,
                )
                db.add(new_booking)
                added += 1

                collaborator_names = tuple(sorted(template.collaborators or []))
                if collaborator_names:
                    if collaborator_names not in collaborator_cache:
                        collaborator_cache[collaborator_names] = _resolve_collaborators(
                            db,
                            template.user.username
                            if template.user
                            else owner_booking.user.username,
                            list(collaborator_names),
                        )
                    collaborator_usernames, collaborator_users = collaborator_cache[
                        collaborator_names
                    ]
                    new_booking.collaborators = (
                        collaborator_usernames if collaborator_usernames else None
                    )
                    added += _create_collaborator_copies(
                        db, new_booking, collaborator_users
                    )
                else:
                    new_booking.collaborators = None
                next_date += timedelta(days=1)

        db.commit()
    except Exception:
        db.rollback()
        raise

    return {
        "message": f"Extended booking group {grouped_booking_id} by {added} slot(s).",
        "count": added,
    }


@app.post("/api/bookings/group/{grouped_booking_id}/rebook")
def rebook_booking_group(
    grouped_booking_id: str,
    payload: GroupRebookRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    all_bookings = (
        db.query(models.Booking)
        .filter(models.Booking.grouped_booking_id == grouped_booking_id)
        .all()
    )
    if not all_bookings:
        raise HTTPException(status_code=404, detail="Booking group not found.")

    owner_booking = next((b for b in all_bookings if not b.is_collaborator), None)
    if not owner_booking:
        raise HTTPException(
            status_code=400,
            detail="Unable to locate booking owner for this group.",
        )

    if payload.user_id != owner_booking.user_id:
        raise HTTPException(
            status_code=403,
            detail="Only the booking owner can rebook this booking group.",
        )

    if payload.end_date < payload.start_date:
        raise HTTPException(
            status_code=400, detail="End date must be after start date."
        )

    templates = {}
    owner_bookings = [b for b in all_bookings if not b.is_collaborator]
    for booking in owner_bookings:
        if booking.device_id not in templates:
            templates[booking.device_id] = booking

    new_grouped_id = str(uuid.uuid4())
    created = 0
    collaborator_cache: dict[tuple[str, ...], tuple[List[str], List[models.User]]] = {}
    try:
        current_date = payload.start_date
        while current_date <= payload.end_date:
            for device_id, template in templates.items():
                start_dt = datetime.combine(current_date, template.start_time.time())
                if template.start_time.tzinfo:
                    start_dt = start_dt.replace(tzinfo=template.start_time.tzinfo)
                end_dt = start_dt + (template.end_time - template.start_time)

                conflict = (
                    db.query(models.Booking)
                    .filter(
                        models.Booking.device_id == device_id,
                        models.Booking.is_collaborator.is_(False),
                        models.Booking.status.notin_(
                            ["CANCELLED", "EXPIRED", "REJECTED"]
                        ),
                        models.Booking.start_time < end_dt,
                        models.Booking.end_time > start_dt,
                    )
                    .first()
                )
                if conflict:
                    raise HTTPException(
                        status_code=409,
                        detail=(
                            f"Device '{template.device.deviceName}' is already booked "
                            "within the requested time range."
                        ),
                    )

                new_booking = models.Booking(
                    device_id=device_id,
                    user_id=owner_booking.user_id,
                    is_collaborator=False,
                    start_time=start_dt,
                    end_time=end_dt,
                    status="PENDING",
                    comment=payload.message or template.comment,
                    collaborators=template.collaborators,
                    grouped_booking_id=new_grouped_id,
                )
                db.add(new_booking)
                created += 1

                collaborator_names = tuple(sorted(template.collaborators or []))
                if collaborator_names:
                    if collaborator_names not in collaborator_cache:
                        collaborator_cache[collaborator_names] = _resolve_collaborators(
                            db,
                            template.user.username
                            if template.user
                            else owner_booking.user.username,
                            list(collaborator_names),
                        )
                    collaborator_usernames, collaborator_users = collaborator_cache[
                        collaborator_names
                    ]
                    new_booking.collaborators = (
                        collaborator_usernames if collaborator_usernames else None
                    )
                    created += _create_collaborator_copies(
                        db, new_booking, collaborator_users
                    )
                else:
                    new_booking.collaborators = None
            current_date += timedelta(days=1)

        db.commit()

        if created > 0:
            devices_summary = sorted(
                {
                    template.device.deviceType + " - " + template.device.deviceName
                    for template in templates.values()
                    if template.device
                }
            )
            owner_user = owner_booking.user
            collaborators = owner_booking.collaborators or []
            content = (
                ":repeat: **Booking Group Re-created**\n"
                f"> User: **{owner_user.username if owner_user else owner_booking.user_id}**\n"
                f"> Devices: **{', '.join(devices_summary)}**\n"
                f"> New window: **{payload.start_date.isoformat()} → {payload.end_date.isoformat()}**\n"
                f"> Collaborators: **{', '.join(collaborators) if collaborators else 'None'}**\n"
                f"> Message: {payload.message or owner_booking.comment or 'None'}"
            )
            background_tasks.add_task(send_booking_created_notification, content)

    except Exception:
        db.rollback()
        raise

    return {
        "message": f"Created {created} booking(s) successfully.",
        "count": created,
        "grouped_booking_id": new_grouped_id,
    }


# ================ Get one user's all bookings  ================


@app.get("/bookings/user/{user_id}")
def get_user_bookings(
    user_id: int,
    grouped: bool = Query(
        False, description="Return grouped booking sessions when true"
    ),
    db: Session = Depends(get_db),
):

    user = db.query(models.User).get(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Update the status of devices that are already expired but have not been updated
    now = datetime.now()
    db.query(models.Booking).filter(
        models.Booking.user_id == user_id,
        models.Booking.end_time < now,
        ~models.Booking.status.in_(
            ["CANCELLED", "EXPIRED"]
        ),  # The current status is not CANCELLED OR EXPIRED, i.e., Has not been marked as cancelled or expired
    ).update({models.Booking.status: "EXPIRED"}, synchronize_session=False)

    db.commit()

    # Query bookings where user is owner or listed as collaborator
    bookings = (
        db.query(models.Booking)
        .filter(
            or_(
                models.Booking.user_id == user_id,
                models.Booking.collaborators != None,  # noqa: E711
            )
        )
        .order_by(models.Booking.created_at.desc(), models.Booking.start_time.asc())
        .all()
    )

    raw_results = []
    groups = {}
    owner_booking_cache: dict[str, Optional[models.Booking]] = {}
    owner_collaborators_cache: dict[str, List[str]] = {}

    def ensure_owner_entry(group_id: str) -> Optional[models.Booking]:
        entry = owner_booking_cache.get(group_id)
        if entry is not None and not entry.is_collaborator:
            return entry
        entry = (
            db.query(models.Booking)
            .filter(
                models.Booking.grouped_booking_id == group_id,
                models.Booking.is_collaborator.is_(False),
            )
            .order_by(models.Booking.booking_id.asc())
            .first()
        )
        owner_booking_cache[group_id] = entry
        owner_collaborators_cache[group_id] = entry.collaborators or [] if entry else []
        return entry

    for booking in bookings:
        group_id = booking.grouped_booking_id
        if not booking.is_collaborator:
            owner_booking_cache[group_id] = booking
            owner_collaborators_cache[group_id] = booking.collaborators or []
            owner_entry = booking
        else:
            owner_entry = owner_booking_cache.get(group_id)
            if owner_entry is None or owner_entry.is_collaborator:
                owner_entry = ensure_owner_entry(group_id)

        collaborators_for_group = owner_collaborators_cache.get(group_id, [])
        effective_collaborators = (
            booking.collaborators
            if booking.collaborators is not None
            else collaborators_for_group
        )
        if effective_collaborators is None:
            effective_collaborators = []

        is_owner = (not booking.is_collaborator) and (booking.user_id == user_id)
        is_collaborator = booking.is_collaborator or (
            not is_owner and user.username in effective_collaborators
        )
        if not is_owner and not is_collaborator:
            continue

        owner_username = (
            owner_entry.user.username if owner_entry and owner_entry.user else None
        )
        owner_id_value = owner_entry.user_id if owner_entry else booking.user_id

        raw_results.append(
            {
                "booking_id": booking.booking_id,
                "device_type": booking.device.deviceType if booking.device else None,
                "device_name": booking.device.deviceName if booking.device else None,
                "ip_address": booking.device.ip_address if booking.device else None,
                "start_time": booking.start_time,
                "end_time": booking.end_time,
                "status": booking.status,
                "collaborators": effective_collaborators,
                "owner_id": owner_id_value,
                "owner_username": owner_username,
                "is_owner": is_owner,
                "is_collaborator": is_collaborator,
                "grouped_booking_id": group_id,
            }
        )

        if not grouped:
            continue

        if group_id not in groups:
            groups[group_id] = {
                "grouped_booking_id": group_id,
                "owner_id": owner_id_value,
                "owner_username": owner_username,
                "collaborators": collaborators_for_group,
                "booking_ids": set(),
                "owner_booking_ids": set(),
                "devices": {},
                "start_date": booking.start_time.date(),
                "end_date": booking.end_time.date(),
                "created_at": booking.created_at,
                "statuses": set(),
                "is_owner": is_owner,
                "is_collaborator": is_collaborator,
            }
        group = groups[group_id]

        if booking.start_time.date() < group["start_date"]:
            group["start_date"] = booking.start_time.date()
        if booking.end_time.date() > group["end_date"]:
            group["end_date"] = booking.end_time.date()

        if booking.created_at < group["created_at"]:
            group["created_at"] = booking.created_at

        group["statuses"].add((booking.status or "").upper())
        combined_collabs = set(group["collaborators"] or [])
        combined_collabs.update(effective_collaborators or [])
        group["collaborators"] = sorted(combined_collabs) if combined_collabs else []
        group["is_collaborator"] = group["is_collaborator"] or is_collaborator
        group["is_owner"] = group["is_owner"] or is_owner
        group["booking_ids"].add(booking.booking_id)
        if not booking.is_collaborator:
            group["owner_id"] = owner_id_value
            group["owner_username"] = owner_username
            group["owner_booking_ids"].add(booking.booking_id)

        device_entry = group["devices"].setdefault(
            booking.device_id,
            {
                "device_id": booking.device_id,
                "device_name": booking.device.deviceName if booking.device else None,
                "device_type": booking.device.deviceType if booking.device else None,
                "dates": set(),
            },
        )
        device_entry["dates"].add(booking.start_time.date().isoformat())

    def derive_status(statuses: set[str]) -> str:
        upper_statuses = {s.upper() for s in statuses if s}
        if not upper_statuses:
            return "PENDING"
        if upper_statuses == {"CANCELLED"}:
            return "CANCELLED"
        if "CANCELLED" in upper_statuses:
            return "CANCELLED"
        if any(s in {"REJECTED", "DECLINED"} for s in upper_statuses):
            return "DECLINED"
        if any(s == "EXPIRED" for s in upper_statuses):
            return "EXPIRED"
        if any(s in {"PENDING", "CONFLICTING"} for s in upper_statuses):
            return "PENDING"
        if any(s in {"APPROVED", "CONFIRMED"} for s in upper_statuses):
            return "APPROVED"
        return next(iter(upper_statuses))

    grouped_results = []
    for group in groups.values():
        devices = []
        for device in group["devices"].values():
            devices.append(
                {
                    "device_id": device["device_id"],
                    "device_name": device["device_name"],
                    "device_type": device["device_type"],
                    "dates": sorted(device["dates"]),
                }
            )

        grouped_results.append(
            {
                "grouped_booking_id": group["grouped_booking_id"],
                "owner_id": group["owner_id"],
                "owner_username": group["owner_username"],
                "collaborators": group["collaborators"],
                "start_date": group["start_date"].isoformat(),
                "end_date": group["end_date"].isoformat(),
                "created_at": group["created_at"].isoformat(),
                "status": derive_status(group["statuses"]),
                "devices": devices,
                "device_count": len(devices),
                "booking_ids": sorted(group["booking_ids"]),
                "owner_booking_ids": sorted(group["owner_booking_ids"]),
                "is_owner": group["is_owner"],
                "is_collaborator": group["is_collaborator"],
            }
        )

    grouped_results.sort(key=lambda g: g["created_at"], reverse=True)
    if grouped:
        return grouped_results

    raw_results.sort(key=lambda r: r["start_time"])
    return raw_results


# ================ Booking Favorites ================
@app.get("/bookings/favorites/{user_id}")
def get_booking_favorites(user_id: int, db: Session = Depends(get_db)):
    favorites = (
        db.query(models.BookingFavorite)
        .filter(models.BookingFavorite.user_id == user_id)
        .order_by(models.BookingFavorite.updated_at.desc())
        .all()
    )
    return [_favorite_to_dict(favorite) for favorite in favorites]


@app.post("/bookings/favorites")
def create_booking_favorite(
    payload: BookingFavoriteCreate, db: Session = Depends(get_db)
):
    user = db.query(models.User).get(payload.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    name = (payload.name or "").strip() or datetime.utcnow().strftime("%Y-%m-%d")
    existing = (
        db.query(models.BookingFavorite)
        .filter(
            models.BookingFavorite.user_id == payload.user_id,
            models.BookingFavorite.grouped_booking_id == payload.grouped_booking_id,
        )
        .first()
    )

    if existing:
        existing.name = name
        existing.device_snapshot = payload.device_snapshot
        existing.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(existing)
        favorite = existing
    else:
        favorite = models.BookingFavorite(
            user_id=payload.user_id,
            name=name,
            grouped_booking_id=payload.grouped_booking_id,
            device_snapshot=payload.device_snapshot,
        )
        db.add(favorite)
        db.commit()
        db.refresh(favorite)

    return _favorite_to_dict(favorite)


@app.put("/bookings/favorites/{favorite_id}")
def update_booking_favorite(
    favorite_id: int, payload: BookingFavoriteUpdate, db: Session = Depends(get_db)
):
    favorite = db.query(models.BookingFavorite).get(favorite_id)
    if not favorite:
        raise HTTPException(status_code=404, detail="Favorite not found")

    if payload.name is not None:
        name = payload.name.strip()
        favorite.name = name or datetime.utcnow().strftime("%Y-%m-%d")
    favorite.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(favorite)
    return _favorite_to_dict(favorite)


@app.delete("/bookings/favorites/{favorite_id}")
def delete_booking_favorite(favorite_id: int, db: Session = Depends(get_db)):
    favorite = db.query(models.BookingFavorite).get(favorite_id)
    if not favorite:
        raise HTTPException(status_code=404, detail="Favorite not found")
    db.delete(favorite)
    db.commit()
    return {"message": "Favorite removed"}


# ================ Delete the expired or cancelled bookings  ================
@app.delete("/bookings/{booking_id}")
def delete_booking(booking_id: int, db: Session = Depends(get_db)):

    booking = db.query(models.Booking).get(booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found.")

    related_bookings = (
        db.query(models.Booking)
        .filter(
            models.Booking.grouped_booking_id == booking.grouped_booking_id,
            models.Booking.device_id == booking.device_id,
            models.Booking.start_time == booking.start_time,
            models.Booking.end_time == booking.end_time,
        )
        .all()
    )
    if not related_bookings:
        db.delete(booking)
    else:
        for record in related_bookings:
            db.delete(record)
    db.commit()
    return {"message": f"Booking {booking_id} deleted."}


# ================ Show all booking status  ================
@app.get("/bookings/for-week")
def get_bookings_for_week(start: str, db: Session = Depends(get_db)):

    now = datetime.now()
    db.query(models.Booking).filter(
        models.Booking.end_time < now,
        ~models.Booking.status.in_(["CANCELLED", "EXPIRED", "REJECTED"]),
    ).update({models.Booking.status: "EXPIRED"}, synchronize_session=False)
    db.commit()

    # Parse start into date
    try:
        week_start = datetime.strptime(start, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(
            status_code=400, detail="Invalid date format, expected YYYY-MM-DD"
        )
    week_end = week_start + timedelta(days=7)

    # Find all bookings that overlap in [week_start, week_end)
    try:
        rows = (
            db.query(
                models.Booking.booking_id,
                models.Booking.device_id,
                models.Booking.user_id,
                models.Booking.start_time,
                models.Booking.end_time,
                models.Booking.status,
                models.Booking.grouped_booking_id,
                models.Booking.collaborators,
                models.Booking.is_collaborator,
                models.Device.deviceType,
                models.Device.deviceName,
                models.User.username,
            )
            .outerjoin(models.Device, models.Booking.device_id == models.Device.id)
            .outerjoin(models.User, models.Booking.user_id == models.User.id)
            .filter(
                models.Booking.start_time < week_end,
                models.Booking.end_time > week_start,
            )
            .all()
        )

        owner_lookup: dict[str, str] = {}
        for (
            _booking_id,
            _device_id,
            _user_id,
            _start_time,
            _end_time,
            _status,
            grouped_booking_id,
            _collaborators,
            is_collaborator,
            _device_type,
            _device_name,
            username,
        ) in rows:
            if not is_collaborator and username:
                owner_lookup[grouped_booking_id] = username

        results = []
        for (
            booking_id,
            device_id,
            user_id,
            start_time,
            end_time,
            status,
            grouped_booking_id,
            collaborators,
            is_collaborator,
            device_type,
            device_name,
            username,
        ) in rows:
            display_device_name = device_name or f"Device {device_id}"
            display_device_type = device_type or "Unknown"

            display_username = username or None
            collaborator_list = collaborators or []
            owner_username = owner_lookup.get(grouped_booking_id, display_username)

            results.append(
                {
                    "booking_id": booking_id,
                    "user_id": user_id,
                    "username": display_username,
                    "owner_username": owner_username,
                    "device_id": device_id,
                    "device_type": display_device_type,
                    "device_name": display_device_name,
                    "start_time": start_time.isoformat(),
                    "end_time": end_time.isoformat(),
                    "status": status,
                    "grouped_booking_id": grouped_booking_id,
                    "collaborators": collaborator_list,
                    "is_collaborator": bool(is_collaborator),
                }
            )
        return results
    except Exception as exc:
        logger.exception("Failed to load bookings for week %s: %s", start, exc)
        raise HTTPException(
            status_code=500, detail="Failed to load bookings for the requested week."
        )


# ================== Confliction check ==================
@app.post("/check-conflicts", response_model=List[schemas.DeviceConflict])
def check_conflicts(req: schemas.ConflictCheckRequest, db: Session = Depends(get_db)):
    results = []
    for device_id in req.device_ids:
        device = db.query(models.Device).get(device_id)
        if not device:
            continue

        conflict_slots = []

        # Parse device.maintenance_start / device.maintenance_end
        if device.maintenance_start and device.maintenance_end:
            maint_start_date_str = device.maintenance_start.split("/")[
                1
            ]  # "2025-03-22"
            maint_end_date_str = device.maintenance_end.split("/")[1]  # "2025-03-22"
            # parse them
            maint_start = datetime.strptime(maint_start_date_str, "%Y-%m-%d")
            maint_end = datetime.strptime(maint_end_date_str, "%Y-%m-%d")

            start_of_maint = max(maint_start, req.start)
            end_of_maint = min(maint_end, req.end)

            # IF there are interactions
            if end_of_maint >= start_of_maint:
                # day by day
                day_iter = start_of_maint.date()
                while day_iter <= end_of_maint.date():
                    conflict_slots.append(
                        schemas.ConflictTimeSlot(
                            date=day_iter.strftime("%Y-%m-%d"),
                            start_time="00:00",
                            end_time="23:59",
                            conflict_type="maintenance",
                        )
                    )
                    day_iter += timedelta(days=1)

        # Then check Bookings (PENDING/CONFIRMED/CONFLICTING) and [req.start, req.end]
        overlapping_bookings = (
            db.query(models.Booking)
            .filter(
                models.Booking.device_id == device_id,
                models.Booking.end_time > req.start,
                models.Booking.start_time < req.end,
                models.Booking.status.in_(["PENDING", "CONFIRMED", "CONFLICTING"]),
            )
            .all()
        )

        for bk in overlapping_bookings:
            start_dt = bk.start_time
            end_dt = bk.end_time
            day_iter = start_dt.date()
            while day_iter <= end_dt.date():

                day_start = (
                    start_dt
                    if day_iter == start_dt.date()
                    else datetime.combine(day_iter, datetime.min.time())
                )
                day_end = (
                    end_dt
                    if day_iter == end_dt.date()
                    else datetime.combine(day_iter, datetime.max.time())
                )

                if day_end < req.start or day_start > req.end:
                    pass
                else:
                    conflict_slots.append(
                        schemas.ConflictTimeSlot(
                            date=day_iter.strftime("%Y-%m-%d"),
                            start_time=day_start.strftime("%H:%M"),
                            end_time=day_end.strftime("%H:%M"),
                            conflict_type="booking",
                        )
                    )
                day_iter += timedelta(days=1)

        # if device.status == "Maintenance" is true, which means that those slots will be unavailable.
        if device.status.lower() == "maintenance":
            # day by day => from req.start~req.end
            day_iter = req.start.date()
            while day_iter <= req.end.date():
                # let conflict_type="maintenance"
                day_iter += timedelta(days=1)

        if conflict_slots:
            results.append(
                schemas.DeviceConflict(
                    device_id=device.id,
                    device_name=f"{device.deviceType} - {device.deviceName}",
                    status=device.status,
                    conflicts=conflict_slots,
                )
            )

    return results


# ================== Topology Management ==================
@app.post("/topology")
def create_topology(
    topology: schemas.TopologyCreate,
    request: Request,
    db: Session = Depends(get_db),
):
    """Create a new topology"""
    user_id = request.session.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Not authenticated")

    if user_id != topology.user_id:
        raise HTTPException(
            status_code=403, detail="Cannot create topology for another user"
        )

    new_topology = models.Topology(
        user_id=topology.user_id,
        name=topology.name,
        nodes=topology.nodes,
        edges=topology.edges,
    )
    db.add(new_topology)
    db.commit()
    db.refresh(new_topology)

    return {
        "topology_id": new_topology.id,
        "message": "Topology created successfully",
    }


@app.put("/topology/{topology_id}")
def update_topology(
    topology_id: int,
    topology: schemas.TopologyUpdate,
    request: Request,
    db: Session = Depends(get_db),
):
    """Update an existing topology"""
    user_id = request.session.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Not authenticated")

    existing_topology = db.query(models.Topology).get(topology_id)
    if not existing_topology:
        raise HTTPException(status_code=404, detail="Topology not found")

    if existing_topology.user_id != user_id:
        raise HTTPException(
            status_code=403, detail="Cannot update another user's topology"
        )

    existing_topology.name = topology.name
    existing_topology.nodes = topology.nodes
    existing_topology.edges = topology.edges
    existing_topology.updated_at = datetime.now()

    db.commit()
    db.refresh(existing_topology)

    return {
        "message": "Topology updated successfully",
    }


@app.get("/topology/{topology_id}")
def get_topology(
    topology_id: int,
    request: Request,
    db: Session = Depends(get_db),
):
    """Get a specific topology"""
    user_id = request.session.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Not authenticated")

    topology = db.query(models.Topology).get(topology_id)
    if not topology:
        raise HTTPException(status_code=404, detail="Topology not found")

    if topology.user_id != user_id:
        raise HTTPException(
            status_code=403, detail="Cannot access another user's topology"
        )

    return {
        "topology": {
            "id": topology.id,
            "name": topology.name,
            "nodes": topology.nodes,
            "edges": topology.edges,
            "created_at": topology.created_at.isoformat(),
            "updated_at": topology.updated_at.isoformat(),
        }
    }


@app.get("/topology/list")
def list_topologies(
    user_id: int,
    request: Request,
    db: Session = Depends(get_db),
):
    """List all topologies for a user"""
    session_user_id = request.session.get("user_id")
    if not session_user_id:
        raise HTTPException(status_code=401, detail="Not authenticated")

    if session_user_id != user_id:
        raise HTTPException(
            status_code=403, detail="Cannot list another user's topologies"
        )

    topologies = (
        db.query(models.Topology)
        .filter(models.Topology.user_id == user_id)
        .order_by(models.Topology.updated_at.desc())
        .all()
    )

    return {
        "topologies": [
            {
                "id": t.id,
                "name": t.name,
                "created_at": t.created_at.isoformat(),
                "updated_at": t.updated_at.isoformat(),
            }
            for t in topologies
        ]
    }


@app.post("/topology/check-availability")
def check_topology_availability(
    req: schemas.TopologyCheckRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """Check availability for all devices in a topology (mocked for now)"""
    user_id = request.session.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Not authenticated")

    # Mock availability check - randomly assign availability status
    import random

    availability = {}
    for node in req.nodes:
        node_id = node.get("id", "")
        device_type = node.get("deviceType", "Unknown")

        # Mock: 70% chance of available, 20% unavailable, 10% unknown
        rand = random.random()
        if rand < 0.7:
            status = "available"
        elif rand < 0.9:
            status = "unavailable"
        else:
            status = "unknown"

        availability[node_id] = {
            "status": status,
            "details": {
                "device_type": device_type,
                "mock": True,
                "message": f"Mocked availability check for {device_type}",
            },
        }

    return {"availability": availability}


@app.post("/topology/resolve")
def resolve_topology(
    req: schemas.TopologyResolveRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """Resolve logical topology to physical device mappings using real topology resolver"""
    user_id = request.session.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Not authenticated")

    try:
        from backend.scheduler.services.topology_resolver import TopologyResolver

        # Parse date range
        start_time = req.start_time
        end_time = req.end_time

        if start_time >= end_time:
            raise HTTPException(
                status_code=400, detail="End time must be after start time"
            )

        # Create resolver and resolve topology
        resolver = TopologyResolver(db)
        mappings_data = resolver.resolve_topology(
            logical_nodes=req.nodes,
            logical_edges=req.edges,
            date_range_start=start_time,
            date_range_end=end_time,
            num_options=3,
        )

        if not mappings_data:
            # No mappings found, return empty response
            return schemas.TopologyResolveResponse(
                mappings=[],
                total_options=0,
            )

        # Convert to schema format
        mappings = []
        for mapping_data in mappings_data:
            # Convert node mappings
            node_mappings = []
            for nm_data in mapping_data.get("node_mappings", []):
                # Convert alternatives format
                alternatives = []
                for alt in nm_data.get("alternatives", []):
                    alternatives.append(
                        {
                            "device_id": alt.get("device_id"),
                            "device_name": alt.get("device_name"),
                            "device_type": alt.get("device_type"),
                            "fit_score": alt.get("fit_score"),
                            "available": alt.get("available", True),
                        }
                    )

                node_mappings.append(
                    schemas.DeviceMapping(
                        logical_node_id=nm_data.get("logical_node_id", ""),
                        physical_device_id=nm_data.get("physical_device_id"),
                        physical_device_name=nm_data.get("physical_device_name", ""),
                        physical_device_type=nm_data.get("physical_device_type", ""),
                        fit_score=nm_data.get("fit_score", 0.0),
                        confidence=nm_data.get("confidence", "low"),
                        alternatives=alternatives,
                        explanation=nm_data.get("explanation", ""),
                    )
                )

            # Convert link mappings
            link_mappings = []
            for lm_data in mapping_data.get("link_mappings", []):
                link_mappings.append(
                    schemas.LinkMapping(
                        logical_edge_id=lm_data.get("logical_edge_id", ""),
                        source_mapping=lm_data.get("source_mapping", ""),
                        target_mapping=lm_data.get("target_mapping", ""),
                        physical_link_id=lm_data.get("physical_link_id"),
                        fit_score=lm_data.get("fit_score", 0.0),
                    )
                )

            mappings.append(
                schemas.TopologyMapping(
                    mapping_id=mapping_data.get("mapping_id", "unknown"),
                    total_fit_score=mapping_data.get("total_fit_score", 0.0),
                    node_mappings=node_mappings,
                    link_mappings=link_mappings,
                    notes=mapping_data.get("notes", ""),
                )
            )

        return schemas.TopologyResolveResponse(
            mappings=mappings,
            total_options=len(mappings),
        )

    except ImportError as e:
        # Fallback to mock if resolver not available
        import random

        raise HTTPException(status_code=500, detail=f"Resolver not available: {str(e)}")
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Topology resolution failed: {str(e)}"
        )


@app.post("/topology/suggest")
def suggest_topology_configurations(
    req: schemas.TopologySuggestRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """Suggest optimized topology configurations with recommendations"""
    user_id = request.session.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Not authenticated")

    try:
        from backend.scheduler.services.topology_resolver import TopologyResolver
        from backend.scheduler.services.recommendation_engine import RecommendationEngine

        # First resolve the topology to get base mappings
        resolver = TopologyResolver(db)
        base_mappings = resolver.resolve_topology(
            logical_nodes=req.nodes,
            logical_edges=req.edges,
            date_range_start=req.start_time,
            date_range_end=req.end_time,
            num_options=5,  # Get more options for recommendations
        )

        if not base_mappings:
            return schemas.TopologySuggestResponse(
                recommendations=[],
                total_recommendations=0,
            )

        # Get recommendations
        recommendation_engine = RecommendationEngine(db)
        suggestions = recommendation_engine.suggest_topology_configurations(
            logical_nodes=req.nodes,
            logical_edges=req.edges,
            date_range_start=req.start_time,
            date_range_end=req.end_time,
            base_mappings=base_mappings,
        )

        # Convert to schema format
        recommendations = []
        for suggestion in suggestions:
            # Convert mapping to schema format
            mapping_data = suggestion["mapping"]
            node_mappings = []
            for nm_data in mapping_data.get("node_mappings", []):
                alternatives = []
                for alt in nm_data.get("alternatives", []):
                    alternatives.append(
                        {
                            "device_id": alt.get("device_id"),
                            "device_name": alt.get("device_name"),
                            "device_type": alt.get("device_type"),
                            "fit_score": alt.get("fit_score"),
                            "available": alt.get("available", True),
                        }
                    )

                node_mappings.append(
                    schemas.DeviceMapping(
                        logical_node_id=nm_data.get("logical_node_id", ""),
                        physical_device_id=nm_data.get("physical_device_id"),
                        physical_device_name=nm_data.get("physical_device_name", ""),
                        physical_device_type=nm_data.get("physical_device_type", ""),
                        fit_score=nm_data.get("fit_score", 0.0),
                        confidence=nm_data.get("confidence", "low"),
                        alternatives=alternatives,
                        explanation=nm_data.get("explanation", ""),
                    )
                )

            link_mappings = []
            for lm_data in mapping_data.get("link_mappings", []):
                link_mappings.append(
                    schemas.LinkMapping(
                        logical_edge_id=lm_data.get("logical_edge_id", ""),
                        source_mapping=lm_data.get("source_mapping", ""),
                        target_mapping=lm_data.get("target_mapping", ""),
                        physical_link_id=lm_data.get("physical_link_id"),
                        fit_score=lm_data.get("fit_score", 0.0),
                    )
                )

            topology_mapping = schemas.TopologyMapping(
                mapping_id=mapping_data.get("mapping_id", "unknown"),
                total_fit_score=mapping_data.get("total_fit_score", 0.0),
                node_mappings=node_mappings,
                link_mappings=link_mappings,
                notes=mapping_data.get("notes", ""),
            )

            recommendations.append(
                schemas.ConfigurationRecommendation(
                    mapping_id=suggestion["mapping_id"],
                    recommendation_score=suggestion["recommendation_score"],
                    performance_score=suggestion["performance_score"],
                    availability_score=suggestion["availability_score"],
                    efficiency_score=suggestion["efficiency_score"],
                    reliability_score=suggestion["reliability_score"],
                    rationale=suggestion["rationale"],
                    earliest_available_slot=datetime.fromisoformat(
                        suggestion["earliest_available_slot"]
                    )
                    if suggestion.get("earliest_available_slot")
                    else None,
                    mapping=topology_mapping,
                )
            )

        return schemas.TopologySuggestResponse(
            recommendations=recommendations,
            total_recommendations=len(recommendations),
        )

    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Recommendation generation failed: {str(e)}"
        )


@app.post("/availability/forecast")
def forecast_availability(
    req: schemas.AvailabilityForecastRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """Forecast availability probabilities for devices"""
    user_id = request.session.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Not authenticated")

    try:
        from backend.scheduler.services.recommendation_engine import RecommendationEngine

        recommendation_engine = RecommendationEngine(db)
        forecasts_dict = recommendation_engine.forecast_availability(
            device_ids=req.device_ids,
            start_time=req.start_time,
            end_time=req.end_time,
            forecast_window_days=req.forecast_window_days or 7,
        )

        forecasts = []
        for device_id, forecast_data in forecasts_dict.items():
            forecasts.append(
                schemas.DeviceAvailabilityForecast(
                    device_id=device_id,
                    availability_probability=forecast_data["availability_probability"],
                    confidence=forecast_data["confidence"],
                    factors=forecast_data["factors"],
                    earliest_available_slot=datetime.fromisoformat(
                        forecast_data["earliest_available_slot"]
                    )
                    if forecast_data.get("earliest_available_slot")
                    else None,
                )
            )

        return schemas.AvailabilityForecastResponse(forecasts=forecasts)

    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Availability forecasting failed: {str(e)}"
        )


@app.delete("/topology/{topology_id}")
def delete_topology(
    topology_id: int,
    request: Request,
    db: Session = Depends(get_db),
):
    """Delete a topology"""
    user_id = request.session.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Not authenticated")

    topology = db.query(models.Topology).get(topology_id)
    if not topology:
        raise HTTPException(status_code=404, detail="Topology not found")

    if topology.user_id != user_id:
        raise HTTPException(
            status_code=403, detail="Cannot delete another user's topology"
        )

    db.delete(topology)
    db.commit()

    return {"message": "Topology deleted successfully"}
