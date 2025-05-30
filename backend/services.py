import os
import logging
import requests
from functools import wraps
from fastapi import Request, HTTPException
from langchain_openai import OpenAIEmbeddings
from langchain_community.vectorstores import Chroma
from langchain.docstore.document import Document
from supabase import create_client, Client
from dotenv import load_dotenv
from models import UnitPreferences

load_dotenv()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_ORGANIZATION = os.getenv("OPENAI_ORGANIZATION")
OPENAI_PROJECT = os.getenv("OPENAI_PROJECT")
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY")
ELEVENLABS_VOICE_ID = os.getenv("ELEVENLABS_VOICE_ID", "EXAVITQu4vr4xnSDxMaL")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
API_KEY = os.getenv("API_KEY")

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
logger = logging.getLogger("greasemonkey-backend")

# Unit conversion and TTS-friendly formatting utilities
def create_unit_instructions(preferences: UnitPreferences) -> str:
    """Generate clear instructions for the AI about unit preferences and TTS formatting."""
    instructions = [
        "IMPORTANT FORMATTING RULES FOR TEXT-TO-SPEECH:",
        "- Never use abbreviations for units (no 'Nm', 'lb-ft', 'PSI', etc.)",
        "- Always spell out units completely for clear speech",
        "- Be concise but avoid technical abbreviations",
        "",
        "UNIT PREFERENCES:"
    ]

    # Torque
    if preferences.torque_unit == "newton_meters":
        instructions.append("- Torque: Use newton meters (not Nm)")
    else:
        instructions.append("- Torque: Use pound feet (not lb-ft)")

    # Pressure
    if preferences.pressure_unit == "psi":
        instructions.append("- Pressure: Use pounds per square inch (not PSI)")
    elif preferences.pressure_unit == "bar":
        instructions.append("- Pressure: Use bar")
    else:
        instructions.append("- Pressure: Use kilopascals (not kPa)")

    # Length
    if preferences.length_unit == "metric":
        instructions.append("- Length: Use millimeters, centimeters, meters (not mm, cm, m)")
    else:
        instructions.append("- Length: Use inches, feet (not in, ft)")

    # Volume
    if preferences.volume_unit == "metric":
        instructions.append("- Volume: Use liters, milliliters (not L, ml)")
    else:
        instructions.append("- Volume: Use quarts, gallons, ounces (not qt, gal, oz)")

    # Temperature
    if preferences.temperature_unit == "celsius":
        instructions.append("- Temperature: Use degrees Celsius (not °C)")
    else:
        instructions.append("- Temperature: Use degrees Fahrenheit (not °F)")

    # Weight
    if preferences.weight_unit == "metric":
        instructions.append("- Weight: Use kilograms, grams (not kg, g)")
    else:
        instructions.append("- Weight: Use pounds, ounces (not lbs, oz)")

    # Socket sizes
    if preferences.socket_unit == "metric":
        instructions.append("- Socket sizes: Use millimeter sockets (not mm)")
    else:
        instructions.append("- Socket sizes: Use inch sockets (not in)")

    return "\n".join(instructions)

# API key check
def check_api_key(request: Request):
    if API_KEY:
        key = request.headers.get("x-api-key")
        if key != API_KEY:
            logger.warning("Unauthorized: Invalid or missing API key")
            raise HTTPException(status_code=401, detail="Invalid or missing API key")

def require_api_key(endpoint):
    @wraps(endpoint)
    async def wrapper(*args, **kwargs):
        # Look for FastAPI Request object in kwargs (could be named 'request' or 'request_')
        request = kwargs.get('request_') or kwargs.get('request')

        # If not found in kwargs, search through all args and kwargs for Request instance
        if not request or not isinstance(request, Request):
            for arg in args:
                if isinstance(arg, Request):
                    request = arg
                    break
            if not request:
                for value in kwargs.values():
                    if isinstance(value, Request):
                        request = value
                        break

        if not request:
            raise HTTPException(status_code=500, detail="Request object not found for API key check")
        check_api_key(request)
        return await endpoint(*args, **kwargs)
    return wrapper

# FSM retrieval setup (placeholder)
CHROMA_PATH = os.getenv("CHROMA_PATH", "./chroma_db")
fsm_docs = [
    Document(page_content="The oil capacity for a 2008 Subaru WRX is 4.5 quarts with filter. Use 5W-30.", metadata={"car": "2008 Subaru WRX"}),
    Document(page_content="The torque spec for the valve cover on a 1995 E36 is 10 newton meters, applied in a criss-cross pattern.", metadata={"car": "1995 BMW E36"})
]

# Lazy initialization for testing
embeddings = None
vectorstore = None

def get_vectorstore():
    global embeddings, vectorstore
    if not OPENAI_API_KEY:
        return None
    if vectorstore is None:
        embeddings = OpenAIEmbeddings(openai_api_key=OPENAI_API_KEY)
        vectorstore = Chroma.from_documents(fsm_docs, embeddings, persist_directory=CHROMA_PATH)
    return vectorstore

def retrieve_fsm(query: str, car=None, user_id=None):
    vs = get_vectorstore()
    if not vs:
        context = "Mock FSM response for testing"
    else:
        results = vs.similarity_search(query, k=1)
        if results:
            context = results[0].page_content
        else:
            context = None

    # Add recent conversation history for context
    if supabase and user_id:
        try:
            # Get last 3 conversations for this user
            history = supabase.table("queries").select("question, response").eq("user_id", user_id).order("created_at", desc=True).limit(3).execute()
            if history.data:
                context_parts = []
                if context:
                    context_parts.append(f"FSM: {context}")

                context_parts.append("Recent conversation history:")
                for i, conv in enumerate(reversed(history.data)):  # Reverse to show oldest first
                    context_parts.append(f"Q{i+1}: {conv['question']}")
                    context_parts.append(f"A{i+1}: {conv['response']}")

                return "\n".join(context_parts)
        except Exception as e:
            logger.warning(f"Failed to retrieve conversation history for user {user_id}: {e}")

    return context

def call_gpt4o(question: str, car=None, engine=None, notes=None, unit_preferences=None):
    if not OPENAI_API_KEY:
        return "OPENAI_API_KEY not set"

    # Create TTS-friendly system prompt with unit preferences
    system_prompt_parts = [
        "You are GreaseMonkey AI, an expert automotive assistant.",
        "Provide concise, direct answers optimized for text-to-speech.",
        "Be quick and punctual - get straight to the point.",
        "DO NOT repeat the car name or details in your answer - the user already knows what car they're asking about.",
        "Focus only on answering the specific question asked."
    ]

    # Add unit preferences if provided
    if unit_preferences:
        system_prompt_parts.append(create_unit_instructions(unit_preferences))
    else:
        # Default TTS-friendly formatting rules
        system_prompt_parts.extend([
            "",
            "FORMATTING RULES:",
            "- Never use abbreviations for units (spell them out completely)",
            "- Use full unit names like 'newton meters' instead of 'Nm'",
            "- Use 'pound feet' instead of 'lb-ft'",
            "- Use 'pounds per square inch' instead of 'PSI'",
            "- Be concise but clear for voice reading"
        ])

    system_prompt = "\n".join(system_prompt_parts)

    user_content = question
    if car or engine or notes:
        user_content += f"\nCar: {car or ''}\nEngine: {engine or ''}\nNotes: {notes or ''}"

    payload = {
        "model": "gpt-4o",
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content}
        ]
    }

    headers = {
        "Authorization": f"Bearer {OPENAI_API_KEY}",
        "Content-Type": "application/json"
    }

    # Add organization and project headers if available
    if OPENAI_ORGANIZATION:
        headers["OpenAI-Organization"] = OPENAI_ORGANIZATION
    if OPENAI_PROJECT:
        headers["OpenAI-Project"] = OPENAI_PROJECT

    response = requests.post(
        "https://api.openai.com/v1/chat/completions",
        headers=headers,
        json=payload
    )
    if response.status_code != 200:
        return f"OpenAI error: {response.text}"
    data = response.json()
    return data["choices"][0]["message"]["content"]

def call_elevenlabs_tts(text: str) -> str:
    # Return a URL that works with the POST endpoint
    # The frontend will need to make a POST request with the text
    return f"/tts?text={text.replace(' ', '%20')}"

supabase: Client = None
if SUPABASE_URL and SUPABASE_KEY:
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

def log_query(user_id: str, question: str, response: str):
    if not supabase:
        return
    try:
        # Try to insert the query
        supabase.table("queries").insert({
            "user_id": user_id,
            "question": question,
            "response": response
        }).execute()
        logger.info(f"Query logged for user {user_id}")
    except Exception as e:
        # If user doesn't exist, create them and try again
        if "queries_user_id_fkey" in str(e):
            try:
                logger.info(f"Creating new user {user_id}")
                supabase.table("users").insert({
                    "user_id": user_id,  # Fixed: use user_id instead of id
                    "email": None,  # Optional field
                    "garage": [],   # Default empty garage
                    "tier": "free"  # Default tier
                }).execute()

                # Now try logging the query again
                supabase.table("queries").insert({
                    "user_id": user_id,
                    "question": question,
                    "response": response
                }).execute()
                logger.info(f"Query logged for new user {user_id}")
            except Exception as create_error:
                logger.warning(f"Failed to create user and log query for {user_id}: {create_error}")
        else:
            logger.warning(f"Failed to log query for user {user_id}: {e}")
