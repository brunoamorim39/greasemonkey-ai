import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { config } from '@/lib/config'
import { userService } from '@/lib/services/user-service'
import { vehicleService } from '@/lib/services/vehicle-service'
import { documentService } from '@/lib/services/document-service'
import { withAuth } from '@/lib/auth'

const openai = new OpenAI({
  apiKey: config.openai.apiKey,
  organization: config.openai.organization,
  project: config.openai.project,
})

async function askHandler(request: NextRequest) {
  const startTime = Date.now()

  try {
    const body = await request.json()
    const {
      question,
      userId = config.app.defaultUserId,
      vehicleId,
      includeDocuments = true
    } = body

    // Validate input
    if (!question || typeof question !== 'string') {
      return NextResponse.json(
        { error: 'Question is required and must be a string' },
        { status: 400 }
      )
    }

    if (question.length > config.limits.maxQuestionLength) {
      return NextResponse.json(
        { error: `Question too long. Maximum ${config.limits.maxQuestionLength} characters allowed.` },
        { status: 400 }
      )
    }

    // Check usage limits before processing
    const usageCheck = await userService.checkUsageLimit(userId, 'ask')
    if (!usageCheck.allowed) {
      return NextResponse.json(
        {
          error: usageCheck.reason,
          upgrade_required: true
        },
        { status: 429 }
      )
    }

    // Get user preferences for unit formatting
    const preferences = await userService.getUserPreferences(userId)

    // Build unit instructions
    const unitInstructions = createUnitInstructions(preferences)

    // Get vehicle context if provided
    let vehicleContext = ''
    if (vehicleId) {
      const vehicle = await vehicleService.getVehicle(userId, vehicleId)
      if (vehicle) {
        vehicleContext = `\n\nVEHICLE CONTEXT: ${vehicleService.formatVehicleForGPT(vehicle)}`
        if (vehicle.engine) {
          vehicleContext += `\nEngine: ${vehicle.engine}`
        }
        if (vehicle.notes) {
          vehicleContext += `\nNotes: ${vehicle.notes}`
        }
      }
    }

    // Search user documents for relevant context
    let documentContext = ''
    let searchResults: any[] = []
    if (includeDocuments) {
      searchResults = await documentService.searchDocuments(userId, {
        query: question,
        limit: 3
      })

      if (searchResults.length > 0) {
        documentContext = '\n\nRELEVANT DOCUMENTS:\n' +
          searchResults.map(result =>
            `- ${result.document.original_filename}: ${result.content}`
          ).join('\n')
      }
    }

    // Build the full system prompt
    const systemPrompt = `${config.prompts.system}

${unitInstructions}${vehicleContext}${documentContext}`

    // Call GPT-4
    const completion = await openai.chat.completions.create({
      model: config.openai.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: question }
      ],
      max_tokens: config.openai.maxTokens,
      temperature: config.openai.temperature,
    })

    const response = completion.choices[0]?.message?.content || 'I apologize, but I could not generate a response.'
    const responseTime = Date.now() - startTime

    // Track usage
    await userService.trackUsage(userId, 'ask', {
      question_length: question.length,
      response_length: response.length,
      vehicle_id: vehicleId,
      used_documents: includeDocuments,
      response_time_ms: responseTime,
    })

    // Log the query for analytics
    await userService.logQuery(
      userId,
      question,
      response,
      vehicleId ? { vehicle_id: vehicleId } : undefined,
      responseTime
    )

    // Generate TTS audio
    let audioUrl = null
    try {
      if (response.length <= config.limits.maxTTSCharacters) {
        const ttsResponse = await fetch('https://api.elevenlabs.io/v1/text-to-speech/' + config.elevenlabs.voiceId, {
          method: 'POST',
          headers: {
            'Accept': 'audio/mpeg',
            'Content-Type': 'application/json',
            'xi-api-key': config.elevenlabs.apiKey,
          },
          body: JSON.stringify({
            text: response,
            model_id: config.elevenlabs.modelId,
            voice_settings: {
              stability: config.tts.stability,
              similarity_boost: config.tts.similarityBoost,
              style: config.tts.style,
              use_speaker_boost: config.tts.useSpeakerBoost,
            },
          }),
        })

        if (ttsResponse.ok) {
          const audioBuffer = await ttsResponse.arrayBuffer()
          const audioBase64 = Buffer.from(audioBuffer).toString('base64')
          audioUrl = `data:audio/mpeg;base64,${audioBase64}`

          // Track TTS usage
          await userService.trackUsage(userId, 'tts', {
            text_length: response.length,
            model: config.elevenlabs.modelId,
          })
        }
      }
    } catch (ttsError) {
      console.error('TTS generation failed:', ttsError)
      // Continue without TTS
    }

    return NextResponse.json({
      response,
      audioUrl,
      responseTimeMs: responseTime,
      vehicleContext: vehicleId ? vehicleContext : undefined,
      documentsUsed: includeDocuments ? searchResults?.length || 0 : 0,
    })

  } catch (error) {
    console.error('Error in ask route:', error)

    if (error instanceof Error) {
      return NextResponse.json(
        { error: `Failed to process request: ${error.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Export the authenticated handler
export const POST = withAuth(askHandler)

function createUnitInstructions(preferences: any): string {
  const instructions = [
    '\nUNIT PREFERENCES & TTS FORMATTING:',
    '- Write out all numbers clearly for speech synthesis',
    '- Always spell out units completely (no abbreviations)',
    '',
  ]

  // Torque
  if (preferences.torque_unit === 'newton_meters') {
    instructions.push('- Torque: Use newton meters (not Nm)')
  } else {
    instructions.push('- Torque: Use pound feet (not lb-ft)')
  }

  // Pressure
  if (preferences.pressure_unit === 'psi') {
    instructions.push('- Pressure: Use pounds per square inch (not PSI)')
  } else if (preferences.pressure_unit === 'bar') {
    instructions.push('- Pressure: Use bar')
  } else {
    instructions.push('- Pressure: Use kilopascals (not kPa)')
  }

  // Length
  if (preferences.length_unit === 'metric') {
    instructions.push('- Length: Use millimeters, centimeters, meters')
  } else {
    instructions.push('- Length: Use inches, feet')
  }

  // Volume
  if (preferences.volume_unit === 'metric') {
    instructions.push('- Volume: Use liters, milliliters')
  } else {
    instructions.push('- Volume: Use quarts, gallons, ounces')
  }

  // Temperature
  if (preferences.temperature_unit === 'celsius') {
    instructions.push('- Temperature: Use degrees Celsius')
  } else {
    instructions.push('- Temperature: Use degrees Fahrenheit')
  }

  return instructions.join('\n')
}
