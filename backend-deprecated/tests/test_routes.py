import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock
from io import BytesIO
import sys
import os
import uuid
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from main import app

client = TestClient(app)


def test_health_check():
    """Test the health check endpoint"""
    response = client.get("/")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "message": "GreaseMonkey AI backend running"}


def test_ask_endpoint_without_api_key():
    """Test that ask endpoint requires API key"""
    with patch('services.API_KEY', 'test-key'):
        response = client.post("/ask", json={
            "question": "What's the oil capacity?",
            "user_id": "test_user"
        })
        assert response.status_code == 401


def test_ask_endpoint_with_invalid_api_key():
    """Test ask endpoint with invalid API key"""
    with patch('services.API_KEY', 'valid-key'):
        response = client.post("/ask",
            json={
                "question": "What's the oil capacity?",
                "user_id": "test_user"
            },
            headers={"x-api-key": "invalid-key"}
        )
        assert response.status_code == 401


@patch('routes.log_query')  # Mock the log_query function to avoid Supabase UUID validation
@patch('routes.call_gpt4o')
@patch('routes.retrieve_fsm')
def test_ask_endpoint_success(mock_retrieve_fsm, mock_call_gpt4o, mock_log_query):
    """Test successful ask endpoint"""
    mock_retrieve_fsm.return_value = "4.5 quarts with filter"
    mock_call_gpt4o.return_value = "The oil capacity is 4.5 quarts with filter."
    mock_log_query.return_value = None  # Mock the logging function

    with patch('services.API_KEY', 'test-key'):
        # Use a valid UUID for user_id
        test_user_id = str(uuid.uuid4())
        response = client.post("/ask",
            json={
                "question": "What's the oil capacity?",
                "user_id": test_user_id,
                "car": "2008 Subaru WRX"
            },
            headers={"x-api-key": "test-key"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "answer" in data
        assert "audio_url" in data


def test_stt_endpoint_without_api_key():
    """Test that STT endpoint requires API key"""
    with patch('services.API_KEY', 'test-key'):
        # Create a dummy file for the upload
        dummy_file = ("test.wav", BytesIO(b"dummy audio data"), "audio/wav")
        response = client.post("/stt", files={"file": dummy_file})
        assert response.status_code == 401


def test_tts_endpoint_without_api_key():
    """Test that TTS endpoint requires API key"""
    with patch('services.API_KEY', 'test-key'):
        with patch('routes.ELEVENLABS_API_KEY', 'test-eleven'):
            response = client.post("/tts", params={"text": "test"})
            assert response.status_code == 401


def test_tts_endpoint_text_too_long():
    """Test that TTS endpoint validates text length"""
    long_text = "a" * 5001  # Exceeds 5000 character limit
    with patch('services.API_KEY', 'test-key'):
        with patch('routes.ELEVENLABS_API_KEY', 'test-eleven'):
            response = client.post("/tts",
                params={"text": long_text},
                headers={"x-api-key": "test-key"}
            )
            assert response.status_code == 400
            assert "Text too long for TTS" in response.json()["detail"]


def test_tts_endpoint_empty_text():
    """Test that TTS endpoint validates empty text"""
    with patch('services.API_KEY', 'test-key'):
        with patch('routes.ELEVENLABS_API_KEY', 'test-eleven'):
            response = client.post("/tts",
                params={"text": "   "},  # Only whitespace
                headers={"x-api-key": "test-key"}
            )
            assert response.status_code == 400
            assert "Text cannot be empty" in response.json()["detail"]


@patch('requests.post')  # Patch requests.post directly instead of routes.requests
def test_tts_endpoint_success(mock_requests_post):
    """Test successful TTS endpoint"""
    # Mock the requests.post response
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.raw = BytesIO(b"fake audio data")
    mock_requests_post.return_value = mock_response

    with patch('services.API_KEY', 'test-key'):
        with patch('routes.ELEVENLABS_API_KEY', 'test-eleven'):
            response = client.post("/tts",
                params={"text": "hello world"},
                headers={"x-api-key": "test-key"}
            )
            assert response.status_code == 200


def test_ask_endpoint_missing_question():
    """Test ask endpoint with missing question"""
    with patch.dict(os.environ, {'API_KEY': 'test-key'}):
        response = client.post("/ask",
            json={"user_id": "test_user"},
            headers={"x-api-key": "test-key"}
        )
        assert response.status_code == 422  # Validation error


def test_ask_endpoint_missing_user_id():
    """Test ask endpoint with missing user_id"""
    with patch.dict(os.environ, {'API_KEY': 'test-key'}):
        response = client.post("/ask",
            json={"question": "What's the oil capacity?"},
            headers={"x-api-key": "test-key"}
        )
        assert response.status_code == 422  # Validation error
