from pydantic import BaseModel, field_validator
from typing import Optional, Dict, Any
from datetime import datetime
from enum import Enum

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
