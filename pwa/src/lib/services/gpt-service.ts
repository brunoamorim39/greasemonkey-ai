import OpenAI from 'openai'
import { config } from '@/lib/config'

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
    systemPrompt: string,
    userQuestion: string,
    documentContext: string = '',
    iterations: number = 3
  ): Promise<EvaluatedAnswer> {

    try {
      // Generate multiple responses with different approaches
      const responses = await Promise.all([
        this.generateResponse(systemPrompt, userQuestion, documentContext, 0.1), // Very deterministic
        this.generateResponse(systemPrompt, userQuestion, documentContext, 0.3), // Slightly creative
        this.generateResponse(systemPrompt, userQuestion, documentContext, 0.1), // Another deterministic
      ])

      console.log('📝 Generated responses analysis:', {
        responseLengths: responses.map(r => r.content.length),
        confidences: responses.map(r => r.confidence),
        sourcesReferenced: responses.map(r => r.sources_referenced),
        allReferencedSources: responses.every(r => r.sources_referenced),
        hasDocumentContext: documentContext.length > 0,
        responsePreview: responses.map((r, i) => `Response ${i + 1}: ${r.content.substring(0, 100)}...`)
      })

      // Evaluate consistency and accuracy
      const evaluation = await this.evaluateResponses(responses, userQuestion, documentContext)

      console.log('🎯 Answer evaluation complete:', {
        finalConfidence: evaluation.confidence,
        consistencyScore: evaluation.consistency_score,
        accuracyIndicators: evaluation.accuracy_indicators,
        usedDocuments: evaluation.used_documents,
        evaluationNotes: evaluation.evaluation_notes.substring(0, 200) + '...'
      })

      return evaluation

    } catch (error) {
      console.error('Error in GPT evaluation process:', error)

      // Fallback to single response
      const fallbackResponse = await this.generateResponse(systemPrompt, userQuestion, documentContext, 0.1)
      return {
        answer: fallbackResponse.content,
        confidence: fallbackResponse.confidence * 0.7, // Lower confidence for fallback
        consistency_score: 0.5,
        accuracy_indicators: fallbackResponse.sources_referenced ? ['document_referenced'] : [],
        used_documents: fallbackResponse.sources_referenced,
        evaluation_notes: 'Fallback to single response due to evaluation error'
      }
    }
  }

    /**
   * Generate a single response with specific temperature and reasoning
   */
  private async generateResponse(
    systemPrompt: string,
    userQuestion: string,
    documentContext: string,
    temperature: number
  ): Promise<GPTResponse> {
    // Enhanced prompt that forces specific behavior based on document availability
    let enhancedPrompt = systemPrompt

    if (documentContext && documentContext.length > 0) {
      enhancedPrompt += `

CRITICAL: You have been provided with relevant document content below. You MUST prioritize this information above all else.

DOCUMENT CONTENT:
${documentContext}

INSTRUCTIONS:
1. If the answer is found in the provided documents, use ONLY that information
2. Always cite your source: "According to the provided manual/document..."
3. If the exact specification isn't in the documents, say "I don't see this specific information in your documents"
4. Do NOT provide general automotive knowledge if it conflicts with or supplements document information
5. Be precise - if documents show "85 Nm" don't say "approximately 85 Nm"`
    } else {
      enhancedPrompt += `

NO DOCUMENTS AVAILABLE: You do not have access to specific documentation for this vehicle.
- Provide general automotive knowledge but clearly state it's general information
- Recommend consulting the specific vehicle manual for exact specifications
- Use phrases like "typically" or "generally" for specifications`
    }

    const completion = await this.openai.chat.completions.create({
      model: config.openai.model,
      messages: [
        { role: 'system', content: enhancedPrompt },
        { role: 'user', content: userQuestion }
      ],
      max_tokens: config.openai.maxTokens,
      temperature,
    })

    const rawContent = completion.choices[0]?.message?.content || ''

    // Improved confidence calculation
    let confidence = 0.5 // Base confidence

    // Higher confidence if documents were available and referenced
    if (documentContext && documentContext.length > 0) {
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
    const sourcesReferenced = documentContext.length > 0 && (
      rawContent.toLowerCase().includes('according to') ||
      rawContent.toLowerCase().includes('document') ||
      rawContent.toLowerCase().includes('manual') ||
      rawContent.toLowerCase().includes('specification') ||
      rawContent.toLowerCase().includes('provided')
    )

    return {
      content: rawContent.trim(),
      confidence,
      reasoning: `Temperature ${temperature}, hasDocuments: ${documentContext.length > 0}, citedSources: ${sourcesReferenced}`,
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
    const hasDocuments = documentContext && documentContext.length > 0

    const evaluationPrompt = `You are a critical automotive technical evaluator. Your job is to find the BEST answer from multiple responses to the same question.

ORIGINAL QUESTION: ${originalQuestion}

RESPONSES TO EVALUATE:
${responses.map((r, i) => `
--- OPTION ${i + 1} (confidence: ${r.confidence}, cited sources: ${r.sources_referenced}) ---
${r.content}
--- END OPTION ${i + 1} ---
`).join('\n')}

${hasDocuments ? `AVAILABLE REFERENCE MATERIAL:
${documentContext}

CRITICAL EVALUATION CRITERIA:
1. If documents were provided, responses MUST reference them to be considered accurate
2. Responses that ignore available documentation should be penalized heavily
3. Exact specifications from documents are more valuable than general knowledge
4. Consistency matters - if responses give different numbers, investigate why

` : `NO REFERENCE DOCUMENTS AVAILABLE
- Responses should acknowledge the lack of specific documentation
- General automotive knowledge is acceptable but should be labeled as such
- Responses recommending manual consultation are preferred

`}

EVALUATION REQUIREMENTS:
1. CONSISTENCY_SCORE: Rate 1-10 how well responses agree with each other
   - 10 = All responses nearly identical
   - 5-7 = Responses similar but with minor differences
   - 1-3 = Responses significantly contradict each other

2. If documents were available but responses didn't use them, mark USED_DOCUMENTS as false

3. CONFIDENCE should reflect:
   - Document usage (if available): High confidence
   - Consistency between responses: Higher when consistent
   - Specificity of information: Higher for exact specs

Provide your evaluation in this format:
BEST_ANSWER: [Return ONLY the content of the most accurate response WITHOUT any "Response X" labels or numbers - just the pure answer text]
CONFIDENCE: [1-10]
CONSISTENCY_SCORE: [1-10]
ACCURACY_INDICATORS: [specific factors like "cited documents", "exact specification", etc.]
USED_DOCUMENTS: [true/false]
EVALUATION_NOTES: [Critical analysis of response quality and consistency]

CRITICAL: In BEST_ANSWER, do NOT include "Response 1", "Response 2", "Response 3" or any numbering. Only include the actual answer content.`

    try {
      const evaluation = await this.openai.chat.completions.create({
        model: config.openai.model,
        messages: [
          { role: 'system', content: evaluationPrompt },
          { role: 'user', content: 'Please evaluate these responses.' }
        ],
        max_tokens: 800,
        temperature: 0.1, // Very deterministic for evaluation
      })

      const evalContent = evaluation.choices[0]?.message?.content || ''

      // Parse evaluation results
      let bestAnswer = this.extractSection(evalContent, 'BEST_ANSWER') || responses[0].content

      // Aggressive cleanup of response numbering - GPT loves to include these
      bestAnswer = bestAnswer
        .replace(/^Response \d+:\s*/gi, '') // Remove "Response 1: " from start
        .replace(/Response \d+:/gi, '') // Remove "Response 1:" anywhere
        .replace(/Response \d+\s*\(/gi, '(') // Remove "Response 3 (" -> "("
        .replace(/^Response \d+\s+/gi, '') // Remove "Response 3 " from start
        .replace(/^\s*\d+[.)]\s*/g, '') // Remove "1. " or "1) " from start
        .replace(/^Answer \d+:\s*/gi, '') // Remove "Answer 1: "
        .replace(/^Option \d+:\s*/gi, '') // Remove "Option 1: "
        .replace(/^Choice \d+:\s*/gi, '') // Remove "Choice 1: "
        .trim()

      // If it's still just a number or short, fall back to first response
      if (bestAnswer.length < 10 || /^\d+$/.test(bestAnswer)) {
        bestAnswer = responses[0].content
      }

      const cleanedAnswer = bestAnswer
      const confidence = this.extractScore(evalContent, 'CONFIDENCE') || 0.7
      const consistencyScore = this.extractScore(evalContent, 'CONSISTENCY_SCORE') || 0.7
      const accuracyIndicators = this.extractList(evalContent, 'ACCURACY_INDICATORS')
      const usedDocuments = this.extractBoolean(evalContent, 'USED_DOCUMENTS') || false
      const evaluationNotes = this.extractSection(evalContent, 'EVALUATION_NOTES') || 'Evaluation completed'

      return {
        answer: cleanedAnswer,
        confidence,
        consistency_score: consistencyScore,
        accuracy_indicators: accuracyIndicators,
        used_documents: usedDocuments,
        evaluation_notes: evaluationNotes
      }

    } catch (error) {
      console.error('Error in response evaluation:', error)

      // Fallback evaluation logic
      const mostReferenced = responses.filter(r => r.sources_referenced)[0] || responses[0]
      const avgConfidence = responses.reduce((sum, r) => sum + r.confidence, 0) / responses.length

      return {
        answer: mostReferenced.content,
        confidence: avgConfidence,
        consistency_score: 0.6,
        accuracy_indicators: mostReferenced.sources_referenced ? ['document_referenced'] : [],
        used_documents: mostReferenced.sources_referenced,
        evaluation_notes: 'Fallback evaluation due to API error'
      }
    }
  }

  /**
   * Extract a section from evaluation response
   */
  private extractSection(content: string, sectionName: string): string | null {
    const regex = new RegExp(`${sectionName}:\\s*([\\s\\S]*?)(?=\\n[A-Z_]+:|$)`, 'i')
    const match = content.match(regex)
    return match ? match[1].trim() : null
  }

  /**
   * Extract a numeric score from evaluation response
   */
  private extractScore(content: string, scoreName: string): number | null {
    const regex = new RegExp(`${scoreName}:\\s*(\\d+(?:\\.\\d+)?)`, 'i')
    const match = content.match(regex)
    return match ? parseFloat(match[1]) / 10 : null
  }

  /**
   * Extract a list from evaluation response
   */
  private extractList(content: string, listName: string): string[] {
    const section = this.extractSection(content, listName)
    if (!section) return []

    return section
      .split(/[,;]/)
      .map(item => item.trim())
      .filter(item => item.length > 0)
  }

  /**
   * Extract a boolean from evaluation response
   */
  private extractBoolean(content: string, boolName: string): boolean | null {
    const regex = new RegExp(`${boolName}:\\s*(true|false)`, 'i')
    const match = content.match(regex)
    return match ? match[1].toLowerCase() === 'true' : null
  }
}

export const gptService = new GPTService()
