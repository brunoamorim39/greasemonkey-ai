import 'package:flutter/material.dart';

enum DocumentType {
  userUpload('user_upload'),
  bentleyManual('bentley_manual'),
  haynesManual('haynes_manual'),
  fsmOfficial('fsm_official'),
  repairGuide('repair_guide');

  const DocumentType(this.value);
  final String value;

  static DocumentType fromString(String value) {
    switch (value) {
      case 'user_upload':
        return DocumentType.userUpload;
      case 'bentley_manual':
        return DocumentType.bentleyManual;
      case 'haynes_manual':
        return DocumentType.haynesManual;
      case 'fsm_official':
        return DocumentType.fsmOfficial;
      case 'repair_guide':
        return DocumentType.repairGuide;
      default:
        return DocumentType.userUpload;
    }
  }

  String get displayName {
    switch (this) {
      case DocumentType.userUpload:
        return 'User Upload';
      case DocumentType.bentleyManual:
        return 'Bentley Manual';
      case DocumentType.haynesManual:
        return 'Haynes Manual';
      case DocumentType.fsmOfficial:
        return 'Factory Service Manual';
      case DocumentType.repairGuide:
        return 'Repair Guide';
    }
  }

  IconData get icon {
    switch (this) {
      case DocumentType.userUpload:
        return Icons.upload_file;
      case DocumentType.bentleyManual:
        return Icons.directions_car_filled;
      case DocumentType.haynesManual:
        return Icons.build;
      case DocumentType.fsmOfficial:
        return Icons.factory;
      case DocumentType.repairGuide:
        return Icons.handyman;
    }
  }

  Color get color {
    switch (this) {
      case DocumentType.userUpload:
        return Colors.blue;
      case DocumentType.bentleyManual:
        return Colors.green;
      case DocumentType.haynesManual:
        return Colors.orange;
      case DocumentType.fsmOfficial:
        return Colors.purple;
      case DocumentType.repairGuide:
        return Colors.teal;
    }
  }
}

enum DocumentStatus {
  processing('processing'),
  ready('ready'),
  error('error');

  const DocumentStatus(this.value);
  final String value;

  static DocumentStatus fromString(String value) {
    switch (value) {
      case 'processing':
        return DocumentStatus.processing;
      case 'ready':
        return DocumentStatus.ready;
      case 'error':
        return DocumentStatus.error;
      default:
        return DocumentStatus.processing;
    }
  }

  String get displayName {
    switch (this) {
      case DocumentStatus.processing:
        return 'Processing';
      case DocumentStatus.ready:
        return 'Ready';
      case DocumentStatus.error:
        return 'Error';
    }
  }

  IconData get icon {
    switch (this) {
      case DocumentStatus.processing:
        return Icons.hourglass_empty;
      case DocumentStatus.ready:
        return Icons.check_circle;
      case DocumentStatus.error:
        return Icons.error;
    }
  }

  Color get color {
    switch (this) {
      case DocumentStatus.processing:
        return Colors.orange;
      case DocumentStatus.ready:
        return Colors.green;
      case DocumentStatus.error:
        return Colors.red;
    }
  }
}

class DocumentMetadata {
  final String id;
  final String? userId;
  final String title;
  final String filename;
  final DocumentType documentType;
  final String? carMake;
  final String? carModel;
  final int? carYear;
  final String? carEngine;
  final int fileSize;
  final int? pageCount;
  final DocumentStatus status;
  final DateTime? uploadDate;
  final DateTime? processedDate;
  final String? errorMessage;
  final List<String> tags;
  final bool isPublic;

  DocumentMetadata({
    required this.id,
    this.userId,
    required this.title,
    required this.filename,
    required this.documentType,
    this.carMake,
    this.carModel,
    this.carYear,
    this.carEngine,
    required this.fileSize,
    this.pageCount,
    required this.status,
    this.uploadDate,
    this.processedDate,
    this.errorMessage,
    required this.tags,
    required this.isPublic,
  });

  factory DocumentMetadata.fromJson(Map<String, dynamic> json) {
    return DocumentMetadata(
      id: json['id'],
      userId: json['user_id'],
      title: json['title'],
      filename: json['filename'],
      documentType: DocumentType.fromString(json['document_type']),
      carMake: json['car_make'],
      carModel: json['car_model'],
      carYear: json['car_year'],
      carEngine: json['car_engine'],
      fileSize: json['file_size'],
      pageCount: json['page_count'],
      status: DocumentStatus.fromString(json['status']),
      uploadDate: json['upload_date'] != null
          ? DateTime.parse(json['upload_date'])
          : null,
      processedDate: json['processed_date'] != null
          ? DateTime.parse(json['processed_date'])
          : null,
      errorMessage: json['error_message'],
      tags: List<String>.from(json['tags'] ?? []),
      isPublic: json['is_public'] ?? false,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'user_id': userId,
      'title': title,
      'filename': filename,
      'document_type': documentType.value,
      'car_make': carMake,
      'car_model': carModel,
      'car_year': carYear,
      'car_engine': carEngine,
      'file_size': fileSize,
      'page_count': pageCount,
      'status': status.value,
      'upload_date': uploadDate?.toIso8601String(),
      'processed_date': processedDate?.toIso8601String(),
      'error_message': errorMessage,
      'tags': tags,
      'is_public': isPublic,
    };
  }

  String get carInfo {
    final parts = <String>[];
    if (carMake != null) parts.add(carMake!);
    if (carModel != null) parts.add(carModel!);
    if (carYear != null) parts.add(carYear.toString());
    return parts.join(' ');
  }

  String get fileSizeFormatted {
    if (fileSize < 1024) return '$fileSize B';
    if (fileSize < 1024 * 1024)
      return '${(fileSize / 1024).toStringAsFixed(1)} KB';
    return '${(fileSize / (1024 * 1024)).toStringAsFixed(1)} MB';
  }

  bool get isSystemDocument => userId == null;
  bool get isUserDocument => userId != null;
}

class DocumentSearchResult {
  final String content;
  final DocumentMetadata metadata;
  final double relevanceScore;
  final int? pageNumber;

  DocumentSearchResult({
    required this.content,
    required this.metadata,
    required this.relevanceScore,
    this.pageNumber,
  });

  factory DocumentSearchResult.fromJson(Map<String, dynamic> json) {
    return DocumentSearchResult(
      content: json['content'],
      metadata: DocumentMetadata.fromJson(json['metadata']),
      relevanceScore: (json['relevance_score'] as num).toDouble(),
      pageNumber: json['page_number'],
    );
  }

  String get snippet {
    const maxLength = 150;
    if (content.length <= maxLength) return content;
    return '${content.substring(0, maxLength)}...';
  }
}

class UserDocumentStats {
  final int totalDocuments;
  final Map<String, int> documentsByType;
  final double storageUsedMb;
  final double maxStorageMb;
  final bool canUploadMore;

  UserDocumentStats({
    required this.totalDocuments,
    required this.documentsByType,
    required this.storageUsedMb,
    required this.maxStorageMb,
    required this.canUploadMore,
  });

  factory UserDocumentStats.fromJson(Map<String, dynamic> json) {
    return UserDocumentStats(
      totalDocuments: json['total_documents'],
      documentsByType: Map<String, int>.from(json['documents_by_type'] ?? {}),
      storageUsedMb: (json['storage_used_mb'] as num).toDouble(),
      maxStorageMb: (json['max_storage_mb'] as num).toDouble(),
      canUploadMore: json['can_upload_more'],
    );
  }

  double get storageUsagePercent {
    if (maxStorageMb == 0) return 0;
    return (storageUsedMb / maxStorageMb * 100).clamp(0, 100);
  }

  String get storageUsageText {
    return '${storageUsedMb.toStringAsFixed(1)} MB / ${maxStorageMb.toStringAsFixed(0)} MB';
  }

  bool get isNearLimit => storageUsagePercent > 80;
  bool get isAtLimit => storageUsagePercent >= 100;
}

class DocumentUploadResult {
  final bool isSuccess;
  final DocumentMetadata? document;
  final String? errorMessage;

  DocumentUploadResult.success(this.document)
      : isSuccess = true,
        errorMessage = null;

  DocumentUploadResult.error(this.errorMessage)
      : isSuccess = false,
        document = null;
}

class DocumentSource {
  final String title;
  final DocumentType type;
  final double relevanceScore;
  final String snippet;

  DocumentSource({
    required this.title,
    required this.type,
    required this.relevanceScore,
    required this.snippet,
  });

  static List<DocumentSource> parseFromResponse(String response) {
    // Parse sources from GPT response that includes source attribution
    final sources = <DocumentSource>[];
    final lines = response.split('\n');

    for (int i = 0; i < lines.length; i++) {
      final line = lines[i];
      if (line.startsWith('Source ') &&
          line.contains('[') &&
          line.contains(']')) {
        try {
          // Extract source information from response
          final sourceMatch =
              RegExp(r'Source \d+: \[([^\]]+)\] \(Score: ([\d.]+)\)')
                  .firstMatch(line);
          if (sourceMatch != null) {
            final sourceInfo = sourceMatch.group(1)!;
            final score = double.parse(sourceMatch.group(2)!);

            // Extract document type and title
            String type = 'user_upload';
            String title = sourceInfo;

            if (sourceInfo.contains(':')) {
              final parts = sourceInfo.split(':');
              type = parts[0].toLowerCase().replaceAll(' ', '_');
              title = parts[1].trim();
            } else {
              type = sourceInfo.toLowerCase().replaceAll(' ', '_');
            }

            // Get snippet from next few lines
            String snippet = '';
            for (int j = i + 1; j < lines.length && j < i + 4; j++) {
              if (lines[j].trim().isNotEmpty &&
                  !lines[j].startsWith('Source ')) {
                snippet += '${lines[j].trim()} ';
              }
            }

            sources.add(DocumentSource(
              title: title,
              type: DocumentType.fromString(type),
              relevanceScore: score,
              snippet: snippet.trim(),
            ));
          }
        } catch (e) {
          // Ignore parsing errors
        }
      }
    }

    return sources;
  }
}
