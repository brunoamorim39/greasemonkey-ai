import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:record/record.dart';
import 'package:path_provider/path_provider.dart';
import 'package:permission_handler/permission_handler.dart';

class AudioRecordingService {
  final AudioRecorder _recorder = AudioRecorder();
  bool _isRecording = false;
  String? _currentRecordingPath;

  // Check if platform needs explicit permission handling
  bool get _needsExplicitPermissions => !kIsWeb && !Platform.isMacOS;

  bool get isRecording => _isRecording;
  String? get currentRecordingPath => _currentRecordingPath;

  /// Check if microphone permission is granted
  Future<bool> hasPermission() async {
    if (!_needsExplicitPermissions) {
      // On web and macOS, permissions are handled differently
      return await _recorder.hasPermission();
    }

    // For mobile platforms, use permission_handler
    final status = await Permission.microphone.status;
    return status.isGranted;
  }

  /// Request microphone permission
  Future<bool> requestPermission() async {
    if (!_needsExplicitPermissions) {
      // On web, the browser will handle permission requests
      // On macOS, permissions are granted via entitlements
      return await _recorder.hasPermission();
    }

    // For mobile platforms
    final status = await Permission.microphone.request();
    return status.isGranted;
  }

  /// Start recording to a file
  Future<bool> startRecording() async {
    if (_isRecording) {
      debugPrint('Already recording');
      return false;
    }

    try {
      // Check permission
      if (!await hasPermission()) {
        final granted = await requestPermission();
        if (!granted) {
          debugPrint('Microphone permission denied');
          return false;
        }
      }

      // Generate file path
      String audioPath;
      if (kIsWeb) {
        // On web, the record package handles file management
        audioPath = 'query.wav';
      } else {
        final dir = await getTemporaryDirectory();
        audioPath = '${dir.path}/query_${DateTime.now().millisecondsSinceEpoch}.wav';
      }

      // Configure recording
      const config = RecordConfig(
        encoder: AudioEncoder.wav,
        bitRate: 128000,
        sampleRate: 44100,
        numChannels: 1,
      );

      // Start recording
      await _recorder.start(config, path: audioPath);

      _isRecording = true;
      _currentRecordingPath = audioPath;

      debugPrint('Started recording to: $audioPath');
      return true;
    } catch (e) {
      debugPrint('Failed to start recording: $e');
      _isRecording = false;
      _currentRecordingPath = null;
      return false;
    }
  }

  /// Stop recording and return the file path
  Future<String?> stopRecording() async {
    if (!_isRecording) {
      debugPrint('Not currently recording');
      return null;
    }

    try {
      final path = await _recorder.stop();
      _isRecording = false;

      debugPrint('Stopped recording. File saved to: $path');

      // Return the path (either the one we specified or the one returned by the recorder)
      final finalPath = path ?? _currentRecordingPath;
      _currentRecordingPath = null;

      return finalPath;
    } catch (e) {
      debugPrint('Failed to stop recording: $e');
      _isRecording = false;
      _currentRecordingPath = null;
      return null;
    }
  }

  /// Cancel current recording
  Future<void> cancelRecording() async {
    if (!_isRecording) return;

    try {
      await _recorder.cancel();
      _isRecording = false;
      _currentRecordingPath = null;
      debugPrint('Recording cancelled');
    } catch (e) {
      debugPrint('Failed to cancel recording: $e');
      _isRecording = false;
      _currentRecordingPath = null;
    }
  }

  /// Get current amplitude (if supported)
  Future<double?> getAmplitude() async {
    if (!_isRecording) return null;

    try {
      final amplitude = await _recorder.getAmplitude();
      return amplitude.current;
    } catch (e) {
      debugPrint('Failed to get amplitude: $e');
      return null;
    }
  }

  /// Check if the device supports recording
  Future<bool> isRecordingSupported() async {
    try {
      return await _recorder.hasPermission();
    } catch (e) {
      debugPrint('Error checking recording support: $e');
      return false;
    }
  }

  /// Dispose the recorder
  void dispose() {
    _recorder.dispose();
  }
}
