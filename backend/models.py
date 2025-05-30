from pydantic import BaseModel, field_validator
from typing import Optional

class AskRequest(BaseModel):
    user_id: str
    question: str
    car: Optional[str] = None
    engine: Optional[str] = None
    notes: Optional[str] = None

    @field_validator('user_id', 'question')
    @classmethod
    def validate_not_empty(cls, v):
        if not v or not v.strip():
            raise ValueError('Field cannot be empty')
        return v

class AskResponse(BaseModel):
    answer: str
    audio_url: Optional[str] = None
