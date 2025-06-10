#!/usr/bin/env python3
"""
Test script for the GreaseMonkey AI Document System

This script demonstrates the document system functionality and can be used
for testing during development.
"""

import os
import sys
import asyncio
import requests
import json
from pathlib import Path

# Add the parent directory to the path so we can import from services
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Test configuration
API_BASE_URL = "http://localhost:8000"
API_KEY = "your-test-api-key"  # Replace with your actual API key
TEST_USER_ID = "test-user-123"

def test_api_call(method, endpoint, data=None, files=None):
    """Helper function to make API calls with proper headers."""
    url = f"{API_BASE_URL}{endpoint}"
    headers = {"x-api-key": API_KEY}

    if method.upper() == "GET":
        response = requests.get(url, headers=headers, params=data)
    elif method.upper() == "POST":
        if files:
            response = requests.post(url, headers=headers, data=data, files=files)
        else:
            headers["Content-Type"] = "application/json"
            response = requests.post(url, headers=headers, json=data)
    elif method.upper() == "DELETE":
        response = requests.delete(url, headers=headers, params=data)
    else:
        raise ValueError(f"Unsupported method: {method}")

    return response

def test_health_check():
    """Test basic API connectivity."""
    print("🏥 Testing health check...")
    response = test_api_call("GET", "/")

    if response.status_code == 200:
        print("✅ Health check passed")
        return True
    else:
        print(f"❌ Health check failed: {response.status_code}")
        return False

def test_document_upload():
    """Test document upload functionality."""
    print("\n📤 Testing document upload...")

    # Create a simple test PDF (placeholder)
    test_content = """This is a test service manual for a BMW 3 Series.

    Chapter 1: Brake System

    To replace brake pads:
    1. Remove the wheel
    2. Remove the brake caliper
    3. Replace the brake pads
    4. Reassemble in reverse order

    Torque specifications:
    - Wheel bolts: 120 Nm
    - Caliper bolts: 25 Nm
    """

    # For this test, we'll simulate a file upload
    # In a real scenario, you'd have an actual PDF file
    print("⚠️  Note: This test requires an actual PDF file to upload")
    print("   Create a test PDF and update the file path below")

    # Uncomment and modify this section when you have a test PDF:
    """
    test_pdf_path = "test_manual.pdf"
    if os.path.exists(test_pdf_path):
        with open(test_pdf_path, 'rb') as f:
            files = {'file': ('test_manual.pdf', f, 'application/pdf')}
            data = {
                'user_id': TEST_USER_ID,
                'title': 'BMW 3 Series Test Manual',
                'car_make': 'BMW',
                'car_model': '3 Series',
                'car_year': 2018,
                'car_engine': '2.0L Turbo',
                'tags': 'test,bmw,manual'
            }

            response = test_api_call("POST", "/documents/upload", data=data, files=files)

            if response.status_code == 200:
                print("✅ Document upload successful")
                result = response.json()
                print(f"   Document ID: {result.get('id')}")
                return result.get('id')
            else:
                print(f"❌ Document upload failed: {response.status_code}")
                print(f"   Error: {response.text}")
                return None
    else:
        print(f"❌ Test PDF file not found: {test_pdf_path}")
        return None
    """

    print("⏭️  Skipping upload test (no PDF file provided)")
    return None

def test_user_stats():
    """Test user document statistics."""
    print("\n📊 Testing user document stats...")

    response = test_api_call("GET", f"/documents/stats/{TEST_USER_ID}")

    if response.status_code == 200:
        print("✅ User stats retrieved successfully")
        stats = response.json()
        print(f"   Total documents: {stats.get('total_documents', 0)}")
        print(f"   Storage used: {stats.get('storage_used_mb', 0):.2f} MB")
        print(f"   Can upload more: {stats.get('can_upload_more', False)}")
        return True
    else:
        print(f"❌ User stats failed: {response.status_code}")
        print(f"   Error: {response.text}")
        return False

def test_document_list():
    """Test listing user documents."""
    print("\n📋 Testing document list...")

    response = test_api_call("GET", f"/documents/list/{TEST_USER_ID}")

    if response.status_code == 200:
        print("✅ Document list retrieved successfully")
        documents = response.json()
        print(f"   Found {len(documents)} documents")
        for doc in documents:
            print(f"   - {doc.get('title')} ({doc.get('status')})")
        return documents
    else:
        print(f"❌ Document list failed: {response.status_code}")
        print(f"   Error: {response.text}")
        return []

def test_document_search():
    """Test document search functionality."""
    print("\n🔍 Testing document search...")

    search_data = {
        "query": "brake pad replacement",
        "user_id": TEST_USER_ID,
        "car_make": "BMW",
        "car_model": "3 Series",
        "car_year": 2018,
        "limit": 5
    }

    response = test_api_call("POST", "/documents/search", data=search_data)

    if response.status_code == 200:
        print("✅ Document search successful")
        results = response.json()
        print(f"   Found {len(results)} results")
        for i, result in enumerate(results, 1):
            print(f"   {i}. {result.get('metadata', {}).get('title', 'Unknown')} "
                  f"(Score: {result.get('relevance_score', 0):.2f})")
        return results
    else:
        print(f"❌ Document search failed: {response.status_code}")
        print(f"   Error: {response.text}")
        return []

def test_enhanced_ask():
    """Test the enhanced ask endpoint with document context."""
    print("\n🤖 Testing enhanced ask with document context...")

    ask_data = {
        "user_id": TEST_USER_ID,
        "question": "How do I replace brake pads on my BMW 3 Series?",
        "car": "BMW 3 Series 2018",
        "engine": "2.0L Turbo"
    }

    response = test_api_call("POST", "/ask", data=ask_data)

    if response.status_code == 200:
        print("✅ Enhanced ask successful")
        result = response.json()
        answer = result.get('answer', '')
        print(f"   Answer preview: {answer[:200]}...")
        return True
    else:
        print(f"❌ Enhanced ask failed: {response.status_code}")
        print(f"   Error: {response.text}")
        return False

def test_system_validation():
    """Test system configuration validation."""
    print("\n🔧 Testing system validation...")

    try:
        from manual_ingestion import ManualIngestionManager
        manager = ManualIngestionManager()
        validation = manager.validate_system()

        print("✅ System validation completed")
        print(f"   OpenAI configured: {validation['openai_configured']}")
        print(f"   Supabase configured: {validation['supabase_configured']}")
        print(f"   System manuals: {validation['system_manuals_count']}")
        print(f"   Document types: {validation['document_types']}")

        if validation['errors']:
            print(f"   ⚠️  Errors: {validation['errors']}")

        return len(validation['errors']) == 0

    except ImportError as e:
        print(f"❌ Could not import validation modules: {e}")
        return False
    except Exception as e:
        print(f"❌ System validation failed: {e}")
        return False

def run_all_tests():
    """Run all tests in sequence."""
    print("🚀 Starting GreaseMonkey AI Document System Tests")
    print("=" * 60)

    test_results = {}

    # Run tests
    test_results['health'] = test_health_check()
    test_results['system_validation'] = test_system_validation()
    test_results['user_stats'] = test_user_stats()
    test_results['document_list'] = test_document_list()
    test_results['document_search'] = test_document_search()
    test_results['enhanced_ask'] = test_enhanced_ask()

    # Note: document upload test is commented out as it requires a real PDF
    test_results['document_upload'] = None  # test_document_upload()

    # Summary
    print("\n" + "=" * 60)
    print("📋 Test Summary:")

    passed = sum(1 for result in test_results.values() if result is True)
    failed = sum(1 for result in test_results.values() if result is False)
    skipped = sum(1 for result in test_results.values() if result is None)

    for test_name, result in test_results.items():
        if result is True:
            print(f"   ✅ {test_name}: PASSED")
        elif result is False:
            print(f"   ❌ {test_name}: FAILED")
        else:
            print(f"   ⏭️  {test_name}: SKIPPED")

    print(f"\nResults: {passed} passed, {failed} failed, {skipped} skipped")

    if failed == 0:
        print("🎉 All tests passed! Document system is working correctly.")
    else:
        print("⚠️  Some tests failed. Check the configuration and try again.")

    return failed == 0

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description='Test GreaseMonkey AI Document System')
    parser.add_argument('--api-url', default=API_BASE_URL, help='API base URL')
    parser.add_argument('--api-key', default=API_KEY, help='API key for authentication')
    parser.add_argument('--user-id', default=TEST_USER_ID, help='Test user ID')
    parser.add_argument('--test', choices=['health', 'upload', 'stats', 'list', 'search', 'ask', 'validation'],
                       help='Run a specific test')

    args = parser.parse_args()

    # Update globals with command line arguments
    API_BASE_URL = args.api_url
    API_KEY = args.api_key
    TEST_USER_ID = args.user_id

    if args.test:
        # Run specific test
        test_functions = {
            'health': test_health_check,
            'upload': test_document_upload,
            'stats': test_user_stats,
            'list': test_document_list,
            'search': test_document_search,
            'ask': test_enhanced_ask,
            'validation': test_system_validation
        }

        if args.test in test_functions:
            print(f"Running {args.test} test...")
            result = test_functions[args.test]()
            sys.exit(0 if result else 1)
        else:
            print(f"Unknown test: {args.test}")
            sys.exit(1)
    else:
        # Run all tests
        success = run_all_tests()
        sys.exit(0 if success else 1)
