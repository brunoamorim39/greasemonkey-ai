from fastapi import APIRouter, HTTPException, Header, Depends
from typing import Optional
import json

# Import models - adjust imports based on your structure
try:
    from subscription_models import (
        ReceiptVerificationRequest,
        ReceiptVerificationResponse,
        SubscriptionStatusResponse,
        UsageCheckRequest,
        UsageCheckResponse,
        Platform
    )
    from subscription_service import SubscriptionService
except ImportError:
    # If imports fail, define minimal models for development
    from pydantic import BaseModel

    class ReceiptVerificationRequest(BaseModel):
        user_id: str
        platform: str
        receipt_data: str
        transaction_id: str
        product_id: str

    class ReceiptVerificationResponse(BaseModel):
        success: bool
        error_message: Optional[str] = None

router = APIRouter(prefix="/subscription", tags=["subscription"])

# Initialize subscription service
subscription_service = SubscriptionService()

@router.post("/verify-receipt", response_model=ReceiptVerificationResponse)
async def verify_receipt(request: ReceiptVerificationRequest):
    """Verify a purchase receipt from App Store or Play Store"""
    try:
        result = await subscription_service.verify_receipt(request)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Receipt verification failed: {str(e)}")

@router.get("/status/{user_id}")
async def get_subscription_status(user_id: str):
    """Get user's current subscription status and permissions"""
    try:
        status = await subscription_service.get_user_subscription_status(user_id)
        return status
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get subscription status: {str(e)}")

@router.post("/check-usage")
async def check_usage_limits(request: UsageCheckRequest):
    """Check if user can perform a specific action based on their subscription"""
    try:
        can_perform = await subscription_service._can_user_perform_action(
            request.user_id,
            request.action
        )

        if not can_perform:
            # Get user tier to provide helpful message
            status = await subscription_service.get_user_subscription_status(request.user_id)

            if status.current_tier.value == "garage_visitor":
                if request.action == "ask_question":
                    reason = f"Free tier limit reached. You have {status.questions_remaining or 0} questions remaining today."
                elif request.action == "upload_document":
                    reason = "Document uploads require a paid subscription."
                elif request.action == "add_vehicle":
                    reason = "Free tier allows only 1 vehicle."
                else:
                    reason = "Action not allowed for free tier."

                return UsageCheckResponse(
                    can_perform=False,
                    reason=reason,
                    upgrade_required=True
                )
            else:
                reason = "Usage limit reached for current billing period."

        return UsageCheckResponse(can_perform=can_perform)

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Usage check failed: {str(e)}")

@router.post("/webhook/ios")
async def ios_webhook(
    payload: dict,
    x_apple_receipt_verification: Optional[str] = Header(None)
):
    """Handle iOS App Store Server Notifications"""
    try:
        success = await subscription_service.handle_webhook(Platform.IOS, payload)
        return {"success": success}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Webhook processing failed: {str(e)}")

@router.post("/webhook/android")
async def android_webhook(payload: dict):
    """Handle Android Play Store Developer Notifications"""
    try:
        success = await subscription_service.handle_webhook(Platform.ANDROID, payload)
        return {"success": success}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Webhook processing failed: {str(e)}")

@router.get("/health")
async def subscription_health():
    """Health check for subscription service"""
    return {"status": "healthy", "service": "subscription"}
