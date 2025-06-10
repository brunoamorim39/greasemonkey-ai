import OpenAI from 'openai'
import { config } from '@/lib/config'
import { buildSystemPrompt } from '@/lib/prompts'

export interface GPTResponse {
  content: string
  confidence: number
  reasoning: string
  sources_referenced: boolean
}

export interface EvaluatedAnswer {
  answer: string
  confidence: number
  consistency_score: number
  accuracy_indicators: string[]
  used_documents: boolean
  evaluation_notes: string
}

export interface GPTEvaluationResult {
  bestAnswer: string
  confidence: number
  accuracy: number
  consistency: number
  reasoning: string
  allResponses: GPTResponse[]
}

// Token counting utility
function estimateTokens(text: string): number {
  // Rough estimation: ~4 characters per token for English text
  return Math.ceil(text.length / 4)
}

function truncateText(text: string, maxTokens: number): string {
  const maxChars = maxTokens * 4 // Rough estimation
  if (text.length <= maxChars) return text

  // Try to truncate at sentence boundaries
  const truncated = text.substring(0, maxChars)
  const lastSentence = truncated.lastIndexOf('.')

  if (lastSentence > maxChars * 0.8) {
    return truncated.substring(0, lastSentence + 1) + '\n\n[Text truncated for length...]'
  }

  return truncated + '\n\n[Text truncated for length...]'
}

export class GPTService {
  private openai: OpenAI

  constructor() {
    this.openai = new OpenAI({
      apiKey: config.openai.apiKey,
    })
  }

  /**
   * Generate multiple answers and evaluate them for consistency and accuracy
   */
  async getEvaluatedAnswer(
    query: string,
    searchResults: string,
    carInfo: { make: string; model: string; year: number }
  ): Promise<GPTEvaluationResult> {
    try {
      // Estimate tokens and truncate if necessary
      const systemPrompt = buildSystemPrompt();
      const queryTokens = estimateTokens(query)
      const systemPromptTokens = estimateTokens(systemPrompt)
      const carInfoTokens = estimateTokens(JSON.stringify(carInfo))

      // Much more aggressive limits for production rate limits
      // Reserve tokens for: system prompt (1k), query (0.5k), car info (0.2k), response (2k), overhead (1k)
      const reservedTokens = 4700
      const maxSearchTokens = 25000 - reservedTokens // Stay well under 30k/min limit

      console.log(`🔢 Token estimation: query=${queryTokens}, system=${systemPromptTokens}, reserved=${reservedTokens}, maxSearch=${maxSearchTokens}`)

      const truncatedSearchResults = truncateText(searchResults, maxSearchTokens)
      const finalSearchTokens = estimateTokens(truncatedSearchResults)

      console.log(`📊 Search results: original=${estimateTokens(searchResults)} tokens, truncated=${finalSearchTokens} tokens`)

      // Generate responses SEQUENTIALLY to avoid rate limits
      console.log('🔄 Generating responses sequentially to avoid rate limits...')
      const responses: GPTResponse[] = []

      // First response (low temp)
      const response1 = await this.generateResponse(query, truncatedSearchResults, carInfo, 0.1)
      responses.push(response1)

      // Brief delay to help with rate limiting
      await new Promise(resolve => setTimeout(resolve, 500))

      // Second response (higher temp)
      const response2 = await this.generateResponse(query, truncatedSearchResults, carInfo, 0.3)
      responses.push(response2)

      // Brief delay to help with rate limiting
      await new Promise(resolve => setTimeout(resolve, 500))

      // Third response (low temp again)
      const response3 = await this.generateResponse(query, truncatedSearchResults, carInfo, 0.1)
      responses.push(response3)

      console.log('🔍 Multi-answer evaluation:', {
        responseCount: responses.length,
        confidences: responses.map(r => r.confidence),
        sourcesReferenced: responses.map(r => r.sources_referenced),
        allReferencedSources: responses.every(r => r.sources_referenced),
        hasDocumentContext: truncatedSearchResults.length > 0,
        responsePreview: responses.map((r, i) => `Response ${i + 1}: ${r.content.substring(0, 100)}...`)
      })

      // Evaluate consistency and accuracy
      const evaluation = await this.evaluateResponses(responses, query, truncatedSearchResults)

      console.log('🎯 Answer evaluation complete:', {
        confidence: evaluation.confidence,
        consistencyScore: evaluation.consistency_score,
        accuracyIndicators: evaluation.accuracy_indicators,
        usedDocuments: evaluation.used_documents,
        responseLength: evaluation.answer.length
      })

      return {
        bestAnswer: evaluation.answer,
        confidence: evaluation.confidence,
        accuracy: evaluation.accuracy_indicators.length > 0 ? 1 : 0,
        consistency: evaluation.consistency_score,
        reasoning: evaluation.evaluation_notes,
        allResponses: responses
      }

    } catch (error) {
      console.error('Error in GPT evaluation process:', error)
      throw error
    }
  }

  /**
   * Generate a single response with specific temperature and reasoning
   */
  private async generateResponse(
    query: string,
    searchResults: string,
    carInfo: { make: string; model: string; year: number },
    temperature: number = 0.1
  ): Promise<GPTResponse> {
    const enhancedPrompt = buildSystemPrompt()

    // Double-check token limits before sending
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: enhancedPrompt },
      {
        role: 'user',
        content: `Car: ${carInfo.year} ${carInfo.make} ${carInfo.model}

Available documentation:
${searchResults}

User question: ${query}

Please provide a detailed answer based on the documentation above. If the information is found in the documents, cite it clearly. If not found, state that clearly.`
      }
    ]

    const totalTokens = messages.reduce((sum, msg) => {
      const content = typeof msg.content === 'string' ? msg.content : '';
      return sum + estimateTokens(content);
    }, 0)
    console.log(`🎯 Final message tokens: ${totalTokens} (temp: ${temperature})`)

    if (totalTokens > 120000) {
      throw new Error(`Token count too high: ${totalTokens}. Search results may need further truncation.`)
    }

    const completion = await this.openai.chat.completions.create({
      model: config.openai.model,
      messages,
      max_tokens: config.openai.maxTokens,
      temperature,
    })

    const rawContent = completion.choices[0]?.message?.content || ''

    // Improved confidence calculation
    let confidence = 0.5 // Base confidence

    // Higher confidence if documents were available and referenced
    if (searchResults && searchResults.length > 0) {
      const hasDocRef = rawContent.toLowerCase().includes('according to') ||
                       rawContent.toLowerCase().includes('document') ||
                       rawContent.toLowerCase().includes('manual') ||
                       rawContent.toLowerCase().includes('specification')

      confidence = hasDocRef ? 0.9 : 0.4 // High if cited docs, low if ignored them
    } else {
      // No documents available - moderate confidence for general knowledge
      confidence = 0.6
    }

    // Check if documents were properly referenced
    const sourcesReferenced = searchResults.length > 0 && (
      rawContent.toLowerCase().includes('according to') ||
      rawContent.toLowerCase().includes('document') ||
      rawContent.toLowerCase().includes('manual') ||
      rawContent.toLowerCase().includes('specification') ||
      rawContent.toLowerCase().includes('provided')
    )

    return {
      content: rawContent.trim(),
      confidence,
      reasoning: `Temperature ${temperature}, hasDocuments: ${searchResults.length > 0}, citedSources: ${sourcesReferenced}`,
      sources_referenced: sourcesReferenced
    }
  }

  /**
   * Evaluate multiple responses for consistency and accuracy
   */
  private async evaluateResponses(
    responses: GPTResponse[],
    originalQuestion: string,
    documentContext: string
  ): Promise<EvaluatedAnswer> {
    // Simplified evaluation to avoid additional GPT calls and rate limits
    const hasDocuments = documentContext && documentContext.length > 0

    // Find best response based on simple criteria
    let bestResponse = responses[0]
    let bestScore = 0

    for (const response of responses) {
      let score = response.confidence

      // Bonus for citing sources when documents are available
      if (hasDocuments && response.sources_referenced) {
        score += 0.3
      }

      // Bonus for longer, more detailed responses
      if (response.content.length > 100) {
        score += 0.1
      }

      if (score > bestScore) {
        bestScore = score
        bestResponse = response
      }
    }

    // Calculate consistency score based on response similarity
    const responseLengths = responses.map(r => r.content.length)
    const avgLength = responseLengths.reduce((a, b) => a + b, 0) / responseLengths.length
    const lengthVariance = responseLengths.reduce((sum, len) => sum + Math.abs(len - avgLength), 0) / responseLengths.length
    const consistencyScore = Math.max(0.1, 1 - (lengthVariance / avgLength))

    // Calculate average confidence
    const avgConfidence = responses.reduce((sum, r) => sum + r.confidence, 0) / responses.length

    // Determine accuracy indicators
    const accuracyIndicators: string[] = []
    if (hasDocuments && bestResponse.sources_referenced) {
      accuracyIndicators.push('cited_documents')
    }
    if (consistencyScore > 0.8) {
      accuracyIndicators.push('consistent_responses')
    }
    if (avgConfidence > 0.8) {
      accuracyIndicators.push('high_confidence')
    }

    return {
      answer: bestResponse.content,
      confidence: avgConfidence,
      consistency_score: consistencyScore,
      accuracy_indicators: accuracyIndicators,
      used_documents: bestResponse.sources_referenced,
      evaluation_notes: `Selected response with score ${bestScore.toFixed(2)}. Consistency: ${consistencyScore.toFixed(2)}`
    }
  }
}

export const gptService = new GPTService()
