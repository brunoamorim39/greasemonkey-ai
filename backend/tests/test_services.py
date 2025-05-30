import pytest
from unittest.mock import patch, MagicMock
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services import retrieve_fsm, call_gpt4o, get_vectorstore


def test_get_vectorstore_without_api_key():
    """Test that get_vectorstore returns None when no OpenAI API key is set"""
    with patch.dict(os.environ, {}, clear=True):
        # Clear any existing API key
        import services
        services.OPENAI_API_KEY = None
        services.vectorstore = None
        services.embeddings = None

        result = get_vectorstore()
        assert result is None


def test_retrieve_fsm_mock_response():
    """Test that retrieve_fsm returns mock response when vectorstore unavailable"""
    with patch('services.get_vectorstore', return_value=None):
        result = retrieve_fsm("oil capacity")
        assert result == "Mock FSM response for testing"


def test_retrieve_fsm_with_results():
    """Test retrieve_fsm with mocked vectorstore results"""
    mock_vectorstore = MagicMock()
    mock_doc = MagicMock()
    mock_doc.page_content = "4.5 quarts with filter"
    mock_vectorstore.similarity_search.return_value = [mock_doc]

    with patch('services.get_vectorstore', return_value=mock_vectorstore):
        result = retrieve_fsm("oil capacity", car="2008 Subaru WRX")
        assert result == "4.5 quarts with filter"
        mock_vectorstore.similarity_search.assert_called_once_with("oil capacity", k=1)


def test_call_gpt4o_without_api_key():
    """Test GPT-4o call without API key"""
    with patch.dict(os.environ, {}, clear=True):
        import services
        services.OPENAI_API_KEY = None

        result = call_gpt4o("What's the oil capacity?")
        assert result == "OPENAI_API_KEY not set"


def test_call_gpt4o_success():
    """Test successful GPT-4o API call"""
    with patch('services.OPENAI_API_KEY', 'test-key'):
        with patch('services.requests') as mock_requests:
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.json.return_value = {
                "choices": [{"message": {"content": "4.5 quarts with filter"}}]
            }
            mock_requests.post.return_value = mock_response

            result = call_gpt4o("What's the oil capacity?", car="2008 WRX")
            assert result == "4.5 quarts with filter"


def test_call_gpt4o_api_error():
    """Test GPT-4o API error handling"""
    with patch('services.OPENAI_API_KEY', 'test-key'):
        with patch('services.requests') as mock_requests:
            mock_response = MagicMock()
            mock_response.status_code = 400
            mock_response.text = "Bad request"
            mock_requests.post.return_value = mock_response

            result = call_gpt4o("What's the oil capacity?")
            assert "OpenAI error: Bad request" in result
