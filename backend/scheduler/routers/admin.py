import os
from fastapi import APIRouter, Depends, HTTPException, status, Request, BackgroundTasks
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_
# Phase U2: Import InventoryDevice as Device for unified device management
from backend.inventory.models import InventoryDevice as Device, DeviceType
from backend.scheduler import models, schemas
from backend.core.deps import get_db

from backend.core.hash import hash_password, verify_password
from backend.core.discord_utils import send_admin_action_notification

router = APIRouter(prefix="/admin", tags=["admin"])

"""
The secret key for admin registration 
"""
ADMIN_SECRET = os.getenv("ADMIN_SECRET", "")


# ================== Admin Register ==================
@router.post("/register", response_model=schemas.User)
def admin_register(admin: schemas.AdminCreate, db: Session = Depends(get_db), request: Request = None):

    # Check secret key 
    if admin.admin_secret != ADMIN_SECRET:
        raise HTTPException(status_code=403, detail="Invalid admin secret")
    
     # Check the user name 
    existing_user = db.query(models.User).filter(models.User.username == admin.username).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already taken.")

    # Hash the password
    hashed_pass = hash_password(admin.password)

    new_user = models.User(
        username=admin.username,
        email=admin.email,
        password=hashed_pass,
        is_admin=True,  # Mark this user as admin
        discord_id=admin.discord_id
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    # Store the user_id in Session
    request.session["user_id"] = new_user.id

    return new_user

# ================== Admin Login ==================
@router.post("/login")
def login_user(login_data: schemas.UserLogin, db: Session = Depends(get_db), request: Request = None):
    
    user = db.query(models.User).filter(models.User.username == login_data.username).first()

    # Check if the user exists and required information is correct
    if not user or not verify_password(login_data.password, user.password):
        raise HTTPException(status_code=400, detail="Invalid username or password")
    
    request.session["user_id"] = user.id
    return {
        "message": "Sign in successful",
        "user_id": user.id,
        "is_admin": user.is_admin
    }


# ================== Admin Check ==================
def admin_required(request: Request, db: Session = Depends(get_db)):

    user_id = request.session.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Not authenticated")

    user = db.query(models.User).get(user_id)
    if not user or not getattr(user, "is_admin", False):
        raise HTTPException(status_code=403, detail="Admin privileges required")
    
@router.get("/checkAdminSession")
def get_session(request: Request, db: Session = Depends(get_db)):

    user_id = request.session.get("user_id")
    if user_id:
        user = db.query(models.User).get(user_id)
        if user:
            return {"logged_in": True, "user_id": user.id, "username": user.username, "is_admin": user.is_admin}
    return {"logged_in": False}



# ================== Show all devices ==================
@router.get("/devices", response_model=list[schemas.DeviceResponse])
def get_devices(request: Request, db: Session = Depends(get_db)):
    admin_required(request, db)
    # Phase U2: Eager load device_type to prevent N+1 queries
    return db.query(Device).options(joinedload(Device.device_type)).all()



# ================== Add a new device ==================
@router.post("/devices", response_model=schemas.DeviceResponse, status_code=status.HTTP_201_CREATED)
def add_device(device: schemas.DeviceCreate, db: Session = Depends(get_db), auth: None = Depends(admin_required)):

    # Phase U2: Rewrite deviceType filter with JOIN
    existing_polatis = (
        db.query(Device)
        .join(DeviceType)
        .filter(
            DeviceType.name == device.deviceType,
            Device.name == device.deviceName,
            Device.polatis_name == device.polatis_name
        )
        .first()
    )

    if existing_polatis:
        raise HTTPException(status_code=400, detail="Polatis name already exists in this device group")

    # Phase U2: Rewrite IP conflict check with JOIN
    if device.ip_address:
        existing_ip_conflict = (
            db.query(Device)
            .join(DeviceType)
            .filter(
                Device.mgmt_ip == str(device.ip_address),
                or_(
                    DeviceType.name != device.deviceType,
                    Device.name != device.deviceName
                )
            )
            .first()
        )

        if existing_ip_conflict:
            raise HTTPException(status_code=400, detail="IP address already exists for another device")

    # Phase U2: Create InventoryDevice with device_type lookup
    # deviceType setter was removed - must handle lookup in router
    device_type_obj = db.query(DeviceType).filter(DeviceType.name == device.deviceType).first()
    if not device_type_obj:
        raise HTTPException(
            status_code=400,
            detail=f"DeviceType '{device.deviceType}' not found. Please create it via inventory API first."
        )
    
    new_device = Device(
        polatis_name=device.polatis_name,
        device_type=device_type_obj,  # Set relationship directly
        deviceName=device.deviceName,
        status=device.status,
        ip_address=str(device.ip_address) if device.ip_address else None,
        maintenance_start=device.maintenance_start,  
        maintenance_end=device.maintenance_end,
        Out_Port=device.Out_Port,
        In_Port=device.In_Port   
    )
    db.add(new_device)
    db.commit()
    # Eager load device_type for response
    db.refresh(new_device)
    return new_device



# ================== Delete a device ==================
@router.delete("/devices/{device_id}")
def delete_device(device_id: int, db: Session = Depends(get_db),  auth: None = Depends(admin_required)):

    device = db.query(Device).get(device_id)
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    db.delete(device)
    db.commit()
    return {"success": True, "message": f"Device {device_id} deleted successfully"}


# ================== Edit a device ==================
@router.put("/devices/{device_id}", response_model = schemas.DeviceResponse)
def update_device_info(device_id: int, update: schemas.DeviceUpdateFull, 
                       db: Session = Depends(get_db), auth: None = Depends(admin_required)):

    # Phase U2: Query with eager loading
    device = db.query(Device).options(joinedload(Device.device_type)).filter(Device.id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    old_type = device.deviceType
    old_name = device.deviceName
     
    # Phase U2: Check if polatis exists with JOIN
    existing_polatis = (
        db.query(Device)
        .join(DeviceType)
        .filter(
            Device.id != device_id,
            DeviceType.name == update.deviceType,
            Device.name == update.deviceName,
            Device.polatis_name == update.polatis_name
        )
        .first()
    )

    if existing_polatis:
        raise HTTPException(status_code=400, detail="Polatis name already exists in this device group")

    # Phase U2: Check IP conflict with JOIN
    if update.ip_address:
        existing_ip_conflict = (
            db.query(Device)
            .join(DeviceType)
            .filter(
                Device.id != device_id,
                Device.mgmt_ip == str(update.ip_address),
                or_(
                    DeviceType.name != update.deviceType,
                    Device.name != update.deviceName,
                )
            )
            .first()
        )

        if existing_ip_conflict:
            raise HTTPException(status_code=400, detail="IP address already exists for another device")

    # Phase U2: Bulk update with JOIN (update all devices with same type/name)
    (
        db.query(Device)
        .join(DeviceType)
        .filter(
            DeviceType.name == old_type,
            Device.name == old_name
        )
        .update(
            {Device.mgmt_ip: str(update.ip_address) if update.ip_address else None},
            synchronize_session=False
        )
    )
    
    # Update device properties
    # deviceType setter was removed - must handle lookup in router
    if update.deviceType != device.deviceType:
        new_device_type = db.query(DeviceType).filter(DeviceType.name == update.deviceType).first()
        if not new_device_type:
            raise HTTPException(
                status_code=400,
                detail=f"DeviceType '{update.deviceType}' not found. Please create it via inventory API first."
            )
        device.device_type = new_device_type
    
    device.status = update.status
    device.deviceName = update.deviceName
    device.maintenance_start = update.maintenance_start
    device.maintenance_end = update.maintenance_end  
    device.Out_Port = update.Out_Port  
    device.In_Port = update.In_Port 
    
    db.commit()
    db.refresh(device)
    return device

# ================== Get all pending or conflicting bookings ==================
@router.get("/bookings/pending")
def get_pending_bookings(db: Session = Depends(get_db), auth: None = Depends(admin_required)):
    bookings = (
        db.query(models.Booking)
        .join(models.User)
        .join(models.Device)
        .filter(models.Booking.status.in_(["PENDING", "CONFLICTING"]))
        .all()
    )

    return [{
        "booking_id": b.booking_id,
        "user_id": b.user_id,
        "username": b.user.username,
        "device_type": b.device.deviceType,
        "device_name": b.device.deviceName,
        "ip_address": b.device.ip_address,
        "start_time": b.start_time.isoformat(),
        "end_time": b.end_time.isoformat(),
        "status": b.status,
        "comment": b.comment
    } for b in bookings]


# ================== Confirm or Reject bookings & Send Emails ==================
@router.put("/bookings/{booking_id}")
async def update_booking_status(
    booking_id: int,
    status_update: schemas.BookingStatusUpdate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    auth: None = Depends(admin_required)
):
    valid_statuses = ["CONFIRMED", "REJECTED"]
    if status_update.status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Allowed: {', '.join(valid_statuses)}")
    
    booking = db.query(models.Booking).get(booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    booking.status = status_update.status
    db.commit()

    user    = db.query(models.User).get(booking.user_id)
    device = booking.device
    device_type = booking.device.deviceType
    device_name = booking.device.deviceName
    device_ip = device.ip_address
    start_str = booking.start_time.strftime("%Y-%m-%d %H:%M")
    end_str   = booking.end_time.strftime("%Y-%m-%d %H:%M")

    if status_update.status == "CONFIRMED":
        msg = (
            f":white_check_mark: <@{user.discord_id}>, your booking has been **CONFIRMED** by admin.\n"
            f"> Device: **{device_type} - {device_name}**\n"
            f"> Time Period: {start_str} ~ {end_str}"
        )
    else:
        msg = (
            f":x: <@{user.discord_id}>, your booking has been **REJECTED** by admin.\n"
            f"> Device: **{device_type} - {device_name}**\n"
            f"> Time Period: {start_str} ~ {end_str}\n"
        )
    background_tasks.add_task(send_admin_action_notification, msg, user.discord_id)

    return {"message": "Booking status updated successfully"}


# ================== Show all current bookings ==================
@router.get("/bookings/all")
def get_all_bookings(db: Session = Depends(get_db), auth: None = Depends(admin_required)):
    bookings = (
        db.query(models.Booking)
        .join(models.User)
        .join(models.Device)
        .order_by(models.Booking.start_time.desc())  # sort in the default start time 
        .all()
    )

    return [{
        "booking_id": b.booking_id,
        "user_id": b.user_id,
        "username": b.user.username,
        "device_type": b.device.deviceType,
        "device_name": b.device.deviceName,
        "ip_address": b.device.ip_address,
        "start_time": b.start_time.isoformat(),
        "end_time": b.end_time.isoformat(),
        "status": b.status,
        "comment": b.comment
    } for b in bookings]    