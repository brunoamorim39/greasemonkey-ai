'use client'

import { useState } from 'react'
import {
  FileText,
  Upload,
  Trash2,
  Download,
  CheckCircle,
  Clock,
  AlertCircle,
  FolderOpen,
  Book,
  Wrench,
  Clipboard,
  FileImage,
  FileVideo,
  Car
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card'
import { Button } from './ui/Button'
import { cn } from '@/lib/utils'

interface Document {
  id: string
  filename: string
  type: string
  status: string
  sizeMB: string
  createdAt: string
  category?: string
  description?: string
}

interface DocumentManagerProps {
  documents: Document[]
  onUploadDocument: (file: File, category: string, description?: string) => Promise<void>
  onDeleteDocument: (id: string) => Promise<void>
  userTier: string
  userStats?: {
    tier: string
    usage: {
      daily: { ask_count: number }
      monthly: { ask_count: number }
      limits: {
        maxDailyAsks?: number
        maxMonthlyAsks?: number
        maxDocumentUploads?: number
        maxVehicles?: number
      }
    }
    vehicles: {
      count: number
      vehicles: any[]
    }
    documents: {
      count: number
      storageUsedMB: number
      documents: Document[]
    }
  } | null
}

const DOCUMENT_CATEGORIES = [
  {
    id: 'service_manual',
    name: 'Service Manual',
    icon: Book,
    description: 'Official service manuals and repair guides',
    color: 'blue'
  },
  {
    id: 'owners_manual',
    name: 'Owner\'s Manual',
    icon: Car,
    description: 'Owner manuals and user guides',
    color: 'green'
  },
  {
    id: 'maintenance_record',
    name: 'Maintenance Records',
    icon: Clipboard,
    description: 'Service history and maintenance logs',
    color: 'orange'
  },
  {
    id: 'parts_diagram',
    name: 'Parts Diagrams',
    icon: Wrench,
    description: 'Part diagrams and technical schematics',
    color: 'purple'
  },
  {
    id: 'photos',
    name: 'Photos',
    icon: FileImage,
    description: 'Vehicle photos and damage documentation',
    color: 'pink'
  },
  {
    id: 'videos',
    name: 'Videos',
    icon: FileVideo,
    description: 'Instructional videos and diagnostics',
    color: 'yellow'
  },
  {
    id: 'other',
    name: 'Other',
    icon: FileText,
    description: 'Other automotive documents',
    color: 'gray'
  }
]

export function DocumentManager({
  documents,
  onUploadDocument,
  onDeleteDocument,
  userTier,
  userStats
}: DocumentManagerProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState('service_manual')
  const [uploadDescription, setUploadDescription] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [activeFilter, setActiveFilter] = useState<string>('all')

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedFile(file)
    }
  }

  const handleUpload = async () => {
    if (!selectedFile) return

    setIsUploading(true)
    try {
      await onUploadDocument(selectedFile, selectedCategory, uploadDescription)
      setSelectedFile(null)
      setUploadDescription('')
      // Reset file input
      const input = document.getElementById('file-upload') as HTMLInputElement
      if (input) input.value = ''
    } catch (error) {
      console.error('Upload failed:', error)
    } finally {
      setIsUploading(false)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'processed':
        return <CheckCircle className="h-4 w-4 text-green-400" />
      case 'processing':
        return <Clock className="h-4 w-4 text-yellow-400" />
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-red-400" />
      default:
        return <Clock className="h-4 w-4 text-gray-400" />
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'processed':
        return 'Ready'
      case 'processing':
        return 'Processing'
      case 'failed':
        return 'Failed'
      default:
        return 'Pending'
    }
  }

  const getCategoryInfo = (categoryId: string) => {
    return DOCUMENT_CATEGORIES.find(cat => cat.id === categoryId) || DOCUMENT_CATEGORIES[DOCUMENT_CATEGORIES.length - 1]
  }

  const getColorClasses = (color: string) => {
    const colorMap: Record<string, string> = {
      blue: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
      green: 'bg-green-500/20 text-green-300 border-green-500/30',
      orange: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
      purple: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
      pink: 'bg-pink-500/20 text-pink-300 border-pink-500/30',
      yellow: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
      gray: 'bg-gray-500/20 text-gray-300 border-gray-500/30'
    }
    return colorMap[color] || colorMap.gray
  }

  const filteredDocuments = activeFilter === 'all'
    ? documents
    : documents.filter(doc => doc.type === activeFilter || doc.category === activeFilter)

  const documentsByCategory = DOCUMENT_CATEGORIES.map(category => ({
    ...category,
    documents: documents.filter(doc => doc.category === category.id || (category.id === 'other' && !doc.category)),
    count: documents.filter(doc => doc.category === category.id || (category.id === 'other' && !doc.category)).length
  }))

  const isPremiumUser = userTier !== 'free_tier'

  // Get document limits (consistent with VehicleManager)
  const maxDocuments = userStats?.usage?.limits?.maxDocumentUploads
  const currentDocuments = documents.length
  const isAtDocumentLimit = maxDocuments !== undefined && maxDocuments !== null && currentDocuments >= maxDocuments
  const tier = userStats?.tier || 'free_tier'

  // Format tier display name (consistent with VehicleManager)
  const getTierDisplayName = (tierName: string) => {
    switch (tierName) {
      case 'free_tier': return 'Free Tier'
      case 'weekend_warrior': return 'Weekend Warrior'
      case 'master_tech': return 'Master Tech'
      default: return tierName
    }
  }

  return (
    <div className="space-y-6">
      {/* Document Library */}
      <Card variant="glass">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-3">
              <FolderOpen className="h-6 w-6 text-orange-500" />
              <div className="flex flex-col">
                <span>Document Library</span>
                <div className="flex items-center gap-2 text-sm font-normal">
                  <span className="text-zinc-400">
                    {currentDocuments}{maxDocuments !== undefined && maxDocuments !== null ? `/${maxDocuments}` : ''} documents
                  </span>
                  <span className="text-xs text-zinc-500">•</span>
                  <span className="text-xs text-zinc-500">{getTierDisplayName(tier)}</span>
                </div>
              </div>
            </CardTitle>

            <div className="flex items-center gap-4">
              {/* Filter buttons */}
              {documents.length > 0 && (
                <div className="flex gap-2">
                  <button
                    onClick={() => setActiveFilter('all')}
                    className={cn(
                      "px-3 py-1 rounded-lg text-sm transition-all duration-200",
                      activeFilter === 'all'
                        ? "bg-orange-500 text-white"
                        : "bg-zinc-700 text-zinc-300 hover:bg-zinc-600"
                    )}
                  >
                    All ({documents.length})
                  </button>
                </div>
              )}

              {/* Upgrade hint when at limit */}
              {isAtDocumentLimit && (
                <div className="text-center">
                  <p className="text-sm text-orange-400 mb-2">Document limit reached</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-orange-500/50 text-orange-400 hover:bg-orange-500/10"
                  >
                    Upgrade Plan
                  </Button>
                </div>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {documents.length > 0 ? (
            <div className="space-y-6">
              {/* Category Overview */}
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                {documentsByCategory.map((category) => {
                  const Icon = category.icon
                  return (
                    <button
                      key={category.id}
                      onClick={() => setActiveFilter(category.id)}
                      className={cn(
                        "p-3 rounded-lg border transition-all duration-200 hover:scale-105",
                        activeFilter === category.id
                          ? getColorClasses(category.color)
                          : "bg-zinc-800/50 border-zinc-700 text-zinc-300 hover:border-zinc-600"
                      )}
                    >
                      <Icon className="h-4 w-4 mx-auto mb-1" />
                      <div className="text-xs font-medium">{category.name}</div>
                      <div className="text-xs text-zinc-400">({category.count})</div>
                    </button>
                  )
                })}
              </div>

              {/* Document List */}
              <div className="space-y-3">
                {filteredDocuments.map((document) => {
                  const categoryInfo = getCategoryInfo(document.category || 'other')
                  const Icon = categoryInfo.icon

                  return (
                    <Card key={document.id} variant="default" className="card-hover">
                      <CardContent className="py-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className={cn("p-2 rounded-lg", getColorClasses(categoryInfo.color))}>
                              <Icon className="h-4 w-4" />
                            </div>

                            <div className="flex-1 min-w-0">
                              <h3 className="font-medium text-white truncate">{document.filename}</h3>
                              <div className="flex items-center gap-4 mt-1">
                                <span className="text-xs text-zinc-400">{categoryInfo.name}</span>
                                <span className="text-xs text-zinc-400">{document.sizeMB} MB</span>
                                <span className="text-xs text-zinc-400">
                                  {new Date(document.createdAt).toLocaleDateString()}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2">
                              {getStatusIcon(document.status)}
                              <span className="text-sm text-zinc-400">{getStatusText(document.status)}</span>
                            </div>

                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {/* Download logic */}}
                                className="p-2"
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => onDeleteDocument(document.id)}
                                className="p-2 text-red-400 hover:text-red-300"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>

              {filteredDocuments.length === 0 && activeFilter !== 'all' && (
                <div className="text-center py-8">
                  <FolderOpen className="h-12 w-12 text-zinc-600 mx-auto mb-3" />
                  <p className="text-zinc-400">No documents in this category yet</p>
                  <Button
                    onClick={() => setActiveFilter('all')}
                    variant="outline"
                    size="sm"
                    className="mt-3"
                  >
                    View All Documents
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12">
              <FileText className="h-16 w-16 text-zinc-600 mx-auto mb-4" />
              <p className="text-zinc-400 text-lg mb-2">No documents uploaded yet</p>
              <p className="text-zinc-500 text-sm">
                {isPremiumUser
                  ? "Upload your first document below to enhance AI responses with your specific vehicle information!"
                  : "Upgrade your plan to upload documents and get personalized automotive assistance."
                }
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upload Section */}
      {isPremiumUser ? (
        <Card variant="elevated">
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <Upload className="h-5 w-5 text-orange-500" />
              Upload Document
            </CardTitle>

            {/* Limit warning */}
            {isAtDocumentLimit && (
              <div className="mt-3 p-3 bg-orange-500/10 border border-orange-500/20 rounded-lg">
                <div className="flex items-center gap-2 text-orange-400 text-sm">
                  <FileText className="h-4 w-4" />
                  <span className="font-medium">Document limit reached ({currentDocuments}/{maxDocuments})</span>
                </div>
                <p className="text-xs text-zinc-400 mt-1">
                  You've reached the maximum number of documents for the {getTierDisplayName(tier)}.
                  Upgrade your plan to upload more documents.
                </p>
              </div>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Category Selection */}
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Document Category
              </label>
              <div className="grid grid-cols-3 md:grid-cols-7 gap-2">
                {DOCUMENT_CATEGORIES.map((category) => {
                  const Icon = category.icon
                  return (
                    <button
                      key={category.id}
                      onClick={() => setSelectedCategory(category.id)}
                      disabled={isAtDocumentLimit}
                      className={cn(
                        "p-2 rounded-lg border transition-all duration-200 hover:scale-105",
                        selectedCategory === category.id
                          ? getColorClasses(category.color)
                          : "bg-zinc-800/50 border-zinc-700 text-zinc-300 hover:border-zinc-600",
                        isAtDocumentLimit && "opacity-50 cursor-not-allowed hover:scale-100"
                      )}
                    >
                      <Icon className="h-4 w-4 mx-auto mb-1" />
                      <div className="text-xs font-medium">{category.name}</div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* File Upload */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="file-upload" className="block text-sm font-medium text-white mb-2">
                  Select File
                </label>
                <input
                  id="file-upload"
                  type="file"
                  onChange={handleFileSelect}
                  accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.mp4,.mov"
                  disabled={isAtDocumentLimit}
                  className={cn(
                    "block w-full text-sm text-zinc-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-orange-500 file:text-white hover:file:bg-orange-600 file:cursor-pointer cursor-pointer bg-zinc-800/50 border border-zinc-700 rounded-lg",
                    isAtDocumentLimit && "opacity-50 cursor-not-allowed file:cursor-not-allowed file:opacity-50"
                  )}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Description (Optional)
                </label>
                <textarea
                  value={uploadDescription}
                  onChange={(e) => setUploadDescription(e.target.value)}
                  placeholder="Brief description..."
                  disabled={isAtDocumentLimit}
                  className={cn(
                    "w-full bg-zinc-900/50 border border-zinc-700 text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 placeholder:text-zinc-500 resize-none transition-all duration-200",
                    isAtDocumentLimit && "opacity-50 cursor-not-allowed"
                  )}
                  rows={2}
                />
              </div>
            </div>

            <Button
              onClick={handleUpload}
              disabled={!selectedFile || isUploading || isAtDocumentLimit}
              loading={isUploading}
              className={cn(
                "w-full",
                isAtDocumentLimit && "opacity-50 cursor-not-allowed"
              )}
              icon={<Upload className="h-4 w-4" />}
            >
              {isUploading ? 'Uploading...' : 'Upload Document'}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card variant="elevated" className="border-amber-500/50">
          <CardContent className="py-6">
            <div className="text-center space-y-3">
              <div className="bg-amber-500/20 p-3 rounded-full w-fit mx-auto">
                <Upload className="h-6 w-6 text-amber-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Upgrade to Upload Documents</h3>
                <p className="text-zinc-400 text-sm">
                  Upload service manuals, maintenance records, and more to get personalized automotive assistance.
                </p>
              </div>
              <Button variant="outline" size="sm" className="mt-3">
                Upgrade Plan
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
