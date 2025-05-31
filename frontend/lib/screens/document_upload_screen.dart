import 'package:flutter/material.dart';
import 'package:file_picker/file_picker.dart';
import 'dart:io';
import '../services/document_service.dart';
import '../models/document.dart';
import '../state/app_state.dart';
import 'package:provider/provider.dart';

class DocumentUploadScreen extends StatefulWidget {
  const DocumentUploadScreen({super.key});

  @override
  State<DocumentUploadScreen> createState() => _DocumentUploadScreenState();
}

class _DocumentUploadScreenState extends State<DocumentUploadScreen> {
  final _titleController = TextEditingController();
  final _tagsController = TextEditingController();
  final _formKey = GlobalKey<FormState>();

  File? _selectedFile;
  bool _isUploading = false;

  String? _selectedMake;
  String? _selectedModel;
  int? _selectedYear;
  String? _selectedEngine;

  UserDocumentStats? _stats;
  bool _loadingStats = true;

  @override
  void initState() {
    super.initState();
    _loadUserStats();
    _prefillFromActiveVehicle();
  }

  void _loadUserStats() async {
    final appState = Provider.of<AppState>(context, listen: false);
    if (appState.userId != null) {
      final stats = await DocumentService.getUserStats(appState.userId!);
      setState(() {
        _stats = stats;
        _loadingStats = false;
      });
    } else {
      setState(() {
        _loadingStats = false;
      });
    }
  }

  void _prefillFromActiveVehicle() {
    final appState = Provider.of<AppState>(context, listen: false);
    if (appState.activeVehicle != null) {
      final vehicle = appState.activeVehicle!;

      // Parse vehicle name to extract make and model
      final nameParts = vehicle.name.split(' ');
      if (nameParts.isNotEmpty) {
        _selectedMake = nameParts[0];
        if (nameParts.length > 1) {
          _selectedModel = nameParts.skip(1).join(' ');
        }
      }

      // Try to extract year from vehicle name or engine
      final yearMatch = RegExp(r'\b(19|20)\d{2}\b').firstMatch('${vehicle.name} ${vehicle.engine}');
      if (yearMatch != null) {
        _selectedYear = int.tryParse(yearMatch.group(0)!);
      }

      _selectedEngine = vehicle.engine;
    }
  }

  Future<void> _pickFile() async {
    try {
      FilePickerResult? result = await FilePicker.platform.pickFiles(
        type: FileType.custom,
        allowedExtensions: ['pdf'],
        allowMultiple: false,
      );

      if (result != null && result.files.single.path != null) {
        setState(() {
          _selectedFile = File(result.files.single.path!);
          if (_titleController.text.isEmpty) {
            // Auto-fill title from filename
            final fileName = result.files.single.name;
            _titleController.text = fileName.replaceAll('.pdf', '').replaceAll('_', ' ');
          }
        });
      }
    } catch (e) {
      _showError('Error picking file: $e');
    }
  }

  Future<void> _uploadDocument() async {
    if (!_formKey.currentState!.validate() || _selectedFile == null) {
      return;
    }

    final appState = Provider.of<AppState>(context, listen: false);
    if (appState.userId == null) {
      _showError('Please sign in to upload documents');
      return;
    }

    // Check if user can upload
    if (_stats != null && !_stats!.canUploadMore) {
      _showError('Storage limit reached. Please upgrade your plan or delete some documents.');
      return;
    }

    setState(() {
      _isUploading = true;
    });

    try {
      final result = await DocumentService.uploadDocument(
        userId: appState.userId!,
        pdfFile: _selectedFile!,
        title: _titleController.text.trim(),
        carMake: _selectedMake,
        carModel: _selectedModel,
        carYear: _selectedYear,
        carEngine: _selectedEngine,
        tags: _tagsController.text.trim().split(',').map((e) => e.trim()).where((e) => e.isNotEmpty).toList(),
      );

      if (result.isSuccess) {
        _showSuccess('Document uploaded successfully! It will be processed and available for search shortly.');
        Navigator.pop(context, result.document);
      } else {
        _showError(result.errorMessage ?? 'Upload failed');
      }
    } catch (e) {
      _showError('Upload error: $e');
    } finally {
      setState(() {
        _isUploading = false;
      });
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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Upload Document'),
        backgroundColor: Colors.grey[900],
        foregroundColor: Colors.white,
      ),
      backgroundColor: Colors.grey[850],
      body: _loadingStats
        ? const Center(child: CircularProgressIndicator())
        : _stats != null && !_stats!.canUploadMore
          ? _buildUpgradePrompt()
          : _buildUploadForm(),
    );
  }

  Widget _buildUpgradePrompt() {
    return Center(
      child: Card(
        margin: const EdgeInsets.all(16),
        color: Colors.grey[800],
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                Icons.cloud_off,
                size: 64,
                color: Colors.orange[400],
              ),
              const SizedBox(height: 16),
              Text(
                'Storage Limit Reached',
                style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                  color: Colors.white,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                _stats!.storageUsageText,
                style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                  color: Colors.grey[300],
                ),
              ),
              const SizedBox(height: 16),
              Text(
                'Upgrade to a paid plan to upload your own service manuals and repair guides.',
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: Colors.grey[400],
                ),
              ),
              const SizedBox(height: 24),
              ElevatedButton(
                onPressed: () {
                  // Navigate to upgrade screen
                  // TODO: Implement upgrade flow
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.blue[600],
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 16),
                ),
                child: const Text('Upgrade Plan'),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildUploadForm() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Form(
        key: _formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Storage usage card
            if (_stats != null) _buildStorageCard(),
            const SizedBox(height: 16),

            // File selection card
            Card(
              color: Colors.grey[800],
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Select Document',
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        color: Colors.white,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 12),
                    InkWell(
                      onTap: _pickFile,
                      child: Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(20),
                        decoration: BoxDecoration(
                          border: Border.all(
                            color: _selectedFile != null ? Colors.green : Colors.grey[600]!,
                            width: 2,
                          ),
                          borderRadius: BorderRadius.circular(8),
                          color: Colors.grey[900],
                        ),
                        child: Column(
                          children: [
                            Icon(
                              _selectedFile != null ? Icons.check_circle : Icons.upload_file,
                              size: 48,
                              color: _selectedFile != null ? Colors.green : Colors.grey[400],
                            ),
                            const SizedBox(height: 8),
                            Text(
                              _selectedFile != null
                                  ? _selectedFile!.path.split('/').last
                                  : 'Tap to select PDF file',
                              style: TextStyle(
                                color: _selectedFile != null ? Colors.green : Colors.grey[400],
                                fontWeight: _selectedFile != null ? FontWeight.bold : FontWeight.normal,
                              ),
                              textAlign: TextAlign.center,
                            ),
                            if (_selectedFile != null) ...[
                              const SizedBox(height: 4),
                              FutureBuilder<int>(
                                future: _selectedFile!.length(),
                                builder: (context, snapshot) {
                                  if (snapshot.hasData) {
                                    return Text(
                                      DocumentService.formatFileSize(snapshot.data!),
                                      style: TextStyle(
                                        color: Colors.grey[400],
                                        fontSize: 12,
                                      ),
                                    );
                                  }
                                  return const SizedBox.shrink();
                                },
                              ),
                            ],
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),

            // Document details card
            Card(
              color: Colors.grey[800],
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Document Details',
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        color: Colors.white,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 16),

                    // Title field
                    TextFormField(
                      controller: _titleController,
                      style: const TextStyle(color: Colors.white),
                      decoration: InputDecoration(
                        labelText: 'Document Title',
                        labelStyle: TextStyle(color: Colors.grey[400]),
                        border: OutlineInputBorder(
                          borderSide: BorderSide(color: Colors.grey[600]!),
                        ),
                        enabledBorder: OutlineInputBorder(
                          borderSide: BorderSide(color: Colors.grey[600]!),
                        ),
                        focusedBorder: OutlineInputBorder(
                          borderSide: BorderSide(color: Colors.blue[400]!),
                        ),
                        filled: true,
                        fillColor: Colors.grey[900],
                      ),
                      validator: (value) {
                        if (value == null || value.trim().isEmpty) {
                          return 'Please enter a document title';
                        }
                        return null;
                      },
                    ),
                    const SizedBox(height: 16),

                    // Vehicle information
                    Text(
                      'Vehicle Information (Optional)',
                      style: TextStyle(
                        color: Colors.grey[300],
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                    const SizedBox(height: 8),

                    Row(
                      children: [
                        Expanded(
                          child: TextFormField(
                            initialValue: _selectedMake,
                            style: const TextStyle(color: Colors.white),
                            decoration: InputDecoration(
                              labelText: 'Make',
                              labelStyle: TextStyle(color: Colors.grey[400]),
                              border: OutlineInputBorder(
                                borderSide: BorderSide(color: Colors.grey[600]!),
                              ),
                              enabledBorder: OutlineInputBorder(
                                borderSide: BorderSide(color: Colors.grey[600]!),
                              ),
                              focusedBorder: OutlineInputBorder(
                                borderSide: BorderSide(color: Colors.blue[400]!),
                              ),
                              filled: true,
                              fillColor: Colors.grey[900],
                            ),
                            onChanged: (value) => _selectedMake = value.isEmpty ? null : value,
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: TextFormField(
                            initialValue: _selectedModel,
                            style: const TextStyle(color: Colors.white),
                            decoration: InputDecoration(
                              labelText: 'Model',
                              labelStyle: TextStyle(color: Colors.grey[400]),
                              border: OutlineInputBorder(
                                borderSide: BorderSide(color: Colors.grey[600]!),
                              ),
                              enabledBorder: OutlineInputBorder(
                                borderSide: BorderSide(color: Colors.grey[600]!),
                              ),
                              focusedBorder: OutlineInputBorder(
                                borderSide: BorderSide(color: Colors.blue[400]!),
                              ),
                              filled: true,
                              fillColor: Colors.grey[900],
                            ),
                            onChanged: (value) => _selectedModel = value.isEmpty ? null : value,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),

                    Row(
                      children: [
                        Expanded(
                          child: TextFormField(
                            initialValue: _selectedYear?.toString(),
                            style: const TextStyle(color: Colors.white),
                            keyboardType: TextInputType.number,
                            decoration: InputDecoration(
                              labelText: 'Year',
                              labelStyle: TextStyle(color: Colors.grey[400]),
                              border: OutlineInputBorder(
                                borderSide: BorderSide(color: Colors.grey[600]!),
                              ),
                              enabledBorder: OutlineInputBorder(
                                borderSide: BorderSide(color: Colors.grey[600]!),
                              ),
                              focusedBorder: OutlineInputBorder(
                                borderSide: BorderSide(color: Colors.blue[400]!),
                              ),
                              filled: true,
                              fillColor: Colors.grey[900],
                            ),
                            onChanged: (value) => _selectedYear = int.tryParse(value),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: TextFormField(
                            initialValue: _selectedEngine,
                            style: const TextStyle(color: Colors.white),
                            decoration: InputDecoration(
                              labelText: 'Engine',
                              labelStyle: TextStyle(color: Colors.grey[400]),
                              border: OutlineInputBorder(
                                borderSide: BorderSide(color: Colors.grey[600]!),
                              ),
                              enabledBorder: OutlineInputBorder(
                                borderSide: BorderSide(color: Colors.grey[600]!),
                              ),
                              focusedBorder: OutlineInputBorder(
                                borderSide: BorderSide(color: Colors.blue[400]!),
                              ),
                              filled: true,
                              fillColor: Colors.grey[900],
                            ),
                            onChanged: (value) => _selectedEngine = value.isEmpty ? null : value,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),

                    // Tags field
                    TextFormField(
                      controller: _tagsController,
                      style: const TextStyle(color: Colors.white),
                      decoration: InputDecoration(
                        labelText: 'Tags (comma-separated)',
                        hintText: 'e.g. brake, repair, manual',
                        labelStyle: TextStyle(color: Colors.grey[400]),
                        hintStyle: TextStyle(color: Colors.grey[500]),
                        border: OutlineInputBorder(
                          borderSide: BorderSide(color: Colors.grey[600]!),
                        ),
                        enabledBorder: OutlineInputBorder(
                          borderSide: BorderSide(color: Colors.grey[600]!),
                        ),
                        focusedBorder: OutlineInputBorder(
                          borderSide: BorderSide(color: Colors.blue[400]!),
                        ),
                        filled: true,
                        fillColor: Colors.grey[900],
                      ),
                    ),
                    const SizedBox(height: 16),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 24),

            // Upload button
            ElevatedButton(
              onPressed: _isUploading || _selectedFile == null ? null : _uploadDocument,
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.blue[600],
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8),
                ),
              ),
              child: _isUploading
                  ? const Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                          ),
                        ),
                        SizedBox(width: 12),
                        Text('Uploading...'),
                      ],
                    )
                  : const Text(
                      'Upload Document',
                      style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                    ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStorageCard() {
    return Card(
      color: Colors.grey[800],
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(
                  Icons.storage,
                  color: Colors.blue[400],
                  size: 20,
                ),
                const SizedBox(width: 8),
                Text(
                  'Storage Usage',
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    color: Colors.white,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const Spacer(),
                Text(
                  _stats!.storageUsageText,
                  style: TextStyle(
                    color: Colors.grey[400],
                    fontSize: 12,
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
            const SizedBox(height: 8),
            Text(
              '${_stats!.totalDocuments} documents uploaded',
              style: TextStyle(
                color: Colors.grey[400],
                fontSize: 12,
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  void dispose() {
    _titleController.dispose();
    _tagsController.dispose();
    super.dispose();
  }
}
