# models.py

import uuid
from sqlalchemy import (
    Column,
    Integer,
    String,
    ForeignKey,
    DateTime,
    Text,
    Boolean,
    JSON,
)
from sqlalchemy.orm import relationship
from datetime import datetime
from backend.core.database import Base


class User(Base):
    __tablename__ = "user_table"

    id = Column(Integer, primary_key=True, index=True)
    discord_id = Column(String(20), unique=True, nullable=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(100), unique=True, nullable=True)
    password = Column(String(100), nullable=False)
    is_admin = Column(Boolean, default=False)

    bookings = relationship("Booking", back_populates="user")
    topologies = relationship("Topology", back_populates="user")
    booking_favorites = relationship(
        "BookingFavorite",
        back_populates="user",
        cascade="all, delete-orphan",
    )


class Device(Base):
    __tablename__ = "device_table"
    id = Column(Integer, primary_key=True, index=True)
    polatis_name = Column(String(100), nullable=True)

    deviceType = Column(String(50), nullable=True)
    deviceName = Column(String(50), nullable=True)
    ip_address = Column(String(50), nullable=True)
    status = Column(String(50), nullable=True)
    maintenance_start = Column(String(100), nullable=True)
    maintenance_end = Column(String(100), nullable=True)

    Out_Port = Column(Integer, nullable=False)
    In_Port = Column(Integer, nullable=False)

    bookings = relationship("Booking", back_populates="device")


class Booking(Base):
    __tablename__ = "booking_table"

    booking_id = Column(Integer, primary_key=True, index=True)
    device_id = Column(Integer, ForeignKey("device_table.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("user_table.id"), nullable=False)
    is_collaborator = Column(Boolean, nullable=False, default=False)
    grouped_booking_id = Column(String(64), nullable=False, index=True, default=lambda: str(uuid.uuid4()))
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=False)
    status = Column(String(50), nullable=True)
    comment = Column(Text, nullable=True)
    collaborators = Column(JSON, nullable=True, default=list)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    device = relationship("Device", back_populates="bookings")
    user = relationship("User", back_populates="bookings")


class BookingFavorite(Base):
    __tablename__ = "booking_favorite"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("user_table.id"), nullable=False)
    name = Column(String(200), nullable=False)
    grouped_booking_id = Column(String(64), nullable=False, index=True)
    device_snapshot = Column(JSON, nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(
        DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    user = relationship("User", back_populates="booking_favorites")


class Topology(Base):
    __tablename__ = "topology_table"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("user_table.id"), nullable=False)
    name = Column(String(200), nullable=False)
    nodes = Column(JSON, nullable=False)
    edges = Column(JSON, nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(
        DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    user = relationship("User", back_populates="topologies")


class AdminRole(Base):
    __tablename__ = "admin_roles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("user_table.id"), unique=True, nullable=False)
    role = Column(String(50), nullable=False, default="Viewer")
    status = Column(String(20), nullable=False, default="active")
    permissions = Column(JSON, nullable=True)
    approval_limits = Column(JSON, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(
        DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    user = relationship("User")


class AdminAuditLog(Base):
    __tablename__ = "admin_audit_log"

    id = Column(Integer, primary_key=True, index=True)
    actor_id = Column(Integer, ForeignKey("user_table.id"), nullable=True)
    actor_role = Column(String(50), nullable=True)
    action = Column(String(100), nullable=False)
    entity_type = Column(String(50), nullable=False)
    entity_id = Column(String(64), nullable=True)
    payload = Column(JSON, nullable=True)
    outcome = Column(String(20), nullable=False, default="success")
    message = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    actor = relationship("User")


class DeviceOwnership(Base):
    __tablename__ = "device_ownership"

    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(Integer, ForeignKey("device_table.id"), nullable=False)
    owner_id = Column(Integer, ForeignKey("user_table.id"), nullable=False)
    assigned_by = Column(Integer, ForeignKey("user_table.id"), nullable=True)
    assigned_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    revoked_at = Column(DateTime, nullable=True)

    device = relationship("Device")
    owner = relationship("User", foreign_keys=[owner_id])
    assigned_by_user = relationship("User", foreign_keys=[assigned_by])


class DeviceTag(Base):
    __tablename__ = "device_tags"

    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(Integer, ForeignKey("device_table.id"), nullable=False)
    tag = Column(String(50), nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    device = relationship("Device")


class DeviceHealthSnapshot(Base):
    __tablename__ = "device_health_snapshot"

    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(Integer, ForeignKey("device_table.id"), nullable=False)
    status = Column(String(50), nullable=False)
    heartbeat_at = Column(DateTime, nullable=True)
    metrics = Column(JSON, nullable=True)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    device = relationship("Device")


class TopologyReview(Base):
    __tablename__ = "topology_review"

    id = Column(Integer, primary_key=True, index=True)
    topology_id = Column(Integer, ForeignKey("topology_table.id"), unique=True, nullable=False)
    status = Column(String(20), nullable=False, default="submitted")
    conflict_count = Column(Integer, nullable=False, default=0)
    last_checked_at = Column(DateTime, nullable=True)
    resolved_at = Column(DateTime, nullable=True)
    resolved_by = Column(Integer, ForeignKey("user_table.id"), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(
        DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    topology = relationship("Topology")
    resolver = relationship("User", foreign_keys=[resolved_by])


class AdminSetting(Base):
    __tablename__ = "admin_settings"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(100), unique=True, nullable=False)
    value = Column(JSON, nullable=False)
    updated_at = Column(
        DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow
    )
    updated_by = Column(Integer, ForeignKey("user_table.id"), nullable=True)

    updater = relationship("User")


class AdminInvitation(Base):
    __tablename__ = "admin_invitations"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(200), nullable=False)
    handle = Column(String(100), nullable=True)
    role = Column(String(50), nullable=False, default="Viewer")
    invited_by = Column(Integer, ForeignKey("user_table.id"), nullable=True)
    token = Column(String(64), nullable=False, unique=True)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    accepted_at = Column(DateTime, nullable=True)

    inviter = relationship("User")
