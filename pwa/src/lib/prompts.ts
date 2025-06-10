// AI Prompts for GreaseMonkey automotive assistant
// This file contains all prompts used by the AI system for easier maintenance and updates

export const SYSTEM_PROMPTS = {
  // Main system prompt for automotive assistance
  primary: `You are GreaseMonkey AI, a specialized automotive repair and maintenance assistant.

CORE RESPONSIBILITIES:
- Provide expert automotive repair, maintenance, and troubleshooting assistance
- Help with cars, trucks, motorcycles, and other motor vehicles
- Infer vehicle information from user messages when possible
- Give practical, actionable advice with specific details

CRITICAL ACCURACY REQUIREMENTS:
- ALWAYS prioritize information from provided documents over general knowledge
- If unsure about specific details (engine size, chassis generation, etc.), acknowledge uncertainty
- When documents are provided, cite them explicitly: "According to the manual..." or "The specification document states..."
- If document information conflicts with general knowledge, trust the document

DOCUMENT REFERENCE PRIORITY:
1. First, check provided documents for exact information
2. If found in documents, cite the source clearly
3. If not in documents but you have reliable general automotive knowledge, provide it while stating "based on general automotive knowledge" or "typically"
4. If completely uncertain, recommend consulting the specific vehicle manual
5. Be helpful - don't just say "I don't know" when you can provide useful general guidance

VEHICLE INFERENCE:
- When users mention vehicle details (year, make, model, engine), acknowledge and use that context
- Common BMW codes: E46 = 3-Series (1998-2006), E90 = 3-Series (2005-2012), E92 = 3-Series Coupe (2007-2013)
- BMW 325 engine variations:
  * E46 325i (2001-2006): 2.5L M54 inline-6
  * E90 325i (2006-2012): 2.5L N52 inline-6 (later became 328i with 3.0L)
- Engine codes: LS1 = Chevy 5.7L V8, 2JZ = Toyota 3.0L inline-6, etc.
- If vehicle info is provided but no specific question, ask what they need help with regarding that vehicle
- Attempt to infer vehicle information from chassis codes, if provided by the user. For example, G80, W123, B4, Mk3, AW11, etc.

RESPONSE STYLE:
- Be direct and helpful - assume the user knows their way around cars
- Include specific torque specs, part numbers, and procedures when relevant
- Do not mention things like safety considerations, proper tools, or other things that are not relevant to the question
- Use technical terminology appropriately but explain when needed
- Brevity is the key, there is no need to be verbose unless the user asks for an actual explanation
- Focus on the question at hand, do not go off on tangents, and try to keep responses concise and to the point

SCOPE BOUNDARIES:
- Focus on automotive topics but be helpful, not robotic
- If asked about completely unrelated topics (homework, general coding, etc.), politely redirect: "I specialize in automotive repair and maintenance. What can I help you with regarding your vehicle?"
- For borderline topics (like automotive electronics programming), try to help from an automotive perspective

TEXT-TO-SPEECH OPTIMIZATION:
- Write numbers clearly (e.g., "fifteen newton meters" not "15 Nm")
- Spell out units ("pounds per square inch" not "PSI")
- Use "degrees Celsius/Fahrenheit" instead of symbols
- Say "millimeters" not "mm", "inches" not "in"

EXPERTISE AREAS:
- Engine diagnostics and repair
- Transmission and drivetrain issues
- Brake and suspension systems
- Electrical and electronic systems
- HVAC and climate control
- Fuel and ignition systems
- Maintenance schedules and fluid changes
- Performance modifications and tuning`,

  // Prompt for when vehicle context is provided
  withVehicleContext: (vehicleInfo: string) => `
VEHICLE CONTEXT: ${vehicleInfo}
Use this EXACT vehicle information to provide specific, relevant advice. This is the user's actual vehicle - do not assume different specifications than what is provided. Reference year-specific procedures, common issues for this exact model/year combination, and appropriate parts/specifications for THIS specific vehicle.`,

  // Prompt for when user provides vehicle info in their message
  vehicleInference: `
VEHICLE INFERENCE INSTRUCTIONS:
- The user has mentioned vehicle information in their message
- Extract and acknowledge the vehicle details (year, make, model, trim, engine)
- Use this context to provide specific advice for that vehicle
- If they haven't asked a specific question yet, acknowledge the vehicle and ask what they need help with`,

  // Prompt for asking user to confirm vehicle selection
  vehicleConfirmation: (vehicleName: string) => `
VEHICLE CONFIRMATION REQUEST:
The user mentioned "${vehicleName}" which might refer to a vehicle in their garage. Before proceeding with their question, ask them to confirm if they meant their ${vehicleName}.

Example response: "I noticed you mentioned '${vehicleName}' - did you mean your ${vehicleName}? If so, I can provide specific advice for that vehicle."

Keep the confirmation brief and then address their original question.`,

  // Fallback for unclear or very brief messages
  clarification: `
The user's message is unclear or very brief. Ask a helpful follow-up question to understand:
- What specific issue they're experiencing
- What symptoms or problems they've noticed
- What work they're trying to perform
- Any error codes or unusual sounds/behaviors`,

  // For when rejecting off-topic questions
  redirect: `Respond politely but redirect to automotive topics: "I specialize in automotive repair and maintenance. What can I help you with regarding your vehicle?"`
}

// Helper function to build the full system prompt based on context
export function buildSystemPrompt(options: {
  vehicleContext?: string
  hasVehicleInMessage?: boolean
  isUnclear?: boolean
  isOffTopic?: boolean
  needsVehicleConfirmation?: string
} = {}) {
  let prompt = SYSTEM_PROMPTS.primary

  if (options.vehicleContext) {
    prompt += "\n\n" + SYSTEM_PROMPTS.withVehicleContext(options.vehicleContext)
  }

  if (options.hasVehicleInMessage) {
    prompt += "\n\n" + SYSTEM_PROMPTS.vehicleInference
  }

  if (options.needsVehicleConfirmation) {
    prompt += "\n\n" + SYSTEM_PROMPTS.vehicleConfirmation(options.needsVehicleConfirmation)
  }

  if (options.isUnclear) {
    prompt += "\n\n" + SYSTEM_PROMPTS.clarification
  }

  if (options.isOffTopic) {
    prompt += "\n\n" + SYSTEM_PROMPTS.redirect
  }

  return prompt
}

// Vehicle detection patterns for inference
export const VEHICLE_PATTERNS = {
  // BMW model codes
  bmwCodes: /\b(E\d{2,3}|F\d{2,3}|G\d{2,3})\b/gi,

  // Engine codes and designations
  engineCodes: /\b(\d{3}[A-Z]{1,2}|LS[1-9]|2JZ|RB\d{2,3}|SR\d{2,3}|4G\d{2,3}|B\d{2,3}[A-Z]?\d?|K\d{2,3}[A-Z]?\d?)\b/gi,

  // Year make model patterns
  yearMakeModel: /\b(19|20)\d{2}\s+[A-Z][a-z]+\s+[A-Z0-9][a-z0-9-]+/gi,

  // Common make names
  makes: /\b(Toyota|Honda|Ford|Chevrolet|Chevy|Dodge|BMW|Mercedes|Audi|Volkswagen|VW|Nissan|Mazda|Subaru|Hyundai|Kia|Lexus|Acura|Infiniti|Cadillac|Buick|GMC|Jeep|Ram|Chrysler|Mitsubishi|Volvo|Porsche|Jaguar|Land\s*Rover|Mini|Fiat|Alfa\s*Romeo)\b/gi,
}

// Function to detect if a message contains vehicle information
export function detectVehicleInfo(message: string): {
  hasVehicleInfo: boolean
  extractedInfo: string[]
  confidence: 'high' | 'medium' | 'low'
} {
  const info: string[] = []
  let confidence: 'high' | 'medium' | 'low' = 'low'

  // Check for various patterns
  const bmwMatches = message.match(VEHICLE_PATTERNS.bmwCodes)
  const engineMatches = message.match(VEHICLE_PATTERNS.engineCodes)
  const yearMakeModelMatches = message.match(VEHICLE_PATTERNS.yearMakeModel)
  const makeMatches = message.match(VEHICLE_PATTERNS.makes)

  if (bmwMatches) info.push(...bmwMatches)
  if (engineMatches) info.push(...engineMatches)
  if (yearMakeModelMatches) info.push(...yearMakeModelMatches)
  if (makeMatches) info.push(...makeMatches)

  // Determine confidence level
  if (yearMakeModelMatches || (bmwMatches && engineMatches)) {
    confidence = 'high'
  } else if (bmwMatches || engineMatches || (makeMatches && makeMatches.length > 0)) {
    confidence = 'medium'
  }

  return {
    hasVehicleInfo: info.length > 0,
    extractedInfo: [...new Set(info)], // Remove duplicates
    confidence
  }
}

// Interface for user's vehicle from garage
export interface UserVehicle {
  id: string
  make: string
  model: string
  year: number
  nickname?: string
  trim?: string
  engine?: string
  notes?: string
}

// Function to detect if message references a vehicle from user's garage
export function detectVehicleFromGarage(message: string, userVehicles: UserVehicle[]): {
  matchedVehicle: UserVehicle | null
  matchType: 'nickname' | 'make_model' | 'make' | 'model' | 'year_make' | 'full_match' | null
  confidence: 'high' | 'medium' | 'low'
} {
  if (!userVehicles.length) {
    return { matchedVehicle: null, matchType: null, confidence: 'low' }
  }

  const messageLower = message.toLowerCase()

  // High confidence matches
  for (const vehicle of userVehicles) {
    // Check for nickname match (highest confidence)
    if (vehicle.nickname) {
      const nicknameLower = vehicle.nickname.toLowerCase()
      if (messageLower.includes(nicknameLower)) {
        return { matchedVehicle: vehicle, matchType: 'nickname', confidence: 'high' }
      }
    }

    // Check for "my [make]" or "the [make]" patterns
    const makePattern = new RegExp(`\\b(my|the)\\s+${vehicle.make.toLowerCase()}\\b`, 'i')
    if (makePattern.test(messageLower)) {
      return { matchedVehicle: vehicle, matchType: 'make', confidence: 'high' }
    }

    // Check for "my [model]" or "the [model]" patterns
    const modelPattern = new RegExp(`\\b(my|the)\\s+${vehicle.model.toLowerCase()}\\b`, 'i')
    if (modelPattern.test(messageLower)) {
      return { matchedVehicle: vehicle, matchType: 'model', confidence: 'high' }
    }

    // Check for full year make model match
    const fullPattern = new RegExp(`\\b${vehicle.year}\\s+${vehicle.make.toLowerCase()}\\s+${vehicle.model.toLowerCase()}\\b`, 'i')
    if (fullPattern.test(messageLower)) {
      return { matchedVehicle: vehicle, matchType: 'full_match', confidence: 'high' }
    }
  }

  // Medium confidence matches
  for (const vehicle of userVehicles) {
    // Check for make + model combination
    const makeModelPattern = new RegExp(`\\b${vehicle.make.toLowerCase()}\\s+${vehicle.model.toLowerCase()}\\b`, 'i')
    if (makeModelPattern.test(messageLower)) {
      return { matchedVehicle: vehicle, matchType: 'make_model', confidence: 'medium' }
    }

    // Check for year + make combination
    const yearMakePattern = new RegExp(`\\b${vehicle.year}\\s+${vehicle.make.toLowerCase()}\\b`, 'i')
    if (yearMakePattern.test(messageLower)) {
      return { matchedVehicle: vehicle, matchType: 'year_make', confidence: 'medium' }
    }
  }

  // Low confidence - just make or model mentioned alone (only if user has one vehicle)
  if (userVehicles.length === 1) {
    const vehicle = userVehicles[0]
    const makeOnly = new RegExp(`\\b${vehicle.make.toLowerCase()}\\b`, 'i')
    const modelOnly = new RegExp(`\\b${vehicle.model.toLowerCase()}\\b`, 'i')

    if (makeOnly.test(messageLower)) {
      return { matchedVehicle: vehicle, matchType: 'make', confidence: 'low' }
    }
    if (modelOnly.test(messageLower)) {
      return { matchedVehicle: vehicle, matchType: 'model', confidence: 'low' }
    }
  }

  return { matchedVehicle: null, matchType: null, confidence: 'low' }
}

// Function to check if a message is off-topic
export function isOffTopic(message: string): boolean {
  const offTopicPatterns = [
    /homework|assignment|school|university|college/i,
    /programming|code|javascript|python|html|css|web development/i,
    /math|calculus|algebra|geometry|equation/i,
    /weather|sports|politics|news|entertainment/i,
    /cooking|recipe|food|restaurant/i,
    /relationship|dating|love|romance/i,
    /health|medical|doctor|medicine/i,
  ]

  return offTopicPatterns.some(pattern => pattern.test(message))
}

// Function to check if a message is unclear or too brief
export function isUnclearMessage(message: string): boolean {
  const trimmed = message.trim()

  // Too short
  if (trimmed.length < 10) return true

  // Only contains vehicle info but no question
  const vehicleInfo = detectVehicleInfo(message)
  if (vehicleInfo.hasVehicleInfo && vehicleInfo.confidence === 'high') {
    // Check if there's a question or problem description beyond vehicle info
    const questionWords = /\b(what|how|why|when|where|problem|issue|help|fix|repair|trouble|wrong|broken|noise|sound|vibrat|leak|smell)\b/i
    return !questionWords.test(message)
  }

  return false
}
