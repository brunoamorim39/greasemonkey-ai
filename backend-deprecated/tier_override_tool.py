#!/usr/bin/env python3
"""
GreaseMonkey AI Tier Override Tool
A simple CLI tool for testing different user tiers during development.

Usage:
    python tier_override_tool.py <user_id> <tier> [hours]

Examples:
    python tier_override_tool.py test-user-123 weekend_warrior 24
    python tier_override_tool.py test-user-123 master_tech 72
    python tier_override_tool.py test-user-123 free_tier 1
"""

import sys
import requests
import json
from datetime import datetime, timedelta
import os
from dotenv import load_dotenv

load_dotenv()

# Configuration
API_BASE_URL = os.getenv("API_BASE_URL", "http://localhost:8000")
API_KEY = os.getenv("API_KEY")

def set_tier_override(user_id: str, tier: str, hours: int = 24):
    """Set a tier override for a user."""

    if not API_KEY:
        print("Error: API_KEY not found in environment variables")
        return False

    valid_tiers = ["free_tier", "weekend_warrior", "master_tech"]
    if tier not in valid_tiers:
        print(f"Error: Invalid tier '{tier}'. Valid tiers: {', '.join(valid_tiers)}")
        return False

    expires_at = datetime.now() + timedelta(hours=hours)

    payload = {
        "user_id": user_id,
        "override_tier": tier,
        "expires_at": expires_at.isoformat()
    }

    headers = {
        "x-api-key": API_KEY,
        "Content-Type": "application/json"
    }

    try:
        response = requests.post(
            f"{API_BASE_URL}/admin/tier-override",
            headers=headers,
            json=payload
        )

        if response.status_code == 200:
            print(f"✅ Successfully set tier override for user '{user_id}'")
            print(f"   Tier: {tier}")
            print(f"   Expires: {expires_at.strftime('%Y-%m-%d %H:%M:%S')}")
            return True
        else:
            print(f"❌ Error setting tier override: {response.status_code}")
            print(f"   Response: {response.text}")
            return False

    except requests.exceptions.RequestException as e:
        print(f"❌ Network error: {e}")
        return False

def get_user_usage(user_id: str):
    """Get current usage stats for a user."""

    if not API_KEY:
        print("Error: API_KEY not found in environment variables")
        return None

    headers = {
        "x-api-key": API_KEY,
        "Content-Type": "application/json"
    }

    try:
        response = requests.get(
            f"{API_BASE_URL}/usage/{user_id}",
            headers=headers
        )

        if response.status_code == 200:
            data = response.json()
            print(f"📊 Current usage stats for user '{user_id}':")
            print(f"   Tier: {data['tier']}")
            print(f"   Can make requests: {data['can_make_requests']}")
            print(f"   Today's asks: {data['daily_stats']['ask_queries']}")

            if data.get('remaining_asks') is not None:
                print(f"   Remaining asks: {data['remaining_asks']}")

            if data.get('estimated_monthly_cost_cents'):
                cost = data['estimated_monthly_cost_cents'] / 100
                print(f"   Estimated monthly cost: ${cost:.2f}")

            return data
        else:
            print(f"❌ Error getting usage stats: {response.status_code}")
            print(f"   Response: {response.text}")
            return None

    except requests.exceptions.RequestException as e:
        print(f"❌ Network error: {e}")
        return None

def main():
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)

    user_id = sys.argv[1]
    tier = sys.argv[2]
    hours = int(sys.argv[3]) if len(sys.argv) > 3 else 24

    print(f"🔧 GreaseMonkey AI Tier Override Tool")
    print(f"   Backend URL: {API_BASE_URL}")
    print()

    # Show current usage first
    print("📋 Current status:")
    get_user_usage(user_id)
    print()

    # Set the override
    print("🔄 Setting tier override...")
    success = set_tier_override(user_id, tier, hours)

    if success:
        print()
        print("📋 Updated status:")
        get_user_usage(user_id)
        print()
        print("💡 Tips:")
        print("   - Test the /ask endpoint to verify daily limits")
        print("   - Try adding vehicles to test vehicle limits")
        print("   - Check document upload restrictions")
        print("   - Override will expire automatically")

if __name__ == "__main__":
    main()
