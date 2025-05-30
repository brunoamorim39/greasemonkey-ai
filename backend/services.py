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

load_dotenv()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY")
ELEVENLABS_VOICE_ID = os.getenv("ELEVENLABS_VOICE_ID", "EXAVITQu4vr4xnSDxMaL")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
API_KEY = os.getenv("API_KEY")

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
logger = logging.getLogger("greasemonkey-backend")

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
        request = kwargs.get('request')
        if not request:
            for arg in args:
                if isinstance(arg, Request):
                    request = arg
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
    Document(page_content="The torque spec for the valve cover on a 1995 E36 is 10 Nm, applied in a criss-cross pattern.", metadata={"car": "1995 BMW E36"})
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

def retrieve_fsm(query: str, car=None):
    vs = get_vectorstore()
    if not vs:
        return "Mock FSM response for testing"
    results = vs.similarity_search(query, k=1)
    if results:
        return results[0].page_content
    return None

def call_gpt4o(question: str, car=None, engine=None, notes=None):
    if not OPENAI_API_KEY:
        return "OPENAI_API_KEY not set"
    system_prompt = "You are GreaseMonkey AI, an expert automotive assistant. Answer concisely and accurately."
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
    response = requests.post(
        "https://api.openai.com/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {OPENAI_API_KEY}",
            "Content-Type": "application/json"
        },
        json=payload
    )
    if response.status_code != 200:
        return f"OpenAI error: {response.text}"
    data = response.json()
    return data["choices"][0]["message"]["content"]

def call_elevenlabs_tts(text: str) -> str:
    return "/tts?text=" + text.replace(" ", "%20")

supabase: Client = None
if SUPABASE_URL and SUPABASE_KEY:
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

def log_query(user_id: str, question: str, response: str):
    if not supabase:
        return
    supabase.table("queries").insert({
        "user_id": user_id,
        "question": question,
        "response": response
    }).execute()
