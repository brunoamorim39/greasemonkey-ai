from fastapi import APIRouter, UploadFile, File, Request, HTTPException
from fastapi.responses import StreamingResponse
from typing import Optional
from .services import (
    logger, require_api_key, retrieve_fsm, call_gpt4o, call_elevenlabs_tts, log_query, OPENAI_API_KEY, ELEVENLABS_API_KEY
)
from .models import AskRequest, AskResponse

router = APIRouter()

@router.get("/", tags=["Health"], summary="Health check", description="Returns status of the backend.")
def root():
    return {"status": "ok", "message": "GreaseMonkey AI backend running"}

@router.post("/ask", response_model=AskResponse, tags=["AI"], summary="Ask a question", description="Ask a car-related question. Uses FSM retrieval, GPT-4o, TTS, and logs to Supabase.")
@require_api_key
def ask(request: AskRequest, request_: Request):
    try:
        fsm_snippet = retrieve_fsm(request.question, car=request.car)
        if fsm_snippet:
            context = f"FSM: {fsm_snippet}\n"
        else:
            context = ""
        answer = call_gpt4o(
            question=context + request.question,
            car=request.car,
            engine=request.engine,
            notes=request.notes
        )
        audio_url = call_elevenlabs_tts(answer)
        log_query(request.user_id, request.question, answer)
        logger.info(f"Answered question for user {request.user_id}")
        return AskResponse(answer=answer, audio_url=audio_url)
    except Exception as e:
        logger.error(f"/ask error: {e}")
        raise HTTPException(status_code=500, detail="Failed to process question")

@router.post("/stt", tags=["STT"], summary="Speech-to-text", description="Transcribe audio using Whisper API.")
@require_api_key
def stt(file: UploadFile = File(...), request: Request = None):
    if not OPENAI_API_KEY:
        logger.error("OPENAI_API_KEY not set")
        raise HTTPException(status_code=500, detail="OPENAI_API_KEY not set")
    try:
        audio_bytes = file.file.read()
        import requests
        response = requests.post(
            "https://api.openai.com/v1/audio/transcriptions",
            headers={
                "Authorization": f"Bearer [MASKED]"
            },
            files={
                "file": (file.filename, audio_bytes, file.content_type),
                "model": (None, "whisper-1")
            }
        )
        if response.status_code != 200:
            logger.error(f"Whisper API error: {response.text}")
            raise HTTPException(status_code=500, detail="Whisper API error")
        logger.info("STT transcription successful")
        return response.json()
    except Exception as e:
        logger.error(f"/stt error: {e}")
        raise HTTPException(status_code=500, detail="Failed to transcribe audio")

@router.post("/tts", tags=["TTS"], summary="Text-to-speech", description="Convert text to speech using ElevenLabs API.")
@require_api_key
def tts(text: str, request: Request = None):
    if not ELEVENLABS_API_KEY:
        logger.error("ELEVENLABS_API_KEY not set")
        raise HTTPException(status_code=500, detail="ELEVENLABS_API_KEY not set")
    try:
        import requests
        url = f"https://api.elevenlabs.io/v1/text-to-speech/{ELEVENLABS_API_KEY}"
        headers = {
            "xi-api-key": "[MASKED]",
            "Content-Type": "application/json"
        }
        payload = {
            "text": text,
            "model_id": "eleven_multilingual_v2",
            "voice_settings": {"stability": 0.5, "similarity_boost": 0.5}
        }
        resp = requests.post(url, headers=headers, json=payload, stream=True)
        if resp.status_code != 200:
            logger.error(f"ElevenLabs API error: {resp.text}")
            raise HTTPException(status_code=500, detail="ElevenLabs API error")
        logger.info("TTS synthesis successful")
        return StreamingResponse(resp.raw, media_type="audio/mpeg")
    except Exception as e:
        logger.error(f"/tts error: {e}")
        raise HTTPException(status_code=500, detail="Failed to synthesize audio")
