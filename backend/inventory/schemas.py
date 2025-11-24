# schemas.py - Inventory Management Pydantic Schemas

from pydantic import BaseModel, Field, validator, IPvAnyAddress
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


# ================== Device Status Enum ==================

class DeviceStatus(str, Enum):
    """Status of inventory devices"""
    ACTIVE = "active"
    IN_MAINTENANCE = "in_maintenance"
    RETIRED = "retired"
    SPARE = "spare"
    PLANNED = "planned"


# ================== DeviceType Schemas ==================

class DeviceTypeBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    category: str = Field(..., max_length=50)  # OPTICAL, COMPUTE, STORAGE, INFRA
    description: Optional[str] = None
    is_schedulable: bool = False
    has_ports: bool = False

    @validator("category")
    def validate_category(cls, v):
        allowed = {"OPTICAL", "COMPUTE", "STORAGE", "INFRA"}
        if v.upper() not in allowed:
            raise ValueError(f"Category must be one of: {', '.join(allowed)}")
        return v.upper()


class DeviceTypeCreate(DeviceTypeBase):
    """Schema for creating a device type"""
    pass


class DeviceTypeUpdate(BaseModel):
    """Schema for updating a device type"""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    category: Optional[str] = Field(None, max_length=50)
    description: Optional[str] = None
    is_schedulable: Optional[bool] = None
    has_ports: Optional[bool] = None

    @validator("category")
    def validate_category(cls, v):
        if v is not None:
            allowed = {"OPTICAL", "COMPUTE", "STORAGE", "INFRA"}
            if v.upper() not in allowed:
                raise ValueError(f"Category must be one of: {', '.join(allowed)}")
            return v.upper()
        return v


class DeviceTypeResponse(DeviceTypeBase):
    """Schema for device type response"""
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True


# ================== Manufacturer Schemas ==================

class ManufacturerBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    website: Optional[str] = Field(None, max_length=200)
    notes: Optional[str] = None

    @validator("website")
    def validate_website(cls, v):
        if v and not (v.startswith("http://") or v.startswith("https://")):
            raise ValueError("Website must be a valid URL starting with http:// or https://")
        return v


class ManufacturerCreate(ManufacturerBase):
    """Schema for creating a manufacturer"""
    pass


class ManufacturerUpdate(BaseModel):
    """Schema for updating a manufacturer"""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    website: Optional[str] = Field(None, max_length=200)
    notes: Optional[str] = None

    @validator("website")
    def validate_website(cls, v):
        if v and not (v.startswith("http://") or v.startswith("https://")):
            raise ValueError("Website must be a valid URL starting with http:// or https://")
        return v


class ManufacturerResponse(ManufacturerBase):
    """Schema for manufacturer response"""
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True


# ================== Site Schemas ==================

class SiteBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    address: Optional[str] = None
    notes: Optional[str] = None


class SiteCreate(SiteBase):
    """Schema for creating a site"""
    pass


class SiteUpdate(BaseModel):
    """Schema for updating a site"""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    address: Optional[str] = None
    notes: Optional[str] = None


class SiteResponse(SiteBase):
    """Schema for site response"""
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True


# ================== Tag Schemas ==================

class TagBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=50)
    description: Optional[str] = None
    color: Optional[str] = Field(None, max_length=20)

    @validator("color")
    def validate_color(cls, v):
        if v and not v.startswith("#"):
            raise ValueError("Color must be a hex color starting with #")
        if v and len(v) != 7:
            raise ValueError("Color must be a valid hex color (e.g., #FF5733)")
        return v


class TagCreate(TagBase):
    """Schema for creating a tag"""
    pass


class TagUpdate(BaseModel):
    """Schema for updating a tag"""
    name: Optional[str] = Field(None, min_length=1, max_length=50)
    description: Optional[str] = None
    color: Optional[str] = Field(None, max_length=20)

    @validator("color")
    def validate_color(cls, v):
        if v and not v.startswith("#"):
            raise ValueError("Color must be a hex color starting with #")
        if v and len(v) != 7:
            raise ValueError("Color must be a valid hex color (e.g., #FF5733)")
        return v


class TagResponse(TagBase):
    """Schema for tag response"""
    id: int
    created_at: datetime

    class Config:
        orm_mode = True


class DeviceTagResponse(BaseModel):
    """Schema for device tag relationship response"""
    tag_id: int
    tag_name: str
    tag_color: Optional[str] = None
    created_at: datetime


# ================== Device Schemas ==================

class DeviceBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    oi_id: Optional[str] = Field(None, max_length=50)
    device_type_id: int
    manufacturer_id: Optional[int] = None
    model: Optional[str] = Field(None, max_length=100)
    serial_number: Optional[str] = Field(None, max_length=100)
    status: DeviceStatus = DeviceStatus.ACTIVE
    site_id: Optional[int] = None
    rack: Optional[str] = Field(None, max_length=50)
    u_position: Optional[int] = Field(None, ge=0)
    hostname: Optional[str] = Field(None, max_length=100)
    mgmt_ip: Optional[IPvAnyAddress] = None
    polatis_name: Optional[str] = Field(None, max_length=100)
    polatis_port_range: Optional[str] = Field(None, max_length=100)
    owner_group: Optional[str] = Field(None, max_length=100)
    notes: Optional[str] = None


class DeviceCreate(DeviceBase):
    """Schema for creating a device"""
    pass


class DeviceUpdate(BaseModel):
    """Schema for updating a device (all fields optional)"""
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    oi_id: Optional[str] = Field(None, max_length=50)
    device_type_id: Optional[int] = None
    manufacturer_id: Optional[int] = None
    model: Optional[str] = Field(None, max_length=100)
    serial_number: Optional[str] = Field(None, max_length=100)
    status: Optional[DeviceStatus] = None
    site_id: Optional[int] = None
    rack: Optional[str] = Field(None, max_length=50)
    u_position: Optional[int] = Field(None, ge=0)
    hostname: Optional[str] = Field(None, max_length=100)
    mgmt_ip: Optional[IPvAnyAddress] = None
    polatis_name: Optional[str] = Field(None, max_length=100)
    polatis_port_range: Optional[str] = Field(None, max_length=100)
    owner_group: Optional[str] = Field(None, max_length=100)
    notes: Optional[str] = None


class DeviceResponse(DeviceBase):
    """Schema for device response"""
    id: int
    created_at: datetime
    updated_at: datetime
    created_by_id: Optional[int] = None
    updated_by_id: Optional[int] = None
    device_type_name: Optional[str] = None
    manufacturer_name: Optional[str] = None
    site_name: Optional[str] = None
    tags: List[TagResponse] = Field(default_factory=list)

    class Config:
        orm_mode = True


class DeviceSummary(BaseModel):
    """Lightweight summary of device"""
    id: int
    oi_id: Optional[str] = None
    name: str
    device_type_name: Optional[str] = None
    status: str
    site_name: Optional[str] = None


# ================== DeviceHistory Schemas ==================

class DeviceHistoryResponse(BaseModel):
    """Schema for device history entry"""
    id: int
    device_id: int
    action: str
    field_name: Optional[str] = None
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    changed_by_id: Optional[int] = None
    changed_by_username: Optional[str] = None
    notes: Optional[str] = None
    extra: Optional[Dict[str, Any]] = None
    created_at: datetime

    class Config:
        orm_mode = True


# ================== Legacy Maintenance Record Schemas ==================
# NOTE: These schemas are kept for historical data but endpoints will be removed in Phase 3
# The MaintenanceRecord model remains in the database but is not used by new API endpoints

class MaintenanceRecordBase(BaseModel):
    item_id: int
    maintenance_type: str = Field(..., max_length=50)
    description: Optional[str] = None
    performed_by: Optional[str] = Field(None, max_length=200)
    scheduled_date: Optional[datetime] = None
    performed_date: Optional[datetime] = None
    next_due_date: Optional[datetime] = None
    cost: Optional[float] = Field(None, ge=0)
    parts_used: Optional[List[Dict[str, Any]]] = None
    status: str = "scheduled"
    notes: Optional[str] = None
    outcome: Optional[str] = None
    extra: Optional[Dict[str, Any]] = None


class MaintenanceRecordCreate(MaintenanceRecordBase):
    """Schema for creating a maintenance record (legacy)"""
    pass


class MaintenanceRecordUpdate(BaseModel):
    """Schema for updating a maintenance record (legacy)"""
    maintenance_type: Optional[str] = Field(None, max_length=50)
    description: Optional[str] = None
    performed_by: Optional[str] = Field(None, max_length=200)
    scheduled_date: Optional[datetime] = None
    performed_date: Optional[datetime] = None
    next_due_date: Optional[datetime] = None
    cost: Optional[float] = Field(None, ge=0)
    parts_used: Optional[List[Dict[str, Any]]] = None
    status: Optional[str] = None
    notes: Optional[str] = None
    outcome: Optional[str] = None
    extra: Optional[Dict[str, Any]] = None


class MaintenanceRecordResponse(MaintenanceRecordBase):
    """Schema for maintenance record response (legacy)"""
    id: int
    created_at: datetime
    updated_at: datetime
    created_by_id: Optional[int] = None
    created_by_username: Optional[str] = None

    class Config:
        orm_mode = True


# ================== List/Query Schemas ==================

class PaginationParams(BaseModel):
    """Pagination parameters"""
    limit: int = Field(default=50, ge=1, le=500)
    offset: int = Field(default=0, ge=0)


class DeviceListResponse(BaseModel):
    """Response for listing devices"""
    items: List[DeviceResponse]
    total: int
    limit: int
    offset: int


class DeviceFilterParams(BaseModel):
    """Filter parameters for device queries"""
    device_type_id: Optional[int] = None
    manufacturer_id: Optional[int] = None
    site_id: Optional[int] = None
    status: Optional[DeviceStatus] = None
    tag_ids: Optional[List[int]] = None
    search: Optional[str] = None  # Search in name, model, serial_number, oi_id
    limit: int = Field(default=50, ge=1, le=500)
    offset: int = Field(default=0, ge=0)


class BulkUpdateRequest(BaseModel):
    """Schema for bulk updating multiple devices"""
    device_ids: List[int] = Field(..., min_items=1)
    updates: Dict[str, Any]  # Field name -> new value


class BulkUpdateResponse(BaseModel):
    """Response for bulk update operation"""
    succeeded: List[int]
    failed: List[Dict[str, Any]]  # {device_id: int, error: str}


class TagAssignmentRequest(BaseModel):
    """Schema for assigning tags to a device"""
    tag_ids: List[int] = Field(..., min_items=1)
