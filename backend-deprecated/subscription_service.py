import os
import json
import requests
import base64
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from supabase import create_client, Client
from subscription_models import (
    ReceiptVerificationRequest,
    ReceiptVerificationResponse,
    SubscriptionTier,
    Platform,
    SubscriptionStatusResponse,
    UserSubscription,
    SubscriptionStatus
)

class SubscriptionService:
    def __init__(self):
        self.supabase: Client = create_client(
            os.getenv("SUPABASE_URL"),
            os.getenv("SUPABASE_SERVICE_KEY")  # Use service role key for admin operations
        )

        # App Store Connect API credentials (optional - for server-to-server verification)
        self.app_store_shared_secret = os.getenv("APP_STORE_SHARED_SECRET")

        # Play Store API credentials (optional)
        self.play_store_service_account = os.getenv("PLAY_STORE_SERVICE_ACCOUNT_JSON")

    async def verify_receipt(self, request: ReceiptVerificationRequest) -> ReceiptVerificationResponse:
        """Verify purchase receipt from App Store or Play Store"""

        try:
            if request.platform == Platform.IOS:
                return await self._verify_ios_receipt(request)
            elif request.platform == Platform.ANDROID:
                return await self._verify_android_receipt(request)
            else:
                return ReceiptVerificationResponse(
                    success=False,
                    tier=SubscriptionTier.GARAGE_VISITOR,
                    error_message="Unsupported platform"
                )
        except Exception as e:
            return ReceiptVerificationResponse(
                success=False,
                tier=SubscriptionTier.GARAGE_VISITOR,
                error_message=f"Receipt verification failed: {str(e)}"
            )

    async def _verify_ios_receipt(self, request: ReceiptVerificationRequest) -> ReceiptVerificationResponse:
        """Verify iOS App Store receipt"""

        # For production, use https://buy.itunes.apple.com/verifyReceipt
        # For testing, use https://sandbox.itunes.apple.com/verifyReceipt
        verification_url = "https://buy.itunes.apple.com/verifyReceipt"

        payload = {
            "receipt-data": request.receipt_data,
            "password": self.app_store_shared_secret,
            "exclude-old-transactions": True
        }

        try:
            response = requests.post(verification_url, json=payload, timeout=30)
            result = response.json()

            # If production verification fails with status 21007, try sandbox
            if result.get("status") == 21007:
                verification_url = "https://sandbox.itunes.apple.com/verifyReceipt"
                response = requests.post(verification_url, json=payload, timeout=30)
                result = response.json()

            if result.get("status") == 0:  # Success
                # Extract subscription info from receipt
                latest_receipt_info = result.get("latest_receipt_info", [])
                if latest_receipt_info:
                    latest_transaction = latest_receipt_info[-1]

                    # Parse subscription details
                    product_id = latest_transaction.get("product_id")
                    expires_date_ms = int(latest_transaction.get("expires_date_ms", 0))
                    expires_date = datetime.fromtimestamp(expires_date_ms / 1000) if expires_date_ms else None
                    purchase_date_ms = int(latest_transaction.get("purchase_date_ms", 0))
                    purchase_date = datetime.fromtimestamp(purchase_date_ms / 1000) if purchase_date_ms else None

                    # Update subscription in database
                    tier = self._get_tier_from_product_id(product_id)
                    subscription_id = await self._update_subscription_in_db(
                        request.user_id,
                        request.platform,
                        request.transaction_id,
                        product_id,
                        request.receipt_data,
                        purchase_date,
                        expires_date
                    )

                    return ReceiptVerificationResponse(
                        success=True,
                        subscription_id=subscription_id,
                        tier=tier,
                        expires_at=expires_date
                    )

            return ReceiptVerificationResponse(
                success=False,
                tier=SubscriptionTier.GARAGE_VISITOR,
                error_message=f"App Store verification failed with status: {result.get('status')}"
            )

        except Exception as e:
            return ReceiptVerificationResponse(
                success=False,
                tier=SubscriptionTier.GARAGE_VISITOR,
                error_message=f"iOS receipt verification error: {str(e)}"
            )

    async def _verify_android_receipt(self, request: ReceiptVerificationRequest) -> ReceiptVerificationResponse:
        """Verify Android Play Store receipt"""

        # For Android, you'd typically use Google Play Developer API
        # This is a simplified implementation - you'd need to implement proper Google API integration

        try:
            # Parse receipt data (this would be a purchase token from Play Store)
            # For now, we'll assume the receipt is valid and create subscription

            # In a real implementation, you'd:
            # 1. Use Google Play Developer API to verify the purchase token
            # 2. Check subscription status
            # 3. Get expiration date

            tier = self._get_tier_from_product_id(request.product_id)

            # For now, set a default expiration (this should come from Play Store API)
            expires_date = datetime.now() + timedelta(days=30)  # Placeholder
            purchase_date = datetime.now()

            subscription_id = await self._update_subscription_in_db(
                request.user_id,
                request.platform,
                request.transaction_id,
                request.product_id,
                request.receipt_data,
                purchase_date,
                expires_date
            )

            return ReceiptVerificationResponse(
                success=True,
                subscription_id=subscription_id,
                tier=tier,
                expires_at=expires_date
            )

        except Exception as e:
            return ReceiptVerificationResponse(
                success=False,
                tier=SubscriptionTier.GARAGE_VISITOR,
                error_message=f"Android receipt verification error: {str(e)}"
            )

    def _get_tier_from_product_id(self, product_id: str) -> SubscriptionTier:
        """Map product ID to subscription tier"""
        if product_id in ["gearhead_monthly_499", "gearhead_yearly_4990"]:
            return SubscriptionTier.GEARHEAD
        elif product_id in ["mastertech_monthly_2999", "mastertech_yearly_29990"]:
            return SubscriptionTier.MASTER_TECH
        else:
            return SubscriptionTier.GARAGE_VISITOR

    async def _update_subscription_in_db(
        self,
        user_id: str,
        platform: Platform,
        transaction_id: str,
        product_id: str,
        receipt_data: str,
        purchase_date: datetime,
        expires_date: datetime
    ) -> str:
        """Update user subscription in Supabase database"""

        # Call the database function to update subscription
        result = self.supabase.rpc(
            "update_subscription_from_receipt",
            {
                "p_user_id": user_id,
                "p_platform": platform.value,
                "p_transaction_id": transaction_id,
                "p_product_id": product_id,
                "p_receipt_data": receipt_data,
                "p_purchase_date": purchase_date.isoformat(),
                "p_expires_date": expires_date.isoformat()
            }
        ).execute()

        if result.data:
            return str(result.data)
        else:
            raise Exception("Failed to update subscription in database")

    async def get_user_subscription_status(self, user_id: str) -> SubscriptionStatusResponse:
        """Get user's current subscription status and permissions"""

        try:
            # Get user's current tier
            tier_result = self.supabase.rpc(
                "get_user_subscription_tier",
                {"p_user_id": user_id}
            ).execute()

            current_tier = SubscriptionTier(tier_result.data or "garage_visitor")

            # Get subscription details
            subscription_result = self.supabase.table("user_subscriptions").select("*").eq(
                "user_id", user_id
            ).eq("status", "active").order("created_at", desc=True).limit(1).execute()

            subscription = None
            if subscription_result.data:
                sub_data = subscription_result.data[0]
                subscription = UserSubscription(
                    id=sub_data["id"],
                    user_id=sub_data["user_id"],
                    subscription_tier=SubscriptionTier(sub_data["subscription_tier"]),
                    platform=Platform(sub_data["platform"]),
                    platform_subscription_id=sub_data.get("platform_subscription_id"),
                    product_id=sub_data["product_id"],
                    status=SubscriptionStatus(sub_data["status"]),
                    current_period_start=sub_data.get("current_period_start"),
                    current_period_end=sub_data.get("current_period_end"),
                    cancel_at_period_end=sub_data.get("cancel_at_period_end", False),
                    created_at=sub_data["created_at"],
                    updated_at=sub_data["updated_at"]
                )

            # Determine permissions based on tier
            can_ask_questions = await self._can_user_perform_action(user_id, "ask_question")
            can_upload_documents = await self._can_user_perform_action(user_id, "upload_document")
            can_add_vehicles = await self._can_user_perform_action(user_id, "add_vehicle")

            # Calculate remaining usage for free tier
            questions_remaining = None
            documents_remaining = None

            if current_tier == SubscriptionTier.GARAGE_VISITOR:
                # Get today's usage
                usage_result = self.supabase.table("subscription_usage").select("*").eq(
                    "user_id", user_id
                ).gte("period_start", datetime.now().date()).limit(1).execute()

                if usage_result.data:
                    usage = usage_result.data[0]
                    questions_remaining = max(0, 3 - usage.get("questions_used", 0))
                else:
                    questions_remaining = 3

            elif current_tier == SubscriptionTier.GEARHEAD:
                # Get current period usage for documents
                usage_result = self.supabase.table("subscription_usage").select("*").eq(
                    "user_id", user_id
                ).gte("period_start", datetime.now().date()).limit(1).execute()

                if usage_result.data:
                    usage = usage_result.data[0]
                    documents_remaining = max(0, 20 - usage.get("documents_uploaded", 0))
                else:
                    documents_remaining = 20

            return SubscriptionStatusResponse(
                user_id=user_id,
                current_tier=current_tier,
                subscription=subscription,
                can_ask_questions=can_ask_questions,
                can_upload_documents=can_upload_documents,
                can_add_vehicles=can_add_vehicles,
                questions_remaining=questions_remaining,
                documents_remaining=documents_remaining
            )

        except Exception as e:
            # Return default free tier status on error
            return SubscriptionStatusResponse(
                user_id=user_id,
                current_tier=SubscriptionTier.GARAGE_VISITOR,
                subscription=None,
                can_ask_questions=False,
                can_upload_documents=False,
                can_add_vehicles=False,
                questions_remaining=0
            )

    async def _can_user_perform_action(self, user_id: str, action: str) -> bool:
        """Check if user can perform a specific action"""
        try:
            result = self.supabase.rpc(
                "can_user_perform_action",
                {
                    "p_user_id": user_id,
                    "p_action": action
                }
            ).execute()

            return bool(result.data)
        except:
            return False

    async def handle_webhook(self, platform: Platform, payload: Dict[str, Any]) -> bool:
        """Handle webhook notifications from app stores"""

        try:
            # Store webhook event
            self.supabase.table("webhook_events").insert({
                "platform": platform.value,
                "event_type": payload.get("notification_type", "unknown"),
                "raw_payload": payload,
                "processed": False
            }).execute()

            # Process webhook based on platform
            if platform == Platform.IOS:
                return await self._process_ios_webhook(payload)
            elif platform == Platform.ANDROID:
                return await self._process_android_webhook(payload)

            return False

        except Exception as e:
            print(f"Webhook processing error: {str(e)}")
            return False

    async def _process_ios_webhook(self, payload: Dict[str, Any]) -> bool:
        """Process iOS App Store Server Notifications"""
        # Implementation for iOS webhook processing
        # This would handle subscription cancellations, renewals, etc.
        return True

    async def _process_android_webhook(self, payload: Dict[str, Any]) -> bool:
        """Process Android Play Store Developer Notifications"""
        # Implementation for Android webhook processing
        return True
