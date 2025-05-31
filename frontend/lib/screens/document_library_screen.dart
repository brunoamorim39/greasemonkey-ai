import 'package:flutter/material.dart';
import '../services/document_service.dart';
import '../models/document.dart';
import '../state/app_state.dart';
import 'package:provider/provider.dart';
import 'document_upload_screen.dart';

class DocumentLibraryScreen extends StatefulWidget {
  const DocumentLibraryScreen({super.key});

  @override
  State<DocumentLibraryScreen> createState() => _DocumentLibraryScreenState();
}

class _DocumentLibraryScreenState extends State<DocumentLibraryScreen> {
  List<DocumentMetadata> _documents = [];
  UserDocumentStats? _stats;
  bool _isLoading = true;
  String _searchQuery = '';
  final _searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    final appState = Provider.of<AppState>(context, listen: false);
    if (appState.userId == null) return;

    setState(() {
      _isLoading = true;
    });

    try {
      final [documents, stats] = await Future.wait([
        DocumentService.getUserDocuments(appState.userId!),
        DocumentService.getUserStats(appState.userId!),
      ]);

      setState(() {
        _documents = documents as List<DocumentMetadata>;
        _stats = stats as UserDocumentStats?;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _isLoading = false;
      });
      _showError('Error loading documents: $e');
    }
  }

  Future<void> _deleteDocument(DocumentMetadata document) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: Colors.grey[800],
        title: Text(
          'Delete Document',
          style: TextStyle(color: Colors.white),
        ),
        content: Text(
          'Are you sure you want to delete "${document.title}"? This action cannot be undone.',
          style: TextStyle(color: Colors.grey[300]),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: Text(
              'Cancel',
              style: TextStyle(color: Colors.grey[400]),
            ),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, true),
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.red[600],
              foregroundColor: Colors.white,
            ),
            child: const Text('Delete'),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      final appState = Provider.of<AppState>(context, listen: false);
      if (appState.userId == null) return;

      try {
        final success = await DocumentService.deleteDocument(document.id, appState.userId!);
        if (success) {
          setState(() {
            _documents.removeWhere((doc) => doc.id == document.id);
          });
          _showSuccess('Document deleted successfully');
          // Reload stats
          _loadStats();
        } else {
          _showError('Failed to delete document');
        }
      } catch (e) {
        _showError('Error deleting document: $e');
      }
    }
  }

  Future<void> _downloadDocument(DocumentMetadata document) async {
    final appState = Provider.of<AppState>(context, listen: false);
    if (appState.userId == null) return;

    try {
      _showSuccess('Preparing download...');

      final downloadUrl = await DocumentService.getDownloadUrl(document.id, appState.userId!);

      if (downloadUrl != null) {
        // Open the download URL in browser/system handler
        // For mobile platforms, you might want to use url_launcher package
        _showSuccess('Download link generated! Opening file...');

        // TODO: Use url_launcher to open the download URL
        // await launch(downloadUrl);

        // For now, just show a success message
        print('Download URL: $downloadUrl');
      } else {
        _showError('Failed to generate download link');
      }
    } catch (e) {
      _showError('Error downloading document: $e');
    }
  }

  Future<void> _loadStats() async {
    final appState = Provider.of<AppState>(context, listen: false);
    if (appState.userId == null) return;

    try {
      final stats = await DocumentService.getUserStats(appState.userId!);
      setState(() {
        _stats = stats;
      });
    } catch (e) {
      // Ignore stats loading errors
    }
  }

  void _showError(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: Colors.red,
      ),
    );
  }

  void _showSuccess(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: Colors.green,
      ),
    );
  }

  List<DocumentMetadata> get _filteredDocuments {
    if (_searchQuery.isEmpty) return _documents;

    return _documents.where((doc) {
      final query = _searchQuery.toLowerCase();
      return doc.title.toLowerCase().contains(query) ||
             doc.carInfo.toLowerCase().contains(query) ||
             doc.tags.any((tag) => tag.toLowerCase().contains(query));
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Document Library'),
        backgroundColor: Colors.grey[900],
        foregroundColor: Colors.white,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _loadData,
          ),
        ],
      ),
      backgroundColor: Colors.grey[850],
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : Column(
              children: [
                // Stats and search section
                _buildHeaderSection(),

                // Documents list
                Expanded(
                  child: _filteredDocuments.isEmpty
                      ? _buildEmptyState()
                      : _buildDocumentsList(),
                ),
              ],
            ),
      floatingActionButton: FloatingActionButton(
        onPressed: () async {
          final result = await Navigator.push<DocumentMetadata>(
            context,
            MaterialPageRoute(
              builder: (context) => const DocumentUploadScreen(),
            ),
          );
          if (result != null) {
            // Refresh the list
            _loadData();
          }
        },
        backgroundColor: Colors.blue[600],
        foregroundColor: Colors.white,
        child: const Icon(Icons.add),
      ),
    );
  }

  Widget _buildHeaderSection() {
    return Column(
      children: [
        // Storage stats
        if (_stats != null) _buildStatsCard(),

        // Search bar
        Padding(
          padding: const EdgeInsets.all(16),
          child: TextField(
            controller: _searchController,
            style: const TextStyle(color: Colors.white),
            decoration: InputDecoration(
              hintText: 'Search documents...',
              hintStyle: TextStyle(color: Colors.grey[400]),
              prefixIcon: Icon(Icons.search, color: Colors.grey[400]),
              suffixIcon: _searchQuery.isNotEmpty
                  ? IconButton(
                      icon: Icon(Icons.clear, color: Colors.grey[400]),
                      onPressed: () {
                        _searchController.clear();
                        setState(() {
                          _searchQuery = '';
                        });
                      },
                    )
                  : null,
              border: OutlineInputBorder(
                borderSide: BorderSide(color: Colors.grey[600]!),
                borderRadius: BorderRadius.circular(8),
              ),
              enabledBorder: OutlineInputBorder(
                borderSide: BorderSide(color: Colors.grey[600]!),
                borderRadius: BorderRadius.circular(8),
              ),
              focusedBorder: OutlineInputBorder(
                borderSide: BorderSide(color: Colors.blue[400]!),
                borderRadius: BorderRadius.circular(8),
              ),
              filled: true,
              fillColor: Colors.grey[800],
            ),
            onChanged: (value) {
              setState(() {
                _searchQuery = value;
              });
            },
          ),
        ),
      ],
    );
  }

  Widget _buildStatsCard() {
    return Card(
      margin: const EdgeInsets.all(16),
      color: Colors.grey[800],
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            Row(
              children: [
                Icon(
                  Icons.folder,
                  color: Colors.blue[400],
                  size: 20,
                ),
                const SizedBox(width: 8),
                Text(
                  'Document Library',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    color: Colors.white,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const Spacer(),
                Chip(
                  label: Text(
                    '${_stats!.totalDocuments} docs',
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 12,
                    ),
                  ),
                  backgroundColor: Colors.blue[600],
                  materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                ),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Icon(
                  Icons.storage,
                  color: Colors.grey[400],
                  size: 16,
                ),
                const SizedBox(width: 6),
                Text(
                  'Storage: ${_stats!.storageUsageText}',
                  style: TextStyle(
                    color: Colors.grey[400],
                    fontSize: 12,
                  ),
                ),
                const Spacer(),
                Text(
                  '${_stats!.storageUsagePercent.toStringAsFixed(1)}%',
                  style: TextStyle(
                    color: _stats!.isAtLimit ? Colors.red :
                          _stats!.isNearLimit ? Colors.orange :
                          Colors.grey[400],
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            LinearProgressIndicator(
              value: _stats!.storageUsagePercent / 100,
              backgroundColor: Colors.grey[700],
              valueColor: AlwaysStoppedAnimation<Color>(
                _stats!.isAtLimit ? Colors.red :
                _stats!.isNearLimit ? Colors.orange :
                Colors.blue,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            _searchQuery.isNotEmpty ? Icons.search_off : Icons.upload_file,
            size: 64,
            color: Colors.grey[600],
          ),
          const SizedBox(height: 16),
          Text(
            _searchQuery.isNotEmpty
                ? 'No documents found'
                : 'No documents uploaded yet',
            style: Theme.of(context).textTheme.headlineSmall?.copyWith(
              color: Colors.grey[400],
            ),
          ),
          const SizedBox(height: 8),
          Text(
            _searchQuery.isNotEmpty
                ? 'Try adjusting your search terms'
                : 'Upload your first service manual or repair guide',
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: Colors.grey[500],
            ),
            textAlign: TextAlign.center,
          ),
          if (_searchQuery.isEmpty) ...[
            const SizedBox(height: 24),
            ElevatedButton.icon(
              onPressed: () async {
                final result = await Navigator.push<DocumentMetadata>(
                  context,
                  MaterialPageRoute(
                    builder: (context) => const DocumentUploadScreen(),
                  ),
                );
                if (result != null) {
                  _loadData();
                }
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.blue[600],
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
              ),
              icon: const Icon(Icons.upload_file),
              label: const Text('Upload Document'),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildDocumentsList() {
    return ListView.builder(
      padding: const EdgeInsets.only(bottom: 80), // Space for FAB
      itemCount: _filteredDocuments.length,
      itemBuilder: (context, index) {
        final document = _filteredDocuments[index];
        return _buildDocumentCard(document);
      },
    );
  }

  Widget _buildDocumentCard(DocumentMetadata document) {
    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      color: Colors.grey[800],
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header row
            Row(
              children: [
                Icon(
                  document.documentType.icon,
                  color: document.documentType.color,
                  size: 20,
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    document.title,
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      color: Colors.white,
                      fontWeight: FontWeight.bold,
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                _buildStatusChip(document.status),
              ],
            ),
            const SizedBox(height: 8),

            // Car info and file info
            if (document.carInfo.isNotEmpty) ...[
              Row(
                children: [
                  Icon(
                    Icons.directions_car,
                    size: 16,
                    color: Colors.grey[400],
                  ),
                  const SizedBox(width: 6),
                  Text(
                    document.carInfo,
                    style: TextStyle(
                      color: Colors.grey[300],
                      fontSize: 14,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 4),
            ],

            Row(
              children: [
                Icon(
                  Icons.description,
                  size: 16,
                  color: Colors.grey[400],
                ),
                const SizedBox(width: 6),
                Text(
                  '${document.fileSizeFormatted}',
                  style: TextStyle(
                    color: Colors.grey[400],
                    fontSize: 12,
                  ),
                ),
                if (document.pageCount != null) ...[
                  const SizedBox(width: 12),
                  Icon(
                    Icons.pages,
                    size: 16,
                    color: Colors.grey[400],
                  ),
                  const SizedBox(width: 4),
                  Text(
                    '${document.pageCount} pages',
                    style: TextStyle(
                      color: Colors.grey[400],
                      fontSize: 12,
                    ),
                  ),
                ],
                const Spacer(),
                if (document.uploadDate != null)
                  Text(
                    _formatDate(document.uploadDate!),
                    style: TextStyle(
                      color: Colors.grey[500],
                      fontSize: 12,
                    ),
                  ),
              ],
            ),

            // Tags
            if (document.tags.isNotEmpty) ...[
              const SizedBox(height: 8),
              Wrap(
                spacing: 6,
                runSpacing: 4,
                children: document.tags.map((tag) => Chip(
                  label: Text(
                    tag,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 10,
                    ),
                  ),
                  backgroundColor: Colors.grey[700],
                  materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  visualDensity: VisualDensity.compact,
                )).toList(),
              ),
            ],

            // Error message
            if (document.status == DocumentStatus.error && document.errorMessage != null) ...[
              const SizedBox(height: 8),
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: Colors.red.withOpacity(0.1),
                  border: Border.all(color: Colors.red, width: 1),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Row(
                  children: [
                    Icon(
                      Icons.error_outline,
                      size: 16,
                      color: Colors.red,
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        document.errorMessage!,
                        style: TextStyle(
                          color: Colors.red[300],
                          fontSize: 12,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],

            // Actions
            const SizedBox(height: 12),
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                if (document.status == DocumentStatus.ready) ...[
                  TextButton.icon(
                    onPressed: () => _downloadDocument(document),
                    style: TextButton.styleFrom(
                      foregroundColor: Colors.blue[400],
                    ),
                    icon: const Icon(Icons.download, size: 16),
                    label: const Text('Download'),
                  ),
                  const SizedBox(width: 8),
                ],
                TextButton.icon(
                  onPressed: () => _deleteDocument(document),
                  style: TextButton.styleFrom(
                    foregroundColor: Colors.red[400],
                  ),
                  icon: const Icon(Icons.delete, size: 16),
                  label: const Text('Delete'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStatusChip(DocumentStatus status) {
    return Chip(
      label: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            status.icon,
            size: 12,
            color: Colors.white,
          ),
          const SizedBox(width: 4),
          Text(
            status.displayName,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 10,
            ),
          ),
        ],
      ),
      backgroundColor: status.color,
      materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
      visualDensity: VisualDensity.compact,
    );
  }

  String _formatDate(DateTime date) {
    final now = DateTime.now();
    final difference = now.difference(date);

    if (difference.inDays == 0) {
      return 'Today';
    } else if (difference.inDays == 1) {
      return 'Yesterday';
    } else if (difference.inDays < 7) {
      return '${difference.inDays} days ago';
    } else if (difference.inDays < 30) {
      return '${(difference.inDays / 7).floor()} weeks ago';
    } else {
      return '${date.day}/${date.month}/${date.year}';
    }
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }
}
