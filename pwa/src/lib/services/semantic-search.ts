// @ts-ignore - compromise types not available
import nlp from 'compromise'

// Lightweight Porter Stemmer implementation (browser-compatible)
class PorterStemmer {
  static stem(word: string): string {
    if (word.length <= 2) return word.toLowerCase()

    word = word.toLowerCase()

    // Step 1a
    if (word.endsWith('sses')) {
      word = word.slice(0, -2)
    } else if (word.endsWith('ies')) {
      word = word.slice(0, -2)
    } else if (word.endsWith('ss')) {
      // keep as is
    } else if (word.endsWith('s') && word.length > 1) {
      word = word.slice(0, -1)
    }

    // Step 1b (simplified)
    if (word.endsWith('eed')) {
      word = word.slice(0, -1)
    } else if (word.endsWith('ed') && word.length > 2) {
      word = word.slice(0, -2)
    } else if (word.endsWith('ing') && word.length > 3) {
      word = word.slice(0, -3)
    }

    // Step 2 (simplified common suffixes)
    const step2Map: Record<string, string> = {
      'ational': 'ate',
      'tional': 'tion',
      'enci': 'ence',
      'anci': 'ance',
      'izer': 'ize',
      'iser': 'ise',
      'alli': 'al',
      'entli': 'ent',
      'eli': 'e',
      'ousli': 'ous',
      'ization': 'ize',
      'isation': 'ise',
      'ation': 'ate',
      'ator': 'ate',
      'alism': 'al',
      'iveness': 'ive',
      'fulness': 'ful',
      'ousness': 'ous',
      'aliti': 'al',
      'iviti': 'ive',
      'biliti': 'ble'
    }

    for (const [suffix, replacement] of Object.entries(step2Map)) {
      if (word.endsWith(suffix)) {
        word = word.slice(0, -suffix.length) + replacement
        break
      }
    }

    return word
  }
}

// Lightweight TF-IDF implementation (browser-compatible)
class TfIdf {
  private documents: string[] = []
  private vocabulary: Set<string> = new Set()
  private termFrequencies: Map<string, number>[] = []
  private documentFrequencies: Map<string, number> = new Map()

  addDocument(text: string): void {
    const terms = this.tokenize(text)
    this.documents.push(text)

    const termFreq = new Map<string, number>()
    const uniqueTerms = new Set<string>()

    // Calculate term frequencies for this document
    for (const term of terms) {
      const stemmed = PorterStemmer.stem(term)
      this.vocabulary.add(stemmed)
      uniqueTerms.add(stemmed)
      termFreq.set(stemmed, (termFreq.get(stemmed) || 0) + 1)
    }

    this.termFrequencies.push(termFreq)

    // Update document frequencies
    for (const term of uniqueTerms) {
      this.documentFrequencies.set(term, (this.documentFrequencies.get(term) || 0) + 1)
    }
  }

  tfidf(term: string, documentIndex: number): number {
    const stemmed = PorterStemmer.stem(term)
    const tf = this.termFrequencies[documentIndex]?.get(stemmed) || 0
    const df = this.documentFrequencies.get(stemmed) || 0

    if (tf === 0 || df === 0) return 0

    const idf = Math.log(this.documents.length / df)
    return tf * idf
  }

  private tokenize(text: string): string[] {
    return text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2)
  }
}

// Automotive-specific terms and their weights
const AUTOMOTIVE_TERMS = {
  // Engine components
  engine: 1.0, motor: 1.0, cylinder: 1.0, piston: 1.0, camshaft: 1.0, crankshaft: 1.0,
  valve: 1.0, timing: 1.0, compression: 1.0, combustion: 1.0, spark: 1.0, plug: 1.0,

  // Drivetrain
  transmission: 1.0, gearbox: 1.0, clutch: 1.0, differential: 1.0, axle: 1.0,
  driveshaft: 1.0, cv: 1.0, joint: 1.0,

  // Suspension & steering
  suspension: 1.0, shock: 1.0, strut: 1.0, spring: 1.0, coil: 1.0, stabilizer: 1.0,
  sway: 1.0, steering: 1.0, rack: 1.0, pinion: 1.0, tie: 1.0, rod: 1.0,

  // Brakes
  brake: 1.0, pad: 1.0, rotor: 1.0, disc: 1.0, caliper: 1.0, master: 1.0,

  // Electrical
  battery: 1.0, alternator: 1.0, starter: 1.0, ignition: 1.0, fuse: 1.0, relay: 1.0,
  sensor: 1.0, ecu: 1.0, computer: 1.0, module: 1.0,

  // Fluids & maintenance
  oil: 1.0, coolant: 1.0, fluid: 1.0, filter: 1.0, change: 1.0, service: 1.0,
  maintenance: 1.0, inspection: 1.0,

  // Common issues
  leak: 1.0, noise: 1.0, vibration: 1.0, rough: 1.0, idle: 1.0, misfire: 1.0,
  stall: 1.0, overheat: 1.0, temperature: 1.0, warning: 1.0, light: 1.0,

  // Tools & procedures
  torque: 1.0, spec: 1.0, specification: 1.0, procedure: 1.0, step: 1.0,
  remove: 1.0, install: 1.0, replace: 1.0, repair: 1.0, diagnose: 1.0
}

// Symptom patterns for better matching
const SYMPTOM_PATTERNS = [
  /(?:car|vehicle|engine)\s+(?:won\'t|doesn\'t|not)\s+(?:start|turn|crank)/gi,
  /(?:rough|unstable|uneven)\s+(?:idle|idling)/gi,
  /(?:engine|motor)\s+(?:overheating|overheats|too\s+hot)/gi,
  /(?:brake|brakes)\s+(?:squealing|grinding|noise)/gi,
  /(?:steering|wheel)\s+(?:vibration|vibrating|shaking)/gi,
  /(?:transmission|shifting)\s+(?:problems|issues|slipping)/gi,
  /(?:check\s+engine|warning)\s+light/gi
]

interface DocumentText {
  extracted_text: string
}

interface DocumentWithText {
  id: string
  original_filename: string
  car_make?: string
  car_model?: string
  car_year?: number
  document_text?: DocumentText[]
}

export interface SemanticSearchResult {
  document: DocumentWithText
  content: string
  relevanceScore: number
  matchReasons: string[]
}

export class SemanticSearchEngine {
  private tfidf: TfIdf

  constructor() {
    this.tfidf = new TfIdf()
  }

  /**
   * Enhanced semantic search with automotive domain awareness
   */
  searchDocuments(query: string, documents: DocumentWithText[]): SemanticSearchResult[] {
    // Prepare TF-IDF with document corpus
    this.tfidf = new TfIdf()
    documents.forEach(doc => {
      const text = doc.document_text?.[0]?.extracted_text || ''
      this.tfidf.addDocument(text)
    })

    const results: SemanticSearchResult[] = []

    for (let i = 0; i < documents.length; i++) {
      const doc = documents[i]
      const searchResult = this.scoreDocument(query, doc, i)

      if (searchResult.relevanceScore > 0.1) {
        results.push(searchResult)
      }
    }

    return results.sort((a, b) => b.relevanceScore - a.relevanceScore)
  }

  private scoreDocument(query: string, document: DocumentWithText, docIndex: number): SemanticSearchResult {
    const fullText = document.document_text?.[0]?.extracted_text || ''
    const matchReasons: string[] = []
    let totalScore = 0

    // 1. Automotive term matching (40% weight)
    const automotiveScore = this.calculateAutomotiveScore(query, fullText, matchReasons)
    totalScore += automotiveScore * 0.4

    // 2. Symptom pattern matching (25% weight)
    const symptomScore = this.calculateSymptomScore(query, fullText, matchReasons)
    totalScore += symptomScore * 0.25

    // 3. TF-IDF semantic similarity (20% weight)
    const tfidfScore = this.calculateTfIdfScore(query, docIndex, matchReasons)
    totalScore += tfidfScore * 0.2

    // 4. Vehicle context matching (10% weight)
    const vehicleScore = this.calculateVehicleScore(query, document, matchReasons)
    totalScore += vehicleScore * 0.1

    // 5. Filename relevance (5% weight)
    const filenameScore = this.calculateFilenameScore(query, document.original_filename, matchReasons)
    totalScore += filenameScore * 0.05

    // Extract relevant content
    const content = this.extractRelevantContent(query, fullText)

    return {
      document,
      content: content || `Document: ${document.original_filename}`,
      relevanceScore: Math.min(totalScore, 1.0),
      matchReasons
    }
  }

  private calculateAutomotiveScore(query: string, fullText: string, matchReasons: string[]): number {
    const queryTerms = this.extractAutomotiveTerms(query)
    const textTerms = this.extractAutomotiveTerms(fullText)

    if (queryTerms.length === 0) return 0

    let matchedTerms = 0
    const foundTerms: string[] = []

    for (const queryTerm of queryTerms) {
      if (textTerms.includes(queryTerm)) {
        matchedTerms++
        foundTerms.push(queryTerm)
      }
    }

    if (foundTerms.length > 0) {
      matchReasons.push(`Automotive terms: ${foundTerms.join(', ')}`)
    }

    return matchedTerms / queryTerms.length
  }

  private calculateSymptomScore(query: string, fullText: string, matchReasons: string[]): number {
    const queryLower = query.toLowerCase()
    const textLower = fullText.toLowerCase()

    for (const pattern of SYMPTOM_PATTERNS) {
      const queryMatches = queryLower.match(pattern)
      const textMatches = textLower.match(pattern)

      if (queryMatches && textMatches) {
        matchReasons.push(`Symptom pattern: ${queryMatches[0]}`)
        return 1.0
      }
    }

    // Also check for common automotive issues using NLP
    const queryDoc = nlp(query)
    const symptoms = queryDoc.match('#Verb (not|won\'t|doesn\'t) #Verb').out('text')

    if (symptoms && textLower.includes(symptoms.toLowerCase())) {
      matchReasons.push(`Issue description: ${symptoms}`)
      return 0.8
    }

    return 0
  }

  private calculateTfIdfScore(query: string, docIndex: number, matchReasons: string[]): number {
    const queryTerms = query.toLowerCase()
      .split(/\s+/)
      .map(term => PorterStemmer.stem(term))
      .filter(term => term.length > 2)

    if (queryTerms.length === 0) return 0

    let totalScore = 0
    const significantTerms: string[] = []

    for (const term of queryTerms) {
      const score = this.tfidf.tfidf(term, docIndex)
      if (score > 0.1) {
        totalScore += score
        significantTerms.push(term)
      }
    }

    if (significantTerms.length > 0) {
      matchReasons.push(`Key terms: ${significantTerms.join(', ')}`)
    }

    return Math.min(totalScore / queryTerms.length, 1.0)
  }

  private calculateVehicleScore(query: string, document: DocumentWithText, matchReasons: string[]): number {
    const queryDoc = nlp(query)
    const vehicles = queryDoc.match('#Value #Value?').out('array') // Try to find make/model patterns

    let score = 0
    const matches: string[] = []

    // Check make
    if (document.car_make && query.toLowerCase().includes(document.car_make.toLowerCase())) {
      score += 0.4
      matches.push(document.car_make)
    }

    // Check model
    if (document.car_model && query.toLowerCase().includes(document.car_model.toLowerCase())) {
      score += 0.4
      matches.push(document.car_model)
    }

    // Check year
    if (document.car_year && query.includes(document.car_year.toString())) {
      score += 0.2
      matches.push(document.car_year.toString())
    }

    if (matches.length > 0) {
      matchReasons.push(`Vehicle match: ${matches.join(' ')}`)
    }

    return score
  }

  private calculateFilenameScore(query: string, filename: string, matchReasons: string[]): number {
    const queryLower = query.toLowerCase()
    const filenameLower = filename.toLowerCase()

    // Direct substring match
    if (filenameLower.includes(queryLower)) {
      matchReasons.push(`Filename contains: "${query}"`)
      return 1.0
    }

    // Check individual query terms
    const queryTerms = queryLower.split(/\s+/).filter(term => term.length > 2)
    const matchedTerms = queryTerms.filter(term => filenameLower.includes(term))

    if (matchedTerms.length > 0) {
      matchReasons.push(`Filename contains: ${matchedTerms.join(', ')}`)
      return matchedTerms.length / queryTerms.length
    }

    return 0
  }

  private extractAutomotiveTerms(text: string): string[] {
    const words = text.toLowerCase()
      .split(/\s+/)
      .map(word => word.replace(/[^\w]/g, ''))
      .filter(word => word.length > 2)

    return words.filter(word => AUTOMOTIVE_TERMS.hasOwnProperty(word))
  }

  private extractRelevantContent(query: string, fullText: string): string {
    if (!fullText) return ''

    const queryTerms = query.toLowerCase().split(' ').filter(term => term.length > 2)
    const sentences = fullText.split(/[.!?]+/).filter(s => s.trim().length > 10)

    // Find sentences with highest term density
    const scoredSentences = sentences.map(sentence => {
      const lowerSentence = sentence.toLowerCase()
      const termMatches = queryTerms.filter(term => lowerSentence.includes(term)).length
      const automotiveTerms = this.extractAutomotiveTerms(sentence).length

      return {
        sentence: sentence.trim(),
        score: termMatches + (automotiveTerms * 0.5)
      }
    }).filter(item => item.score > 0)

    // Sort by relevance and take top 3
    const topSentences = scoredSentences
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(item => item.sentence)

    let result = topSentences.join('. ').trim()

    if (result.length > 500) {
      result = result.substring(0, 500) + '...'
    }

    return result || fullText.substring(0, 300) + '...'
  }
}

export const semanticSearchEngine = new SemanticSearchEngine()
