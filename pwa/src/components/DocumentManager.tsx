'use client'

import { useState } from 'react'
import {
  FileText,
  Upload,
  Trash2,
  Download,
  CheckCircle2,
  Clock,
  AlertCircle,
  FolderOpen,
  Book,
  Wrench,
  Clipboard,
  FileImage,
  FileVideo,
  Car,
  Plus,
  ArrowUp,
  Filter,
  Search,
  X
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { cn } from '@/lib/utils'
import { getTierDisplayName } from '@/lib/utils/tier'

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
  const [searchQuery, setSearchQuery] = useState('')
  const [showUploadForm, setShowUploadForm] = useState(false)

  const tier = userStats?.tier || 'free'
  const maxDocuments = userStats?.usage?.limits?.maxDocumentUploads
  const currentDocuments = documents.length
  const isAtDocumentLimit = maxDocuments !== undefined && maxDocuments !== null && currentDocuments >= maxDocuments
  const canUpload = userTier !== 'free_tier' && !isAtDocumentLimit

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
      setShowUploadForm(false)
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
        return <CheckCircle2 className="h-4 w-4 text-green-400" />
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

  const filteredDocuments = documents.filter(doc => {
    const matchesFilter = activeFilter === 'all' || doc.category === activeFilter
    const matchesSearch = searchQuery === '' ||
      doc.filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.description?.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesFilter && matchesSearch
  })

  const documentsByCategory = DOCUMENT_CATEGORIES.map(category => ({
    ...category,
    documents: documents.filter(doc => doc.category === category.id || (category.id === 'other' && !doc.category)),
    count: documents.filter(doc => doc.category === category.id || (category.id === 'other' && !doc.category)).length
  }))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center">
              <FolderOpen className="h-5 w-5 text-white" />
            </div>
            Document Library
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-zinc-400 text-sm">
              {currentDocuments}{maxDocuments !== undefined && maxDocuments !== null ? `/${maxDocuments}` : ''} documents
            </span>
            <span className="text-zinc-600">•</span>
            <span className="text-xs text-zinc-500 bg-zinc-800 px-2 py-1 rounded">
              {getTierDisplayName(tier)}
            </span>
          </div>
        </div>

        {/* Upload Button */}
        {canUpload && (
          <Button
            onClick={() => setShowUploadForm(true)}
            size="sm"
            className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
          >
            <Upload className="h-4 w-4 mr-2" />
            Upload
          </Button>
        )}
      </div>

      {/* Document Limit Alert */}
      {isAtDocumentLimit && (
        <Card className="border-orange-500/30 bg-orange-500/10">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-orange-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="text-orange-400 font-medium mb-1">Document Limit Reached</h3>
                <p className="text-sm text-zinc-400 mb-3">
                  You've reached the maximum of {maxDocuments} documents for the {getTierDisplayName(tier)}.
                  Upgrade to upload more documents.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-orange-500/50 text-orange-400 hover:bg-orange-500/10"
                  onClick={() => window.dispatchEvent(new CustomEvent('showPricing'))}
                >
                  <ArrowUp className="h-4 w-4 mr-2" />
                  Upgrade Plan
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Free Tier Upgrade Prompt */}
      {userTier === 'free_tier' && (
        <Card className="border-blue-500/30 bg-blue-500/10">
          <CardContent className="py-8 text-center">
            <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Upload className="h-8 w-8 text-blue-400" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">Upload Documents</h3>
            <p className="text-zinc-400 mb-6 max-w-md mx-auto">
              Upload service manuals, maintenance records, and repair guides to get personalized automotive assistance tailored to your vehicle.
            </p>
            <Button
              onClick={() => window.dispatchEvent(new CustomEvent('showPricing'))}
              className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
            >
              <ArrowUp className="h-4 w-4 mr-2" />
              Upgrade to Upload Documents
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Search and Filter */}
      {documents.length > 0 && (
        <div className="space-y-4">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-zinc-400" />
            <Input
              placeholder="Search documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-zinc-900/50 border-zinc-700"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 hover:bg-zinc-700 rounded"
              >
                <X className="h-3 w-3 text-zinc-400" />
              </button>
            )}
          </div>

          {/* Category Filters */}
          <div className="flex gap-2 overflow-x-auto pb-2">
            <button
              onClick={() => setActiveFilter('all')}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all",
                activeFilter === 'all'
                  ? "bg-zinc-700 text-white"
                  : "bg-zinc-800/50 text-zinc-400 hover:bg-zinc-700/50"
              )}
            >
              All ({documents.length})
            </button>
            {documentsByCategory.filter(cat => cat.count > 0).map((category) => {
              const Icon = category.icon
              return (
                <button
                  key={category.id}
                  onClick={() => setActiveFilter(category.id)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all",
                    activeFilter === category.id
                      ? getColorClasses(category.color).replace('bg-', 'bg-').replace('/20', '/30')
                      : "bg-zinc-800/50 text-zinc-400 hover:bg-zinc-700/50"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {category.name} ({category.count})
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Documents List */}
      {documents.length > 0 ? (
        <div className="space-y-3">
          {filteredDocuments.length > 0 ? (
            filteredDocuments.map((document) => {
              const categoryInfo = getCategoryInfo(document.category || 'other')
              const Icon = categoryInfo.icon

              return (
                <Card key={document.id} className="hover:bg-zinc-900/50 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      {/* Category Icon */}
                      <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0", getColorClasses(categoryInfo.color))}>
                        <Icon className="h-6 w-6" />
                      </div>

                      {/* Document Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-white text-lg mb-1 truncate">
                              {document.filename}
                            </h3>
                            <p className="text-sm text-zinc-400 mb-2">{categoryInfo.name}</p>
                            {document.description && (
                              <p className="text-sm text-zinc-500 mb-2 line-clamp-2">
                                {document.description}
                              </p>
                            )}
                            <div className="flex items-center gap-4 text-xs text-zinc-500">
                              <span>{document.sizeMB} MB</span>
                              <span>{new Date(document.createdAt).toLocaleDateString()}</span>
                              <div className="flex items-center gap-1">
                                {getStatusIcon(document.status)}
                                <span>{getStatusText(document.status)}</span>
                              </div>
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex gap-2 flex-shrink-0">
                            {document.status === 'processed' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="p-2 h-auto hover:bg-zinc-800"
                              >
                                <Download className="h-4 w-4 text-zinc-400" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onDeleteDocument(document.id)}
                              className="p-2 h-auto hover:bg-red-500/20 hover:text-red-400"
                            >
                              <Trash2 className="h-4 w-4 text-zinc-400" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })
          ) : (
            <Card className="border-zinc-800/50">
              <CardContent className="py-8 text-center">
                <Search className="h-12 w-12 text-zinc-600 mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-white mb-2">No documents found</h3>
                <p className="text-zinc-400 mb-4">
                  Try adjusting your search or filter criteria
                </p>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearchQuery('')
                    setActiveFilter('all')
                  }}
                >
                  Clear Filters
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        <Card className="border-zinc-800/50">
          <CardContent className="py-12 text-center">
            <div className="w-20 h-20 bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText className="h-10 w-10 text-zinc-600" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">No documents yet</h3>
            <p className="text-zinc-400 mb-6 max-w-sm mx-auto">
              Upload service manuals, maintenance records, and repair guides to get personalized automotive assistance.
            </p>
            {canUpload && (
              <Button
                onClick={() => setShowUploadForm(true)}
                className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
              >
                <Upload className="h-4 w-4 mr-2" />
                Upload Your First Document
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Upload Form Modal */}
      {showUploadForm && canUpload && (
        <Card className="border-blue-500/30 bg-zinc-900/50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-3">
                <Upload className="h-5 w-5 text-blue-500" />
                Upload Document
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowUploadForm(false)
                  setSelectedFile(null)
                  setUploadDescription('')
                }}
                className="p-2 h-auto"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Category Selection */}
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-3">
                  Document Category *
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2">
                  {DOCUMENT_CATEGORIES.map((category) => {
                    const Icon = category.icon
                    return (
                      <button
                        key={category.id}
                        onClick={() => setSelectedCategory(category.id)}
                        className={cn(
                          "p-3 rounded-lg border transition-all text-center hover:scale-105",
                          selectedCategory === category.id
                            ? getColorClasses(category.color)
                            : "bg-zinc-800/50 border-zinc-700 text-zinc-300 hover:border-zinc-600"
                        )}
                      >
                        <Icon className="h-5 w-5 mx-auto mb-1" />
                        <div className="text-xs font-medium leading-tight">{category.name}</div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* File Upload */}
              <div>
                <label htmlFor="file-upload" className="block text-sm font-medium text-zinc-300 mb-2">
                  Select File *
                </label>
                <input
                  id="file-upload"
                  type="file"
                  onChange={handleFileSelect}
                  accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.mp4,.mov"
                  className="block w-full text-sm text-zinc-300 file:mr-4 file:py-3 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-500 file:text-white hover:file:bg-blue-600 file:cursor-pointer cursor-pointer bg-zinc-800/50 border border-zinc-700 rounded-lg"
                />
                {selectedFile && (
                  <p className="text-sm text-zinc-400 mt-2">
                    Selected: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                  </p>
                )}
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Description (Optional)
                </label>
                <textarea
                  value={uploadDescription}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setUploadDescription(e.target.value)}
                  placeholder="Brief description of the document..."
                  className="w-full bg-zinc-800/50 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder:text-zinc-500 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 min-h-[80px]"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-zinc-800">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowUploadForm(false)
                    setSelectedFile(null)
                    setUploadDescription('')
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleUpload}
                  disabled={!selectedFile || isUploading}
                  className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 disabled:opacity-50"
                >
                  {isUploading ? (
                    <>
                      <Clock className="h-4 w-4 mr-2 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Upload Document
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
