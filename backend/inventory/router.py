# router.py - Inventory Management REST API Endpoints

from fastapi import APIRouter, Depends, HTTPException, status, Query, Request, File, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, func
from typing import List, Optional
from datetime import datetime
import shutil
import os

from backend.core.deps import get_db
from backend.inventory import models, schemas
from backend.inventory.models import InventoryDevice, InventoryDeviceTag

router = APIRouter()


def get_current_user_id(request: Request) -> Optional[int]:
    """Get current user ID from session"""
    return request.session.get("user_id") if hasattr(request, "session") else None


# ================== Device CRUD ==================

@router.post("/devices", response_model=schemas.DeviceResponse, status_code=status.HTTP_201_CREATED)
def create_device(
    device: schemas.DeviceCreate,
    request: Request,
    db: Session = Depends(get_db),
):
    """Create a new device"""
    user_id = get_current_user_id(request)
    
    # Validate device_type_id exists
    device_type = db.query(models.DeviceType).get(device.device_type_id)
    if not device_type:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Device type with ID {device.device_type_id} not found"
        )
    
    # Validate manufacturer_id if provided
    if device.manufacturer_id:
        manufacturer = db.query(models.Manufacturer).get(device.manufacturer_id)
        if not manufacturer:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Manufacturer with ID {device.manufacturer_id} not found"
            )
    
    # Validate site_id if provided
    if device.site_id:
        site = db.query(models.Site).get(device.site_id)
        if not site:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Site with ID {device.site_id} not found"
            )
    
    # Check if serial number is unique
    if device.serial_number:
        existing = db.query(InventoryDevice).filter(
            InventoryDevice.serial_number == device.serial_number
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Device with serial number '{device.serial_number}' already exists"
            )
    
    # Create new device
    db_device = InventoryDevice(
        name=device.name,
        oi_id=device.oi_id,
        device_type_id=device.device_type_id,
        manufacturer_id=device.manufacturer_id,
        model=device.model,
        serial_number=device.serial_number,
        status=device.status.value if isinstance(device.status, schemas.DeviceStatus) else device.status,
        site_id=device.site_id,
        rack=device.rack,
        u_position=device.u_position,
        hostname=device.hostname,
        mgmt_ip=str(device.mgmt_ip) if device.mgmt_ip else None,
        polatis_name=device.polatis_name,
        polatis_port_range=device.polatis_port_range,
        owner_group=device.owner_group,
        notes=device.notes,
        created_by_id=user_id,
        updated_by_id=user_id,
    )
    
    db.add(db_device)
    db.commit()
    db.refresh(db_device)
    
    # Create history entry
    history = models.DeviceHistory(
        device_id=db_device.id,
        action="created",
        changed_by_id=user_id,
        notes=f"Device created: {db_device.name}",
    )
    db.add(history)
    db.commit()
    
    return _device_to_response(db_device, db)


@router.get("/devices", response_model=schemas.DeviceListResponse)
def list_devices(
    device_type_id: Optional[int] = Query(None),
    manufacturer_id: Optional[int] = Query(None),
    site_id: Optional[int] = Query(None),
    status: Optional[schemas.DeviceStatus] = Query(None),
    tag_ids: Optional[str] = Query(None),  # Comma-separated tag IDs
    search: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    """List devices with filtering and pagination"""
    query = db.query(InventoryDevice)
    
    # Apply filters
    if device_type_id:
        query = query.filter(InventoryDevice.device_type_id == device_type_id)
    
    if manufacturer_id:
        query = query.filter(InventoryDevice.manufacturer_id == manufacturer_id)
    
    if site_id:
        query = query.filter(InventoryDevice.site_id == site_id)
    
    if status:
        status_value = status.value if isinstance(status, schemas.DeviceStatus) else status
        query = query.filter(InventoryDevice.status == status_value)
    
    if tag_ids:
        tag_id_list = [int(t.strip()) for t in tag_ids.split(",") if t.strip()]
        if tag_id_list:
            # Filter devices that have any of the specified tags
            query = query.join(InventoryDeviceTag).filter(
                InventoryDeviceTag.tag_id.in_(tag_id_list)
            ).distinct()
    
    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            or_(
                InventoryDevice.name.ilike(search_pattern),
                InventoryDevice.model.ilike(search_pattern),
                InventoryDevice.serial_number.ilike(search_pattern),
                InventoryDevice.oi_id.ilike(search_pattern),
            )
        )
    
    # Get total count
    total = query.count()
    
    # Apply pagination and ordering
    devices = (
        query.order_by(InventoryDevice.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    
    return schemas.DeviceListResponse(
        items=[_device_to_response(device, db) for device in devices],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/devices/{device_id}", response_model=schemas.DeviceResponse)
def get_device(
    device_id: int,
    db: Session = Depends(get_db),
):
    """Get a specific device by ID"""
    device = db.query(InventoryDevice).get(device_id)
    if not device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Device with ID {device_id} not found"
        )
    
    return _device_to_response(device, db)


@router.get("/devices/oi/{oi_id}", response_model=schemas.DeviceResponse)
def get_device_by_oi_id(
    oi_id: str,
    db: Session = Depends(get_db),
):
    """Get a specific device by oi_id"""
    device = db.query(InventoryDevice).filter(
        InventoryDevice.oi_id == oi_id
    ).first()
    if not device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Device with oi_id '{oi_id}' not found"
        )
    
    return _device_to_response(device, db)


@router.put("/devices/{device_id}", response_model=schemas.DeviceResponse)
def update_device(
    device_id: int,
    device_update: schemas.DeviceUpdate,
    request: Request,
    db: Session = Depends(get_db),
):
    """Update a device"""
    user_id = get_current_user_id(request)
    
    db_device = db.query(InventoryDevice).get(device_id)
    if not db_device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Device with ID {device_id} not found"
        )
    
    # Validate foreign keys if updated
    if device_update.device_type_id is not None:
        device_type = db.query(models.DeviceType).get(device_update.device_type_id)
        if not device_type:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Device type with ID {device_update.device_type_id} not found"
            )
    
    if device_update.manufacturer_id is not None:
        manufacturer = db.query(models.Manufacturer).get(device_update.manufacturer_id)
        if not manufacturer:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Manufacturer with ID {device_update.manufacturer_id} not found"
            )
    
    if device_update.site_id is not None:
        site = db.query(models.Site).get(device_update.site_id)
        if not site:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Site with ID {device_update.site_id} not found"
            )
    
    # Track changes for history
    changes = []
    update_data = device_update.dict(exclude_unset=True)
    
    for field, new_value in update_data.items():
        if hasattr(db_device, field):
            old_value = getattr(db_device, field)
            # Handle status enum conversion
            if field == "status" and isinstance(new_value, schemas.DeviceStatus):
                new_value = new_value.value
            # Handle mgmt_ip conversion
            if field == "mgmt_ip" and new_value is not None:
                new_value = str(new_value)
            
            if old_value != new_value:
                changes.append({
                    "field": field,
                    "old": str(old_value) if old_value is not None else None,
                    "new": str(new_value) if new_value is not None else None,
                })
                setattr(db_device, field, new_value)
    
    db_device.updated_by_id = user_id
    
    # Create history entries for changes
    for change in changes:
        history = models.DeviceHistory(
            device_id=db_device.id,
            action="updated",
            field_name=change["field"],
            old_value=change["old"],
            new_value=change["new"],
            changed_by_id=user_id,
        )
        db.add(history)
    
    db.commit()
    db.refresh(db_device)
    
    return _device_to_response(db_device, db)


@router.delete("/devices/{device_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_device(
    device_id: int,
    request: Request,
    db: Session = Depends(get_db),
):
    """Delete a device"""
    user_id = get_current_user_id(request)
    
    db_device = db.query(InventoryDevice).get(device_id)
    if not db_device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Device with ID {device_id} not found"
        )
    
    # Create history entry before deletion
    history = models.DeviceHistory(
        device_id=db_device.id,
        action="deleted",
        changed_by_id=user_id,
        notes=f"Device deleted: {db_device.name}",
    )
    db.add(history)
    
    db.delete(db_device)
    db.commit()
    
    return None


@router.post("/devices/bulk-update", response_model=schemas.BulkUpdateResponse)
def bulk_update_devices(
    request_data: schemas.BulkUpdateRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """Bulk update multiple devices"""
    user_id = get_current_user_id(request)
    
    succeeded = []
    failed = []
    
    # Get allowed fields from DeviceUpdate schema
    allowed_fields = set(schemas.DeviceUpdate.__fields__.keys())
    
    for device_id in request_data.device_ids:
        try:
            db_device = db.query(InventoryDevice).get(device_id)
            if not db_device:
                failed.append({"device_id": device_id, "error": "Device not found"})
                continue
            
            # Apply updates only for allowed fields
            for field, value in request_data.updates.items():
                if field not in allowed_fields:
                    failed.append({
                        "device_id": device_id,
                        "error": f"Field '{field}' is not allowed for update"
                    })
                    continue
                
                if hasattr(db_device, field):
                    # Handle status enum conversion
                    if field == "status" and isinstance(value, schemas.DeviceStatus):
                        value = value.value
                    # Handle mgmt_ip conversion
                    if field == "mgmt_ip" and value is not None:
                        value = str(value)
                    setattr(db_device, field, value)
            
            db_device.updated_by_id = user_id
            
            # Create history entry
            history = models.DeviceHistory(
                device_id=db_device.id,
                action="bulk_updated",
                changed_by_id=user_id,
                notes=f"Bulk update: {', '.join(request_data.updates.keys())}",
                extra={"updates": request_data.updates},
            )
            db.add(history)
            
            succeeded.append(device_id)
        except Exception as e:
            failed.append({"device_id": device_id, "error": str(e)})
    
    db.commit()
    
    return schemas.BulkUpdateResponse(succeeded=succeeded, failed=failed)


@router.get("/devices/{device_id}/history", response_model=List[schemas.DeviceHistoryResponse])
def get_device_history(
    device_id: int,
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    """Get history for a device"""
    device = db.query(InventoryDevice).get(device_id)
    if not device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Device with ID {device_id} not found"
        )
    
    history = (
        db.query(models.DeviceHistory)
        .filter(models.DeviceHistory.device_id == device_id)
        .order_by(models.DeviceHistory.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    
    return [_device_history_to_response(h, db) for h in history]


# ================== DeviceType CRUD ==================

@router.get("/device-types", response_model=List[schemas.DeviceTypeResponse])
def list_device_types(
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    """List all device types"""
    device_types = (
        db.query(models.DeviceType)
        .order_by(models.DeviceType.name.asc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    
    return [schemas.DeviceTypeResponse(**dt.__dict__) for dt in device_types]


@router.post("/device-types", response_model=schemas.DeviceTypeResponse, status_code=status.HTTP_201_CREATED)
def create_device_type(
    device_type: schemas.DeviceTypeCreate,
    db: Session = Depends(get_db),
):
    """Create a new device type"""
    # Check name uniqueness
    existing = db.query(models.DeviceType).filter(
        models.DeviceType.name == device_type.name
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Device type with name '{device_type.name}' already exists"
        )
    
    db_device_type = models.DeviceType(**device_type.dict())
    db.add(db_device_type)
    db.commit()
    db.refresh(db_device_type)
    
    return schemas.DeviceTypeResponse(**db_device_type.__dict__)


@router.get("/device-types/{device_type_id}", response_model=schemas.DeviceTypeResponse)
def get_device_type(
    device_type_id: int,
    db: Session = Depends(get_db),
):
    """Get a specific device type"""
    device_type = db.query(models.DeviceType).get(device_type_id)
    if not device_type:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Device type with ID {device_type_id} not found"
        )
    
    return schemas.DeviceTypeResponse(**device_type.__dict__)


@router.put("/device-types/{device_type_id}", response_model=schemas.DeviceTypeResponse)
def update_device_type(
    device_type_id: int,
    device_type_update: schemas.DeviceTypeUpdate,
    db: Session = Depends(get_db),
):
    """Update a device type"""
    db_device_type = db.query(models.DeviceType).get(device_type_id)
    if not db_device_type:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Device type with ID {device_type_id} not found"
        )
    
    # Check name uniqueness if name is being updated
    if device_type_update.name is not None and device_type_update.name != db_device_type.name:
        existing = db.query(models.DeviceType).filter(
            models.DeviceType.name == device_type_update.name
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Device type with name '{device_type_update.name}' already exists"
            )
    
    update_data = device_type_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        if hasattr(db_device_type, field):
            setattr(db_device_type, field, value)
    
    db.commit()
    db.refresh(db_device_type)
    
    return schemas.DeviceTypeResponse(**db_device_type.__dict__)


@router.delete("/device-types/{device_type_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_device_type(
    device_type_id: int,
    db: Session = Depends(get_db),
):
    """Delete a device type"""
    device_type = db.query(models.DeviceType).get(device_type_id)
    if not device_type:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Device type with ID {device_type_id} not found"
        )
    
    # Check if any devices reference this type
    device_count = db.query(InventoryDevice).filter(
        InventoryDevice.device_type_id == device_type_id
    ).count()
    
    if device_count > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot delete device type: {device_count} device(s) are using it"
        )
    
    db.delete(device_type)
    db.commit()
    
    return None


# ================== Manufacturer CRUD ==================

@router.get("/manufacturers", response_model=List[schemas.ManufacturerResponse])
def list_manufacturers(
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    """List all manufacturers"""
    manufacturers = (
        db.query(models.Manufacturer)
        .order_by(models.Manufacturer.name.asc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    
    return [schemas.ManufacturerResponse(**m.__dict__) for m in manufacturers]


@router.post("/manufacturers", response_model=schemas.ManufacturerResponse, status_code=status.HTTP_201_CREATED)
def create_manufacturer(
    manufacturer: schemas.ManufacturerCreate,
    db: Session = Depends(get_db),
):
    """Create a new manufacturer"""
    # Check name uniqueness
    existing = db.query(models.Manufacturer).filter(
        models.Manufacturer.name == manufacturer.name
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Manufacturer with name '{manufacturer.name}' already exists"
        )
    
    db_manufacturer = models.Manufacturer(**manufacturer.dict())
    db.add(db_manufacturer)
    db.commit()
    db.refresh(db_manufacturer)
    
    return schemas.ManufacturerResponse(**db_manufacturer.__dict__)


@router.get("/manufacturers/{manufacturer_id}", response_model=schemas.ManufacturerResponse)
def get_manufacturer(
    manufacturer_id: int,
    db: Session = Depends(get_db),
):
    """Get a specific manufacturer"""
    manufacturer = db.query(models.Manufacturer).get(manufacturer_id)
    if not manufacturer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Manufacturer with ID {manufacturer_id} not found"
        )
    
    return schemas.ManufacturerResponse(**manufacturer.__dict__)


@router.put("/manufacturers/{manufacturer_id}", response_model=schemas.ManufacturerResponse)
def update_manufacturer(
    manufacturer_id: int,
    manufacturer_update: schemas.ManufacturerUpdate,
    db: Session = Depends(get_db),
):
    """Update a manufacturer"""
    db_manufacturer = db.query(models.Manufacturer).get(manufacturer_id)
    if not db_manufacturer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Manufacturer with ID {manufacturer_id} not found"
        )
    
    # Check name uniqueness if name is being updated
    if manufacturer_update.name is not None and manufacturer_update.name != db_manufacturer.name:
        existing = db.query(models.Manufacturer).filter(
            models.Manufacturer.name == manufacturer_update.name
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Manufacturer with name '{manufacturer_update.name}' already exists"
            )
    
    update_data = manufacturer_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        if hasattr(db_manufacturer, field):
            setattr(db_manufacturer, field, value)
    
    db.commit()
    db.refresh(db_manufacturer)
    
    return schemas.ManufacturerResponse(**db_manufacturer.__dict__)


@router.delete("/manufacturers/{manufacturer_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_manufacturer(
    manufacturer_id: int,
    db: Session = Depends(get_db),
):
    """Delete a manufacturer"""
    manufacturer = db.query(models.Manufacturer).get(manufacturer_id)
    if not manufacturer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Manufacturer with ID {manufacturer_id} not found"
        )
    
    # Check if any devices reference this manufacturer
    device_count = db.query(InventoryDevice).filter(
        InventoryDevice.manufacturer_id == manufacturer_id
    ).count()
    
    if device_count > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot delete manufacturer: {device_count} device(s) are using it"
        )
    
    db.delete(manufacturer)
    db.commit()
    
    return None


# ================== Site CRUD ==================

@router.get("/sites", response_model=List[schemas.SiteResponse])
def list_sites(
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    """List all sites"""
    sites = (
        db.query(models.Site)
        .order_by(models.Site.name.asc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    
    return [schemas.SiteResponse(**s.__dict__) for s in sites]


@router.post("/sites", response_model=schemas.SiteResponse, status_code=status.HTTP_201_CREATED)
def create_site(
    site: schemas.SiteCreate,
    db: Session = Depends(get_db),
):
    """Create a new site"""
    # Check name uniqueness
    existing = db.query(models.Site).filter(
        models.Site.name == site.name
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Site with name '{site.name}' already exists"
        )
    
    db_site = models.Site(**site.dict())
    db.add(db_site)
    db.commit()
    db.refresh(db_site)
    
    return schemas.SiteResponse(**db_site.__dict__)


@router.get("/sites/{site_id}", response_model=schemas.SiteResponse)
def get_site(
    site_id: int,
    db: Session = Depends(get_db),
):
    """Get a specific site"""
    site = db.query(models.Site).get(site_id)
    if not site:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Site with ID {site_id} not found"
        )
    
    return schemas.SiteResponse(**site.__dict__)


@router.put("/sites/{site_id}", response_model=schemas.SiteResponse)
def update_site(
    site_id: int,
    site_update: schemas.SiteUpdate,
    db: Session = Depends(get_db),
):
    """Update a site"""
    db_site = db.query(models.Site).get(site_id)
    if not db_site:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Site with ID {site_id} not found"
        )
    
    # Check name uniqueness if name is being updated
    if site_update.name is not None and site_update.name != db_site.name:
        existing = db.query(models.Site).filter(
            models.Site.name == site_update.name
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Site with name '{site_update.name}' already exists"
            )
    
    update_data = site_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        if hasattr(db_site, field):
            setattr(db_site, field, value)
    
    db.commit()
    db.refresh(db_site)
    
    return schemas.SiteResponse(**db_site.__dict__)


@router.delete("/sites/{site_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_site(
    site_id: int,
    db: Session = Depends(get_db),
):
    """Delete a site"""
    site = db.query(models.Site).get(site_id)
    if not site:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Site with ID {site_id} not found"
        )
    
    # Check if any devices reference this site
    device_count = db.query(InventoryDevice).filter(
        InventoryDevice.site_id == site_id
    ).count()
    
    if device_count > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot delete site: {device_count} device(s) are using it"
        )
    
    db.delete(site)
    db.commit()
    
    return None


# ================== Tag Management ==================

@router.get("/tags", response_model=List[schemas.TagResponse])
def list_tags(
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    """List all tags"""
    tags = (
        db.query(models.Tag)
        .order_by(models.Tag.name.asc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    
    return [schemas.TagResponse(**t.__dict__) for t in tags]


@router.post("/tags", response_model=schemas.TagResponse, status_code=status.HTTP_201_CREATED)
def create_tag(
    tag: schemas.TagCreate,
    db: Session = Depends(get_db),
):
    """Create a new tag"""
    # Check name uniqueness
    existing = db.query(models.Tag).filter(
        models.Tag.name == tag.name
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Tag with name '{tag.name}' already exists"
        )
    
    db_tag = models.Tag(**tag.dict())
    db.add(db_tag)
    db.commit()
    db.refresh(db_tag)
    
    return schemas.TagResponse(**db_tag.__dict__)


@router.put("/tags/{tag_id}", response_model=schemas.TagResponse)
def update_tag(
    tag_id: int,
    tag_update: schemas.TagUpdate,
    db: Session = Depends(get_db),
):
    """Update a tag"""
    db_tag = db.query(models.Tag).get(tag_id)
    if not db_tag:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Tag with ID {tag_id} not found"
        )
    
    # Check name uniqueness if name is being updated
    if tag_update.name is not None and tag_update.name != db_tag.name:
        existing = db.query(models.Tag).filter(
            models.Tag.name == tag_update.name
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Tag with name '{tag_update.name}' already exists"
            )
    
    update_data = tag_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        if hasattr(db_tag, field):
            setattr(db_tag, field, value)
    
    db.commit()
    db.refresh(db_tag)
    
    return schemas.TagResponse(**db_tag.__dict__)


@router.delete("/tags/{tag_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_tag(
    tag_id: int,
    db: Session = Depends(get_db),
):
    """Delete a tag"""
    tag = db.query(models.Tag).get(tag_id)
    if not tag:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Tag with ID {tag_id} not found"
        )
    
    # DeviceTag relationships will be cascade deleted by FK constraint
    db.delete(tag)
    db.commit()
    
    return None


# ================== Device Tag Assignment ==================

@router.get("/devices/{device_id}/tags", response_model=List[schemas.TagResponse])
def get_device_tags(
    device_id: int,
    db: Session = Depends(get_db),
):
    """Get all tags for a device"""
    device = db.query(InventoryDevice).get(device_id)
    if not device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Device with ID {device_id} not found"
        )
    
    # Get tags through DeviceTag relationships
    device_tags = (
        db.query(models.Tag)
        .join(InventoryDeviceTag)
        .filter(InventoryDeviceTag.device_id == device_id)
        .all()
    )
    
    return [schemas.TagResponse(**tag.__dict__) for tag in device_tags]


@router.post("/devices/{device_id}/tags", response_model=List[schemas.TagResponse])
def add_device_tags(
    device_id: int,
    request: schemas.TagAssignmentRequest,
    db: Session = Depends(get_db),
):
    """Add tags to a device"""
    device = db.query(InventoryDevice).get(device_id)
    if not device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Device with ID {device_id} not found"
        )
    
    # Validate all tag_ids exist
    tags = db.query(models.Tag).filter(models.Tag.id.in_(request.tag_ids)).all()
    if len(tags) != len(request.tag_ids):
        found_ids = {tag.id for tag in tags}
        missing_ids = set(request.tag_ids) - found_ids
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Tag(s) with ID(s) {missing_ids} not found"
        )
    
    # Create DeviceTag entries (skip if already exists - idempotent)
    for tag_id in request.tag_ids:
        existing = db.query(InventoryDeviceTag).filter(
            InventoryDeviceTag.device_id == device_id,
            InventoryDeviceTag.tag_id == tag_id,
        ).first()
        
        if not existing:
            device_tag = InventoryDeviceTag(
                device_id=device_id,
                tag_id=tag_id,
            )
            db.add(device_tag)
    
    db.commit()
    
    # Return all device tags
    device_tags = (
        db.query(models.Tag)
        .join(InventoryDeviceTag)
        .filter(InventoryDeviceTag.device_id == device_id)
        .all()
    )
    
    return [schemas.TagResponse(**tag.__dict__) for tag in device_tags]


@router.delete("/devices/{device_id}/tags/{tag_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_device_tag(
    device_id: int,
    tag_id: int,
    db: Session = Depends(get_db),
):
    """Remove a tag from a device"""
    device = db.query(InventoryDevice).get(device_id)
    if not device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Device with ID {device_id} not found"
        )
    
    tag = db.query(models.Tag).get(tag_id)
    if not tag:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Tag with ID {tag_id} not found"
        )
    
    device_tag = db.query(InventoryDeviceTag).filter(
        InventoryDeviceTag.device_id == device_id,
        InventoryDeviceTag.tag_id == tag_id,
    ).first()
    
    if not device_tag:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Tag {tag_id} is not assigned to device {device_id}"
        )
    
    db.delete(device_tag)
    db.commit()
    
    return None


# ================== Statistics/Summary ==================

@router.get("/stats/summary")
def get_inventory_summary(db: Session = Depends(get_db)):
    """Get inventory statistics summary"""
    total = db.query(InventoryDevice).count()
    
    # Count by status
    by_status = (
        db.query(
            InventoryDevice.status,
            func.count(InventoryDevice.id).label("count")
        )
        .group_by(InventoryDevice.status)
        .all()
    )
    
    # Count by device type
    by_device_type = (
        db.query(
            models.DeviceType.name,
            func.count(InventoryDevice.id).label("count")
        )
        .join(InventoryDevice)
        .group_by(models.DeviceType.name)
        .all()
    )
    
    # Count by site
    by_site = (
        db.query(
            models.Site.name,
            func.count(InventoryDevice.id).label("count")
        )
        .join(InventoryDevice)
        .group_by(models.Site.name)
        .all()
    )
    
    return {
        "total_devices": total,
        "by_status": {stat: count for stat, count in by_status},
        "by_device_type": {name: count for name, count in by_device_type},
        "by_site": {name: count for name, count in by_site},
    }


# ================== Helper Functions ==================

def _device_to_response(device: InventoryDevice, db: Session) -> schemas.DeviceResponse:
    """Convert Device model to DeviceResponse schema"""
    # Get tags for this device
    device_tags = (
        db.query(models.Tag)
        .join(InventoryDeviceTag)
        .filter(InventoryDeviceTag.device_id == device.id)
        .all()
    )
    
    return schemas.DeviceResponse(
        id=device.id,
        oi_id=device.oi_id,
        name=device.name,
        device_type_id=device.device_type_id,
        manufacturer_id=device.manufacturer_id,
        model=device.model,
        serial_number=device.serial_number,
        status=device.status,
        site_id=device.site_id,
        rack=device.rack,
        u_position=device.u_position,
        hostname=device.hostname,
        mgmt_ip=device.mgmt_ip,
        polatis_name=device.polatis_name,
        polatis_port_range=device.polatis_port_range,
        owner_group=device.owner_group,
        notes=device.notes,
        created_at=device.created_at,
        updated_at=device.updated_at,
        created_by_id=device.created_by_id,
        updated_by_id=device.updated_by_id,
        device_type_name=device.device_type.name if device.device_type else None,
        manufacturer_name=device.manufacturer.name if device.manufacturer else None,
        site_name=device.site.name if device.site else None,
        tags=[schemas.TagResponse(**tag.__dict__) for tag in device_tags],
    )


def _device_history_to_response(history: models.DeviceHistory, db: Session) -> schemas.DeviceHistoryResponse:
    """Convert DeviceHistory model to DeviceHistoryResponse schema"""
    return schemas.DeviceHistoryResponse(
        id=history.id,
        device_id=history.device_id,
        action=history.action,
        field_name=history.field_name,
        old_value=history.old_value,
        new_value=history.new_value,
        changed_by_id=history.changed_by_id,
        changed_by_username=history.changed_by.username if history.changed_by else None,
        notes=history.notes,
        extra=history.extra,
        created_at=history.created_at,
    )

# ================== Attachment Management ==================

UPLOAD_DIR = "/app/uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.post("/devices/{device_id}/attachments", response_model=schemas.DeviceResponse)
def upload_attachment(
    device_id: int,
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """Upload an attachment for a device"""
    user_id = get_current_user_id(request)
    
    device = db.query(InventoryDevice).get(device_id)
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    # Generate safe filename
    # Prefix with device_id to avoid collisions or grouping
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    safe_filename = f"{device_id}_{timestamp}_{file.filename}"
    file_path = os.path.join(UPLOAD_DIR, safe_filename)
    
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")
        
    # Determine file type
    content_type = file.content_type
    file_type = "document"
    if "image" in content_type:
        file_type = "image"
    
    # DB Record
    attachment = models.DeviceAttachment(
        device_id=device_id,
        file_name=file.filename,
        file_path=file_path,
        file_type=file_type,
        mime_type=content_type,
        size_bytes=os.path.getsize(file_path),
        uploaded_by_id=user_id
    )
    db.add(attachment)
    db.commit()
    db.refresh(device)
    
    # History
    history = models.DeviceHistory(
        device_id=device.id,
        action="attachment_added",
        changed_by_id=user_id,
        notes=f"Added attachment: {file.filename}"
    )
    db.add(history)
    db.commit()
    
    return _device_to_response(device, db)

@router.delete("/attachments/{attachment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_attachment(
    attachment_id: int,
    request: Request,
    db: Session = Depends(get_db),
):
    """Delete an attachment"""
    user_id = get_current_user_id(request)
    
    attachment = db.query(models.DeviceAttachment).get(attachment_id)
    if not attachment:
        raise HTTPException(status_code=404, detail="Attachment not found")
        
    device_id = attachment.device_id
    file_path = attachment.file_path
    file_name = attachment.file_name
    
    # Check permissions (assuming only logged in users can delete, maybe enforce admin?)
    # For now, simplistic check
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    # Remove file from disk
    if os.path.exists(file_path):
        try:
            os.remove(file_path)
        except Exception as e:
            # Log error but continue to delete DB record
            print(f"Error removing file {file_path}: {e}")
            
    db.delete(attachment)
    
    # History
    history = models.DeviceHistory(
        device_id=device_id,
        action="attachment_deleted",
        changed_by_id=user_id,
        notes=f"Deleted attachment: {file_name}"
    )
    db.add(history)
    
    db.commit()
    return None

@router.get("/attachments/{attachment_id}/download")
def download_attachment(
    attachment_id: int,
    db: Session = Depends(get_db),
):
    """Download an attachment"""
    attachment = db.query(models.DeviceAttachment).get(attachment_id)
    if not attachment:
        raise HTTPException(status_code=404, detail="Attachment not found")
        
    if not os.path.exists(attachment.file_path):
        raise HTTPException(status_code=404, detail="File missing on server")
        
    return FileResponse(
        attachment.file_path, 
        filename=attachment.file_name, 
        media_type=attachment.mime_type
    )
