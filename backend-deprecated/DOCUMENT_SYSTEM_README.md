# GreaseMonkey AI Document System

This enhanced document system allows users to upload custom PDF documents (for paid plans) through the mobile app. Documents are stored in Supabase Storage with full download capabilities and automatically referenced by the AI assistant.

## Features

### 🚀 **Core Capabilities**
- **Mobile Document Uploads**: Paid users can upload PDF manuals and repair guides through the app
- **Cloud File Storage**: Documents stored securely in Supabase Storage with download capabilities
- **Document Retrieval**: Users can download their uploaded documents anytime
- **AI Integration**: Uploaded documents automatically referenced in chat responses
- **Car-Specific Context**: Documents are tagged and filtered by make, model, year, and engine
- **Intelligent Search**: Semantic search across user documents for AI responses
- **Storage Management**: Tier-based storage limits with usage tracking

### 📋 **User Tiers & Permissions**
- **Free Users**: Chat with AI assistant only
- **Usage Paid**: Document uploads up to 1GB storage with download access
- **Fixed Rate**: Document uploads up to 1GB storage with download access

## Storage Architecture

### **Hybrid Storage System**
1. **Original Files**: Stored in Supabase Storage with secure access
2. **Vector Embeddings**: Stored in ChromaDB for AI search and context
3. **Metadata**: Stored in Supabase PostgreSQL database

### **File Storage Structure**
```
Supabase Storage Bucket: "documents"
└── user_documents/
    └── {user_id}/
        ├── {document_id}_{filename}.pdf
        └── ...
```

## Backend Setup Instructions

### 1. Database Setup

Run the migration to create the documents table:

```bash
# Apply the migration to your Supabase database
supabase db push
```

Or manually execute the SQL in `supabase/migrations/001_create_documents_table.sql`

### 2. Supabase Storage Setup

Create the storage bucket in your Supabase dashboard:

1. Go to Storage in your Supabase dashboard
2. Create a new bucket named "documents"
3. Set appropriate security policies for the bucket
4. Enable Row Level Security (RLS) for user access control

### 3. Environment Variables

Add these to your **backend** `.env` file:

```bash
# Document management settings
DOCUMENTS_PATH=./documents
MAX_DOCUMENT_SIZE_MB=50
MAX_STORAGE_FREE_MB=100
MAX_STORAGE_PAID_MB=1000
CHROMA_PATH=./chroma_db
STORAGE_BUCKET=documents

# OpenAI API (required for embeddings)
OPENAI_API_KEY=your_openai_api_key

# Supabase (required for document metadata and storage)
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_anon_key
```

Your **frontend** `.env` file should only contain:
```bash
BACKEND_URL=http://localhost:8000  # or your deployed backend URL
API_KEY=your-secure-api-key-here   # same as backend API_KEY
```

### 4. Install Dependencies

The required packages are already in `requirements.txt`:
- `pypdf` - PDF text extraction
- `langchain` - Document processing and chunking
- `chromadb` - Vector database for semantic search
- `langchain-openai` - OpenAI embeddings

### 5. Directory Structure

The system will create these directories automatically:
```
backend/
├── documents/           # Local processing temp directory
├── chroma_db/          # Vector database
│   └── user_{user_id}/      # User-specific document collections
```

## How It Works

### User Upload Flow
1. **Mobile App**: User uploads PDF through document upload screen
2. **Backend Processing**:
   - File uploaded to Supabase Storage
   - Text extracted and chunked
   - Embeddings created and stored in ChromaDB
   - Metadata saved to database
3. **AI Integration**: Document content automatically searched during chat
4. **Download**: User can download original files anytime

### AI Chat Integration
When users ask questions, the system:
1. Searches user's uploaded documents for relevant content
2. Provides document excerpts as context to GPT
3. GPT responds with document-informed answers
4. Includes source attribution in responses

## Benefits

### For Users
- **Cloud Document Backup**: Upload vehicle-specific manuals and documentation from mobile device
- **Device Independence**: Documents safely stored in cloud, accessible even if phone is lost/damaged
- **Space Saving**: Documents stored in cloud rather than taking up device storage
- **AI Integration**: GPT responses include relevant excerpts from uploaded documents
- **Easy Sharing**: Generate download links to share manuals with mechanics or friends
- **Source Attribution**: Know exactly where information comes from

### For the Business
- **Premium Feature**: Document uploads drive paid plan conversions
- **Better Accuracy**: Manual-backed responses are more reliable
- **Reduced Liability**: Source attribution provides transparency
- **User Retention**: Cloud storage creates switching costs and ongoing value

### For Developers
- **Modular Design**: Document system is separate from core AI functionality
- **Extensible**: Easy to add new document types and processing methods
- **Performance**: Efficient vector search with car-specific filtering
- **Maintainable**: Clear separation of concerns and comprehensive logging

## Troubleshooting

### Common Issues

1. **Upload Fails**: Check user tier and storage limits
2. **Search Returns No Results**: Verify document processing completed successfully
3. **Large File Processing**: Monitor memory usage during PDF processing
4. **Vector Search Errors**: Ensure OpenAI API key is configured correctly

### Monitoring

Check logs for:
- Document processing status
- Storage usage by user
- Search performance metrics
- Error rates and types
