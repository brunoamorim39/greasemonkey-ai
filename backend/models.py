from pydantic import BaseModel
from typing import Optional

class AskRequest(BaseModel):
    user_id: str
    question: str
    car: Optional[str] = None
    engine: Optional[str] = None
    notes: Optional[str] = None

class AskResponse(BaseModel):
    answer: str
    audio_url: Optional[str] = None
