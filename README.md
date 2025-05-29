
# 🛠️ GreaseMonkey AI – Design Document

**Version:** v0.1  
**Date:** May 29, 2025  
**Author:** [You]

---

## 🔧 1. Product Overview

GreaseMonkey AI is a mobile-first, hands-free AI copilot built for garage environments. It helps mechanics, enthusiasts, and tuners quickly retrieve technical specs, repair steps, and part information using natural language voice commands.

> “What’s the torque spec for the valve cover on a 1995 E36?”  
> “10 Nm, applied in a criss-cross pattern. Would you like the diagram?”

---

## 🧠 2. Core Features

| Feature                     | Description |
|----------------------------|-------------|
| Voice-to-Text (STT)        | Users speak questions hands-free via a mic or push-to-talk interface |
| AI Query Understanding     | Uses GPT-4o to interpret and contextualize user queries |
| FSM + Wiki Retrieval (RAG) | Embeds structured data (PDFs, forums, specs) and pulls exact answers |
| Text-to-Speech (TTS)       | Answers are read aloud using ElevenLabs or similar |
| Car Memory                 | Remembers user's garage, car models, and past questions |
| Multi-Device UX            | Mobile-first, with potential for smartwatch or AR display integration |

---

## 📱 3. User Flow (Voice-Only MVP)

1. User speaks: "GreaseMonkey, what’s the oil capacity on my WRX?"
2. STT transcribes: Whisper API turns it into text.
3. Context added: App adds metadata from user’s garage profile.
4. RAG triggered: Backend queries embedded FSM data.
5. GPT-4o formats response: "4.5 quarts with filter. Use 5W-30."
6. TTS responds aloud using ElevenLabs.

---

## ⚙️ 4. System Architecture

\`\`\`
Mobile App (Flutter)
    ↓ (Mic input)
Whisper API (STT)
    ↓ (Text query)
Backend API (FastAPI)
    → LangChain RAG Pipeline
        → FSM Embeddings (FAISS/Chroma)
    → GPT-4o Query Engine
        → Response Text
    → ElevenLabs (TTS)
        → Audio Stream
    → Supabase (Memory, Car Profiles)
\`\`\`

---

## 🧱 5. Tech Stack

| Layer        | Tooling                    |
|--------------|----------------------------|
| Frontend     | Flutter (iOS & Android)    |
| STT          | OpenAI Whisper API         |
| TTS          | ElevenLabs                 |
| AI Model     | GPT-4o (OpenAI API)        |
| RAG          | LangChain + FAISS/Chroma   |
| Memory       | Supabase (Postgres, Auth)  |
| Backend      | FastAPI (Python)           |
| Hosting      | Render, Railway, or Fly.io |

---

## 📚 6. Memory Design

\`\`\`json
{
  "user_id": "abc123",
  "garage": [
    {
      "car": "2008 Subaru WRX",
      "engine": "EJ255",
      "notes": "Stage 1 tune, AOS kit installed"
    }
  ],
  "query_history": [
    {
      "timestamp": "2025-05-29T15:00:00Z",
      "query": "What’s the oil capacity?",
      "response": "4.5 quarts with filter. Use 5W-30."
    }
  ]
}
\`\`\`

---

## 🛣️ 7. Roadmap

### Phase 1: MVP
- [ ] Flutter app with push-to-talk mic
- [ ] Whisper STT
- [ ] GPT-4o query engine
- [ ] ElevenLabs TTS
- [ ] RAG with LangChain + PDFs
- [ ] Supabase auth + memory

### Phase 2: FSM Expansion + UX Polish
- [ ] FSM ingestion pipeline
- [ ] Image/diagram rendering
- [ ] Voice command history
- [ ] Wake-word detection

### Phase 3: Power Features
- [ ] OBD-II dongle integration
- [ ] RockAuto part lookup
- [ ] Self-hosted shop edition
- [ ] Offline mode

---

## 📦 8. Deployment & DevOps

- CI/CD: GitHub Actions + Codemagic
- Crash analytics: Sentry (Flutter)
- Secret management: Doppler
- FSM ingestion: Python CLI tools

---

## 📈 9. Metrics to Track

- Query success rate
- TTS fallback or repeat usage
- FSM retrieval precision
- Query frequency per car
- User retention per tier

---

## 🔐 10. Licensing Considerations

- Avoid distributing copyrighted FSMs
- Start with:
  - Open-source docs
  - Community wikis
  - Summarized public info
- Consider FSM licensing partners for Pro access

---

## 💵 11. Pricing Structure

### Free Tier (For Light DIYers)
**Cost:** $0

- ✅ High-quality TTS (3 queries/day)
- 📚 Limited FSM access (BMW, Miata, WRX, etc.)
- 🚗 Max 2 saved cars
- 🧠 No persistent memory

---

### DIY Flex Plan (Usage-Based)
**Cost:** $0.10/query after 3/day  
**Audience:** Enthusiasts, part-time wrenchers

- ✅ High-quality TTS
- 🚗 Up to 10 saved vehicles
- 🧠 Full memory/log access
- 📚 Broad FSM access
- 💳 Optional billing cap

---

### Pro Tier (For Shops & Heavy Users)
**Cost:** $29/month  
**Audience:** Professional users, garage shops

- ✅ Unlimited queries
- ✅ High-quality TTS
- 📚 Full FSM access
- 🚗 Unlimited vehicles
- 🧠 Advanced memory/logs
- 📁 Upload custom PDFs
- 🧑‍🔧 Team/shared memory (future)
