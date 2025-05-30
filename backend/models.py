from pydantic import BaseModel, field_validator
from typing import Optional, Dict

class UnitPreferences(BaseModel):
    # Torque measurements
    torque_unit: str = "newton_meters"  # "newton_meters" or "pound_feet"

    # Pressure measurements
    pressure_unit: str = "psi"  # "psi", "bar", "kilopascals"

    # Length/distance measurements
    length_unit: str = "metric"  # "metric" (mm, cm, m) or "imperial" (inches, feet)

    # Volume measurements
    volume_unit: str = "metric"  # "metric" (liters, ml) or "imperial" (quarts, gallons, ounces)

    # Temperature measurements
    temperature_unit: str = "fahrenheit"  # "celsius" or "fahrenheit"

    # Weight measurements
    weight_unit: str = "imperial"  # "metric" (kg, g) or "imperial" (lbs, oz)

    # Socket/tool sizes
    socket_unit: str = "metric"  # "metric" (mm) or "imperial" (inches)

class AskRequest(BaseModel):
    user_id: str
    question: str
    car: Optional[str] = None
    engine: Optional[str] = None
    notes: Optional[str] = None
    unit_preferences: Optional[UnitPreferences] = None

    @field_validator('user_id', 'question')
    @classmethod
    def validate_not_empty(cls, v):
        if not v or not v.strip():
            raise ValueError('Field cannot be empty')
        return v

class AskResponse(BaseModel):
    answer: str
    audio_url: Optional[str] = None
