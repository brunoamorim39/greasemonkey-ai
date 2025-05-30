import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock
import sys
import os
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
    with patch.dict(os.environ, {'API_KEY': 'test-key'}, clear=False):
        response = client.post("/ask", json={
            "question": "What's the oil capacity?",
            "user_id": "test_user"
        })
        assert response.status_code == 401


def test_ask_endpoint_with_invalid_api_key():
    """Test ask endpoint with invalid API key"""
    with patch.dict(os.environ, {'API_KEY': 'valid-key'}, clear=False):
        response = client.post("/ask",
            json={
                "question": "What's the oil capacity?",
                "user_id": "test_user"
            },
            headers={"x-api-key": "invalid-key"}
        )
        assert response.status_code == 401


@patch('routes.call_gpt4o')
@patch('routes.retrieve_fsm')
def test_ask_endpoint_success(mock_retrieve_fsm, mock_call_gpt4o):
    """Test successful ask endpoint"""
    mock_retrieve_fsm.return_value = "4.5 quarts with filter"
    mock_call_gpt4o.return_value = "The oil capacity is 4.5 quarts with filter."

    with patch.dict(os.environ, {'API_KEY': 'test-key'}, clear=False):
        response = client.post("/ask",
            json={
                "question": "What's the oil capacity?",
                "user_id": "test_user",
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
    with patch.dict(os.environ, {'API_KEY': 'test-key'}, clear=False):
        response = client.post("/stt")
        assert response.status_code == 401


def test_tts_endpoint_without_api_key():
    """Test that TTS endpoint requires API key"""
    with patch.dict(os.environ, {'API_KEY': 'test-key', 'ELEVENLABS_API_KEY': 'test-eleven'}, clear=False):
        response = client.post("/tts", params={"text": "test"})
        assert response.status_code == 401


@patch('routes.call_elevenlabs_tts')
def test_tts_endpoint_success(mock_tts):
    """Test successful TTS endpoint"""
    mock_tts.return_value = "/tts?text=hello%20world"

    with patch.dict(os.environ, {'API_KEY': 'test-key', 'ELEVENLABS_API_KEY': 'test-eleven'}, clear=False):
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
