from pydantic import BaseModel, field_validator
from typing import Optional, Dict, List, Any
from datetime import datetime
from enum import Enum

class UnitPreferences(BaseModel):
    # Torque measurements
    torque_unit: str = "newton_meters"  # "newton_meters" or "pound_feet"

    # Pressure measurements
    pressure_unit: str = "psi"  # "psi", "bar", "kilopascals"

    # Length/distance measurements
    length_unit: str = "metric"  # "metric" (mm, cm, m) or "imperial" (inches, feet)

    # Volume measurements
    volume_unit: str = "metric"  # "metric" (liters, ml) or "imperial" (quarts, gallons, ounces)

    # Temperature measurements
    temperature_unit: str = "fahrenheit"  # "celsius" or "fahrenheit"

    # Weight measurements
    weight_unit: str = "imperial"  # "metric" (kg, g) or "imperial" (lbs, oz)

    # Socket/tool sizes
    socket_unit: str = "metric"  # "metric" (mm) or "imperial" (inches)

class AskRequest(BaseModel):
    user_id: str
    question: str
    car: Optional[str] = None
    engine: Optional[str] = None
    notes: Optional[str] = None
    unit_preferences: Optional[UnitPreferences] = None

    @field_validator('user_id', 'question')
    @classmethod
    def validate_not_empty(cls, v):
        if not v or not v.strip():
            raise ValueError('Field cannot be empty')
        return v

class AskResponse(BaseModel):
    answer: str
    audio_url: Optional[str] = None

class BugReport(BaseModel):
    id: Optional[str] = None
    user_id: str
    title: str
    description: str
    category: str
    severity: str
    vehicle_info: Optional[str] = None
    steps_to_reproduce: List[str] = []
    expected_behavior: Optional[str] = None
    actual_behavior: Optional[str] = None
    status: str = "open"
    admin_response: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    @field_validator('user_id', 'title', 'description', 'category', 'severity')
    @classmethod
    def validate_not_empty(cls, v):
        if not v or not v.strip():
            raise ValueError('Field cannot be empty')
        return v

class FeatureRequest(BaseModel):
    id: Optional[str] = None
    user_id: str
    title: str
    description: str
    category: str
    priority: str
    use_case: Optional[str] = None
    current_workaround: Optional[str] = None
    vote_count: int = 0
    status: str = "submitted"
    admin_response: Optional[str] = None
    estimated_timeframe: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    @field_validator('user_id', 'title', 'description', 'category', 'priority')
    @classmethod
    def validate_not_empty(cls, v):
        if not v or not v.strip():
            raise ValueError('Field cannot be empty')
        return v

class FeedbackStats(BaseModel):
    bug_reports: Dict[str, int]
    feature_requests: Dict[str, int]
    total_bugs: int
    total_features: int
    total_votes: int

class UserTier(str, Enum):
    FREE_TIER = "free_tier"  # Free tier (internal name)
    WEEKEND_WARRIOR = "weekend_warrior"  # $4.99/month subscription
    MASTER_TECH = "master_tech"  # $19.99/month subscription

class UsageType(str, Enum):
    ASK_QUERY = "ask_query"
    DOCUMENT_UPLOAD = "document_upload"
    DOCUMENT_SEARCH = "document_search"
    TTS_REQUEST = "tts_request"
    STT_REQUEST = "stt_request"

class UsageRecord(BaseModel):
    id: Optional[str] = None
    user_id: str
    usage_type: UsageType
    timestamp: datetime
    details: Optional[Dict] = None  # Store additional info like tokens used, file size, etc.
    cost_cents: Optional[int] = None  # Cost in cents for usage-based billing

class DailyUsageStats(BaseModel):
    user_id: str
    date: str  # YYYY-MM-DD format
    ask_queries: int = 0
    document_uploads: int = 0
    document_searches: int = 0
    tts_requests: int = 0
    stt_requests: int = 0
    total_cost_cents: int = 0

class MonthlyUsageStats(BaseModel):
    user_id: str
    year_month: str  # YYYY-MM format
    ask_queries: int = 0
    document_uploads: int = 0
    document_searches: int = 0
    tts_requests: int = 0
    stt_requests: int = 0
    total_cost_cents: int = 0

class TierLimits(BaseModel):
    # Daily limits for free tier
    max_daily_asks: Optional[int] = None
    max_monthly_asks: Optional[int] = None  # Monthly question limit for Weekend Warrior
    max_document_uploads: Optional[int] = None
    max_vehicles: Optional[int] = None
    max_storage_mb: Optional[float] = None

    # Monthly limits for usage-based tier
    max_monthly_document_uploads: Optional[int] = None

    # Features enabled/disabled
    document_upload_enabled: bool = True
    tts_enabled: bool = True
    stt_enabled: bool = True

    # Cost per action for usage-based tier (in cents)
    cost_per_ask_cents: Optional[int] = None
    cost_per_upload_cents: Optional[int] = None
    cost_per_tts_cents: Optional[int] = None
    cost_per_stt_cents: Optional[int] = None

class UserUsageRequest(BaseModel):
    user_id: str
    date: Optional[str] = None  # YYYY-MM-DD, defaults to today

class UserUsageResponse(BaseModel):
    user_id: str
    tier: UserTier
    date: str
    daily_stats: DailyUsageStats
    tier_limits: TierLimits
    can_make_requests: bool
    remaining_asks: Optional[int] = None
    estimated_monthly_cost_cents: Optional[int] = None

# Override testing for development
class OverrideTierRequest(BaseModel):
    user_id: str
    override_tier: UserTier
    expires_at: Optional[datetime] = None  # When override expires

class DocumentType(str, Enum):
    USER_UPLOAD = "user_upload"
    BENTLEY_MANUAL = "bentley_manual"
    HAYNES_MANUAL = "haynes_manual"
    FSM_OFFICIAL = "fsm_official"
    REPAIR_GUIDE = "repair_guide"

class DocumentStatus(str, Enum):
    PROCESSING = "processing"
    READY = "ready"
    ERROR = "error"

class DocumentMetadata(BaseModel):
    id: Optional[str] = None
    user_id: Optional[str] = None  # None for system documents
    title: str
    filename: str
    document_type: DocumentType
    car_make: Optional[str] = None
    car_model: Optional[str] = None
    car_year: Optional[int] = None
    car_engine: Optional[str] = None
    file_size: int
    page_count: Optional[int] = None
    storage_path: Optional[str] = None  # Path to file in Supabase Storage
    status: DocumentStatus = DocumentStatus.PROCESSING
    upload_date: Optional[datetime] = None
    processed_date: Optional[datetime] = None
    error_message: Optional[str] = None
    tags: List[str] = []
    is_public: bool = False  # For sharing between users

class DocumentUploadRequest(BaseModel):
    title: str
    car_make: Optional[str] = None
    car_model: Optional[str] = None
    car_year: Optional[int] = None
    car_engine: Optional[str] = None
    tags: List[str] = []
    is_public: bool = False

    @field_validator('title')
    @classmethod
    def validate_not_empty(cls, v):
        if not v or not v.strip():
            raise ValueError('Title cannot be empty')
        return v

class DocumentSearchRequest(BaseModel):
    query: str
    user_id: str
    car_make: Optional[str] = None
    car_model: Optional[str] = None
    car_year: Optional[int] = None
    car_engine: Optional[str] = None
    document_types: List[DocumentType] = []
    limit: int = 5

class DocumentSearchResult(BaseModel):
    content: str
    metadata: DocumentMetadata
    relevance_score: float
    page_number: Optional[int] = None

class UserDocumentStats(BaseModel):
    total_documents: int
    documents_by_type: Dict[str, int]
    storage_used_mb: float
    max_storage_mb: float
    can_upload_more: bool

# =============================================================================
# SUBSCRIPTION MANAGEMENT MODELS
# =============================================================================

class SubscriptionTier(str, Enum):
    GARAGE_VISITOR = "garage_visitor"
    GEARHEAD = "gearhead"
    MASTER_TECH = "master_tech"

class SubscriptionStatus(str, Enum):
    ACTIVE = "active"
    CANCELLED = "cancelled"
    EXPIRED = "expired"
    PAUSED = "paused"

class Platform(str, Enum):
    IOS = "ios"
    ANDROID = "android"
    WEB = "web"

class ReceiptVerificationRequest(BaseModel):
    user_id: str
    platform: Platform
    receipt_data: str
    transaction_id: str
    product_id: str

    @field_validator('user_id', 'receipt_data', 'transaction_id', 'product_id')
    @classmethod
    def validate_not_empty(cls, v):
        if not v or not v.strip():
            raise ValueError('Field cannot be empty')
        return v

class ReceiptVerificationResponse(BaseModel):
    success: bool
    subscription_id: Optional[str] = None
    tier: SubscriptionTier
    expires_at: Optional[datetime] = None
    error_message: Optional[str] = None

class UserSubscription(BaseModel):
    id: str
    user_id: str
    subscription_tier: SubscriptionTier
    platform: Platform
    platform_subscription_id: Optional[str] = None
    product_id: str
    status: SubscriptionStatus
    current_period_start: Optional[datetime] = None
    current_period_end: Optional[datetime] = None
    cancel_at_period_end: bool = False
    created_at: datetime
    updated_at: datetime

class SubscriptionStatusResponse(BaseModel):
    user_id: str
    current_tier: SubscriptionTier
    subscription: Optional[UserSubscription] = None
    can_ask_questions: bool
    can_upload_documents: bool
    can_add_vehicles: bool
    questions_remaining: Optional[int] = None
    documents_remaining: Optional[int] = None

class WebhookEvent(BaseModel):
    platform: Platform
    event_type: str
    subscription_id: Optional[str] = None
    user_id: Optional[str] = None
    raw_payload: Dict[str, Any]

class UsageCheckRequest(BaseModel):
    user_id: str
    action: str  # 'ask_question', 'upload_document', 'add_vehicle'

    @field_validator('user_id', 'action')
    @classmethod
    def validate_not_empty(cls, v):
        if not v or not v.strip():
            raise ValueError('Field cannot be empty')
        return v

class UsageCheckResponse(BaseModel):
    can_perform: bool
    reason: Optional[str] = None
    upgrade_required: bool = False
