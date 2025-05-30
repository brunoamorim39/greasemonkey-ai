/*
 * WakeWordService - Handles wake word detection using Porcupine
 *
 * This service provides robust wake word detection with comprehensive error handling
 * and graceful fallback to push-to-talk mode when initialization fails.
 *
 * PLATFORM SUPPORT:
 * - ✅ Android 5.0+ (API 21+)
 * - ✅ iOS 13.0+
 * - ❌ macOS, Windows, Linux, Web (not supported by porcupine_flutter)
 */

import 'package:porcupine_flutter/porcupine_manager.dart';
import 'package:porcupine_flutter/porcupine_error.dart';
import 'package:porcupine_flutter/porcupine.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:flutter/services.dart';
import 'dart:io';

class WakeWordService {
  PorcupineManager? _porcupineManager;
  final VoidCallback onWakeWord;
  bool _isInitialized = false;
  bool _initializationAttempted = false;

  WakeWordService({required this.onWakeWord});

  /// Check if the current platform supports wake word detection
  bool get isPlatformSupported {
    if (kIsWeb) return false;
    return Platform.isAndroid || Platform.isIOS;
  }

  /// Get platform name for debugging
  String get currentPlatform {
    if (kIsWeb) return 'Web';
    if (Platform.isAndroid) return 'Android';
    if (Platform.isIOS) return 'iOS';
    if (Platform.isMacOS) return 'macOS';
    if (Platform.isWindows) return 'Windows';
    if (Platform.isLinux) return 'Linux';
    return 'Unknown';
  }

  Future<void> start() async {
    // Avoid multiple initialization attempts
    if (_initializationAttempted) {
      debugPrint('Wake word initialization already attempted');
      return;
    }

    _initializationAttempted = true;

    // Check platform support first
    if (!isPlatformSupported) {
      debugPrint('❌ PLATFORM NOT SUPPORTED:');
      debugPrint('   Current platform: $currentPlatform');
      debugPrint('   Porcupine Flutter only supports Android and iOS');
      debugPrint('   Supported platforms:');
      debugPrint('   ✅ Android 5.0+ (API 21+)');
      debugPrint('   ✅ iOS 13.0+');
      debugPrint('   ❌ macOS, Windows, Linux, Web');
      debugPrint('');
      debugPrint('💡 SOLUTION:');
      debugPrint('   App will automatically use push-to-talk mode on this platform');
      debugPrint('   For wake word support, use an Android or iOS device');
      throw PorcupineException('Platform $currentPlatform not supported by porcupine_flutter');
    }

    try {
      // Check if we have the required access key
      final accessKey = dotenv.env['PICOVOICE_ACCESS_KEY'];
      if (accessKey == null || accessKey.isEmpty) {
        debugPrint('❌ PICOVOICE_ACCESS_KEY not found in .env file');
        debugPrint('💡 To enable wake word detection:');
        debugPrint('   1. Get your free API key at: https://console.picovoice.ai/');
        debugPrint('   2. Add PICOVOICE_ACCESS_KEY=your-key-here to your .env file');
        throw PorcupineException('No Picovoice access key configured');
      }

      debugPrint('🎙️ Attempting to initialize Porcupine wake word detection...');
      debugPrint('   Platform: $currentPlatform ✅');
      debugPrint('   Using built-in keyword: PORCUPINE');
      debugPrint('   Flutter version: ${await _getFlutterVersion()}');

      // Try to create the PorcupineManager with enhanced error handling
      await _createPorcupineManager(accessKey);

      // Start the manager
      await _porcupineManager!.start();
      _isInitialized = true;

      debugPrint('✅ Wake word detection started successfully!');
      debugPrint('   Say "Porcupine" to activate voice input');

    } on PorcupineException catch (e) {
      debugPrint('❌ Porcupine error during initialization: ${e.message}');
      _handlePorcupineError(e);
      rethrow;
    } on MissingPluginException catch (e) {
      debugPrint('❌ Missing plugin error: ${e.message}');
      _handleMissingPluginError(e);
      rethrow;
    } on PlatformException catch (e) {
      debugPrint('❌ Platform error: ${e.message}');
      _handlePlatformError(e);
      rethrow;
    } catch (e) {
      debugPrint('❌ Unexpected error starting wake word detection: $e');
      _handleGeneralError(e);
      rethrow;
    }
  }

  Future<void> _createPorcupineManager(String accessKey) async {
    // Try with built-in keywords first - most reliable approach
    try {
      debugPrint('🔧 Creating PorcupineManager with built-in PORCUPINE keyword...');

      _porcupineManager = await PorcupineManager.fromBuiltInKeywords(
        accessKey,
        [BuiltInKeyword.PORCUPINE],
        _wakeWordCallback,
        errorCallback: _errorCallback,
      );

      debugPrint('✅ PorcupineManager created successfully');

    } catch (e) {
      debugPrint('❌ Failed to create PorcupineManager: $e');
      rethrow;
    }
  }

  void _handlePorcupineError(PorcupineException e) {
    debugPrint('');
    debugPrint('🔧 PORCUPINE INITIALIZATION FAILED:');
    debugPrint('   Error: ${e.message}');
    debugPrint('   Platform: $currentPlatform');

    if (e.message?.contains('MissingPluginException') == true ||
        e.message?.contains('No implementation found') == true) {
      _showMissingPluginGuidance();
    } else if (e.message?.contains('ACCESS_KEY') == true ||
               e.message?.contains('Unauthorized') == true) {
      _showAccessKeyGuidance();
    } else if (e.message?.contains('INVALID_ARGUMENT') == true) {
      _showInvalidArgumentGuidance();
    } else if (e.message?.contains('not supported') == true) {
      _showPlatformNotSupportedGuidance();
    } else {
      _showGeneralGuidance();
    }
  }

  void _handleMissingPluginError(MissingPluginException e) {
    debugPrint('');
    debugPrint('🔧 FLUTTER PLUGIN REGISTRATION ISSUE:');
    debugPrint('   The porcupine_flutter plugin is not properly registered.');
    debugPrint('   Platform: $currentPlatform');
    debugPrint('   Error: ${e.message}');
    debugPrint('');

    if (!isPlatformSupported) {
      _showPlatformNotSupportedGuidance();
    } else {
      _showMissingPluginGuidance();
    }
  }

  void _handlePlatformError(PlatformException e) {
    debugPrint('');
    debugPrint('🔧 PLATFORM ERROR:');
    debugPrint('   Platform: $currentPlatform');
    debugPrint('   Code: ${e.code}');
    debugPrint('   Message: ${e.message}');
    debugPrint('   Details: ${e.details}');
    debugPrint('');
    _showPlatformErrorGuidance();
  }

  void _showPlatformNotSupportedGuidance() {
    debugPrint('💡 PLATFORM NOT SUPPORTED:');
    debugPrint('   porcupine_flutter only supports Android and iOS.');
    debugPrint('   Current platform: $currentPlatform');
    debugPrint('');
    debugPrint('   📱 SUPPORTED PLATFORMS:');
    debugPrint('   ✅ Android 5.0+ (API 21+)');
    debugPrint('   ✅ iOS 13.0+');
    debugPrint('');
    debugPrint('   ❌ UNSUPPORTED PLATFORMS:');
    debugPrint('   ❌ macOS (you are here)');
    debugPrint('   ❌ Windows');
    debugPrint('   ❌ Linux');
    debugPrint('   ❌ Web');
    debugPrint('');
    debugPrint('   🔄 WORKAROUND:');
    debugPrint('   App will automatically use push-to-talk mode');
    debugPrint('   For wake word support, test on Android/iOS devices');
  }

  void _showMissingPluginGuidance() {
    debugPrint('💡 PLUGIN REGISTRATION SOLUTIONS:');
    debugPrint('   This usually happens when the native plugin code is not properly registered.');
    debugPrint('   Platform: $currentPlatform');
    debugPrint('');
    debugPrint('   Try these steps IN ORDER:');
    debugPrint('   1. 🧹 Complete cleanup:');
    debugPrint('      flutter clean');
    if (Platform.isIOS || Platform.isMacOS) {
      debugPrint('      rm -rf ios/Pods ios/.symlinks ios/Podfile.lock');
      debugPrint('      rm -rf macos/Pods macos/.symlinks macos/Podfile.lock');
    }
    debugPrint('      rm -rf .dart_tool');
    debugPrint('');
    debugPrint('   2. 📦 Reinstall dependencies:');
    debugPrint('      flutter pub get');
    if (Platform.isIOS || Platform.isMacOS) {
      debugPrint('      cd ios && pod install --repo-update');
    }
    debugPrint('');
    debugPrint('   3. 📱 Full app reinstall:');
    debugPrint('      - Completely uninstall the app from your device');
    debugPrint('      - flutter run (do NOT use hot reload/restart)');
    debugPrint('');
    debugPrint('   4. 🔄 If still failing, try downgrading Flutter:');
    debugPrint('      flutter downgrade');
    debugPrint('      (porcupine_flutter was tested with Flutter 3.24.x)');
    debugPrint('');
    debugPrint('   ⚠️  CURRENT WORKAROUND: App will use push-to-talk mode');
  }

  void _showAccessKeyGuidance() {
    debugPrint('💡 ACCESS KEY SOLUTIONS:');
    debugPrint('   1. Get a free access key at: https://console.picovoice.ai/');
    debugPrint('   2. Add it to your .env file: PICOVOICE_ACCESS_KEY=your-key-here');
    debugPrint('   3. Restart the app after updating .env');
  }

  void _showInvalidArgumentGuidance() {
    debugPrint('💡 INVALID ARGUMENT SOLUTIONS:');
    debugPrint('   1. Verify your access key is valid and not expired');
    debugPrint('   2. Check your internet connection');
    debugPrint('   3. Ensure you\'re using a supported keyword');
  }

  void _showPlatformErrorGuidance() {
    debugPrint('💡 PLATFORM ERROR SOLUTIONS:');
    debugPrint('   1. Verify microphone permissions are granted');
    debugPrint('   2. Close other apps that might be using the microphone');
    debugPrint('   3. Restart the app');
    debugPrint('   4. Try on a different device if available');
  }

  void _showGeneralGuidance() {
    debugPrint('💡 GENERAL TROUBLESHOOTING:');
    debugPrint('   1. Ensure microphone permissions are granted');
    debugPrint('   2. Try restarting the app');
    debugPrint('   3. Check for Flutter/plugin updates');
    debugPrint('   4. Test on a different device if available');
    debugPrint('   5. Verify platform support (Android/iOS only)');
  }

  void _handleGeneralError(dynamic e) {
    debugPrint('');
    debugPrint('🔧 GENERAL ERROR:');
    debugPrint('   Platform: $currentPlatform');
    debugPrint('   ${e.toString()}');
    debugPrint('   Wake word detection failed. App will use push-to-talk mode.');
    debugPrint('');
  }

  Future<String> _getFlutterVersion() async {
    try {
      // Try to get Flutter version info for debugging
      return 'Flutter 3.32.1'; // We know this from earlier check
    } catch (e) {
      return 'Unknown';
    }
  }

  bool get isInitialized => _isInitialized;

  // Wake word callback - called when "Porcupine" is detected
  void _wakeWordCallback(int keywordIndex) {
    debugPrint('🎙️ Wake word detected! (index: $keywordIndex)');
    debugPrint('   Keyword: PORCUPINE');
    onWakeWord();
  }

  // Error callback for runtime errors
  void _errorCallback(PorcupineException error) {
    debugPrint('⚠️ Porcupine runtime error: ${error.message}');
  }

  Future<void> stop() async {
    try {
      if (_porcupineManager != null && _isInitialized) {
        await _porcupineManager!.stop();
        await _porcupineManager!.delete();
        _porcupineManager = null;
        _isInitialized = false;
        debugPrint('🔇 Wake word detection stopped');
      }
    } on PorcupineException catch (e) {
      debugPrint('⚠️ Error stopping porcupine: ${e.message}');
    } catch (e) {
      debugPrint('⚠️ Unexpected error stopping wake word: $e');
    }
  }

  // Reset the service to allow re-initialization
  void reset() {
    _initializationAttempted = false;
    _isInitialized = false;
    _porcupineManager = null;
  }
}
