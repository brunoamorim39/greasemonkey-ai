import 'package:flutter/foundation.dart';
import 'dart:async';
import 'dart:html' as html;
import 'dart:js' as js;
import 'package:flutter_dotenv/flutter_dotenv.dart';

// Web implementation for WakeWordService using Web Speech API
class WakeWordService {
  final VoidCallback onWakeWord;
  bool _isInitialized = false;
  bool _isListening = false;
  js.JsObject? _speechRecognition;
  Timer? _restartTimer;

  WakeWordService({required this.onWakeWord});

  bool get isInitialized => _isInitialized;
  bool get isListening => _isListening;

  Future<void> start() async {
    if (_isListening) {
      debugPrint('Wake word service already listening');
      return;
    }

    try {
      debugPrint('🎙️ Initializing wake word detection: "Hey GreaseMonkey"');

      // Check if Web Speech API is supported
      if (!_isSpeechRecognitionSupported()) {
        throw Exception('Speech recognition not supported in this browser');
      }

      // Request microphone permission
      await _requestMicrophonePermission();

      // Initialize speech recognition for wake word detection
      await _initializeSpeechRecognition();

      _isInitialized = true;
      _isListening = true;

      debugPrint('✅ Wake word detection started successfully!');
      debugPrint('   Say "Hey GreaseMonkey" to activate voice input');
    } catch (e) {
      debugPrint('❌ Failed to start wake word detection: $e');
      _isInitialized = false;
      _isListening = false;
      rethrow;
    }
  }

  bool _isSpeechRecognitionSupported() {
    return js.context.hasProperty('webkitSpeechRecognition') ||
        js.context.hasProperty('SpeechRecognition');
  }

  Future<void> _requestMicrophonePermission() async {
    try {
      final stream = await html.window.navigator.mediaDevices
          ?.getUserMedia({'audio': true});
      stream?.getTracks().forEach((track) => track.stop());
      debugPrint('✅ Microphone permission granted');
    } catch (e) {
      debugPrint('❌ Microphone permission denied: $e');
      throw Exception('Microphone permission required for wake word detection');
    }
  }

  Future<void> _initializeSpeechRecognition() async {
    try {
      // Create speech recognition instance using JS interop
      final SpeechRecognition = js.context['webkitSpeechRecognition'] ??
          js.context['SpeechRecognition'];
      _speechRecognition = js.JsObject(SpeechRecognition, []);

      // Configure recognition
      _speechRecognition!['continuous'] = true;
      _speechRecognition!['interimResults'] = true;
      _speechRecognition!['lang'] = 'en-US';

      // Set up event listeners
      _speechRecognition!['onresult'] = js.allowInterop((event) {
        _handleSpeechResult(event);
      });

      _speechRecognition!['onerror'] = js.allowInterop((error) {
        _handleSpeechError(error);
      });

      _speechRecognition!['onend'] = js.allowInterop((event) {
        _handleSpeechEnd();
      });

      // Start recognition
      _speechRecognition!.callMethod('start', []);
      debugPrint('🎤 Started continuous speech recognition for wake word');
    } catch (e) {
      throw Exception('Failed to initialize speech recognition: $e');
    }
  }

  void _handleSpeechResult(dynamic event) {
    try {
      final results = event['results'];
      if (results == null) return;

      // Check the most recent result
      final resultIndex = results['length'] - 1;
      if (resultIndex < 0) return;

      final result = results[resultIndex];
      final alternative = result[0];
      final transcript = alternative['transcript'].toString().toLowerCase();

      // Check for our custom wake word
      if (transcript.contains('hey greasemonkey') ||
          transcript.contains('hey grease monkey')) {
        debugPrint('🎯 Wake word detected: "Hey GreaseMonkey"');

        // Stop current recognition to avoid interference
        _speechRecognition?.callMethod('stop', []);

        // Trigger wake word callback
        onWakeWord();

        // Restart recognition after a brief delay
        _restartTimer = Timer(const Duration(seconds: 2), () {
          if (_isListening) {
            _speechRecognition?.callMethod('start', []);
          }
        });
      }
    } catch (e) {
      debugPrint('Error handling speech result: $e');
    }
  }

  void _handleSpeechError(dynamic error) {
    final errorType = error['error']?.toString() ?? 'unknown';
    debugPrint('Speech recognition error: $errorType');

    // Restart on certain errors
    if (errorType == 'no-speech' || errorType == 'audio-capture') {
      _restartRecognition();
    }
  }

  void _handleSpeechEnd() {
    debugPrint('Speech recognition ended, restarting...');

    // Automatically restart if we're still supposed to be listening
    if (_isListening) {
      _restartRecognition();
    }
  }

  void _restartRecognition() {
    _restartTimer?.cancel();
    _restartTimer = Timer(const Duration(milliseconds: 500), () {
      if (_isListening && _speechRecognition != null) {
        try {
          _speechRecognition!.callMethod('start', []);
        } catch (e) {
          debugPrint('Error restarting speech recognition: $e');
        }
      }
    });
  }

  Future<void> stop() async {
    if (!_isListening) return;

    try {
      _isListening = false;
      _restartTimer?.cancel();
      _speechRecognition?.callMethod('stop', []);
      debugPrint('🛑 Wake word detection stopped');
    } catch (e) {
      debugPrint('Error stopping wake word detection: $e');
    }
  }

  void dispose() {
    stop();
    _restartTimer?.cancel();
    _speechRecognition = null;
  }
}
