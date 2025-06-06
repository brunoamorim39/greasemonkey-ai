import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { config } from '@/lib/config'
import { withAuth } from '@/lib/auth'
import { userService } from '@/lib/services/user-service'
import { vehicleService } from '@/lib/services/vehicle-service'
import { documentService } from '@/lib/services/document-service'
import { buildSystemPrompt, detectVehicleInfo, detectVehicleFromGarage, isOffTopic, isUnclearMessage, UserVehicle } from '@/lib/prompts'

const openai = new OpenAI({
  apiKey: config.openai.apiKey,
})

console.log('OpenAI API Key check:', {
  hasApiKey: !!config.openai.apiKey,
  apiKeyLength: config.openai.apiKey?.length || 0,
  apiKeyPrefix: config.openai.apiKey?.substring(0, 7) || 'none'
})

interface SearchResult {
  document: {
    original_filename: string
  }
  content: string
}

interface UserPreferences {
  torque_unit?: string
  pressure_unit?: string
  length_unit?: string
  volume_unit?: string
  temperature_unit?: string
}

async function askHandler(request: NextRequest & { userId: string }) {
  const startTime = Date.now()

  try {
    const { question, vehicleId, includeDocuments = true } = await request.json()

    if (!question?.trim()) {
      return NextResponse.json({ error: 'Question is required' }, { status: 400 })
    }

    // Get authenticated user ID from middleware
    const userId = request.userId

    // Check rate limits and usage
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

    // Get user's vehicles for garage detection
    const userVehicles = await vehicleService.getUserVehicles(userId)
    const userVehiclesForMatching: UserVehicle[] = userVehicles.map(v => ({
      id: v.id,
      make: v.make,
      model: v.model,
      year: v.year,
      nickname: v.nickname || undefined,
      trim: v.trim || undefined,
      engine: v.engine || undefined,
      notes: v.notes || undefined
    }))

        // Check if user mentioned a vehicle from their garage (when no vehicle is selected)
    let effectiveVehicleId = vehicleId
    let autoSwitchedVehicle: UserVehicle | null = null
    let needsVehicleConfirmation: string | null = null

    if (!vehicleId) {
      const garageMatch = detectVehicleFromGarage(question, userVehiclesForMatching)
      if (garageMatch.matchedVehicle) {
        if (garageMatch.confidence === 'high') {
          // Auto-switch for high confidence
          effectiveVehicleId = garageMatch.matchedVehicle.id
          autoSwitchedVehicle = garageMatch.matchedVehicle
        } else if (garageMatch.confidence === 'medium') {
          // Ask for confirmation for medium confidence
          const vehicleName = garageMatch.matchedVehicle.nickname ||
                              `${garageMatch.matchedVehicle.year} ${garageMatch.matchedVehicle.make} ${garageMatch.matchedVehicle.model}`
          needsVehicleConfirmation = vehicleName
        }
        // Low confidence = ignore
      }
    }

    // Get vehicle context if provided or auto-detected
    let vehicleContext = ''
    let selectedVehicle = null
    if (effectiveVehicleId) {
      selectedVehicle = await vehicleService.getVehicle(userId, effectiveVehicleId)
      if (selectedVehicle) {
        vehicleContext = `\n\nVEHICLE CONTEXT: ${vehicleService.formatVehicleForGPT(selectedVehicle)}`
        if (selectedVehicle.engine) {
          vehicleContext += `\nEngine: ${selectedVehicle.engine}`
        }
        if (selectedVehicle.notes) {
          vehicleContext += `\nNotes: ${selectedVehicle.notes}`
        }
      }
    }

    // Search user documents for relevant context
    let documentContext = ''
    let searchResults: SearchResult[] = []
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

    // Analyze the user's question for intelligent prompting
    const vehicleInfo = detectVehicleInfo(question)
    const isOffTopicQuery = isOffTopic(question)
    const isUnclear = isUnclearMessage(question)

    // Build vehicle context string for prompt
    let vehicleContextString = ''
    if (effectiveVehicleId && vehicleContext) {
      vehicleContextString = vehicleContext.replace('\n\nVEHICLE CONTEXT: ', '')
    }

    // Build the intelligent system prompt
    const systemPrompt = buildSystemPrompt({
      vehicleContext: vehicleContextString || undefined,
      hasVehicleInMessage: vehicleInfo.hasVehicleInfo,
      isUnclear,
      isOffTopic: isOffTopicQuery,
      needsVehicleConfirmation: needsVehicleConfirmation || undefined
    }) + '\n\n' + unitInstructions + vehicleContext + documentContext

    // Debug right before OpenAI call
    console.log('About to call OpenAI with:', {
      hasClient: !!openai,
      clientApiKey: openai.apiKey ? `${openai.apiKey.substring(0, 10)}...${openai.apiKey.slice(-4)}` : 'MISSING',
      model: config.openai.model,
      systemPromptLength: systemPrompt.length
    })

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
      vehicle_id: effectiveVehicleId,
      used_documents: includeDocuments,
      response_time_ms: responseTime,
      auto_switched_vehicle: autoSwitchedVehicle ? true : false,
      requested_confirmation: needsVehicleConfirmation ? true : false,
    })

    // Log the query for analytics
    await userService.logQuery(
      userId,
      question,
      response,
            effectiveVehicleId ? {
        vehicle_id: effectiveVehicleId,
        auto_switched: autoSwitchedVehicle ? true : false,
        requested_confirmation: needsVehicleConfirmation ? true : false
      } : undefined,
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
      vehicleContext: effectiveVehicleId ? vehicleContext : undefined,
      documentsUsed: includeDocuments ? searchResults?.length || 0 : 0,
      autoSwitchedVehicle: autoSwitchedVehicle ? {
        id: autoSwitchedVehicle.id,
        make: autoSwitchedVehicle.make,
        model: autoSwitchedVehicle.model,
        year: autoSwitchedVehicle.year,
        nickname: autoSwitchedVehicle.nickname
      } : undefined,
      needsVehicleConfirmation: needsVehicleConfirmation || undefined,
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

function createUnitInstructions(preferences: UserPreferences): string {
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
