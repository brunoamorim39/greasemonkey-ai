import { NextRequest, NextResponse } from 'next/server'
import { documentService } from '@/lib/services/document-service'
import { config } from '@/lib/config'
import { withAuth } from '@/lib/auth'

async function getDocumentsHandler(request: NextRequest & { userId: string }) {
  try {
    // Get authenticated user ID from middleware
    const userId = request.userId

    const documents = await documentService.getUserDocuments(userId)

    return NextResponse.json({ documents })
  } catch (error) {
    console.error('Error fetching documents:', error)
    return NextResponse.json(
      { error: 'Failed to fetch documents' },
      { status: 500 }
    )
  }
}

async function uploadDocumentHandler(request: NextRequest & { userId: string }) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    // Get authenticated user ID from middleware
    const userId = request.userId
    const category = formData.get('category') as string
    const vehicleId = formData.get('vehicle_id') as string || undefined
    const description = formData.get('description') as string || undefined

    if (!file) {
      return NextResponse.json(
        { error: 'File is required' },
        { status: 400 }
      )
    }

    if (!category) {
      return NextResponse.json(
        { error: 'Document category is required' },
        { status: 400 }
      )
    }

    // Validate file type
    const supportedTypes = documentService.getSupportedFileTypes()
    if (!supportedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: `Unsupported file type. Supported types: ${supportedTypes.join(', ')}` },
        { status: 400 }
      )
    }

    // Validate file size
    const fileSizeMB = file.size / (1024 * 1024)
    const maxSizeMB = documentService.getMaxFileSizeMB()
    if (fileSizeMB > maxSizeMB) {
      return NextResponse.json(
        { error: `File size (${fileSizeMB.toFixed(1)}MB) exceeds maximum allowed (${maxSizeMB}MB)` },
        { status: 400 }
      )
    }

    // Validate document category
    const validCategories = ['service_manual', 'owners_manual', 'maintenance_record', 'other']
    if (!validCategories.includes(category)) {
      return NextResponse.json(
        { error: 'Invalid document category' },
        { status: 400 }
      )
    }

    const uploadRequest = {
      file,
      category: category as 'service_manual' | 'owners_manual' | 'maintenance_record' | 'other',
      vehicle_id: vehicleId,
    }

    const document = await documentService.uploadDocument(userId, uploadRequest)

    return NextResponse.json({ document }, { status: 201 })
  } catch (error) {
    console.error('Error uploading document:', error)

    if (error instanceof Error) {
      if (error.message.includes('limit') || error.message.includes('Upload not allowed')) {
        return NextResponse.json(
          { error: error.message, upgrade_required: true },
          { status: 429 }
        )
      }

      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to upload document' },
      { status: 500 }
    )
  }
}

export const GET = withAuth(getDocumentsHandler)
export const POST = withAuth(uploadDocumentHandler)
