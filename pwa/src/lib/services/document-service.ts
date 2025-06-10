import { createClient } from '@supabase/supabase-js'
import { Database, DocumentMetadata, DocumentType, DocumentStatus } from '../supabase/types'
import { semanticSearchEngine, type SemanticSearchResult } from './semantic-search'
import { userService } from './user-service'
import { TIER_LIMITS } from '../config'

// Create service role client for backend operations (bypasses RLS)
const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

const STORAGE_BUCKET = 'documents'
const MAX_FILE_SIZE_MB = 50

export interface DocumentUploadRequest {
  file: File
  category: string
  vehicle_id?: string
}

export interface DocumentSearchRequest {
  query: string
  car_make?: string
  car_model?: string
  car_year?: number
  document_types?: DocumentType[]
  limit?: number
}

export interface DocumentSearchResult {
  document: DocumentMetadata
  content: string
  relevanceScore: number
  searchStrategy: string
}

export class DocumentService {

  async getUserDocuments(userId: string): Promise<DocumentMetadata[]> {
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching user documents:', error)
        return []
      }

      return data || []
    } catch (error) {
      console.error('Error in getUserDocuments:', error)
      return []
    }
  }

  async getDocument(userId: string, documentId: string): Promise<DocumentMetadata | null> {
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('user_id', userId)
        .eq('id', documentId)
        .single()

      if (error) {
        console.error('Error fetching document:', error)
        return null
      }

      return data
    } catch (error) {
      console.error('Error in getDocument:', error)
      return null
    }
  }

  async canUserUploadDocument(userId: string, fileSizeMB: number): Promise<{ allowed: boolean; reason?: string }> {
    try {
      // Check usage limits
      const usageCheck = await userService.checkUsageLimit(userId, 'document_upload')
      if (!usageCheck.allowed) {
        return usageCheck
      }

      // Check file size
      if (fileSizeMB > MAX_FILE_SIZE_MB) {
        return {
          allowed: false,
          reason: `File size (${fileSizeMB.toFixed(1)}MB) exceeds maximum allowed (${MAX_FILE_SIZE_MB}MB)`
        }
      }

      // Check document count limits
      const tier = await userService.getUserTier(userId)
      const limits = TIER_LIMITS[tier]

      if (limits.maxDocumentUploads !== null) {
        const currentDocuments = await this.getUserDocuments(userId)
        if (currentDocuments.length >= limits.maxDocumentUploads) {
          return {
            allowed: false,
            reason: `Document limit reached (${currentDocuments.length}/${limits.maxDocumentUploads}). Upgrade your plan for more uploads.`
          }
        }
      }

      // Check storage limits
      if (limits.maxStorageMB !== null) {
        const storageUsed = await this.getUserStorageUsage(userId)
        if (storageUsed + fileSizeMB > limits.maxStorageMB) {
          return {
            allowed: false,
            reason: `Storage limit would be exceeded. Current: ${storageUsed.toFixed(1)}MB, Limit: ${limits.maxStorageMB}MB`
          }
        }
      }

      return { allowed: true }
    } catch (error) {
      console.error('Error checking upload permissions:', error)
      return { allowed: false, reason: 'Error checking upload permissions' }
    }
  }

  async uploadDocument(userId: string, uploadRequest: DocumentUploadRequest): Promise<DocumentMetadata | null> {
    try {
      const { file, category, vehicle_id } = uploadRequest

      // Validate file type
      if (!this.getSupportedFileTypes().includes(file.type)) {
        throw new Error(`Unsupported file type: ${file.type}. Only PDF, Word documents (.doc, .docx), and text files (.txt) are supported for AI processing.`)
      }

      // Check if user can upload
      const fileSizeMB = file.size / (1024 * 1024)
      const canUpload = await this.canUserUploadDocument(userId, fileSizeMB)
      if (!canUpload.allowed) {
        throw new Error(canUpload.reason || 'Upload not allowed')
      }

      const documentId = crypto.randomUUID()
      const storagePath = `${userId}/${documentId}/${file.name}`

      // Upload file to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(storagePath, file, {
          cacheControl: '3600',
          upsert: false
        })

      if (uploadError) {
        console.error('Error uploading file:', uploadError)
        throw new Error('Failed to upload file to storage')
      }

             // Create document metadata record
       const documentData: DocumentMetadata = {
         id: documentId,
         user_id: userId,
         vehicle_id: uploadRequest.vehicle_id,
         filename: file.name,
         original_filename: file.name,
         storage_path: storagePath,
         file_size_bytes: file.size,
         category: category as DocumentType,
         status: 'processing' as DocumentStatus,
         created_at: new Date().toISOString(),
         updated_at: new Date().toISOString(),
       }

      const { error: documentError } = await supabase
        .from('documents')
        .insert(documentData)

      if (documentError) {
        console.error('Error creating document record:', documentError)
        throw new Error('Failed to create document record')
      }

      // Track usage
      await userService.trackUsage(userId, 'document_upload', {
        document_id: documentData.id,
        file_size: file.size,
        document_type: category,
      })

            // Process document for text extraction in background via API
      this.processDocumentAsync(documentId).catch((error: any) => {
        console.error('Background document processing failed:', error)
        this.updateDocumentStatus(documentId, 'error')
      })

      return documentData
    } catch (error) {
      console.error('Error in uploadDocument:', error)
      throw error
    }
  }

  private async processDocumentAsync(documentId: string): Promise<void> {
    try {
      // Call the server-side processing API
      const response = await fetch('/api/documents/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ documentId }),
      })

      if (!response.ok) {
        throw new Error(`Processing failed: ${response.status}`)
      }

      const result = await response.json()
      console.log('Document processed successfully:', result)
    } catch (error) {
      console.error('Error calling document processing API:', error)
      throw error
    }
  }

  async deleteDocument(userId: string, documentId: string): Promise<boolean> {
    try {
      // Get document info
      const document = await this.getDocument(userId, documentId)
      if (!document) {
        return false
      }

      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .remove([document.storage_path])

      if (storageError) {
        console.error('Error deleting file from storage:', storageError)
        // Continue with database deletion even if storage deletion fails
      }

      // Delete from database
      const { error: dbError } = await supabase
        .from('documents')
        .delete()
        .eq('id', documentId)
        .eq('user_id', userId)

      if (dbError) {
        console.error('Error deleting document from database:', dbError)
        return false
      }

      return true
    } catch (error) {
      console.error('Error in deleteDocument:', error)
      return false
    }
  }

  async getDocumentDownloadUrl(userId: string, documentId: string): Promise<string | null> {
    try {
      const document = await this.getDocument(userId, documentId)
      if (!document) {
        return null
      }

      const { data, error } = await supabase.storage
        .from(STORAGE_BUCKET)
        .createSignedUrl(document.storage_path, 3600) // 1 hour expiry

      if (error) {
        console.error('Error creating signed URL:', error)
        return null
      }

      return data.signedUrl
    } catch (error) {
      console.error('Error in getDocumentDownloadUrl:', error)
      return null
    }
  }

  async updateDocumentStatus(documentId: string, status: DocumentStatus): Promise<void> {
    try {
      const { error } = await supabase
        .from('documents')
        .update({
          status,
          updated_at: new Date().toISOString(),
        })
        .eq('id', documentId)

      if (error) {
        console.error('Error updating document status:', error)
      }
    } catch (error) {
      console.error('Error in updateDocumentStatus:', error)
    }
  }

  async getUserStorageUsage(userId: string): Promise<number> {
    try {
      const documents = await this.getUserDocuments(userId)
      const totalBytes = documents.reduce((sum, doc) => sum + doc.file_size_bytes, 0)
      return totalBytes / (1024 * 1024) // Convert to MB
    } catch (error) {
      console.error('Error calculating storage usage:', error)
      return 0
    }
  }

  async searchDocuments(userId: string, searchRequest: DocumentSearchRequest): Promise<DocumentSearchResult[]> {
    try {
      const { query, car_make, car_model, car_year, document_types, limit = 5 } = searchRequest

      console.log('🔍 Enhanced semantic search started:', {
        userId,
        query,
        car_make,
        car_model,
        car_year,
        document_types,
        limit
      })

      // Build filter conditions - documents table only has vehicle_id, not individual car fields
      let queryBuilder = supabase
        .from('documents')
        .select(`
          *,
          document_text (
            extracted_text
          )
        `)
        .eq('user_id', userId)
        .eq('status', 'processed')

      // If vehicle info is provided, we need to find the vehicle_id first
      if (car_make || car_model || car_year) {
        // Get vehicle ID that matches the criteria
        let vehicleQuery = supabase
          .from('vehicles')
          .select('id')
          .eq('user_id', userId)

        if (car_make) vehicleQuery = vehicleQuery.eq('make', car_make)
        if (car_model) vehicleQuery = vehicleQuery.eq('model', car_model)
        if (car_year) vehicleQuery = vehicleQuery.eq('year', car_year)

        const { data: vehicles } = await vehicleQuery
        if (vehicles && vehicles.length > 0) {
          const vehicleIds = vehicles.map(v => v.id)
          queryBuilder = queryBuilder.in('vehicle_id', vehicleIds)
        } else {
          // No matching vehicles found, return empty results
          console.log('📄 No vehicles found matching criteria')
          return []
        }
      }

      if (document_types && document_types.length > 0) {
        queryBuilder = queryBuilder.in('category', document_types)
      }

      const { data: documents, error } = await queryBuilder

      if (error) {
        console.error('Error searching documents:', error)
        return []
      }

      if (!documents || documents.length === 0) {
        console.log('📄 No documents found matching filters')
        return []
      }

      console.log('📄 Documents to search:', {
        count: documents.length,
        documents: documents.map(doc => ({
          id: doc.id,
          filename: doc.original_filename,
          status: doc.status,
          hasText: !!doc.document_text?.[0]?.extracted_text,
          textLength: doc.document_text?.[0]?.extracted_text?.length || 0
        }))
      })

      // Filter out documents with no searchable text to avoid wasted processing
      const documentsWithText = documents.filter(doc => {
        const hasText = !!doc.document_text?.[0]?.extracted_text
        const textLength = doc.document_text?.[0]?.extracted_text?.length || 0
        return hasText && textLength > 0
      })

      if (documentsWithText.length === 0) {
        console.log('⏭️ Skipping document search - no searchable content available')
        return []
      }

      if (documentsWithText.length < documents.length) {
        console.log(`⚡ Filtered out ${documents.length - documentsWithText.length} documents with no searchable content`)
      }

      // Use enhanced semantic search engine on documents with text only
      const semanticResults = semanticSearchEngine.searchDocuments(query, documentsWithText)

      // Convert to our interface and apply limit
      const results: DocumentSearchResult[] = semanticResults
        .slice(0, limit)
        .map(result => ({
          document: result.document as DocumentMetadata,
          content: result.content,
          relevanceScore: result.relevanceScore,
          searchStrategy: 'semantic'
        }))

      console.log('🎯 Enhanced semantic search results:', {
        totalDocuments: documents.length,
        resultsReturned: results.length,
        topScore: results[0]?.relevanceScore,
        results: results.map(r => ({
          filename: r.document.original_filename,
          score: r.relevanceScore.toFixed(3),
          contentPreview: r.content.substring(0, 100) + '...'
        }))
      })

      // Log match details in development
      if (process.env.NODE_ENV === 'development') {
        semanticResults.slice(0, 3).forEach((result, i) => {
          console.log(`🔍 Match #${i + 1}: ${result.document.original_filename}`, {
            score: result.relevanceScore.toFixed(3),
            reasons: result.matchReasons
          })
        })
      }

      return results
    } catch (error) {
      console.error('Error in enhanced semantic search:', error)
      // Fallback to basic search if semantic search fails
      return this.fallbackBasicSearch(userId, searchRequest)
    }
  }

  /**
   * Enhanced multi-strategy document search
   * Uses multiple search approaches and combines results for better accuracy
   */
  async searchDocumentsEnhanced(userId: string, searchRequest: DocumentSearchRequest): Promise<DocumentSearchResult[]> {
    try {
      const { query, car_make, car_model, car_year, document_types, limit = 5 } = searchRequest

      console.log('🔍 Enhanced multi-strategy search started:', {
        userId,
        query,
        car_make,
        car_model,
        car_year,
        document_types,
        limit
      })

      // Get all eligible documents first
      let queryBuilder = supabase
        .from('documents')
        .select(`
          *,
          document_text (
            extracted_text
          )
        `)
        .eq('user_id', userId)
        .eq('status', 'processed')

      // Apply vehicle and type filters
      if (car_make || car_model || car_year) {
        let vehicleQuery = supabase
          .from('vehicles')
          .select('id')
          .eq('user_id', userId)

        if (car_make) vehicleQuery = vehicleQuery.eq('make', car_make)
        if (car_model) vehicleQuery = vehicleQuery.eq('model', car_model)
        if (car_year) vehicleQuery = vehicleQuery.eq('year', car_year)

        const { data: vehicles } = await vehicleQuery
        if (vehicles && vehicles.length > 0) {
          const vehicleIds = vehicles.map(v => v.id)
          queryBuilder = queryBuilder.in('vehicle_id', vehicleIds)
        } else {
          console.log('📄 No vehicles found matching criteria')
          return []
        }
      }

      if (document_types && document_types.length > 0) {
        queryBuilder = queryBuilder.in('category', document_types)
      }

      const { data: documents, error } = await queryBuilder

      if (error) {
        console.error('📄 Error fetching documents:', error)
        return []
      }

      if (!documents || documents.length === 0) {
        console.log('📄 No documents found matching filters')
        return []
      }

      // Debug: Also check document_text table directly
      console.log('🔍 Direct document_text check for debug...')
      const { data: textRecords, error: textError } = await supabase
        .from('document_text')
        .select('document_id, text_length, extracted_text')
        .limit(5)

      console.log('📊 Direct document_text query result:', {
        textRecords: textRecords?.map(t => ({
          doc_id: t.document_id.substring(0, 8),
          length: t.text_length,
          hasText: !!t.extracted_text,
          textPreview: t.extracted_text?.substring(0, 50) || 'None'
        })),
        textError,
        totalRecords: textRecords?.length || 0
      })

      // Debug: Check if our document IDs match what's in document_text
      const documentIds = documents.map(d => d.id)
      console.log('🆔 Document IDs being searched:', documentIds.map(id => id.substring(0, 8)))

      if (textRecords && textRecords.length > 0) {
        const textDocIds = textRecords.map(t => t.document_id)
        console.log('🆔 Document IDs with text:', textDocIds.map(id => id.substring(0, 8)))

        const matches = documentIds.filter(docId => textDocIds.includes(docId))
        console.log('🎯 Matching document IDs:', matches.map(id => id.substring(0, 8)))
      }

      // Detailed analysis of document text availability
      console.log('📄 Analyzing documents for text content:', {
        totalDocuments: documents.length,
        documentsAnalysis: documents.map(doc => ({
          id: doc.id.substring(0, 8),
          filename: doc.original_filename,
          status: doc.status,
          hasTextRecord: !!doc.document_text,
          hasExtractedText: !!doc.document_text?.extracted_text,
          textLength: doc.document_text?.extracted_text?.length || 0,
          textPreview: doc.document_text?.extracted_text?.substring(0, 100) || 'No text',
          rawDocumentText: JSON.stringify(doc.document_text) // Debug: see raw structure
        }))
      })

      // Filter documents with searchable text
      const documentsWithText = documents.filter(doc => {
        const hasText = !!doc.document_text?.extracted_text
        const textLength = doc.document_text?.extracted_text?.length || 0
        return hasText && textLength > 0
      })

      if (documentsWithText.length === 0) {
        console.log('⏭️ No searchable content available - all documents lack extracted text')
        console.log('💡 Documents may need reprocessing for text extraction')
        return []
      }

      console.log(`📊 Search stats: ${documentsWithText.length}/${documents.length} documents have searchable text`)

      // Strategy 1: Exact phrase matching (highest priority)
      const exactMatches = this.findExactMatches(query, documentsWithText)

      // Strategy 2: Enhanced semantic search with automotive terms
      const semanticResults = semanticSearchEngine.searchDocuments(query, documentsWithText)

      // Strategy 3: Technical specification pattern matching
      const specMatches = this.findTechnicalSpecifications(query, documentsWithText)

      // Strategy 4: Context-aware section extraction
      const contextualMatches = this.findContextualMatches(query, documentsWithText)

      // Combine and deduplicate results
      const combinedResults = this.combineSearchResults([
        ...exactMatches.map(r => ({ ...r, searchStrategy: 'exact' })),
        ...semanticResults.map(r => ({
          document: r.document as DocumentMetadata,
          content: r.content,
          relevanceScore: r.relevanceScore,
          searchStrategy: 'semantic'
        })),
        ...specMatches.map(r => ({ ...r, searchStrategy: 'technical' })),
        ...contextualMatches.map(r => ({ ...r, searchStrategy: 'contextual' }))
      ], limit)

      console.log('🎯 Multi-strategy search results:', {
        exactMatches: exactMatches.length,
        semanticMatches: semanticResults.length,
        specMatches: specMatches.length,
        contextualMatches: contextualMatches.length,
        finalResults: combinedResults.length,
        strategies: combinedResults.map(r => r.searchStrategy)
      })

      return combinedResults

    } catch (error) {
      console.error('Error in enhanced multi-strategy search:', error)
      return this.fallbackBasicSearch(userId, searchRequest)
    }
  }

  /**
   * Find exact phrase matches (highest accuracy for specific specs)
   */
  private findExactMatches(query: string, documents: any[]): DocumentSearchResult[] {
    const results: DocumentSearchResult[] = []
    const queryLower = query.toLowerCase()

    // Look for exact matches of the query or key phrases
    const keyPhrases = this.extractKeyPhrases(query)

    for (const doc of documents) {
      const fullText = doc.document_text?.extracted_text || ''
      const fullTextLower = fullText.toLowerCase()

      let highestScore = 0
      let bestMatch = ''

      // Check for exact query match
      if (fullTextLower.includes(queryLower)) {
        const context = this.extractContextAroundMatch(fullText, query, 300)
        if (context) {
          results.push({
            document: doc,
            content: context,
            relevanceScore: 0.95,
            searchStrategy: 'exact'
          })
          continue
        }
      }

      // Check for key phrase matches
      for (const phrase of keyPhrases) {
        if (fullTextLower.includes(phrase.toLowerCase())) {
          const context = this.extractContextAroundMatch(fullText, phrase, 300)
          if (context) {
            const score = 0.85 + (phrase.length / queryLower.length) * 0.1
            if (score > highestScore) {
              highestScore = score
              bestMatch = context
            }
          }
        }
      }

      if (bestMatch) {
        results.push({
          document: doc,
          content: bestMatch,
          relevanceScore: highestScore,
          searchStrategy: 'exact'
        })
      }
    }

    return results.sort((a, b) => b.relevanceScore - a.relevanceScore)
  }

  /**
   * Find technical specifications using pattern matching
   */
  private findTechnicalSpecifications(query: string, documents: any[]): DocumentSearchResult[] {
    const results: DocumentSearchResult[] = []

    // Technical patterns to look for - more comprehensive
    const patterns = {
      torque: /(\d+(?:\.\d+)?)\s*(?:nm|n·m|newton.?meters?|lb.?ft|pound.?feet?|ft.?lb|foot.?pound)/gi,
      pressure: /(\d+(?:\.\d+)?)\s*(?:psi|bar|kpa|kilopascals?)/gi,
      volume: /(\d+(?:\.\d+)?)\s*(?:liters?|l|quarts?|qt|gallons?|gal)/gi,
      temperature: /(\d+(?:\.\d+)?)\s*(?:°c|°f|celsius|fahrenheit|degrees?)/gi,
      size: /(\d+(?:\.\d+)?)\s*(?:mm|millimeters?|in|inches?|cm|centimeters?)/gi
    }

    const queryTerms = query.toLowerCase().split(/\s+/)
    const hasPatternTerms = queryTerms.some(term =>
      ['torque', 'spec', 'specification', 'pressure', 'volume', 'temperature', 'size', 'bolt', 'capacity',
       'tighten', 'tightening', 'bracket', 'arm', 'suspension', 'wheel', 'lug', 'caliper'].includes(term)
    )

    if (!hasPatternTerms) return results

    for (const doc of documents) {
      const fullText = doc.document_text?.extracted_text || ''
      let foundSpecs: string[] = []

      // Find all technical specifications in the document
      Object.entries(patterns).forEach(([type, pattern]) => {
        const matches = fullText.match(pattern)
        if (matches) {
          foundSpecs = foundSpecs.concat(matches)
        }
      })

      if (foundSpecs.length > 0) {
        // Extract context around specifications
        const contexts = foundSpecs.map(spec =>
          this.extractContextAroundMatch(fullText, spec, 200)
        ).filter(Boolean)

        if (contexts.length > 0) {
          const relevantContexts = contexts.filter(context =>
            queryTerms.some(term => context.toLowerCase().includes(term))
          )

                  if (relevantContexts.length > 0) {
          results.push({
            document: doc,
            content: relevantContexts.join(' ... '),
            relevanceScore: 0.8,
            searchStrategy: 'technical'
          })
        } else {
          // Fallback: search for query terms in broader context
          const lowerText = fullText.toLowerCase()
          let hasQueryMatch = false
          let bestContext = ''

          queryTerms.forEach(term => {
            if (lowerText.includes(term) && term.length > 2) {
              hasQueryMatch = true
              const context = this.extractContextAroundMatch(fullText, term, 300)
              if (context.length > bestContext.length) {
                bestContext = context
              }
            }
          })

          if (hasQueryMatch && bestContext) {
            results.push({
              document: doc,
              content: bestContext,
              relevanceScore: 0.6,
              searchStrategy: 'technical'
            })
          }
        }
      }
    }
    }

    return results
  }

  /**
   * Find contextual matches using surrounding text analysis
   */
  private findContextualMatches(query: string, documents: any[]): DocumentSearchResult[] {
    const results: DocumentSearchResult[] = []
    const queryTerms = query.toLowerCase().split(/\s+/).filter(term => term.length > 2)

    for (const doc of documents) {
      const fullText = doc.document_text?.extracted_text || ''
      const sentences = fullText.split(/[.!?]+/).filter((s: string) => s.trim().length > 20)

      let bestSentenceGroup = ''
      let highestScore = 0

      // Analyze sentence groups for contextual relevance
      for (let i = 0; i < sentences.length - 2; i++) {
        const group = sentences.slice(i, i + 3).join('. ').trim()
        const groupLower = group.toLowerCase()

        let score = 0
        let matchedTerms = 0

        queryTerms.forEach(term => {
          if (groupLower.includes(term)) {
            matchedTerms++
            score += 1

            // Bonus for terms appearing close together
            const termIndex = groupLower.indexOf(term)
            queryTerms.forEach(otherTerm => {
              if (term !== otherTerm) {
                const otherIndex = groupLower.indexOf(otherTerm)
                if (otherIndex !== -1 && Math.abs(termIndex - otherIndex) < 100) {
                  score += 0.5
                }
              }
            })
          }
        })

        // Normalize score
        score = (score / queryTerms.length) * (matchedTerms / queryTerms.length)

        if (score > highestScore && score > 0.4) {
          highestScore = score
          bestSentenceGroup = group
        }
      }

      if (bestSentenceGroup) {
        results.push({
          document: doc,
          content: bestSentenceGroup,
          relevanceScore: Math.min(highestScore, 0.75), // Cap contextual scores
          searchStrategy: 'contextual'
        })
      }
    }

    return results.sort((a, b) => b.relevanceScore - a.relevanceScore)
  }

  /**
   * Extract key phrases from query for better matching
   */
  private extractKeyPhrases(query: string): string[] {
    const phrases: string[] = []

    // Multi-word technical terms
    const technicalPatterns = [
      /torque\s+spec(?:ification)?/gi,
      /brake\s+caliper\s+bracket/gi,
      /oil\s+capacity/gi,
      /spark\s+plug\s+gap/gi,
      /wheel\s+torque/gi,
      /valve\s+clearance/gi,
      /timing\s+belt/gi,
      /coolant\s+capacity/gi
    ]

    technicalPatterns.forEach(pattern => {
      const matches = query.match(pattern)
      if (matches) {
        phrases.push(...matches)
      }
    })

    // Add the original query if no technical patterns found
    if (phrases.length === 0) {
      phrases.push(query)
    }

    return phrases
  }

  /**
   * Extract context around a matched phrase
   */
  private extractContextAroundMatch(text: string, match: string, contextLength: number): string {
    const matchIndex = text.toLowerCase().indexOf(match.toLowerCase())
    if (matchIndex === -1) return ''

    const start = Math.max(0, matchIndex - contextLength / 2)
    const end = Math.min(text.length, matchIndex + match.length + contextLength / 2)

    let context = text.substring(start, end).trim()

    // Clean up context boundaries
    if (start > 0) {
      const firstSpace = context.indexOf(' ')
      if (firstSpace > 0) context = context.substring(firstSpace + 1)
    }

    if (end < text.length) {
      const lastSpace = context.lastIndexOf(' ')
      if (lastSpace > 0) context = context.substring(0, lastSpace)
    }

    return context
  }

  /**
   * Combine results from multiple search strategies, removing duplicates and ranking by score
   */
  private combineSearchResults(results: DocumentSearchResult[], limit: number): DocumentSearchResult[] {
    // Group by document ID to avoid duplicates
    const resultMap = new Map<string, DocumentSearchResult>()

    results.forEach(result => {
      const docId = result.document.id
      const existing = resultMap.get(docId)

      if (!existing || result.relevanceScore > existing.relevanceScore) {
        resultMap.set(docId, result)
      }
    })

    return Array.from(resultMap.values())
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, limit)
  }

  private async fallbackBasicSearch(userId: string, searchRequest: DocumentSearchRequest): Promise<DocumentSearchResult[]> {
    console.log('🔄 Falling back to basic search due to semantic search error')

    const { query, limit = 5 } = searchRequest

    try {
      const { data: documents, error } = await supabase
        .from('documents')
        .select(`
          *,
          document_text (
            extracted_text
          )
        `)
        .eq('user_id', userId)
        .eq('status', 'processed')
        .limit(limit)

      if (error || !documents) {
        return []
      }

      return documents
        .map(doc => ({
          document: doc,
          content: this.extractRelevantContent(query, doc.document_text?.extracted_text || ''),
          relevanceScore: this.calculateRelevanceScore(query, doc),
          searchStrategy: 'fallback'
        }))
        .filter(result => result.relevanceScore > 0)
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
    } catch (error) {
      console.error('Error in fallback search:', error)
      return []
    }
  }

  private extractRelevantContent(query: string, fullText: string): string {
    if (!fullText) return ''

    const queryTerms = query.toLowerCase().split(' ').filter(term => term.length > 2)
    const sentences = fullText.split(/[.!?]+/).filter(s => s.trim().length > 10)

    // Find sentences that contain query terms
    const relevantSentences = sentences.filter(sentence => {
      const lowerSentence = sentence.toLowerCase()
      return queryTerms.some(term => lowerSentence.includes(term))
    })

    // Return first few relevant sentences, up to 500 chars
    let result = relevantSentences.slice(0, 3).join('. ').trim()

    if (result.length > 500) {
      result = result.substring(0, 500) + '...'
    }

    return result || fullText.substring(0, 300) + '...'
  }

  private calculateRelevanceScore(query: string, document: any): number {
    const queryLower = query.toLowerCase()
    const filename = document.original_filename.toLowerCase()
    const fullText = document.document_text?.extracted_text?.toLowerCase() || ''

    // High score for text content matches
    const queryTerms = query.toLowerCase().split(' ').filter(term => term.length > 2)
    if (fullText && queryTerms.some((term: string) => fullText.includes(term))) {
      return 0.9
    }

    // Medium score for filename matches
    if (filename.includes(queryLower)) {
      return 0.8
    }

    // Check against car info
    const carInfo = [document.car_make, document.car_model, document.car_year?.toString()]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()

    if (carInfo.includes(queryLower)) {
      return 0.6
    }

    // Low relevance if document exists but no good match
    return 0.1
  }

  getDocumentTypeDisplayName(type: DocumentType): string {
    const displayNames: Record<DocumentType, string> = {
      service_manual: 'Service Manual',
      owners_manual: 'Owner\'s Manual',
      maintenance_record: 'Maintenance Record',
      other: 'Other',
    }
    return displayNames[type] || type
  }

  getSupportedFileTypes(): string[] {
    return [
      'application/pdf',                                                           // PDFs - text extraction
      'application/msword',                                                        // Word .doc - text extraction
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',  // Word .docx - text extraction
      'text/plain'                                                                 // Text files - already text
    ]
  }

  getMaxFileSizeMB(): number {
    return MAX_FILE_SIZE_MB
  }
}

export const documentService = new DocumentService()
