import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_health_check():
    """Test the health check endpoint"""
    response = client.get("/")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "message": "GreaseMonkey AI backend running"}

def test_ask_endpoint_without_api_key():
    """Test that ask endpoint requires API key"""
    response = client.post("/ask", json={
        "question": "What's the oil capacity?",
        "user_id": "test_user"
    })
    assert response.status_code == 401

def test_stt_endpoint_without_api_key():
    """Test that STT endpoint requires API key"""
    response = client.post("/stt")
    assert response.status_code == 401

def test_tts_endpoint_without_api_key():
    """Test that TTS endpoint requires API key"""
    response = client.post("/tts", params={"text": "test"})
    assert response.status_code == 401
