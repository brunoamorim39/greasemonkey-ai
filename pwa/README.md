# GreaseMonkey AI - PWA

Voice-first automotive repair assistant, now as a Progressive Web App.

## Quick Start

1. **Install dependencies:**

   ```bash
   npm install
   ```

2. **Set up environment:**

   ```bash
   cp env.example .env.local
   # Edit .env.local with your API keys
   ```

3. **Run dev server:**

   ```bash
   npm run dev
   ```

4. **Visit:** `http://localhost:3000`

## Tech Stack

- **Frontend:** Next.js 14 + TypeScript + Tailwind CSS
- **Voice:** Web Speech API + OpenAI Whisper
- **AI:** GPT-4 + ElevenLabs TTS
- **Database:** Supabase
- **Deployment:** Vercel (recommended)

## Features

- 🎤 Voice recording and transcription
- 🤖 AI-powered automotive repair answers
- 🔊 Text-to-speech responses
- 📱 PWA support (installable on mobile)
- 🚗 Vehicle context awareness
- ⚙️ Centralized configuration
- ⚡ Ultra-low latency TTS (~75ms)

## Environment Variables

### Required
```env
# Core APIs
OPENAI_API_KEY=your_openai_api_key
ELEVENLABS_API_KEY=your_elevenlabs_api_key
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

### Optional (with defaults)
```env
# OpenAI Configuration
OPENAI_ORGANIZATION=your_openai_org_id
OPENAI_PROJECT=your_openai_project_id
GPT_MODEL=gpt-4o
WHISPER_MODEL=whisper-1
MAX_TOKENS=500
TEMPERATURE=0.7

# ElevenLabs Configuration (optimized for Flash v2.5)
ELEVENLABS_VOICE_ID=pNInz6obpgDQGcFmaJgB  # Adam voice
ELEVENLABS_MODEL_ID=eleven_flash_v2_5      # Ultra-fast, 50% cheaper

# TTS Settings (Flash v2.5 optimized)
TTS_STABILITY=0.65           # Higher stability for Flash
TTS_SIMILARITY_BOOST=0.85    # Higher similarity for Flash
TTS_STYLE=0.2               # Some style for naturalness
TTS_USE_SPEAKER_BOOST=false # Not supported in Flash v2.5

# App Settings
ENVIRONMENT=development
```

## ElevenLabs Model Comparison

| Feature | Flash v2.5 (Default) | Multilingual v2 | Turbo v2.5 |
|---------|---------------------|----------------|------------|
| **Cost** | **50% cheaper** | Standard | 50% cheaper |
| **Latency** | **~75ms** | ~500-1000ms | ~250-300ms |
| **Character Limit** | **40,000** | 10,000 | 40,000 |
| **Languages** | **32** | 29 | 32 |
| **Quality** | Good | **Best** | High |
| **Speaker Boost** | ❌ | ✅ | ❌ |
| **Best For** | Real-time AI | Audiobooks | Balanced use |

### Cost Breakdown (approximate)
- **Flash v2.5:** ~$0.15 per 1K characters
- **Multilingual v2:** ~$0.30 per 1K characters
- **Turbo v2.5:** ~$0.15 per 1K characters

For a typical 100-character response:
- Flash v2.5: **$0.015**
- Multilingual v2: **$0.030** (2x more expensive)

## Voice Options

You can easily change the TTS voice by setting `ELEVENLABS_VOICE_ID`:

- **Adam:** `pNInz6obpgDQGcFmaJgB` (default)
- **Antoni:** `ErXwobaYiN019PkySvjV`
- **Arnold:** `9PWcJUXOm9XVeKUEqN4L`
- **Bella:** `EXAVITQu4vr4xnSDxMaL`
- **Rachel:** `21m00Tcm4TlvDq8ikWAM`
- **Sam:** `yoZ06aMxZJJ28mfd3POQ`

## Model Switching

To switch models, just update your `.env.local`:

```env
# For maximum quality (2x cost, higher latency)
ELEVENLABS_MODEL_ID=eleven_multilingual_v2
TTS_USE_SPEAKER_BOOST=true

# For balanced performance
ELEVENLABS_MODEL_ID=eleven_turbo_v2_5

# For ultra-fast, cheap responses (default)
ELEVENLABS_MODEL_ID=eleven_flash_v2_5
```

## Flash v2.5 Optimizations

The app is optimized for Flash v2.5 with:

- **Smart prompt engineering** - GPT writes out numbers clearly ("fifteen Newton meters" vs "15 Nm")
- **Speaker boost disabled** - Not supported by Flash model
- **Higher similarity/stability** - Compensates for Flash's speed optimizations
- **40k character support** - Can handle much longer responses

## Deploy to Vercel

```bash
npm install -g vercel
vercel --prod
```

## Configuration

All settings are centralized in `src/lib/config.ts`. Environment variables override defaults, making it easy to customize without touching code.

**Flash v2.5 = Best choice for MVP** - 50% cheaper, ultra-fast, perfect for conversational AI!
