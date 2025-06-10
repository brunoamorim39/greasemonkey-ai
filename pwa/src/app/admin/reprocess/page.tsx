'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { apiPost } from '@/lib/api-client'
import { AuthGuard } from '@/components/AuthGuard'
import type { User as SupabaseUser } from '@supabase/supabase-js'

function ReprocessPageContent() {
  const [isProcessing, setIsProcessing] = useState(false)
  const [results, setResults] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const handleReprocess = async () => {
    setIsProcessing(true)
    setError(null)
    setResults(null)

    try {
      // Use the API client which handles authentication automatically
      const response = await apiPost('/api/documents/force-reprocess')

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      setResults(data)
      console.log('📊 Reprocessing results:', data)

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred')
      console.error('❌ Reprocessing failed:', err)
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="min-h-screen bg-zinc-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Document Reprocessing Admin</h1>

        <div className="bg-zinc-800 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Force Reprocess All Documents</h2>
          <p className="text-zinc-400 mb-4">
            This will re-extract text from all your uploaded documents. Use this if documents
            aren't showing up in search results or if text extraction previously failed.
          </p>

          <Button
            onClick={handleReprocess}
            disabled={isProcessing}
            className="bg-orange-600 hover:bg-orange-700"
          >
            {isProcessing ? '🔄 Processing...' : '🚀 Force Reprocess All Documents'}
          </Button>
        </div>

        {error && (
          <div className="bg-red-900/50 border border-red-700 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-red-400 mb-2">❌ Error</h3>
            <p className="text-red-300">{error}</p>
          </div>
        )}

        {results && (
          <div className="bg-zinc-800 rounded-lg p-6">
            <h3 className="text-xl font-semibold mb-4">📊 Reprocessing Results</h3>

            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-zinc-700 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-blue-400">{results.total_documents}</div>
                <div className="text-sm text-zinc-400">Total Documents</div>
              </div>
              <div className="bg-zinc-700 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-green-400">{results.successful}</div>
                <div className="text-sm text-zinc-400">Successful</div>
              </div>
              <div className="bg-zinc-700 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-red-400">{results.failed}</div>
                <div className="text-sm text-zinc-400">Failed</div>
              </div>
            </div>

            <h4 className="font-semibold mb-3">Document Details:</h4>
            <div className="space-y-2">
              {results.results?.map((result: any, index: number) => (
                <div
                  key={index}
                  className={`p-3 rounded border-l-4 ${
                    result.success
                      ? 'bg-green-900/20 border-green-500'
                      : 'bg-red-900/20 border-red-500'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-medium">{result.filename}</div>
                      {result.success && (
                        <div className="text-sm text-green-400">
                          ✅ Text extracted: {result.text_length} characters
                        </div>
                      )}
                      {!result.success && (
                        <div className="text-sm text-red-400">
                          ❌ {result.error}
                        </div>
                      )}
                    </div>
                    <div className={`text-sm font-medium ${
                      result.success ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {result.success ? 'SUCCESS' : 'FAILED'}
                    </div>
                  </div>
                  {result.text_preview && (
                    <div className="mt-2 text-xs text-zinc-500 bg-zinc-900 p-2 rounded">
                      <strong>Preview:</strong> {result.text_preview}...
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function ReprocessPage() {
  return (
    <AuthGuard>
      {(user: SupabaseUser) => <ReprocessPageContent />}
    </AuthGuard>
  )
}
