# models.py - Inventory Management Database Models

from sqlalchemy import (
    Column,
    Integer,
    String,
    ForeignKey,
    DateTime,
    Text,
    Boolean,
    JSON,
    Float,
)
from sqlalchemy.orm import relationship
from datetime import datetime

# Import Base from shared database module
from backend.core.database import Base

# Import scheduler models to reference User model
from backend.scheduler.models import User as SchedulerUser
import re

User = SchedulerUser


class DeviceType(Base):
    """Device type model - represents the type of device"""

    __tablename__ = "device_types"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False, index=True)
    category = Column(String(50), nullable=False, index=True)
    description = Column(Text, nullable=True)
    is_schedulable = Column(Boolean, nullable=False, default=False)
    has_ports = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(
        DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    # Relationships
    devices = relationship("InventoryDevice", back_populates="device_type")


class Manufacturer(Base):
    """Manufacturer model"""

    __tablename__ = "manufacturers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False, index=True)
    website = Column(String(200), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(
        DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    # Relationships
    devices = relationship("InventoryDevice", back_populates="manufacturer")


class Site(Base):
    """Site model - represents physical location"""

    __tablename__ = "sites"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False, index=True)
    address = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(
        DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    # Relationships
    devices = relationship("InventoryDevice", back_populates="site")


class Tag(Base):
    """Tag model for categorizing devices"""

    __tablename__ = "tags"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), unique=True, nullable=False, index=True)
    description = Column(Text, nullable=True)
    color = Column(String(20), nullable=True)  # Hex color for UI
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    # Relationships
    device_tags = relationship("InventoryDeviceTag", back_populates="tag")


class InventoryDeviceTag(Base):
    """Junction table for Device-Tag many-to-many relationship"""

    __tablename__ = "inventory_device_tags"

    device_id = Column(
        Integer,
        ForeignKey("devices.id", ondelete="CASCADE"),
        primary_key=True,
        nullable=False,
        index=True,
    )
    tag_id = Column(
        Integer,
        ForeignKey("tags.id", ondelete="CASCADE"),
        primary_key=True,
        nullable=False,
        index=True,
    )
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    # Relationships
    device = relationship("InventoryDevice", back_populates="device_tags")
    tag = relationship("Tag", back_populates="device_tags")


class InventoryDevice(Base):
    """Device model - core inventory asset (replaces InventoryItem)"""

    __tablename__ = "devices"

    id = Column(Integer, primary_key=True, index=True)
    oi_id = Column(String(50), unique=True, nullable=True, index=True)
    name = Column(String(200), nullable=False, index=True)
    device_type_id = Column(
        Integer, ForeignKey("device_types.id"), nullable=False, index=True
    )
    manufacturer_id = Column(
        Integer, ForeignKey("manufacturers.id"), nullable=True, index=True
    )
    model = Column(String(100), nullable=True)
    serial_number = Column(String(100), unique=True, nullable=True, index=True)
    # Status stores scheduler values directly: "Available", "Maintenance", "Unavailable"
    # This ensures SQL queries work correctly (WHERE status = 'Available')
    status = Column(String(50), nullable=False, default="Available", index=True)
    site_id = Column(Integer, ForeignKey("sites.id"), nullable=True, index=True)
    rack = Column(String(50), nullable=True)
    u_position = Column(Integer, nullable=True)
    hostname = Column(String(100), nullable=True)
    mgmt_ip = Column(String(50), nullable=True)
    polatis_name = Column(String(100), nullable=True)
    polatis_port_range = Column(String(100), nullable=True)
    
    # Scheduler compatibility: maintenance tracking
    # Format: "All Day/YYYY-MM-DD" or "7 AM - 12 PM/YYYY-MM-DD"
    maintenance_start = Column(String(100), nullable=True)
    maintenance_end = Column(String(100), nullable=True)
    
    owner_group = Column(String(100), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(
        DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow
    )
    created_by_id = Column(Integer, ForeignKey("user_table.id"), nullable=True)
    updated_by_id = Column(Integer, ForeignKey("user_table.id"), nullable=True)

    # Relationships
    device_type = relationship("DeviceType", back_populates="devices")
    manufacturer = relationship("Manufacturer", back_populates="devices")
    site = relationship("Site", back_populates="devices")
    device_tags = relationship(
        "InventoryDeviceTag", back_populates="device", cascade="all, delete-orphan"
    )
    history_entries = relationship(
        "DeviceHistory", back_populates="device", cascade="all, delete-orphan"
    )
    created_by = relationship(SchedulerUser, foreign_keys=[created_by_id])
    updated_by = relationship(SchedulerUser, foreign_keys=[updated_by_id])
    
    # Attachments
    attachments = relationship("DeviceAttachment", back_populates="device", cascade="all, delete-orphan")
    
    # Scheduler Relationships
    # Reverted: No longer linked to Booking in legacy mode
    # bookings = relationship("Booking", back_populates="device")

    # =========================================================================
    # Compatibility Properties for Legacy Scheduler Code
    # =========================================================================
    
    @property
    def deviceName(self):
        return self.name
        
    @deviceName.setter
    def deviceName(self, value):
        self.name = value

    @property
    def ip_address(self):
        return self.mgmt_ip
        
    @ip_address.setter
    def ip_address(self, value):
        self.mgmt_ip = value

    @property
    def deviceType(self):
        """Get device type name. Read-only property for scheduler compatibility."""
        return self.device_type.name if self.device_type else None
    
    # deviceType setter removed in U2 stability pass
    # Reason: DB session usage inside model is unsafe
    # To update deviceType, use router/service layer:
    #   device_type_obj = db.query(DeviceType).filter(DeviceType.name == value).first()
    #   if not device_type_obj:
    #       raise ValueError(f"DeviceType '{value}' not found")
    #   device.device_type = device_type_obj

    @property
    def Out_Port(self):
        # Parse 'In=123;Out=456'
        if not self.polatis_port_range:
            return 0
        m = re.search(r"Out=(\d+)", self.polatis_port_range)
        return int(m.group(1)) if m else 0

    @Out_Port.setter
    def Out_Port(self, value):
        # Used by admin.py to update. We need to preserve In_Port.
        current_in = self.In_Port
        if value or current_in:
            self.polatis_port_range = f"In={current_in};Out={value}"
        else:
            self.polatis_port_range = None

    @property
    def In_Port(self):
        if not self.polatis_port_range:
            return 0
        m = re.search(r"In=(\d+)", self.polatis_port_range)
        return int(m.group(1)) if m else 0

    @In_Port.setter
    def In_Port(self, value):
        current_out = self.Out_Port
        if value or current_out:
            self.polatis_port_range = f"In={value};Out={current_out}"
        else:
            self.polatis_port_range = None



class DeviceAttachment(Base):
    __tablename__ = "device_attachments"
    
    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(Integer, ForeignKey("devices.id"), nullable=False, index=True)
    file_name = Column(String(255), nullable=False)
    file_path = Column(String(512), nullable=False)
    file_type = Column(String(50), nullable=False) # e.g. 'manual', 'image'
    mime_type = Column(String(100), nullable=True)
    size_bytes = Column(Integer, nullable=True)
    uploaded_by_id = Column(Integer, ForeignKey("user_table.id"), nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    
    device = relationship("InventoryDevice", back_populates="attachments")



class DeviceHistory(Base):
    """Device history model - audit trail for device changes (replaces InventoryHistory)"""

    __tablename__ = "device_history"

    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(
        Integer,
        ForeignKey("devices.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    action = Column(String(50), nullable=False)
    field_name = Column(String(100), nullable=True)
    old_value = Column(Text, nullable=True)
    new_value = Column(Text, nullable=True)
    changed_by_id = Column(Integer, ForeignKey("user_table.id"), nullable=True)
    notes = Column(Text, nullable=True)
    extra = Column(JSON, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow, index=True)

    # Relationships
    device = relationship("InventoryDevice", back_populates="history_entries")
    changed_by = relationship(SchedulerUser, foreign_keys=[changed_by_id])


class MaintenanceRecord(Base):
    """Maintenance and service records for inventory items (legacy - kept for historical data)"""

    __tablename__ = "maintenance_records"

    id = Column(Integer, primary_key=True, index=True)
    item_id = Column(Integer, nullable=False, index=True)

    # Maintenance details
    maintenance_type = Column(String(50), nullable=False)
    description = Column(Text, nullable=True)
    performed_by = Column(String(200), nullable=True)

    # Dates
    scheduled_date = Column(DateTime, nullable=True)
    performed_date = Column(DateTime, nullable=True)
    next_due_date = Column(DateTime, nullable=True)

    # Cost and parts
    cost = Column(Float, nullable=True)
    parts_used = Column(JSON, nullable=True)

    # Status
    status = Column(String(50), nullable=False, default="scheduled")

    # Results
    notes = Column(Text, nullable=True)
    outcome = Column(String(50), nullable=True)

    # Metadata
    extra = Column(JSON, nullable=True)

    # Timestamps
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(
        DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow
    )
    created_by_id = Column(Integer, ForeignKey("user_table.id"), nullable=True)

    # Relationships
    # Note: legacy records no longer reference the original inventory_items table
    created_by = relationship(SchedulerUser, foreign_keys=[created_by_id])
