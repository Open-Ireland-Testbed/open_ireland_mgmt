# schemas.py

from pydantic import BaseModel, validator, IPvAnyAddress, Field, ConfigDict
from typing import Optional, List, Dict, Any
from datetime import datetime, date
from enum import Enum


# ================== User Part ==================
class UserBase(BaseModel):
    username: str
    email: Optional[str] = None
    discord_id: Optional[str] = None


class UserCreate(UserBase):
    password: str
    password2: str

    @validator("password")
    def password_length(cls, v):
        """Check password has at least 8 characters."""
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters long.")
        return v

    @validator("password2")
    def passwords_match(cls, v, values, **kwargs):
        """Ensure password2 matches password."""
        if "password" in values and v != values["password"]:
            raise ValueError("Passwords do not match.")
        return v


class User(BaseModel):
    id: int
    username: str
    email: Optional[str] = None
    is_admin: bool
    discord_id: Optional[str] = None

    class Config:
        orm_mode = True


class UserLogin(BaseModel):
    username: str
    password: str


# ================== Booking Part ==================
class BookingItem(BaseModel):
    device_type: str
    device_name: str
    start_time: datetime
    end_time: datetime
    status: Optional[str] = "PENDING"


class BookingsRequest(BaseModel):
    user_id: int
    message: Optional[str] = ""
    bookings: List[BookingItem]
    collaborators: List[str] = []
    grouped_booking_id: Optional[str] = None


class BookingStatusUpdate(BaseModel):
    status: str


class CollaboratorsUpdate(BaseModel):
    owner_id: int
    collaborators: List[str]
    booking_ids: Optional[List[int]] = None


class BookingCancelRequest(BaseModel):
    user_id: Optional[int] = None


class RebookRequest(BaseModel):
    user_id: int
    start_date: date
    end_date: date
    booking_ids: Optional[List[int]] = None
    message: Optional[str] = ""


class ExtendBookingRequest(BaseModel):
    user_id: int
    new_end_date: date
    booking_ids: Optional[List[int]] = None


class GroupActionRequest(BaseModel):
    user_id: int


class GroupExtendRequest(GroupActionRequest):
    new_end_date: date


class GroupRebookRequest(GroupActionRequest):
    start_date: date
    end_date: date
    message: Optional[str] = ""


# ================== Admin Part ==================


class BookingFavoriteBase(BaseModel):
    name: Optional[str] = None
    grouped_booking_id: str
    device_snapshot: List[dict]


class BookingFavoriteCreate(BookingFavoriteBase):
    user_id: int


class BookingFavoriteUpdate(BaseModel):
    name: Optional[str] = None


class AdminCreate(BaseModel):
    username: str
    email: Optional[str] = None
    password: str
    password2: str
    admin_secret: str
    discord_id: Optional[str] = None

    @validator("password")
    def password_length(cls, v):
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters long.")
        return v


class AdminRoleType(str, Enum):
    super_admin = "Super Admin"
    admin = "Admin"
    approver = "Approver"
    viewer = "Viewer"


class AdminStatus(str, Enum):
    active = "active"
    disabled = "disabled"


class AdminRolePayload(BaseModel):
    role: AdminRoleType
    status: AdminStatus = AdminStatus.active
    permissions: Optional[Dict[str, bool]] = None
    approval_limits: Optional[Dict[str, Any]] = None


class AdminRoleResponse(AdminRolePayload):
    user_id: int
    updated_at: datetime


class PaginationMeta(BaseModel):
    total: int
    limit: int
    offset: int


class DashboardCard(BaseModel):
    id: str
    label: str
    value: int
    delta: Optional[float] = None
    delta_direction: Optional[str] = None  # "up" | "down"
    hint: Optional[str] = None


class DeviceSummaryCounts(BaseModel):
    total: int
    active: int
    maintenance: int
    offline: int


class ActivityActor(BaseModel):
    id: Optional[int] = None
    name: Optional[str] = None
    role: Optional[str] = None


class ActivityEntity(BaseModel):
    type: str
    id: Optional[str] = None
    label: Optional[str] = None


class ActivityItem(BaseModel):
    id: int
    timestamp: datetime
    actor: Optional[ActivityActor] = None
    action: str
    entity: Optional[ActivityEntity] = None
    outcome: Optional[str] = None
    message: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


class TopologyConflictItem(BaseModel):
    topology_id: int
    name: str
    submitted_by: Optional[str] = None
    conflict_count: int
    last_updated: Optional[datetime] = None


class DashboardResponse(BaseModel):
    cards: List[DashboardCard]
    device_counts: DeviceSummaryCounts
    recent_activity: List[ActivityItem]
    topology_conflicts: List[TopologyConflictItem]


class BookingUserSummary(BaseModel):
    id: int
    username: str
    role: Optional[str] = None


class BookingDeviceSummary(BaseModel):
    id: int
    name: str
    type: str
    status: Optional[str] = None


class BookingRow(BaseModel):
    booking_id: int
    grouped_booking_id: Optional[str] = None
    user: BookingUserSummary
    device: BookingDeviceSummary
    start_time: datetime
    end_time: datetime
    status: str
    comment: Optional[str] = None
    conflict: bool = False
    conflict_notes: Optional[List[str]] = None
    awaiting_my_action: bool = False
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class BookingListResponse(BaseModel):
    items: List[BookingRow]
    meta: PaginationMeta


class BookingBulkActionRequest(BaseModel):
    booking_ids: List[int]
    comment: Optional[str] = None


class BookingBulkActionResult(BaseModel):
    succeeded: List[int]
    failed: List[Dict[str, Any]]


class BookingDetailTimelineItem(BaseModel):
    booking_id: int
    start_time: datetime
    end_time: datetime
    status: str
    owner: BookingUserSummary


class BookingConflictItem(BaseModel):
    booking_id: int
    status: str
    owner: BookingUserSummary
    overlap_start: datetime
    overlap_end: datetime


class BookingDetailResponse(BaseModel):
    booking: BookingRow
    timeline: List[BookingDetailTimelineItem]
    conflicts: List[BookingConflictItem]
    device_health: Optional[Dict[str, Any]] = None
    history: List[BookingDetailTimelineItem]


class BookingConflictResolutionEntry(BaseModel):
    booking_id: int
    status: str
    comment: Optional[str] = None


class BookingConflictResolutionRequest(BaseModel):
    resolution: List[BookingConflictResolutionEntry]
    audit_message: Optional[str] = None


class DeviceOwnerSummary(BaseModel):
    id: Optional[int] = None
    username: Optional[str] = None


class DeviceHealthMeta(BaseModel):
    status: Optional[str] = None
    heartbeat_at: Optional[datetime] = None
    metrics: Optional[Dict[str, Any]] = None


class DeviceRow(BaseModel):
    id: int
    name: str
    type: str
    status: str
    
    owner: Optional[DeviceOwnerSummary] = None
    last_updated: Optional[datetime] = None
    tags: List[str] = Field(default_factory=list)
    site: Optional[str] = None
    location_path: Optional[str] = None
    health: Optional[DeviceHealthMeta] = None


class DeviceListResponse(BaseModel):
    items: List[DeviceRow]
    meta: PaginationMeta


class DeviceStatusUpdateRequest(BaseModel):
    device_ids: List[int]
    status: str
    reason: Optional[str] = None


class DeviceOwnerUpdateRequest(BaseModel):
    device_ids: List[int]
    owner_id: Optional[int] = None


class DeviceTagUpdateRequest(BaseModel):
    device_ids: List[int]
    tags: List[str]
    mode: str = "set"  # set|add|remove


class DeviceBulkActionResponse(BaseModel):
    succeeded: List[int]
    failed: List[Dict[str, Any]]


class AdminUserRow(BaseModel):
    id: int
    username: str
    email: Optional[str] = None
    role: AdminRoleType
    status: AdminStatus
    bookings_count: int = 0
    last_active: Optional[datetime] = None
    approval_limits: Optional[Dict[str, Any]] = None
    devices_operated: Optional[int] = None


class AdminUserListResponse(BaseModel):
    items: List[AdminUserRow]
    meta: PaginationMeta


class AdminUserInviteRequest(BaseModel):
    email: str
    handle: Optional[str] = None
    role: AdminRoleType


class AdminUserRoleUpdateRequest(BaseModel):
    role: AdminRoleType
    approval_limits: Optional[Dict[str, Any]] = None


class AdminUserStatusUpdateRequest(BaseModel):
    status: AdminStatus


class TopologyRow(BaseModel):
    id: int
    name: str
    status: str
    submitted_by: Optional[str] = None
    submitted_at: datetime
    resolved_at: Optional[datetime] = None
    conflict_count: int = 0


class TopologyListResponse(BaseModel):
    items: List[TopologyRow]
    meta: PaginationMeta


class TopologyActionRequest(BaseModel):
    action: str
    comment: Optional[str] = None


class AuditLogRow(BaseModel):
    id: int
    timestamp: datetime
    actor: Optional[ActivityActor] = None
    action: str
    entity: Optional[ActivityEntity] = None
    outcome: Optional[str] = None
    message: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


class AuditLogListResponse(BaseModel):
    items: List[AuditLogRow]
    meta: PaginationMeta


class AdminSettingsResponse(BaseModel):
    values: Dict[str, Any]


class AdminSettingsUpdateRequest(BaseModel):
    values: Dict[str, Any]


# ================== Device Part ==================
class DeviceCreate(BaseModel):
    polatis_name: Optional[str] = None
    deviceType: str
    deviceName: str
    ip_address: Optional[IPvAnyAddress] = None
    status: str
    maintenance_start: Optional[str] = Field(
        None,
        pattern=r"^(7 AM - 12 PM|12 PM - 6 PM|6 PM - 11 PM|All Day)/\d{4}-\d{2}-\d{2}$",
        examples=["All Day/2023-10-01"],
    )
    maintenance_end: Optional[str] = Field(
        None,
        pattern=r"^(7 AM - 12 PM|12 PM - 6 PM|6 PM - 11 PM|All Day)/\d{4}-\d{2}-\d{2}$",
        examples=["All Day/2023-10-02"],
    )
    Out_Port: int
    In_Port: int


class DeviceResponse(BaseModel):
    id: int
    polatis_name: Optional[str] = None
    deviceType: str
    deviceName: str
    ip_address: Optional[IPvAnyAddress] = None
    status: str
    maintenance_start: Optional[str] = Field(
        None,
        pattern=r"^(7 AM - 12 PM|12 PM - 6 PM|6 PM - 11 PM|All Day)/\d{4}-\d{2}-\d{2}$",
        examples=["All Day/2023-10-01"],
    )
    maintenance_end: Optional[str] = Field(
        None,
        pattern=r"^(7 AM - 12 PM|12 PM - 6 PM|6 PM - 11 PM|All Day)/\d{4}-\d{2}-\d{2}$",
        examples=["All Day/2023-10-05"],
    )
    Out_Port: int
    In_Port: int


    class Config:
        orm_mode = True


class DeviceStatus(str, Enum):
    available = "Available"
    maintenance = "Maintenance"


class DeviceUpdateFull(BaseModel):
    polatis_name: Optional[str] = None
    deviceType: str
    deviceName: str
    ip_address: Optional[IPvAnyAddress] = None
    status: str
    maintenance_start: Optional[str] = Field(
        None,
        pattern=r"^(7 AM - 12 PM|12 PM - 6 PM|6 PM - 11 PM|All Day)/\d{4}-\d{2}-\d{2}$",
        examples=["All Day/2023-10-01"],
    )
    maintenance_end: Optional[str] = Field(
        None,
        pattern=r"^(7 AM - 12 PM|12 PM - 6 PM|6 PM - 11 PM|All Day)/\d{4}-\d{2}-\d{2}$",
        examples=["All Day/2023-10-02"],
    )
    Out_Port: int
    In_Port: int


# ================== Conflicts check ==================
class ConflictCheckRequest(BaseModel):
    device_ids: List[int]
    start: datetime
    end: datetime


class ConflictTimeSlot(BaseModel):
    date: str
    start_time: str
    end_time: str
    conflict_type: str


class DeviceConflict(BaseModel):
    device_id: int
    device_name: str
    status: str
    conflicts: List[ConflictTimeSlot]


# ================== PDU Part ==================
class Sensor(BaseModel):
    slot_idx: int = 0


class Outlet(BaseModel):
    device_ip: Optional[str] = None
    outlet_idx: int
    mode: str = "always_on"


class PDUCreate(BaseModel):
    name: str
    host: str
    user: str = "admin"
    passwd: str = "password"
    pdu_path: str = "/model/pdu/0"
    external_id: str
    sensors: List[Sensor] = [Sensor()]
    outlets: List[Outlet] = []
    connected: bool = False

    class Config:
        orm_mode = True


class PDUResponse(BaseModel):
    name: str
    host: str
    user: str
    pdu_path: str
    sensors: List[Sensor]
    outlets: List[Outlet]
    connected: bool = False
    last_updated: Optional[str] = None
    temperature: Optional[float] = None
    humidity: Optional[float] = None
    power: Optional[float] = None

    model_config = ConfigDict(from_attributes=True)


class OutletControl(BaseModel):
    status: str  # "on" or "off"


class SensorData(BaseModel):
    temperature: Optional[float] = None
    humidity: Optional[float] = None
    power: Optional[float] = None


# ================== Topology Part ==================
class TopologyNode(BaseModel):
    id: str
    type: str
    position: dict
    data: dict


class TopologyEdge(BaseModel):
    id: Optional[str] = None
    source: str
    target: str
    type: Optional[str] = None


class TopologyCreate(BaseModel):
    name: str
    user_id: int
    nodes: List[dict]
    edges: List[dict]


class TopologyUpdate(BaseModel):
    name: str
    nodes: List[dict]
    edges: List[dict]


class TopologyResponse(BaseModel):
    id: int
    user_id: int
    name: str
    nodes: List[dict]
    edges: List[dict]
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True


class TopologyCheckRequest(BaseModel):
    nodes: List[dict]
    edges: List[dict]


class NodeAvailability(BaseModel):
    status: str  # "available", "unavailable", "unknown"
    details: Optional[dict] = None


class TopologyAvailabilityResponse(BaseModel):
    availability: dict  # node_id -> NodeAvailability


class TopologyResolveRequest(BaseModel):
    nodes: List[dict]
    edges: List[dict]
    start_time: datetime
    end_time: datetime


class DeviceMapping(BaseModel):
    logical_node_id: str
    physical_device_id: Optional[int] = None
    physical_device_name: Optional[str] = None
    physical_device_type: Optional[str] = None
    fit_score: float  # 0.0 to 1.0
    confidence: str  # "high", "medium", "low"
    alternatives: List[dict] = []  # Alternative device options
    explanation: Optional[str] = ""  # Explanation of the fit score


class LinkMapping(BaseModel):
    logical_edge_id: str
    source_mapping: Optional[str] = None
    target_mapping: Optional[str] = None
    physical_link_id: Optional[str] = None
    fit_score: float


class TopologyMapping(BaseModel):
    mapping_id: str
    total_fit_score: float
    node_mappings: List[DeviceMapping]
    link_mappings: List[LinkMapping]
    notes: Optional[str] = None


class TopologyResolveResponse(BaseModel):
    mappings: List[TopologyMapping]  # Multiple mapping options sorted by fit score
    total_options: int


class AvailabilityForecastRequest(BaseModel):
    device_ids: List[int]
    start_time: datetime
    end_time: datetime
    forecast_window_days: Optional[int] = 7


class DeviceAvailabilityForecast(BaseModel):
    device_id: int
    availability_probability: float
    confidence: float
    factors: List[str]
    earliest_available_slot: Optional[datetime] = None


class AvailabilityForecastResponse(BaseModel):
    forecasts: List[DeviceAvailabilityForecast]


class TopologySuggestRequest(BaseModel):
    nodes: List[dict]
    edges: List[dict]
    start_time: datetime
    end_time: datetime


class ConfigurationRecommendation(BaseModel):
    mapping_id: str
    recommendation_score: float
    performance_score: float
    availability_score: float
    efficiency_score: float
    reliability_score: float
    rationale: str
    earliest_available_slot: Optional[datetime] = None
    mapping: TopologyMapping


class TopologySuggestResponse(BaseModel):
    recommendations: List[ConfigurationRecommendation]
    total_recommendations: int
