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
         filename: file.name,
         original_filename: file.name,
         storage_path: storagePath,
         file_size: file.size,
         file_type: file.type,
         document_type: category as DocumentType,
         status: 'processing' as DocumentStatus,
         car_make: undefined,
         car_model: undefined,
         car_year: undefined,
         metadata: {},
         deactivated_at: undefined,
         deactivation_reason: undefined,
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
        this.updateDocumentStatus(documentId, 'failed')
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
      const totalBytes = documents.reduce((sum, doc) => sum + doc.file_size, 0)
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

      // Use enhanced semantic search engine
      const semanticResults = semanticSearchEngine.searchDocuments(query, documents)

      // Convert to our interface and apply limit
      const results: DocumentSearchResult[] = semanticResults
        .slice(0, limit)
        .map(result => ({
          document: result.document as DocumentMetadata,
          content: result.content,
          relevanceScore: result.relevanceScore
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
          content: this.extractRelevantContent(query, doc.document_text?.[0]?.extracted_text || ''),
          relevanceScore: this.calculateRelevanceScore(query, doc)
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
    const fullText = document.document_text?.[0]?.extracted_text?.toLowerCase() || ''

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
      repair_manual: 'Repair Manual',
      owners_manual: 'Owner\'s Manual',
      parts_catalog: 'Parts Catalog',
      wiring_diagram: 'Wiring Diagram',
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
