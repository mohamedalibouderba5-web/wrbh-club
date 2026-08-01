from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    user_id: int
    full_name: str
    club_id: Optional[int] = None
    must_change_password: bool = False


class UserCreate(BaseModel):
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    full_name: str
    full_name_ar: Optional[str] = None
    role: str
    password: str = Field(min_length=8)
    locale: str = "fr"


class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    full_name: Optional[str] = None
    full_name_ar: Optional[str] = None
    is_active: Optional[bool] = None
    locale: Optional[str] = None
    password: Optional[str] = Field(None, min_length=8)


class UserOut(ORMModel):
    id: int
    club_id: Optional[int] = None
    email: Optional[str]
    phone: Optional[str]
    full_name: str
    full_name_ar: Optional[str]
    role: str
    is_active: bool
    locale: str
    must_change_password: bool = False


class LoginForm(BaseModel):
    username: str  # email or phone
    password: str


class PasswordChangeIn(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8)


class ClubOut(ORMModel):
    id: int
    slug: Optional[str] = None
    name: str
    name_ar: Optional[str]
    acronym: str
    phone: Optional[str]
    whatsapp: Optional[str]
    address: Optional[str]
    logo_path: Optional[str]
    favicon_path: Optional[str] = None
    primary_color: str
    accent_color: str
    facebook: Optional[str]
    instagram: Optional[str]
    app_name: Optional[str] = None
    locale_default: Optional[str] = None
    currency: Optional[str] = None
    sport: Optional[str] = None
    status: Optional[str] = None
    plan: Optional[str] = None


class SeasonOut(ORMModel):
    id: int
    name: str
    starts_on: date
    ends_on: date
    is_current: bool
    registration_open: bool


class CategoryOut(ORMModel):
    id: int
    season_id: int
    code: str
    name: str
    name_ar: Optional[str]
    birth_year_min: int
    birth_year_max: int
    is_active: bool


class TeamOut(ORMModel):
    id: int
    category_id: int
    name: str
    name_ar: Optional[str]
    code: Optional[str]


class TeamCoachOut(BaseModel):
    id: int
    team_id: int
    user_id: int
    role_label: str
    coach_name: Optional[str] = None
    coach_phone: Optional[str] = None


class TeamCoachMemberIn(BaseModel):
    user_id: int
    role_label: str = "coach"  # primary | coach | assistant
    is_primary: bool = False


class TeamCoachAssignIn(BaseModel):
    """Remplace la liste des coachs d'une équipe."""

    coaches: list[TeamCoachMemberIn]


class TeamWithCoachesOut(BaseModel):
    id: int
    category_id: int
    name: str
    name_ar: Optional[str] = None
    code: Optional[str] = None
    category_code: Optional[str] = None
    coaches: list[TeamCoachOut] = []


class AthleteCreate(BaseModel):
    full_name: str
    full_name_ar: Optional[str] = None
    birth_date: Optional[date] = None
    birth_place: Optional[str] = None
    status: str = "Active"
    license_number: Optional[str] = None
    notes: Optional[str] = None
    legacy_number: Optional[int] = None
    photo_path: Optional[str] = None
    blood_type: Optional[str] = None
    parent_phone: Optional[str] = None
    parent_name: Optional[str] = None


class AthleteUpdate(BaseModel):
    full_name: Optional[str] = None
    full_name_ar: Optional[str] = None
    birth_date: Optional[date] = None
    birth_place: Optional[str] = None
    status: Optional[str] = None
    license_number: Optional[str] = None
    notes: Optional[str] = None
    photo_path: Optional[str] = None
    blood_type: Optional[str] = None
    parent_phone: Optional[str] = None
    parent_name: Optional[str] = None
    confirm_status: bool = False


class AthleteOut(ORMModel):
    id: int
    legacy_number: Optional[int]
    full_name: str
    full_name_ar: Optional[str]
    birth_date: Optional[date]
    birth_place: Optional[str]
    status: str
    license_number: Optional[str]
    notes: Optional[str]
    photo_path: Optional[str] = None
    blood_type: Optional[str] = None
    parent_phone: Optional[str] = None
    category_id: Optional[int] = None
    category_code: Optional[str] = None


class RegistrationCreate(BaseModel):
    athlete_id: Optional[int] = None
    athlete: Optional[AthleteCreate] = None
    season_id: int
    category_id: Optional[int] = None
    registered_on: Optional[date] = None
    subscription_fee: Optional[Decimal] = None
    source: str = "web"
    parent_phone: Optional[str] = None
    parent_name: Optional[str] = None
    emergency_name: Optional[str] = None
    emergency_phone: Optional[str] = None
    photo_path: Optional[str] = None
    parent_password: Optional[str] = None


class RegistrationUpdate(BaseModel):
    """Modification d'un dossier d'inscription + champs athlète liés."""

    category_id: Optional[int] = None
    subscription_fee: Optional[Decimal] = None
    notes: Optional[str] = None
    registered_on: Optional[date] = None
    status: Optional[str] = None  # pending / approved / rejected / archived
    full_name: Optional[str] = None
    birth_date: Optional[date] = None
    birth_place: Optional[str] = None
    photo_path: Optional[str] = None
    blood_type: Optional[str] = None
    parent_phone: Optional[str] = None
    parent_name: Optional[str] = None


class RegistrationOut(ORMModel):
    id: int
    athlete_id: int
    season_id: int
    category_id: Optional[int]
    registered_on: Optional[date]
    status: str
    source: str
    subscription_fee: Optional[Decimal]
    notes: Optional[str] = None
    seq_no: Optional[int] = None
    reference: Optional[str] = None
    athlete_name: Optional[str] = None
    athlete_photo: Optional[str] = None
    birth_date: Optional[date] = None
    birth_place: Optional[str] = None
    blood_type: Optional[str] = None
    category_code: Optional[str] = None
    parent_phone: Optional[str] = None
    parent_temp_password: Optional[str] = None
    parent_created: Optional[bool] = None


class EventCreate(BaseModel):
    season_id: Optional[int] = None
    team_id: Optional[int] = None
    venue_id: Optional[int] = None
    event_type: str
    title: str
    title_ar: Optional[str] = None
    description: Optional[str] = None
    starts_at: datetime
    ends_at: Optional[datetime] = None
    recurrence_rule: Optional[str] = None
    opponent: Optional[str] = None
    home_away: Optional[str] = None
    coach_id: Optional[int] = None
    substitute_coach_id: Optional[int] = None


class EventUpdate(BaseModel):
    season_id: Optional[int] = None
    team_id: Optional[int] = None
    venue_id: Optional[int] = None
    event_type: Optional[str] = None
    title: Optional[str] = None
    title_ar: Optional[str] = None
    description: Optional[str] = None
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None
    recurrence_rule: Optional[str] = None
    opponent: Optional[str] = None
    home_away: Optional[str] = None
    coach_id: Optional[int] = None
    substitute_coach_id: Optional[int] = None
    score_home: Optional[int] = None
    score_away: Optional[int] = None
    clear_substitute: bool = False


class EventOut(ORMModel):
    id: int
    event_type: str
    title: str
    title_ar: Optional[str]
    description: Optional[str] = None
    starts_at: datetime
    ends_at: Optional[datetime]
    team_id: Optional[int]
    venue_id: Optional[int]
    opponent: Optional[str]
    home_away: Optional[str]
    score_home: Optional[int]
    score_away: Optional[int]
    is_cancelled: bool
    recurrence_rule: Optional[str]
    coach_id: Optional[int] = None
    substitute_coach_id: Optional[int] = None
    coach_name: Optional[str] = None
    substitute_coach_name: Optional[str] = None


class EventCancelIn(BaseModel):
    reason: Optional[str] = None
    notify: bool = True


class RosterAthleteOut(BaseModel):
    athlete_id: int
    full_name: str
    photo_path: Optional[str] = None
    attendance_status: Optional[str] = None
    jersey_number: Optional[int] = None


class ConvocationOut(ORMModel):
    id: int
    event_id: int
    athlete_id: int
    status: str
    note: Optional[str]
    athlete_name: Optional[str] = None
    event_title: Optional[str] = None
    event_starts_at: Optional[datetime] = None
    event_type: Optional[str] = None


class AttendanceIn(BaseModel):
    athlete_id: int
    status: str
    note: Optional[str] = None


class PaymentCreate(BaseModel):
    installment_id: Optional[int] = None
    athlete_id: int
    amount: Decimal
    method: str = "cash"
    paid_on: date
    reference: Optional[str] = None
    notes: Optional[str] = None


class PaymentUpdate(BaseModel):
    amount: Optional[Decimal] = None
    method: Optional[str] = None
    paid_on: Optional[date] = None
    reference: Optional[str] = None
    notes: Optional[str] = None


class QuickPaymentCreate(BaseModel):
    """Paiement guidé : type → catégorie → joueur."""

    payment_type: str  # monthly | insurance | inscription | equipment
    athlete_id: int
    season_id: Optional[int] = None
    category_id: Optional[int] = None
    year: Optional[int] = None
    month: Optional[int] = None  # 1-12 pour mensuel
    amount: Optional[Decimal] = None
    method: str = "cash"
    paid_on: Optional[date] = None
    equipment_label: Optional[str] = None  # ex. maillot, brassards
    notes: Optional[str] = None


class InstallmentOut(ORMModel):
    id: int
    athlete_id: int
    athlete_name: Optional[str] = None
    season_id: int
    label: str
    label_ar: Optional[str]
    due_date: Optional[date]
    amount: Decimal
    amount_paid: Decimal
    status: str
    seq_no: Optional[int] = None
    reference: Optional[str] = None


class InstallmentUpdate(BaseModel):
    label: Optional[str] = None
    due_date: Optional[date] = None
    amount: Optional[Decimal] = None
    amount_paid: Optional[Decimal] = None
    status: Optional[str] = None


class ClubFeeSettingsOut(BaseModel):
    monthly_subscription_dzd: Decimal
    annual_insurance_dzd: Decimal
    inscription_fee_dzd: Decimal
    currency: str = "DZD"


class ClubFeeSettingsUpdate(BaseModel):
    monthly_subscription_dzd: Optional[Decimal] = None
    annual_insurance_dzd: Optional[Decimal] = None
    inscription_fee_dzd: Optional[Decimal] = None


class EquipmentPurchaseCreate(BaseModel):
    """Achat équipement (stock club et/ou attribué à un joueur)."""

    name: str
    quantity: int = 1
    unit_cost: Decimal = Decimal("0")
    athlete_id: Optional[int] = None
    location: Optional[str] = None
    notes: Optional[str] = None
    entry_date: Optional[date] = None


class LedgerCreate(BaseModel):
    season_id: Optional[int] = None
    entry_type: str
    category: str
    label: str
    amount: Decimal
    entry_date: date
    counterparty: Optional[str] = None
    place: Optional[str] = None
    notes: Optional[str] = None


class LedgerUpdate(BaseModel):
    entry_type: Optional[str] = None
    category: Optional[str] = None
    label: Optional[str] = None
    amount: Optional[Decimal] = None
    entry_date: Optional[date] = None
    counterparty: Optional[str] = None
    place: Optional[str] = None
    notes: Optional[str] = None


class LedgerOut(ORMModel):
    id: int
    entry_type: str
    category: str
    label: str
    amount: Decimal
    entry_date: date
    counterparty: Optional[str]
    place: Optional[str]
    notes: Optional[str] = None
    seq_no: Optional[int] = None
    reference: Optional[str] = None


class AnnouncementCreate(BaseModel):
    title: str
    title_ar: Optional[str] = None
    body: str
    body_ar: Optional[str] = None
    audience: str = "all"
    is_pinned: bool = False


class ThreadCreate(BaseModel):
    subject: str
    body: str
    athlete_id: Optional[int] = None


class ThreadReplyIn(BaseModel):
    body: str


class AnnouncementOut(ORMModel):
    id: int
    title: str
    title_ar: Optional[str]
    body: str
    body_ar: Optional[str]
    audience: str
    published_at: Optional[datetime]
    is_pinned: bool


class InventoryItemCreate(BaseModel):
    name: str
    sku: Optional[str] = None
    quantity: int = 0
    alert_threshold: int = 2
    location: Optional[str] = None
    notes: Optional[str] = None


class InventoryItemUpdate(BaseModel):
    name: Optional[str] = None
    sku: Optional[str] = None
    quantity: Optional[int] = None
    alert_threshold: Optional[int] = None
    location: Optional[str] = None
    notes: Optional[str] = None


class InventoryItemOut(ORMModel):
    id: int
    name: str
    sku: Optional[str]
    quantity: int
    alert_threshold: int
    location: Optional[str]
    notes: Optional[str] = None


class InventoryAssignmentUpdate(BaseModel):
    quantity: Optional[int] = None
    athlete_id: Optional[int] = None
    status: Optional[str] = None  # out / returned / lost
    returned_on: Optional[date] = None
    assigned_on: Optional[date] = None


class PushTokenIn(BaseModel):
    token: str
    platform: str = "unknown"


class HealthOut(BaseModel):
    status: str
    app: str
    environment: str
    database: str
    woken_at: datetime


class MobileChildOut(BaseModel):
    id: int
    full_name: str
    birth_date: Optional[date] = None
    status: str
    legacy_number: Optional[int] = None
    blood_type: Optional[str] = None
    photo_path: Optional[str] = None
    category_code: Optional[str] = None


class MobileHomeOut(BaseModel):
    role: str
    full_name: str
    club_name: str
    club_name_ar: Optional[str]
    children_count: int = 0
    children: list[MobileChildOut] = []
    upcoming_events: list[EventOut] = []
    pending_convocations: int = 0
    unpaid_installments: int = 0
    announcements: list[AnnouncementOut] = []
