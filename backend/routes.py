from fastapi import APIRouter, UploadFile, File, Request, HTTPException
from fastapi.responses import StreamingResponse
from typing import Optional
from services import (
    logger, require_api_key, retrieve_fsm, call_gpt4o, call_elevenlabs_tts, log_query,
    OPENAI_API_KEY, OPENAI_ORGANIZATION, OPENAI_PROJECT, ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID
)
from models import AskRequest, AskResponse

router = APIRouter()

@router.get("/", tags=["Health"], summary="Health check", description="Returns status of the backend.")
def root():
    return {"status": "ok", "message": "GreaseMonkey AI backend running"}

@router.post("/ask", response_model=AskResponse, tags=["AI"], summary="Ask a question", description="Ask a car-related question. Uses FSM retrieval, GPT-4o, TTS, and logs to Supabase.")
@require_api_key
async def ask(request: AskRequest, request_: Request):
    try:
        fsm_snippet = retrieve_fsm(request.question, car=request.car, user_id=request.user_id)
        if fsm_snippet:
            context = f"FSM: {fsm_snippet}\n"
        else:
            context = ""
        answer = call_gpt4o(
            question=context + request.question,
            car=request.car,
            engine=request.engine,
            notes=request.notes,
            unit_preferences=request.unit_preferences
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
async def stt(file: UploadFile = File(...), request: Request = None):
    if not OPENAI_API_KEY:
        logger.error("OPENAI_API_KEY not set")
        raise HTTPException(status_code=500, detail="OPENAI_API_KEY not set")
    try:
        audio_bytes = file.file.read()
        import requests

        headers = {
            "Authorization": f"Bearer {OPENAI_API_KEY}"
        }

        # Add organization and project headers if available
        if OPENAI_ORGANIZATION:
            headers["OpenAI-Organization"] = OPENAI_ORGANIZATION
        if OPENAI_PROJECT:
            headers["OpenAI-Project"] = OPENAI_PROJECT

        response = requests.post(
            "https://api.openai.com/v1/audio/transcriptions",
            headers=headers,
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
async def tts(
    text: str,
    request: Request = None,
    stability: float = 0.75,
    similarity_boost: float = 0.75,
    style: float = 0.0,
    use_speaker_boost: bool = False
):
    # Validate text length to prevent extremely long TTS requests
    MAX_TTS_LENGTH = 5000  # ElevenLabs has a 5000 character limit per request
    if len(text) > MAX_TTS_LENGTH:
        logger.warning(f"TTS text too long: {len(text)} characters (max: {MAX_TTS_LENGTH})")
        raise HTTPException(
            status_code=400,
            detail=f"Text too long for TTS. Maximum {MAX_TTS_LENGTH} characters allowed, got {len(text)} characters."
        )

    if not text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty")

    if not ELEVENLABS_API_KEY:
        logger.error("ELEVENLABS_API_KEY not set")
        raise HTTPException(status_code=500, detail="ELEVENLABS_API_KEY not set")
    try:
        from elevenlabs.client import ElevenLabs
        import io

        # Initialize the ElevenLabs client
        client = ElevenLabs(api_key=ELEVENLABS_API_KEY)

        # Prepare voice settings
        voice_settings = {
            "stability": max(0.0, min(1.0, stability)),  # Clamp between 0.0 and 1.0
            "similarity_boost": max(0.0, min(1.0, similarity_boost)),  # Clamp between 0.0 and 1.0
            "style": max(0.0, min(1.0, style)),  # Clamp between 0.0 and 1.0
            "use_speaker_boost": use_speaker_boost
        }

        # Generate audio using the streaming method with voice settings
        audio_generator = client.text_to_speech.stream(
            text=text,
            voice_id=ELEVENLABS_VOICE_ID,
            model_id="eleven_flash_v2_5",  # Flash model for ultra-low latency
            output_format="mp3_44100_128",
            voice_settings=voice_settings
        )

        logger.info(f"TTS synthesis successful with settings: {voice_settings}")

        # Create a BytesIO stream to collect audio data
        audio_stream = io.BytesIO()

        # Iterate through the generator and write chunks directly to stream
        for chunk in audio_generator:
            if chunk:
                audio_stream.write(chunk)

        # Reset stream position to beginning for reading
        audio_stream.seek(0)

        # Return the audio as a streaming response
        return StreamingResponse(audio_stream, media_type="audio/mpeg")

    except Exception as e:
        logger.error(f"/tts error: {e}")
        raise HTTPException(status_code=500, detail="Failed to synthesize audio")
