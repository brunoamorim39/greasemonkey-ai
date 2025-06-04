import { createClient } from '@supabase/supabase-js'
import { Database, DocumentMetadata, DocumentType, DocumentStatus } from '../supabase/types'
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
  document_type: DocumentType
  car_make?: string
  car_model?: string
  car_year?: number
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
      const { file, document_type, car_make, car_model, car_year } = uploadRequest

      // Validate file type
      if (file.type !== 'application/pdf') {
        throw new Error('Only PDF files are supported')
      }

      const fileSizeMB = file.size / (1024 * 1024)

      // Check if upload is allowed
      const canUpload = await this.canUserUploadDocument(userId, fileSizeMB)
      if (!canUpload.allowed) {
        throw new Error(canUpload.reason || 'Upload not allowed')
      }

      // Generate unique filename
      const fileExtension = file.name.split('.').pop()
      const uniqueId = crypto.randomUUID()
      const filename = `${uniqueId}.${fileExtension}`
      const storagePath = `${userId}/${filename}`

      // Upload file to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(storagePath, file, {
          cacheControl: '3600',
          upsert: false
        })

      if (uploadError) {
        console.error('Error uploading file:', uploadError)
        throw uploadError
      }

      // Create document metadata
      const { data: documentData, error: documentError } = await supabase
        .from('documents')
        .insert({
          user_id: userId,
          filename,
          original_filename: file.name,
          file_size: file.size,
          file_type: file.type,
          document_type,
          car_make,
          car_model,
          car_year,
          status: 'uploaded',
          storage_path: storagePath,
          metadata: {},
        })
        .select()
        .single()

      if (documentError) {
        console.error('Error creating document record:', documentError)
        // Clean up uploaded file
        await supabase.storage.from(STORAGE_BUCKET).remove([storagePath])
        throw documentError
      }

      // Track usage
      await userService.trackUsage(userId, 'document_upload', {
        document_id: documentData.id,
        file_size: file.size,
        document_type,
      })

      // TODO: Process document for search (extract text, create embeddings)
      // For now, we'll mark it as processed
      await this.updateDocumentStatus(documentData.id, 'processed')

      return documentData
    } catch (error) {
      console.error('Error in uploadDocument:', error)
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

      // Build filter conditions
      let queryBuilder = supabase
        .from('documents')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'processed')

      if (car_make) {
        queryBuilder = queryBuilder.eq('car_make', car_make)
      }

      if (car_model) {
        queryBuilder = queryBuilder.eq('car_model', car_model)
      }

      if (car_year) {
        queryBuilder = queryBuilder.eq('car_year', car_year)
      }

      if (document_types && document_types.length > 0) {
        queryBuilder = queryBuilder.in('document_type', document_types)
      }

      const { data: documents, error } = await queryBuilder.limit(limit)

      if (error) {
        console.error('Error searching documents:', error)
        return []
      }

      // TODO: Implement semantic search with embeddings
      // For now, return basic text matching results
      const results: DocumentSearchResult[] = []

      for (const doc of documents || []) {
        // Simple text matching - in production this would use embeddings
        const relevanceScore = this.calculateRelevanceScore(query, doc)
        if (relevanceScore > 0) {
          results.push({
            document: doc,
            content: `Relevant content from ${doc.original_filename}`, // TODO: Extract actual relevant content
            relevanceScore,
          })
        }
      }

      return results.sort((a, b) => b.relevanceScore - a.relevanceScore)
    } catch (error) {
      console.error('Error in searchDocuments:', error)
      return []
    }
  }

  private calculateRelevanceScore(query: string, document: DocumentMetadata): number {
    const queryLower = query.toLowerCase()
    const filename = document.original_filename.toLowerCase()

    // Simple scoring based on filename match
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

    // Default low relevance for all processed documents
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
    return ['application/pdf']
  }

  getMaxFileSizeMB(): number {
    return MAX_FILE_SIZE_MB
  }
}

export const documentService = new DocumentService()
