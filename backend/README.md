# GreaseMonkey AI Backend

## Overview
This is the FastAPI backend for GreaseMonkey AI. It handles:
- Voice-to-text (STT) via Whisper API
- Retrieval-augmented generation (RAG) with LangChain/Chroma
- GPT-4o queries
- Text-to-speech (TTS) via ElevenLabs
- User memory/history via Supabase
- API key security and CORS

## Structure
- `main.py` — FastAPI app setup, CORS, router include
- `routes.py` — All API endpoints
- `services.py` — Business logic, helpers, integrations
- `models.py` — Pydantic models
- `requirements.txt` — Python dependencies
- `Dockerfile` — Container build

## Setup
1. **Clone the repo**
2. **Install dependencies**
   ```sh
   cd backend
   pip install -r requirements.txt
   ```
3. **Create a `.env` file** (see below)
4. **Run locally**
   ```sh
   uvicorn main:app --reload --host 0.0.0.0 --port 8000
   ```
5. **Or use Docker**
   ```sh
   make build
   make up
   ```

## .env Example
```
OPENAI_API_KEY=sk-...
ELEVENLABS_API_KEY=elevenlabs-...
ELEVENLABS_VOICE_ID=EXAVITQu4vr4xnSDxMaL
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-supabase-key
API_KEY=your-backend-api-key
ALLOWED_ORIGINS=http://localhost:3000,https://yourdomain.com
CHROMA_PATH=./chroma_db
```

## Endpoints
### Health
- `GET /` — Health check

### Ask
- `POST /ask` — Ask a car question
  - Body: `{ user_id, question, car?, engine?, notes? }`
  - Headers: `x-api-key: <API_KEY>`
  - Returns: `{ answer, audio_url }`

### Speech-to-Text
- `POST /stt` — Transcribe audio
  - Form: `file` (audio file)
  - Headers: `x-api-key: <API_KEY>`
  - Returns: `{ text }`

### Text-to-Speech
- `POST /tts` — Synthesize speech
  - Body: `text` (string)
  - Headers: `x-api-key: <API_KEY>`
  - Returns: `audio/mpeg` stream

## Security
- All POST endpoints require `x-api-key` header
- CORS origins set via `ALLOWED_ORIGINS` in `.env`

## Dev Notes
- Models, routes, and services are modular for maintainability
- Add more FSM docs to `services.py` or wire up a real ingestion pipeline for production
- Supabase tables: `users`, `queries` (see design doc for schema)

---
PRs and issues welcome!
