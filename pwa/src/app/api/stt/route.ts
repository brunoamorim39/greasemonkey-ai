import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { config } from '@/lib/config'
import { withAuth } from '@/lib/auth'

// Simplest possible OpenAI configuration - just the API key
const openai = new OpenAI({
  apiKey: config.openai.apiKey,
})

async function transcribeHandler(request: NextRequest & { userId: string }) {
  try {
    const formData = await request.formData()
    const audioFile = formData.get('audio') as File
    // Get authenticated user ID from middleware
    const userId = request.userId

    if (!audioFile) {
      return NextResponse.json(
        { error: 'Audio file is required' },
        { status: 400 }
      )
    }

    // Check file size
    if (audioFile.size > config.limits.maxAudioSizeBytes) {
      return NextResponse.json(
        { error: 'Audio file too large. Maximum size is 25MB.' },
        { status: 400 }
      )
    }

    // Convert File to format OpenAI expects
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: config.openai.whisperModel,
      response_format: 'text',
    })

    return NextResponse.json({
      text: transcription,
      user_id: userId,
    })

  } catch (error) {
    console.error('STT endpoint error:', error)
    return NextResponse.json(
      { error: 'Failed to transcribe audio' },
      { status: 500 }
    )
  }
}

export const POST = withAuth(transcribeHandler)
