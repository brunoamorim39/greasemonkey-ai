import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import 'package:flutter_dotenv/flutter_dotenv.dart';
import '../models/document.dart';

class DocumentService {
  static String get backendUrl => dotenv.env['BACKEND_URL'] ?? 'http://localhost:8000';
  static String get apiKey => dotenv.env['API_KEY'] ?? 'your-secure-api-key-here';

  /// Upload a PDF document for a user
  static Future<DocumentUploadResult> uploadDocument({
    required String userId,
    required File pdfFile,
    required String title,
    String? carMake,
    String? carModel,
    int? carYear,
    String? carEngine,
    List<String>? tags,
  }) async {
    try {
      final uri = Uri.parse('$backendUrl/documents/upload');
      final request = http.MultipartRequest('POST', uri);

      // Add headers
      request.headers['x-api-key'] = apiKey;

      // Add file
      request.files.add(await http.MultipartFile.fromPath('file', pdfFile.path));

      // Add form fields
      request.fields['user_id'] = userId;
      request.fields['title'] = title;
      if (carMake != null) request.fields['car_make'] = carMake;
      if (carModel != null) request.fields['car_model'] = carModel;
      if (carYear != null) request.fields['car_year'] = carYear.toString();
      if (carEngine != null) request.fields['car_engine'] = carEngine;
      if (tags != null && tags.isNotEmpty) {
        request.fields['tags'] = tags.join(',');
      }
      request.fields['is_public'] = 'false'; // Always private

      final response = await request.send();
      final responseBody = await response.stream.bytesToString();

      if (response.statusCode == 200) {
        final data = json.decode(responseBody);
        return DocumentUploadResult.success(DocumentMetadata.fromJson(data));
      } else {
        final error = json.decode(responseBody);
        return DocumentUploadResult.error(error['detail'] ?? 'Upload failed');
      }
    } catch (e) {
      return DocumentUploadResult.error('Network error: $e');
    }
  }

  /// Get user's document statistics
  static Future<UserDocumentStats?> getUserStats(String userId) async {
    try {
      final uri = Uri.parse('$backendUrl/documents/stats/$userId');
      final response = await http.get(
        uri,
        headers: {
          'x-api-key': apiKey,
        },
      );

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        return UserDocumentStats.fromJson(data);
      }
      return null;
    } catch (e) {
      print('Error getting user stats: $e');
      return null;
    }
  }

  /// Get list of user's documents
  static Future<List<DocumentMetadata>> getUserDocuments(String userId) async {
    try {
      final uri = Uri.parse('$backendUrl/documents/list/$userId');
      final response = await http.get(
        uri,
        headers: {
          'x-api-key': apiKey,
        },
      );

      if (response.statusCode == 200) {
        final List<dynamic> data = json.decode(response.body);
        return data.map((doc) => DocumentMetadata.fromJson(doc)).toList();
      }
      return [];
    } catch (e) {
      print('Error getting user documents: $e');
      return [];
    }
  }

  /// Search through documents
  static Future<List<DocumentSearchResult>> searchDocuments({
    required String userId,
    required String query,
    String? carMake,
    String? carModel,
    int? carYear,
    List<String>? documentTypes,
    int limit = 5,
  }) async {
    try {
      final uri = Uri.parse('$backendUrl/documents/search');

      final requestBody = {
        'user_id': userId,
        'query': query,
        'limit': limit,
      };

      if (carMake != null) requestBody['car_make'] = carMake;
      if (carModel != null) requestBody['car_model'] = carModel;
      if (carYear != null) requestBody['car_year'] = carYear;
      if (documentTypes != null) requestBody['document_types'] = documentTypes;

      final response = await http.post(
        uri,
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
        },
        body: json.encode(requestBody),
      );

      if (response.statusCode == 200) {
        final List<dynamic> data = json.decode(response.body);
        return data.map((result) => DocumentSearchResult.fromJson(result)).toList();
      }
      return [];
    } catch (e) {
      print('Error searching documents: $e');
      return [];
    }
  }

  /// Delete a document
  static Future<bool> deleteDocument(String documentId, String userId) async {
    try {
      final uri = Uri.parse('$backendUrl/documents/$documentId?user_id=$userId');
      final response = await http.delete(
        uri,
        headers: {
          'x-api-key': apiKey,
        },
      );

      return response.statusCode == 200;
    } catch (e) {
      print('Error deleting document: $e');
      return false;
    }
  }

  /// Get download URL for a document
  static Future<String?> getDownloadUrl(String documentId, String userId) async {
    try {
      final uri = Uri.parse('$backendUrl/documents/$documentId/download?user_id=$userId');
      final response = await http.get(
        uri,
        headers: {
          'x-api-key': apiKey,
        },
      );

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        return data['download_url'];
      }
      return null;
    } catch (e) {
      print('Error getting download URL: $e');
      return null;
    }
  }

  /// Download a document file
  static Future<bool> downloadDocument(String documentId, String userId, String filename) async {
    try {
      final downloadUrl = await getDownloadUrl(documentId, userId);
      if (downloadUrl == null) return false;

      final response = await http.get(Uri.parse(downloadUrl));
      if (response.statusCode != 200) return false;

      // TODO: Implement platform-specific file saving
      // For now, this is a placeholder that indicates success
      return true;
    } catch (e) {
      print('Error downloading document: $e');
      return false;
    }
  }

  /// Check if user can upload more documents
  static Future<bool> canUserUpload(String userId) async {
    final stats = await getUserStats(userId);
    return stats?.canUploadMore ?? false;
  }

  /// Get readable file size
  static String formatFileSize(int bytes) {
    if (bytes < 1024) return '$bytes B';
    if (bytes < 1024 * 1024) return '${(bytes / 1024).toStringAsFixed(1)} KB';
    return '${(bytes / (1024 * 1024)).toStringAsFixed(1)} MB';
  }

  /// Get document type display name
  static String getDocumentTypeDisplayName(String type) {
    switch (type) {
      case 'user_upload':
        return 'User Upload';
      case 'bentley_manual':
        return 'Bentley Manual';
      case 'haynes_manual':
        return 'Haynes Manual';
      case 'fsm_official':
        return 'Factory Service Manual';
      case 'repair_guide':
        return 'Repair Guide';
      default:
        return type.replaceAll('_', ' ').split(' ').map((word) =>
          word.isNotEmpty ? word[0].toUpperCase() + word.substring(1) : word
        ).join(' ');
    }
  }
}
