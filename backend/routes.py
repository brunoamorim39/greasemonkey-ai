from fastapi import APIRouter, UploadFile, File, Request, HTTPException
from fastapi.responses import StreamingResponse
from typing import Optional, List
from datetime import datetime
from services import (
    logger, require_api_key, retrieve_fsm, call_gpt4o, call_elevenlabs_tts, log_query,
    OPENAI_API_KEY, OPENAI_ORGANIZATION, OPENAI_PROJECT, ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID,
    document_manager, MAX_DOCUMENT_SIZE_MB
)
from models import (
    AskRequest, AskResponse, DocumentUploadRequest, DocumentMetadata,
    DocumentSearchRequest, DocumentSearchResult, UserDocumentStats, DocumentType
)

router = APIRouter()

@router.get("/", tags=["Health"], summary="Health check", description="Returns status of the backend.")
def root():
    return {"status": "ok", "message": "GreaseMonkey AI backend running"}

@router.post("/ask", response_model=AskResponse, tags=["AI"], summary="Ask a question", description="Ask a car-related question. Uses enhanced FSM retrieval with user documents, GPT-4o, TTS, and logs to Supabase.")
@require_api_key
async def ask(request: AskRequest, request_: Request):
    try:
        # Enhanced FSM retrieval with document search
        fsm_snippet = retrieve_fsm(request.question, car=request.car, user_id=request.user_id)
        if fsm_snippet:
            context = f"Relevant documentation:\n{fsm_snippet}\n\nUser question: "
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

@router.post("/documents/upload", response_model=DocumentMetadata, tags=["Documents"], summary="Upload document", description="Upload a PDF document for car-specific information (requires paid plan).")
@require_api_key
async def upload_document(
    file: UploadFile = File(...),
    user_id: str = None,
    title: str = None,
    car_make: Optional[str] = None,
    car_model: Optional[str] = None,
    car_year: Optional[int] = None,
    car_engine: Optional[str] = None,
    tags: Optional[str] = None,  # Comma-separated tags
    is_public: bool = False,
    request: Request = None
):
    try:
        # Validate file type
        if not file.filename.lower().endswith('.pdf'):
            raise HTTPException(status_code=400, detail="Only PDF files are supported")

        # Check file size
        file_content = await file.read()
        file_size_mb = len(file_content) / (1024 * 1024)

        if file_size_mb > MAX_DOCUMENT_SIZE_MB:
            raise HTTPException(
                status_code=400,
                detail=f"File too large. Maximum size: {MAX_DOCUMENT_SIZE_MB}MB, got: {file_size_mb:.1f}MB"
            )

        # Parse tags
        tag_list = [tag.strip() for tag in (tags or "").split(",") if tag.strip()]

        # Create upload request
        upload_request = DocumentUploadRequest(
            title=title or file.filename,
            car_make=car_make,
            car_model=car_model,
            car_year=car_year,
            car_engine=car_engine,
            tags=tag_list,
            is_public=is_public
        )

        # Upload document
        metadata = document_manager.upload_document(
            user_id=user_id,
            file_content=file_content,
            filename=file.filename,
            upload_request=upload_request
        )

        logger.info(f"Document uploaded successfully: {metadata.id}")
        return metadata

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"/documents/upload error: {e}")
        raise HTTPException(status_code=500, detail="Failed to upload document")

@router.post("/documents/search", response_model=List[DocumentSearchResult], tags=["Documents"], summary="Search documents", description="Search through user's uploaded documents and system manuals.")
@require_api_key
async def search_documents(request: DocumentSearchRequest, request_: Request):
    try:
        results = document_manager.search_documents(
            query=request.query,
            user_id=request.user_id,
            car_make=request.car_make,
            car_model=request.car_model,
            car_year=request.car_year,
            document_types=request.document_types,
            limit=request.limit
        )

        logger.info(f"Document search returned {len(results)} results for user {request.user_id}")
        return results

    except Exception as e:
        logger.error(f"/documents/search error: {e}")
        raise HTTPException(status_code=500, detail="Failed to search documents")

@router.get("/documents/stats/{user_id}", response_model=UserDocumentStats, tags=["Documents"], summary="Get user document stats", description="Get storage usage and document statistics for a user.")
@require_api_key
async def get_user_document_stats(user_id: str, request: Request):
    try:
        from services import supabase, STORAGE_LIMITS, UserTier

        if not supabase:
            raise HTTPException(status_code=500, detail="Database not available")

        # Get user tier
        user_result = supabase.table("users").select("tier").eq("user_id", user_id).execute()
        if not user_result.data:
            raise HTTPException(status_code=404, detail="User not found")

        user_tier = UserTier(user_result.data[0]["tier"])
        max_storage_mb = STORAGE_LIMITS.get(user_tier, 0)

        # Get user documents
        docs_result = supabase.table("documents").select("document_type, file_size").eq("user_id", user_id).execute()

        # Calculate stats
        total_documents = len(docs_result.data)
        storage_used_bytes = sum(doc["file_size"] for doc in docs_result.data)
        storage_used_mb = storage_used_bytes / (1024 * 1024)

        # Count by type
        documents_by_type = {}
        for doc in docs_result.data:
            doc_type = doc["document_type"]
            documents_by_type[doc_type] = documents_by_type.get(doc_type, 0) + 1

        can_upload_more = user_tier != UserTier.FREE and storage_used_mb < max_storage_mb

        return UserDocumentStats(
            total_documents=total_documents,
            documents_by_type=documents_by_type,
            storage_used_mb=storage_used_mb,
            max_storage_mb=max_storage_mb,
            can_upload_more=can_upload_more
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"/documents/stats error: {e}")
        raise HTTPException(status_code=500, detail="Failed to get document stats")

@router.get("/documents/list/{user_id}", response_model=List[DocumentMetadata], tags=["Documents"], summary="List user documents", description="Get a list of all documents uploaded by a user.")
@require_api_key
async def list_user_documents(user_id: str, request: Request):
    try:
        from services import supabase

        if not supabase:
            raise HTTPException(status_code=500, detail="Database not available")

        result = supabase.table("documents").select("*").eq("user_id", user_id).order("upload_date", desc=True).execute()

        documents = []
        for doc_data in result.data:
            # Convert string dates back to datetime objects
            if doc_data.get("upload_date"):
                doc_data["upload_date"] = datetime.fromisoformat(doc_data["upload_date"].replace("Z", "+00:00"))
            if doc_data.get("processed_date"):
                doc_data["processed_date"] = datetime.fromisoformat(doc_data["processed_date"].replace("Z", "+00:00"))

            documents.append(DocumentMetadata(**doc_data))

        return documents

    except Exception as e:
        logger.error(f"/documents/list error: {e}")
        raise HTTPException(status_code=500, detail="Failed to list documents")

@router.delete("/documents/{document_id}", tags=["Documents"], summary="Delete document", description="Delete a document and its associated files.")
@require_api_key
async def delete_document(document_id: str, user_id: str, request: Request):
    try:
        from services import document_manager

        success = document_manager.delete_document(user_id, document_id)

        if success:
            return {"message": "Document deleted successfully"}
        else:
            raise HTTPException(status_code=404, detail="Document not found or access denied")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"/documents/{document_id} delete error: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete document")

@router.get("/documents/{document_id}/download", tags=["Documents"], summary="Download document", description="Get a download URL for a document file.")
@require_api_key
async def download_document(document_id: str, user_id: str, request: Request):
    try:
        from services import document_manager

        download_url = document_manager.get_file_download_url(user_id, document_id)

        if download_url:
            return {"download_url": download_url}
        else:
            raise HTTPException(status_code=404, detail="Document not found or access denied")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"/documents/{document_id}/download error: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate download URL")

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
