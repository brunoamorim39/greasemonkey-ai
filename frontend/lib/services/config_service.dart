import 'package:flutter/foundation.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'in_app_purchase_service.dart';

class ConfigService {
  static final ConfigService _instance = ConfigService._internal();
  factory ConfigService() => _instance;
  ConfigService._internal();

  bool _initialized = false;

  Future<void> initialize() async {
    if (_initialized) return;

    try {
      // Load environment variables
      await dotenv.load(fileName: ".env");

      // Get backend configuration
      final backendUrl = dotenv.env['BACKEND_URL'] ?? _getDefaultBackendUrl();
      final apiKey = dotenv.env['API_KEY'];

      debugPrint('Configuring backend URL: $backendUrl');

      // Configure the in-app purchase service
      InAppPurchaseService().configure(
        backendUrl: backendUrl,
        apiKey: apiKey,
      );

      _initialized = true;
      debugPrint('Configuration service initialized');
    } catch (e) {
      debugPrint('Error initializing configuration: $e');
      // Fallback to default configuration
      _initializeWithDefaults();
    }
  }

  void _initializeWithDefaults() {
    final backendUrl = _getDefaultBackendUrl();

    debugPrint('Using default backend URL: $backendUrl');

    InAppPurchaseService().configure(
      backendUrl: backendUrl,
    );

    _initialized = true;
  }

  String _getDefaultBackendUrl() {
    // Default backend URLs based on environment
    if (kDebugMode) {
      // Development - adjust this to your local backend
      return 'http://localhost:8000';
    } else {
      // Production - replace with your actual production backend URL
      return 'https://your-production-backend.com';
    }
  }

  String? get backendUrl {
    if (!_initialized) {
      throw StateError('ConfigService not initialized. Call initialize() first.');
    }
    return dotenv.env['BACKEND_URL'] ?? _getDefaultBackendUrl();
  }

  String? get apiKey {
    if (!_initialized) {
      throw StateError('ConfigService not initialized. Call initialize() first.');
    }
    return dotenv.env['API_KEY'];
  }

  bool get isInitialized => _initialized;
}
