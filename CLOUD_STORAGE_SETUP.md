# Cloud Storage Implementation Guide

This guide will help you implement the new cloud file storage feature for your GreaseMonkey AI document system.

## Overview

The enhanced document system now provides:
- ✅ **Original PDF Storage**: Files stored in Supabase Storage
- ✅ **Download Capabilities**: Users can retrieve their uploaded documents
- ✅ **Vector Search**: AI-powered document search using ChromaDB
- ✅ **Metadata Management**: Document information in PostgreSQL

## Implementation Steps

### 1. Supabase Storage Setup

#### Create Storage Bucket
1. Go to your Supabase dashboard
2. Navigate to **Storage** section
3. Click **Create bucket**
4. Name: `documents`
5. Make it **private** (not public)

#### Set Storage Policies
Create these RLS policies for the documents bucket:

```sql
-- Allow users to read their own documents
CREATE POLICY "Users can read own documents" ON storage.objects
FOR SELECT USING (
  bucket_id = 'documents' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to insert their own documents
CREATE POLICY "Users can upload own documents" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'documents' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to delete their own documents
CREATE POLICY "Users can delete own documents" ON storage.objects
FOR DELETE USING (
  bucket_id = 'documents' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
```

### 2. Database Migration

Run the new migration to add the storage_path column:

```bash
# If using Supabase CLI
supabase db push

# Or run the SQL directly:
# supabase/migrations/002_add_storage_path.sql
```

### 3. Environment Configuration

Add to your backend `.env` file:

```bash
# Storage configuration
STORAGE_BUCKET=documents
```

### 4. Backend Deployment

The backend code has been updated with:
- File upload to Supabase Storage
- Download URL generation
- File deletion with cleanup
- Error handling and rollback

Key changes:
- `services.py`: Enhanced DocumentManager with cloud storage
- `routes.py`: New download endpoint
- `models.py`: Added storage_path field

### 5. Frontend Updates

The frontend now includes:
- **Download buttons** on ready documents
- **Download URL generation**
- **Success/error messaging** for downloads

To complete the frontend implementation:

#### Add URL Launcher (Optional)
For better UX, add the `url_launcher` package:

```yaml
# pubspec.yaml
dependencies:
  url_launcher: ^6.2.2
```

Then update the download function:

```dart
import 'package:url_launcher/url_launcher.dart';

Future<void> _downloadDocument(DocumentMetadata document) async {
  // ... existing code ...

  if (downloadUrl != null) {
    try {
      await launch(downloadUrl);
      _showSuccess('Opening download...');
    } catch (e) {
      _showError('Could not open download link');
    }
  }
}
```

### 6. Testing Checklist

- [ ] Upload a PDF document
- [ ] Verify file appears in Supabase Storage bucket
- [ ] Check download button appears for ready documents
- [ ] Test download functionality
- [ ] Verify document deletion removes file from storage
- [ ] Test storage quota limits
- [ ] Verify AI search still works with uploaded content

### 7. Monitoring and Maintenance

#### Storage Usage Monitoring
- Monitor bucket usage in Supabase dashboard
- Set up alerts for storage quota limits
- Regular cleanup of orphaned files

#### Security Considerations
- Download URLs expire after 1 hour for security
- Files are stored with user-specific paths
- RLS policies prevent unauthorized access

## Benefits for Users

### 📁 **Document Library**
Users now have a centralized place to store and organize their automotive documents:
- Service manuals
- Repair guides
- Parts catalogs
- Technical specifications

### 🤖 **AI Assistant Integration**
Documents are automatically:
- Processed for text extraction
- Indexed for semantic search
- Referenced in AI responses
- Tagged by car make/model/year

### 📱 **Mobile Cloud Storage**
Users can:
- Upload documents from their mobile device
- Access documents from cloud storage anytime
- Free up device storage space (documents stored in cloud)
- Never lose documents if phone is lost/damaged
- Share documents with mechanics or friends via download links
- Switch devices without losing their document library

## Value Proposition

This transforms your app from "AI chat assistant" to "Complete automotive document management platform with AI assistance" - significantly increasing user value and retention potential.

Users get:
1. **Cloud Document Backup** - Never lose important manuals again
2. **AI-Powered Search** - Find specific information instantly
3. **Device Independence** - Documents safe even if phone is lost/broken
4. **Space Saving** - Documents stored in cloud, not on device
5. **Intelligent Assistant** - AI that knows their specific documents
6. **Easy Sharing** - Generate download links to share with others

## Troubleshooting

### Common Issues

#### Upload Fails
- Check Supabase Storage bucket exists
- Verify RLS policies are correct
- Check file size limits

#### Download Fails
- Verify storage_path is saved correctly
- Check RLS policies for reading
- Ensure signed URL generation works

#### Storage Path Issues
- Check filename sanitization
- Verify user ID in path structure
- Look for special characters in filenames

### Debug Commands

```bash
# Check storage bucket
supabase storage ls documents

# Check user documents
supabase storage ls documents/user_documents/{user_id}

# Test policy
SELECT * FROM storage.objects WHERE bucket_id = 'documents';
```
