from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class Club(Base, TimestampMixin):
    __tablename__ = "clubs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    name_ar: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    acronym: Mapped[str] = mapped_column(String(20), default="WRBH")
    phone: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)
    whatsapp: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)
    email: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    address: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    logo_path: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    primary_color: Mapped[str] = mapped_column(String(20), default="#1E3A8A")
    accent_color: Mapped[str] = mapped_column(String(20), default="#F5C518")
    facebook: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    instagram: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[Optional[str]] = mapped_column(String(180), unique=True, nullable=True, index=True)
    phone: Mapped[Optional[str]] = mapped_column(String(40), unique=True, nullable=True, index=True)
    full_name: Mapped[str] = mapped_column(String(200))
    full_name_ar: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    role: Mapped[str] = mapped_column(String(30), index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    locale: Mapped[str] = mapped_column(String(10), default="fr")
    birth_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    birth_place: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)


class Season(Base, TimestampMixin):
    __tablename__ = "seasons"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    club_id: Mapped[int] = mapped_column(ForeignKey("clubs.id"))
    name: Mapped[str] = mapped_column(String(40))
    starts_on: Mapped[date] = mapped_column(Date)
    ends_on: Mapped[date] = mapped_column(Date)
    is_current: Mapped[bool] = mapped_column(Boolean, default=False)
    registration_open: Mapped[bool] = mapped_column(Boolean, default=False)


class Discipline(Base, TimestampMixin):
    __tablename__ = "disciplines"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    club_id: Mapped[int] = mapped_column(ForeignKey("clubs.id"))
    name: Mapped[str] = mapped_column(String(80), default="Football")
    name_ar: Mapped[Optional[str]] = mapped_column(String(80), nullable=True)
    code: Mapped[str] = mapped_column(String(20), default="FOOT")


class Category(Base, TimestampMixin):
    __tablename__ = "categories"
    __table_args__ = (UniqueConstraint("season_id", "code", name="uq_category_season_code"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    season_id: Mapped[int] = mapped_column(ForeignKey("seasons.id"), index=True)
    discipline_id: Mapped[int] = mapped_column(ForeignKey("disciplines.id"))
    code: Mapped[str] = mapped_column(String(20))
    name: Mapped[str] = mapped_column(String(80))
    name_ar: Mapped[Optional[str]] = mapped_column(String(80), nullable=True)
    birth_year_min: Mapped[int] = mapped_column(Integer)
    birth_year_max: Mapped[int] = mapped_column(Integer)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class Team(Base, TimestampMixin):
    __tablename__ = "teams"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    category_id: Mapped[int] = mapped_column(ForeignKey("categories.id"), index=True)
    name: Mapped[str] = mapped_column(String(80))
    name_ar: Mapped[Optional[str]] = mapped_column(String(80), nullable=True)
    code: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)


class TeamCoach(Base):
    __tablename__ = "team_coaches"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    team_id: Mapped[int] = mapped_column(ForeignKey("teams.id"))
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    role_label: Mapped[str] = mapped_column(String(40), default="coach")


class Athlete(Base, TimestampMixin):
    __tablename__ = "athletes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    legacy_number: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, index=True)
    full_name: Mapped[str] = mapped_column(String(200), index=True)
    full_name_ar: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    birth_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    birth_place: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    status: Mapped[str] = mapped_column(String(30), default="Active")  # Active / Abandonne
    license_number: Mapped[Optional[str]] = mapped_column(String(60), nullable=True)
    photo_path: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)


class ParentChild(Base):
    __tablename__ = "parent_children"
    __table_args__ = (UniqueConstraint("parent_id", "athlete_id", name="uq_parent_athlete"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    parent_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    athlete_id: Mapped[int] = mapped_column(ForeignKey("athletes.id"), index=True)
    relationship_label: Mapped[str] = mapped_column(String(40), default="parent")


class EmergencyContact(Base):
    __tablename__ = "emergency_contacts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    athlete_id: Mapped[int] = mapped_column(ForeignKey("athletes.id"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    phone: Mapped[str] = mapped_column(String(40))
    relation: Mapped[Optional[str]] = mapped_column(String(60), nullable=True)


class TeamMembership(Base, TimestampMixin):
    __tablename__ = "team_memberships"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    team_id: Mapped[int] = mapped_column(ForeignKey("teams.id"), index=True)
    athlete_id: Mapped[int] = mapped_column(ForeignKey("athletes.id"), index=True)
    season_id: Mapped[int] = mapped_column(ForeignKey("seasons.id"), index=True)
    jersey_number: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class Registration(Base, TimestampMixin):
    __tablename__ = "registrations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    athlete_id: Mapped[int] = mapped_column(ForeignKey("athletes.id"), index=True)
    season_id: Mapped[int] = mapped_column(ForeignKey("seasons.id"), index=True)
    category_id: Mapped[Optional[int]] = mapped_column(ForeignKey("categories.id"), nullable=True)
    registered_on: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(String(30), default="pending")
    # pending / approved / rejected / cancelled
    source: Mapped[str] = mapped_column(String(30), default="web")  # web / mobile / import
    subscription_fee: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)


class Attachment(Base, TimestampMixin):
    __tablename__ = "attachments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    athlete_id: Mapped[Optional[int]] = mapped_column(ForeignKey("athletes.id"), nullable=True)
    registration_id: Mapped[Optional[int]] = mapped_column(ForeignKey("registrations.id"), nullable=True)
    filename: Mapped[str] = mapped_column(String(255))
    path: Mapped[str] = mapped_column(String(255))
    kind: Mapped[str] = mapped_column(String(40), default="other")
    uploaded_by: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)


class Venue(Base, TimestampMixin):
    __tablename__ = "venues"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    club_id: Mapped[int] = mapped_column(ForeignKey("clubs.id"))
    name: Mapped[str] = mapped_column(String(120))
    address: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    kind: Mapped[str] = mapped_column(String(40), default="pitch")  # pitch / hall / other


class Event(Base, TimestampMixin):
    __tablename__ = "events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    club_id: Mapped[int] = mapped_column(ForeignKey("clubs.id"))
    season_id: Mapped[Optional[int]] = mapped_column(ForeignKey("seasons.id"), nullable=True)
    team_id: Mapped[Optional[int]] = mapped_column(ForeignKey("teams.id"), nullable=True, index=True)
    venue_id: Mapped[Optional[int]] = mapped_column(ForeignKey("venues.id"), nullable=True)
    event_type: Mapped[str] = mapped_column(String(30), index=True)
    # training / match / meeting / camp / gala / other
    title: Mapped[str] = mapped_column(String(200))
    title_ar: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    ends_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    recurrence_rule: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)  # RRULE
    opponent: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    home_away: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)  # home / away
    score_home: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    score_away: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    coach_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)
    is_cancelled: Mapped[bool] = mapped_column(Boolean, default=False)


class EventException(Base):
    __tablename__ = "event_exceptions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    event_id: Mapped[int] = mapped_column(ForeignKey("events.id"), index=True)
    original_date: Mapped[date] = mapped_column(Date)
    new_starts_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    is_cancelled: Mapped[bool] = mapped_column(Boolean, default=False)
    note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)


class Convocation(Base, TimestampMixin):
    __tablename__ = "convocations"
    __table_args__ = (UniqueConstraint("event_id", "athlete_id", name="uq_convocation"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    event_id: Mapped[int] = mapped_column(ForeignKey("events.id"), index=True)
    athlete_id: Mapped[int] = mapped_column(ForeignKey("athletes.id"), index=True)
    status: Mapped[str] = mapped_column(String(30), default="pending")
    # pending / confirmed / declined / excused
    responded_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    responded_by: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)
    note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)


class Attendance(Base, TimestampMixin):
    __tablename__ = "attendances"
    __table_args__ = (UniqueConstraint("event_id", "athlete_id", name="uq_attendance"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    event_id: Mapped[int] = mapped_column(ForeignKey("events.id"), index=True)
    athlete_id: Mapped[int] = mapped_column(ForeignKey("athletes.id"), index=True)
    status: Mapped[str] = mapped_column(String(30), default="present")
    # present / absent / late / excused
    marked_by: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)
    note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)


class FeePlan(Base, TimestampMixin):
    __tablename__ = "fee_plans"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    season_id: Mapped[int] = mapped_column(ForeignKey("seasons.id"), index=True)
    category_id: Mapped[Optional[int]] = mapped_column(ForeignKey("categories.id"), nullable=True)
    name: Mapped[str] = mapped_column(String(120))
    inscription_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    monthly_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    currency: Mapped[str] = mapped_column(String(10), default="DZD")


class FeeInstallment(Base, TimestampMixin):
    __tablename__ = "fee_installments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    athlete_id: Mapped[int] = mapped_column(ForeignKey("athletes.id"), index=True)
    season_id: Mapped[int] = mapped_column(ForeignKey("seasons.id"), index=True)
    registration_id: Mapped[Optional[int]] = mapped_column(ForeignKey("registrations.id"), nullable=True)
    label: Mapped[str] = mapped_column(String(80))  # inscription / septembre / ...
    label_ar: Mapped[Optional[str]] = mapped_column(String(80), nullable=True)
    due_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    amount_paid: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    status: Mapped[str] = mapped_column(String(30), default="due")
    # due / partial / paid / waived / overdue


class Payment(Base, TimestampMixin):
    __tablename__ = "payments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    installment_id: Mapped[Optional[int]] = mapped_column(ForeignKey("fee_installments.id"), nullable=True)
    athlete_id: Mapped[int] = mapped_column(ForeignKey("athletes.id"), index=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    method: Mapped[str] = mapped_column(String(40), default="cash")
    paid_on: Mapped[date] = mapped_column(Date)
    recorded_by: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)
    reference: Mapped[Optional[str]] = mapped_column(String(80), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)


class Receipt(Base, TimestampMixin):
    __tablename__ = "receipts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    payment_id: Mapped[int] = mapped_column(ForeignKey("payments.id"), unique=True)
    number: Mapped[str] = mapped_column(String(40), unique=True)
    issued_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class LedgerEntry(Base, TimestampMixin):
    __tablename__ = "ledger_entries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    club_id: Mapped[int] = mapped_column(ForeignKey("clubs.id"))
    season_id: Mapped[Optional[int]] = mapped_column(ForeignKey("seasons.id"), nullable=True)
    entry_type: Mapped[str] = mapped_column(String(20))  # income / expense
    category: Mapped[str] = mapped_column(String(60))  # transport / equipment / salary / other
    label: Mapped[str] = mapped_column(String(200))
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    entry_date: Mapped[date] = mapped_column(Date)
    counterparty: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    place: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_by: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)


class CoachPayroll(Base, TimestampMixin):
    __tablename__ = "coach_payrolls"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    season_id: Mapped[int] = mapped_column(ForeignKey("seasons.id"), index=True)
    pay_type: Mapped[str] = mapped_column(String(30), default="monthly")
    # forfait / monthly / hourly / match
    label: Mapped[str] = mapped_column(String(80))
    period_month: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    period_year: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    paid_on: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(String(30), default="planned")
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)


class Announcement(Base, TimestampMixin):
    __tablename__ = "announcements"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    club_id: Mapped[int] = mapped_column(ForeignKey("clubs.id"))
    title: Mapped[str] = mapped_column(String(200))
    title_ar: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    body: Mapped[str] = mapped_column(Text)
    body_ar: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    audience: Mapped[str] = mapped_column(String(40), default="all")
    # all / parents / coaches / staff
    published_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    author_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)
    is_pinned: Mapped[bool] = mapped_column(Boolean, default=False)


class MessageThread(Base, TimestampMixin):
    __tablename__ = "message_threads"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    subject: Mapped[str] = mapped_column(String(200))
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
    athlete_id: Mapped[Optional[int]] = mapped_column(ForeignKey("athletes.id"), nullable=True)
    status: Mapped[str] = mapped_column(String(30), default="open")


class Message(Base, TimestampMixin):
    __tablename__ = "messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    thread_id: Mapped[int] = mapped_column(ForeignKey("message_threads.id"), index=True)
    sender_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    body: Mapped[str] = mapped_column(Text)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)


class Notification(Base, TimestampMixin):
    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    title: Mapped[str] = mapped_column(String(200))
    body: Mapped[str] = mapped_column(Text)
    kind: Mapped[str] = mapped_column(String(40), default="info")
    link: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)


class PushToken(Base, TimestampMixin):
    __tablename__ = "push_tokens"
    __table_args__ = (UniqueConstraint("user_id", "token", name="uq_user_push"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    token: Mapped[str] = mapped_column(String(255))
    platform: Mapped[str] = mapped_column(String(20), default="unknown")


class InventoryItem(Base, TimestampMixin):
    __tablename__ = "inventory_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    club_id: Mapped[int] = mapped_column(ForeignKey("clubs.id"))
    name: Mapped[str] = mapped_column(String(120))
    sku: Mapped[Optional[str]] = mapped_column(String(60), nullable=True)
    quantity: Mapped[int] = mapped_column(Integer, default=0)
    alert_threshold: Mapped[int] = mapped_column(Integer, default=2)
    location: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)


class InventoryAssignment(Base, TimestampMixin):
    __tablename__ = "inventory_assignments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    item_id: Mapped[int] = mapped_column(ForeignKey("inventory_items.id"), index=True)
    athlete_id: Mapped[Optional[int]] = mapped_column(ForeignKey("athletes.id"), nullable=True)
    user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)
    quantity: Mapped[int] = mapped_column(Integer, default=1)
    assigned_on: Mapped[date] = mapped_column(Date)
    returned_on: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(String(30), default="out")  # out / returned / lost


class Document(Base, TimestampMixin):
    __tablename__ = "documents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    club_id: Mapped[int] = mapped_column(ForeignKey("clubs.id"))
    title: Mapped[str] = mapped_column(String(200))
    title_ar: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    path: Mapped[str] = mapped_column(String(255))
    audience: Mapped[str] = mapped_column(String(40), default="all")
    kind: Mapped[str] = mapped_column(String(40), default="doc")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)
    action: Mapped[str] = mapped_column(String(80))
    entity: Mapped[str] = mapped_column(String(80))
    entity_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    detail: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
