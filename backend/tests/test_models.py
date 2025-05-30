import pytest
from pydantic import ValidationError
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from models import AskRequest


def test_ask_request_valid():
    """Test valid AskRequest creation"""
    request = AskRequest(
        user_id="test_user",
        question="What's the oil capacity?",
        car="2008 Subaru WRX",
        engine="EJ255",
        notes="Stage 1 tune"
    )
    assert request.user_id == "test_user"
    assert request.question == "What's the oil capacity?"
    assert request.car == "2008 Subaru WRX"
    assert request.engine == "EJ255"
    assert request.notes == "Stage 1 tune"


def test_ask_request_minimal():
    """Test AskRequest with only required fields"""
    request = AskRequest(
        user_id="test_user",
        question="What's the oil capacity?"
    )
    assert request.user_id == "test_user"
    assert request.question == "What's the oil capacity?"
    assert request.car is None
    assert request.engine is None
    assert request.notes is None


def test_ask_request_missing_user_id():
    """Test AskRequest validation error for missing user_id"""
    with pytest.raises(ValidationError) as exc_info:
        AskRequest(question="What's the oil capacity?")
    assert "user_id" in str(exc_info.value)


def test_ask_request_missing_question():
    """Test AskRequest validation error for missing question"""
    with pytest.raises(ValidationError) as exc_info:
        AskRequest(user_id="test_user")
    assert "question" in str(exc_info.value)


def test_ask_request_empty_strings():
    """Test AskRequest with empty strings"""
    with pytest.raises(ValidationError):
        AskRequest(user_id="", question="What's the oil capacity?")

    with pytest.raises(ValidationError):
        AskRequest(user_id="test_user", question="")


def test_ask_request_json_serialization():
    """Test AskRequest JSON serialization"""
    request = AskRequest(
        user_id="test_user",
        question="What's the oil capacity?",
        car="2008 WRX"
    )
    json_data = request.model_dump()
    assert json_data["user_id"] == "test_user"
    assert json_data["question"] == "What's the oil capacity?"
    assert json_data["car"] == "2008 WRX"
    assert json_data["engine"] is None
    assert json_data["notes"] is None
