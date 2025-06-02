import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/services.dart';
import 'dart:async';
import 'dart:io' show File, Platform;
import 'package:path_provider/path_provider.dart';
import 'package:just_audio/just_audio.dart';
import 'package:provider/provider.dart';
import 'package:permission_handler/permission_handler.dart';
import '../services/api_service.dart';
import '../services/audio_recording_service.dart';
import '../services/usage_service.dart';
import '../services/wakeword_service_web.dart'
    if (dart.library.io) '../services/wakeword_service_mobile.dart';
import '../state/app_state.dart';
import '../models/vehicle.dart';
import '../main.dart';
import 'settings_screen.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:http/http.dart' as http;

class MainScreen extends StatefulWidget {
  const MainScreen({super.key});

  @override
  State<MainScreen> createState() => _MainScreenState();
}

class _MainScreenState extends State<MainScreen> {
  bool _isRecording = false;
  bool _isListening = false;
  bool _isPlayingTTS = false;
  AudioRecordingService? _audioService;
  String? _audioPath;
  final AudioPlayer _audioPlayer = AudioPlayer();
  bool _isLoading = false;
  double _playbackSpeed = 1.0;
  bool _autoPlay = true;
  bool _recorderInitialized = false;
  bool _permissionGranted = false;
  bool _permissionRequested = false;
  WakeWordService? _wakeWordService;
  final ScrollController _scrollController = ScrollController();

  // Web-specific additions
  final TextEditingController _textController = TextEditingController();
  final FocusNode _textFocusNode = FocusNode();
  bool _showTextInput = kIsWeb;

  // Helper to check if platform needs explicit permission handling
  bool get _needsExplicitPermissions => !kIsWeb;

  // Helper to check if wake word detection is supported on this platform
  bool get _isWakeWordSupported =>
      kIsWeb || Platform.isAndroid || Platform.isIOS;

  @override
  void initState() {
    super.initState();
    _initializeAudioService();
    _requestPermissions();
    _loadAudioSettings();
    _cleanupOldAudioFiles();

    // Add scroll listener for lazy loading
    _scrollController.addListener(_onScroll);

    // Web-specific keyboard shortcuts
    if (kIsWeb) {
      _setupWebKeyboardShortcuts();
    }

    // Listen to audio player state changes to ensure proper speed setting
    _audioPlayer.playerStateStream.listen((state) {
      if (state.playing && state.processingState == ProcessingState.ready) {
        // Ensure speed is applied when audio becomes ready
        _audioPlayer.setSpeed(_playbackSpeed).catchError((error) {
          debugPrint('Error setting playback speed: $error');
        });
      }

      // Handle TTS playback completion or stopping
      if (_isPlayingTTS) {
        if (state.processingState == ProcessingState.completed ||
            (!state.playing &&
                state.processingState == ProcessingState.ready)) {
          debugPrint('TTS playback completed or stopped');
          setState(() => _isPlayingTTS = false);
        }
      }
    });
  }

  Future<void> _initializeAudioService() async {
    _audioService = AudioRecordingService();

    // Check if recording is supported on this platform
    final isSupported = await _audioService!.isRecordingSupported();
    if (!isSupported && !kIsWeb) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
              'Audio recording is supported on this platform.',
              style: TextStyle(color: Colors.white),
            ),
            backgroundColor: Colors.green,
            duration: Duration(seconds: 4),
          ),
        );
      });
    }

    _recorderInitialized = isSupported;
    if (isSupported) {
      _initializeListeningMode();
    }
  }

  Future<void> _requestPermissions() async {
    if (_permissionRequested || _audioService == null) return;

    _permissionRequested = true;

    try {
      _permissionGranted = await _audioService!.hasPermission();

      if (!_permissionGranted) {
        _permissionGranted = await _audioService!.requestPermission();
      }
    } catch (e) {
      debugPrint('Permission request failed: $e');
      _permissionGranted = false;
    }

    setState(() {});
  }

  void _showPermissionDialog() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Microphone Permission Required'),
        content: const Text(
          'This app needs microphone access to record your voice questions. '
          'Please grant microphone permission in your device settings.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.of(context).pop();
              openAppSettings();
            },
            child: const Text('Settings'),
          ),
        ],
      ),
    );
  }

  Future<void> _loadAudioSettings() async {
    final prefs = await SharedPreferences.getInstance();
    setState(() {
      _playbackSpeed = prefs.getDouble('playback_speed') ?? 1.0;
      _autoPlay = prefs.getBool('auto_play') ?? true;
    });
  }

  Future<void> _refreshAudioSettings() async {
    await _loadAudioSettings();

    // If audio is currently playing, update its speed immediately
    if (_isPlayingTTS && _audioPlayer.playing) {
      try {
        await _audioPlayer.setSpeed(_playbackSpeed);
        debugPrint('Updated playback speed to: $_playbackSpeed');
      } catch (e) {
        debugPrint('Error updating playback speed: $e');
      }
    }
  }

  /// Clean up old temporary TTS audio files (older than 24 hours)
  Future<void> _cleanupOldAudioFiles() async {
    try {
      final tempDir = await getTemporaryDirectory();
      final files = tempDir.listSync();
      final now = DateTime.now();

      for (final file in files) {
        if (file is File && file.path.contains('tts_')) {
          final stat = await file.stat();
          final age = now.difference(stat.modified);

          // Delete files older than 24 hours
          if (age.inHours > 24) {
            await file.delete();
            debugPrint('Cleaned up old TTS file: ${file.path}');
          }
        }
      }
    } catch (e) {
      debugPrint('Error cleaning up old audio files: $e');
    }
  }

  void _initializeListeningMode() {
    final appState = Provider.of<AppState>(context, listen: false);

    // If wake word is not supported on this platform, ensure we're in push-to-talk mode
    if (!_isWakeWordSupported) {
      if (!appState.isPushToTalkMode) {
        debugPrint(
            '🔄 Auto-switching to push-to-talk mode - wake word not supported on this platform');
        appState.togglePushToTalkMode();
      }
      return;
    }

    // Only start wake word listening if it's supported and we're not in push-to-talk mode
    if (!appState.isPushToTalkMode) {
      _startWakeWordListening();
    }
  }

  @override
  void dispose() {
    _audioService?.dispose();
    _audioPlayer.dispose();
    _scrollController.dispose();
    _wakeWordService?.dispose();
    super.dispose();
  }

  void _onScroll() {
    // Load more messages when scrolling near the top (for older messages)
    // Since reverse=true, scrolling up (towards older messages) means approaching maxScrollExtent
    if (_scrollController.hasClients &&
        _scrollController.position.pixels >=
            _scrollController.position.maxScrollExtent - 200 &&
        _scrollController.position.maxScrollExtent > 0) {
      final appState = Provider.of<AppState>(context, listen: false);
      // Only load if not already loading and there are more messages
      if (!appState.isLoadingMessages && appState.hasMoreMessages) {
        appState.loadMoreMessages();
      }
    }
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients &&
          _scrollController.position.maxScrollExtent > 0) {
        _scrollController.animateTo(
          0.0, // In reverse mode, 0.0 is the bottom (newest messages)
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    });
  }

  // Add a method to force scroll to bottom after a delay to ensure content is rendered
  void _forceScrollToBottom() {
    Future.delayed(const Duration(milliseconds: 100), () {
      if (_scrollController.hasClients &&
          _scrollController.position.maxScrollExtent > 0) {
        // Only scroll if we're not in the middle of a user scroll gesture
        final isUserScrolling =
            _scrollController.position.isScrollingNotifier.value;
        if (!isUserScrolling) {
          _scrollController.animateTo(
            0.0, // In reverse mode, 0.0 is the bottom (newest messages)
            duration: const Duration(milliseconds: 300),
            curve: Curves.easeOut,
          );
        }
      }
    });
  }

  Future<void> _onMainButtonPressed() async {
    final appState = Provider.of<AppState>(context, listen: false);

    if (_isLoading) return;

    if (!_permissionGranted && _needsExplicitPermissions) {
      await _requestPermissions();
      return;
    }

    // Force push-to-talk mode on unsupported platforms
    if (!_isWakeWordSupported && !appState.isPushToTalkMode) {
      appState.togglePushToTalkMode();
    }

    if (appState.isPushToTalkMode) {
      // In PTT mode, this button records audio
      if (!_isRecording) {
        await _startRecording();
      } else {
        await _stopRecordingAndQuery();
      }
    } else {
      // In wake word mode, this button toggles listening (only on supported platforms)
      if (_isListening) {
        await _stopWakeWordListening();
      } else {
        await _startWakeWordListening();
      }
    }
  }

  Future<void> _startWakeWordListening() async {
    if (!_isWakeWordSupported || !_permissionGranted) return;

    try {
      _wakeWordService ??= WakeWordService(
        onWakeWord: () {
          debugPrint('🎯 Wake word detected, starting recording...');
          _startRecording();
        },
      );

      await _wakeWordService!.start();
      setState(() => _isListening = true);
      debugPrint('✅ Wake word listening started');
    } catch (e) {
      debugPrint('❌ Failed to start wake word listening: $e');
      setState(() => _isListening = false);
    }
  }

  Future<void> _stopWakeWordListening() async {
    if (_wakeWordService != null) {
      try {
        await _wakeWordService!.stop();
        setState(() => _isListening = false);
        debugPrint('🛑 Wake word listening stopped');
      } catch (e) {
        debugPrint('❌ Error stopping wake word listening: $e');
      }
    }
  }

  Future<void> _startRecording() async {
    if (!_permissionGranted) {
      _permissionGranted = await _audioService!.requestPermission();
      if (!_permissionGranted) {
        _showError(
            'Microphone permission not granted. Please enable it in settings.');
        return;
      }
    }

    if (!_recorderInitialized || _audioService == null) {
      _showError('Microphone not available. Please check permissions.');
      return;
    }

    // Stop any currently playing TTS audio
    if (_isPlayingTTS) {
      await _audioPlayer.stop();
      setState(() => _isPlayingTTS = false);
      debugPrint('Stopped TTS playback to start recording');
    }

    try {
      final success = await _audioService!.startRecording();
      if (success) {
        setState(() => _isRecording = true);
      } else {
        _showError(
            'Failed to start recording. Please check microphone access.');
      }
    } catch (e) {
      _showError('Failed to start recording: $e');
    }
  }

  Future<void> _stopRecordingAndQuery() async {
    final appState = Provider.of<AppState>(context, listen: false);
    final userId = appState.userId ?? appState.hashCode.toString();
    final vehicle = appState.activeVehicle;

    try {
      final audioPath = await _audioService!.stopRecording();
      setState(() => _isRecording = false);

      if (audioPath == null) {
        _showError('Failed to save recording.');
        return;
      }

      _audioPath = audioPath;
    } catch (e) {
      setState(() => _isRecording = false);
      _showError('Failed to stop recording: $e');
      return;
    }

    if (_audioPath != null) {
      setState(() => _isLoading = true);

      final audioFile = File(_audioPath!);
      final text = await ApiService.transcribeAudio(audioFile);

      if (text == null || text.isEmpty) {
        setState(() => _isLoading = false);
        _showError('Could not transcribe audio.');
        return;
      }

      final answer = await ApiService.askQuestion(
        userId: userId,
        question: text,
        car: vehicle?.name,
        engine: vehicle?.engine,
        notes: vehicle?.notes,
        unitPreferences: appState.unitPreferences,
      );

      if (answer == null) {
        setState(() => _isLoading = false);
        _showError('Backend error.');
        return;
      }

      String audioUrl = answer['audio_url'] ?? '';

      if (vehicle == null) {
        await appState.addQueryToHistory({
          'question': text,
          'answer':
              'Before I answer, which car is this for? (Please set an active vehicle in your garage.)',
          'audio_url': '',
        });
      } else {
        debugPrint('Received audio URL from backend: $audioUrl');
        await appState.addQueryToHistory({
          'question': text,
          'answer': answer['answer'] ?? 'No answer',
          'audio_url': audioUrl,
        });

        // Track usage for analytics and billing
        await UsageService.trackQuestionUsage(
          userId,
          question: text,
          vehicleId: vehicle.name,
          hadAudio: true,
        );
      }

      setState(() => _isLoading = false);

      // Auto-scroll to bottom to show new message
      _forceScrollToBottom();

      if (audioUrl.isNotEmpty && vehicle != null) {
        debugPrint('Auto-playing TTS for new response');
        await _playTTS(audioUrl);
      }
    }

    // Resume listening in wake word mode
    if (!appState.isPushToTalkMode) {
      await _startWakeWordListening();
    }
  }

  Future<void> _discardRecording() async {
    if (!_isRecording) return;

    try {
      // Stop the recording without processing it
      await _audioService!.stopRecording();
      setState(() => _isRecording = false);

      // Show a brief confirmation
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Recording discarded'),
            duration: Duration(seconds: 1),
            backgroundColor: Colors.orange,
          ),
        );
      }

      debugPrint('Recording discarded by user');
    } catch (e) {
      setState(() => _isRecording = false);
      debugPrint('Error discarding recording: $e');
    }
  }

  Future<void> _playTTS(String audioUrl) async {
    // Refresh audio settings to get the latest playback speed
    await _loadAudioSettings();

    setState(() => _isPlayingTTS = true);
    try {
      String audioStreamUrl;

      if (audioUrl.startsWith('/tts?text=')) {
        // Extract the text from the URL
        final uri = Uri.parse(audioUrl);
        final text = uri.queryParameters['text'] ?? '';

        if (text.isEmpty) {
          throw Exception('No text found in TTS URL');
        }

        debugPrint('Making TTS request for text: $text');

        // Make a POST request to the TTS endpoint with text as query parameter
        final response = await http.post(
          Uri.parse(
              '${ApiService.backendUrl}/tts?text=${Uri.encodeComponent(text)}'),
          headers: {
            'x-api-key': ApiService.apiKey,
          },
        );

        if (response.statusCode == 200) {
          // Create a temporary audio file from the response bytes
          final audioBytes = response.bodyBytes;
          final tempDir = await getTemporaryDirectory();
          final tempFile = File(
              '${tempDir.path}/tts_${DateTime.now().millisecondsSinceEpoch}.mp3');
          await tempFile.writeAsBytes(audioBytes);
          audioStreamUrl = tempFile.path;
          debugPrint('TTS audio saved to: $audioStreamUrl');
        } else if (response.statusCode == 400) {
          // Handle validation errors (e.g., text too long)
          final errorBody = response.body;
          debugPrint('TTS validation error: $errorBody');
          throw Exception(
              'TTS validation error: ${errorBody.contains('too long') ? 'Response too long for voice synthesis' : errorBody}');
        } else {
          throw Exception(
              'TTS request failed with status ${response.statusCode}: ${response.body}');
        }
      } else {
        // Direct URL or local file path
        audioStreamUrl = audioUrl.startsWith('http') ? audioUrl : audioUrl;

        // For local files, check if they exist
        if (!audioStreamUrl.startsWith('http')) {
          final file = File(audioStreamUrl);
          if (!await file.exists()) {
            throw Exception(
                'Audio file no longer available (may have been cleaned up)');
          }
        }
      }

      debugPrint('Playing audio from: $audioStreamUrl');

      // Set a timeout only for the audio setup/loading phase
      await Future.any([
        _setupAndStartAudio(audioStreamUrl),
        Future.delayed(
            const Duration(seconds: 10),
            () => throw TimeoutException(
                'Audio setup timeout', const Duration(seconds: 10))),
      ]);

      debugPrint('Audio playback initiated successfully');
    } catch (e) {
      debugPrint('Error playing TTS: $e');
      setState(() => _isPlayingTTS = false);
      if (e.toString().contains('no longer available')) {
        _showError('Audio no longer available - try asking the question again');
      } else if (e.toString().contains('timeout') ||
          e.toString().contains('Timeout')) {
        _showError('Audio setup timed out');
      } else {
        _showError('Failed to play audio: $e');
      }
    }
    // Note: Don't set _isPlayingTTS = false here immediately
    // We'll listen to the player state stream to know when playback actually completes
  }

  Future<void> _setupAndStartAudio(String audioPath) async {
    try {
      // Refresh audio settings to get latest playback speed
      await _loadAudioSettings();

      String audioUrl;

      // Check if it's a local file path
      if (!audioPath.startsWith('http') && !audioPath.startsWith('file://')) {
        // For local files, use file:// URL scheme
        audioUrl = 'file://$audioPath';
      } else {
        audioUrl = audioPath;
      }

      debugPrint('Setting audio source to: $audioUrl');
      await _audioPlayer.setUrl(audioUrl);

      // Wait for the player to be ready and then set speed
      await _audioPlayer.seek(Duration.zero);

      debugPrint('Setting playback speed to: $_playbackSpeed');
      await _audioPlayer.setSpeed(_playbackSpeed);

      // Give a small delay to ensure speed is applied
      await Future.delayed(const Duration(milliseconds: 50));

      // Start playing - don't await this since it returns immediately and audio plays in background
      _audioPlayer.play();

      debugPrint(
          'Audio playback started successfully with speed: $_playbackSpeed');
    } catch (e) {
      debugPrint('Error in _setupAndStartAudio: $e');
      throw e; // Re-throw to be caught by the caller
    }
  }

  void _showError(String msg) {
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(msg), backgroundColor: Colors.red),
      );
    }
  }

  String _getVehicleDisplayName(Vehicle vehicle) {
    if (vehicle.nickname.isNotEmpty) {
      return '${vehicle.nickname} (${vehicle.name})';
    } else {
      return vehicle.name;
    }
  }

  /// Check if an audio file exists locally
  Future<bool> _isAudioAvailable(String audioUrl) async {
    if (audioUrl.isEmpty) return false;

    // If it's a web URL, assume it's available (though it might not be)
    if (audioUrl.startsWith('http')) {
      return true;
    }

    // If it's a TTS URL that needs to be generated, consider it available
    if (audioUrl.startsWith('/tts?text=')) {
      return true;
    }

    // For local file paths, check if the file actually exists
    try {
      final file = File(audioUrl);
      return await file.exists();
    } catch (e) {
      return false;
    }
  }

  void _showVehicleSwitcher(BuildContext context) {
    final appState = Provider.of<AppState>(context, listen: false);
    showModalBottomSheet(
      context: context,
      builder: (context) {
        return ListView(
          shrinkWrap: true,
          children: [
            const ListTile(
              title: Text('Select Active Vehicle',
                  style: TextStyle(fontWeight: FontWeight.bold)),
            ),
            ...appState.vehicles.map((v) => ListTile(
                  title: Text(_getVehicleDisplayName(v)),
                  subtitle: Text(
                      v.engine + (v.notes.isNotEmpty ? ' — ${v.notes}' : '')),
                  trailing: appState.activeVehicle == v
                      ? const Icon(Icons.check, color: Colors.orange)
                      : null,
                  onTap: () {
                    appState.setActiveVehicle(v);
                    Navigator.pop(context);
                  },
                )),
          ],
        );
      },
    );
  }

  Widget _buildVehicleHeader() {
    return Consumer<AppState>(
      builder: (context, appState, child) {
        final vehicle = appState.activeVehicle;
        return Container(
          margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          decoration: BoxDecoration(
            color: Theme.of(context).cardColor,
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: Colors.grey.withValues(alpha: 0.2)),
          ),
          child: Row(
            children: [
              Icon(
                Icons.directions_car,
                size: 20,
                color: vehicle != null ? Colors.orange : Colors.grey,
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  vehicle != null
                      ? _getVehicleDisplayName(vehicle)
                      : 'No Vehicle Selected',
                  style: const TextStyle(
                      fontSize: 14, fontWeight: FontWeight.w500),
                ),
              ),
              IconButton(
                icon: const Icon(Icons.garage, size: 20),
                onPressed: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(
                        builder: (context) => const GarageDashboard()),
                  );
                },
                tooltip: 'Manage Garage',
                constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
                padding: EdgeInsets.zero,
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildMainButtonWithToggle() {
    return Consumer<AppState>(
      builder: (context, appState, child) {
        return Container(
          margin: const EdgeInsets.only(bottom: 16, top: 8),
          child: Column(
            children: [
              // Text input for web users
              if (kIsWeb && _showTextInput) ...[
                Container(
                  margin:
                      const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  decoration: BoxDecoration(
                    color: Theme.of(context).cardColor,
                    borderRadius: BorderRadius.circular(12),
                    border:
                        Border.all(color: Colors.grey.withValues(alpha: 0.3)),
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: _textController,
                          focusNode: _textFocusNode,
                          decoration: const InputDecoration(
                            hintText:
                                'Type your car question here... (Enter to send, Shift+Enter for new line)',
                            border: InputBorder.none,
                            contentPadding: EdgeInsets.symmetric(
                                horizontal: 16, vertical: 12),
                          ),
                          maxLines: null,
                          textInputAction: TextInputAction.send,
                          onSubmitted: (_) => _submitTextQuestion(),
                        ),
                      ),
                      IconButton(
                        onPressed: _isLoading ? null : _submitTextQuestion,
                        icon: _isLoading
                            ? const SizedBox(
                                width: 20,
                                height: 20,
                                child:
                                    CircularProgressIndicator(strokeWidth: 2),
                              )
                            : const Icon(Icons.send),
                        tooltip: 'Send question',
                      ),
                    ],
                  ),
                ),
                // Divider with OR text
                Row(
                  children: [
                    Expanded(
                        child:
                            Divider(color: Colors.grey.withValues(alpha: 0.3))),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      child: Text(
                        'OR',
                        style: TextStyle(
                          color: Colors.grey.withValues(alpha: 0.7),
                          fontSize: 12,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ),
                    Expanded(
                        child:
                            Divider(color: Colors.grey.withValues(alpha: 0.3))),
                  ],
                ),
              ],

              // Voice interface (existing code)
              _buildVoiceInterface(appState),
            ],
          ),
        );
      },
    );
  }

  Widget _buildVoiceInterface(AppState appState) {
    IconData iconData;
    Color buttonColor;

    if (!_permissionGranted && _needsExplicitPermissions) {
      iconData = Icons.mic_off;
      buttonColor = Colors.grey;
    } else if (appState.isPushToTalkMode) {
      iconData = _isRecording ? Icons.mic : Icons.mic_none;
      buttonColor = _isRecording ? Colors.redAccent : Colors.orange;
    } else {
      iconData = _isListening ? Icons.hearing : Icons.hearing_disabled;
      buttonColor = _isListening ? Colors.green : Colors.grey;
    }

    final bool showPermissionWarning =
        !_permissionGranted && _needsExplicitPermissions;
    final bool isWakeWordDisabled =
        !_isWakeWordSupported || showPermissionWarning;

    return Column(
      children: [
        // Main microphone button with optional trash icon
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            // Trash can icon (only show when recording in PTT mode)
            if (appState.isPushToTalkMode && _isRecording && !_isLoading)
              Container(
                margin: const EdgeInsets.only(right: 20),
                child: GestureDetector(
                  onTap: _discardRecording,
                  child: Container(
                    width: 50,
                    height: 50,
                    decoration: BoxDecoration(
                      color: Colors.grey.withValues(alpha: 0.8),
                      shape: BoxShape.circle,
                      border: Border.all(color: Colors.grey, width: 2),
                    ),
                    child: const Icon(
                      Icons.delete_outline,
                      size: 24,
                      color: Colors.white,
                    ),
                  ),
                ),
              ),
            // Main microphone button
            GestureDetector(
              onTap: _isLoading ? null : _onMainButtonPressed,
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                width: 80,
                height: 80,
                decoration: BoxDecoration(
                  color: _isLoading ? Colors.grey : buttonColor,
                  shape: BoxShape.circle,
                  boxShadow: [
                    if (_isRecording || _isListening)
                      BoxShadow(
                        color: buttonColor.withValues(alpha: 0.5),
                        blurRadius: 16,
                        spreadRadius: 2,
                      ),
                  ],
                ),
                child: _isLoading
                    ? const CircularProgressIndicator(color: Colors.white)
                    : Icon(
                        iconData,
                        size: 40,
                        color: Colors.white,
                      ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        // Compact mode toggle (only show if voice is supported)
        if (!kIsWeb || _recorderInitialized)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(
              color: Theme.of(context).cardColor.withValues(alpha: 0.8),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: Colors.grey.withValues(alpha: 0.3)),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  appState.isPushToTalkMode ? Icons.push_pin : Icons.hearing,
                  size: 16,
                  color: isWakeWordDisabled
                      ? Colors.grey
                      : Theme.of(context).primaryColor,
                ),
                const SizedBox(width: 6),
                Text(
                  appState.isPushToTalkMode ? 'Push to Talk' : 'Wake Word',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w500,
                    color: isWakeWordDisabled ? Colors.grey : null,
                  ),
                ),
                const SizedBox(width: 8),
                Transform.scale(
                  scale: 0.7,
                  child: Switch(
                    value: !appState.isPushToTalkMode,
                    onChanged: !isWakeWordDisabled
                        ? (value) async {
                            appState.togglePushToTalkMode();
                            if (!appState.isPushToTalkMode) {
                              await _startWakeWordListening();
                            } else {
                              await _stopWakeWordListening();
                            }
                          }
                        : null,
                    activeColor: Theme.of(context).primaryColor,
                    materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  ),
                ),
              ],
            ),
          ),
        if (showPermissionWarning)
          Padding(
            padding: const EdgeInsets.only(top: 4),
            child: Text(
              'Mic permission required',
              style: TextStyle(
                fontSize: 10,
                color: Colors.red.withValues(alpha: 0.8),
              ),
            ),
          )
        else if (!appState.isPushToTalkMode &&
            _isListening &&
            _recorderInitialized)
          // Show helpful tip when in active wake word listening mode
          Container(
            margin: const EdgeInsets.only(top: 8),
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: Colors.green.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: Colors.green.withValues(alpha: 0.3)),
            ),
            child: Column(
              children: [
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      Icons.lightbulb_outline,
                      size: 14,
                      color: Colors.green.withValues(alpha: 0.8),
                    ),
                    const SizedBox(width: 6),
                    Text(
                      'Hands-free mode active',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: Colors.green.withValues(alpha: 0.9),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  'Say "Hey GreaseMonkey" to ask a question',
                  style: TextStyle(
                    fontSize: 10,
                    color: Colors.green.withValues(alpha: 0.8),
                  ),
                  textAlign: TextAlign.center,
                ),
              ],
            ),
          )
        else if (!_isWakeWordSupported && !kIsWeb)
          Padding(
            padding: const EdgeInsets.only(top: 4),
            child: Text(
              'Wake word not supported on this platform',
              style: TextStyle(
                fontSize: 10,
                color: Colors.orange.withValues(alpha: 0.9),
              ),
              textAlign: TextAlign.center,
            ),
          )
        else if (kIsWeb && !_recorderInitialized)
          Padding(
            padding: const EdgeInsets.only(top: 4),
            child: Text(
              'Use text input above or enable microphone for voice',
              style: TextStyle(
                fontSize: 10,
                color: Colors.grey.withValues(alpha: 0.8),
              ),
              textAlign: TextAlign.center,
            ),
          ),
      ],
    );
  }

  Widget _buildTranscriptContainer() {
    return Consumer<AppState>(
      builder: (context, appState, child) {
        final visibleQueryHistory = appState.visibleQueryHistory;
        final hasVehicles = appState.vehicles.isNotEmpty;

        return Expanded(
          child: Container(
            margin: const EdgeInsets.all(16),
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: Theme.of(context).cardColor,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: Colors.grey.withValues(alpha: 0.3)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Padding(
                  padding: EdgeInsets.all(8.0),
                  child: Text(
                    'Conversation',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                  ),
                ),
                const Divider(),
                Expanded(
                  child: !hasVehicles
                      ? Center(
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(
                                Icons.directions_car,
                                size: 64,
                                color: Colors.grey.withValues(alpha: 0.5),
                              ),
                              const SizedBox(height: 16),
                              const Text(
                                'Welcome to GreaseMonkey AI!',
                                style: TextStyle(
                                    fontSize: 20, fontWeight: FontWeight.bold),
                                textAlign: TextAlign.center,
                              ),
                              const SizedBox(height: 8),
                              const Text(
                                'First, add your vehicles to get started.\nOnce added, you can ask questions about maintenance, repairs, and more!',
                                textAlign: TextAlign.center,
                                style:
                                    TextStyle(color: Colors.grey, fontSize: 16),
                              ),
                              const SizedBox(height: 24),
                              ElevatedButton.icon(
                                onPressed: () {
                                  Navigator.push(
                                    context,
                                    MaterialPageRoute(
                                        builder: (context) =>
                                            const GarageDashboard()),
                                  );
                                },
                                icon: const Icon(Icons.garage),
                                label: const Text('Manage Your Garage'),
                                style: ElevatedButton.styleFrom(
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 24, vertical: 12),
                                ),
                              ),
                            ],
                          ),
                        )
                      : visibleQueryHistory.isEmpty
                          ? Center(
                              child: Column(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Icon(
                                    kIsWeb ? Icons.chat : Icons.mic,
                                    size: 48,
                                    color: Colors.grey.withValues(alpha: 0.6),
                                  ),
                                  const SizedBox(height: 16),
                                  Text(
                                    kIsWeb
                                        ? 'Ask your first question!'
                                        : 'Ask your first question!',
                                    style: const TextStyle(
                                      fontSize: 18,
                                      fontWeight: FontWeight.w500,
                                    ),
                                    textAlign: TextAlign.center,
                                  ),
                                  const SizedBox(height: 8),
                                  Text(
                                    kIsWeb
                                        ? 'Type your question above or use the microphone button below.'
                                        : 'Tap the microphone button to get started.',
                                    textAlign: TextAlign.center,
                                    style: TextStyle(
                                      color: Colors.grey.withValues(alpha: 0.8),
                                      fontSize: 14,
                                    ),
                                  ),
                                  if (kIsWeb) ...[
                                    const SizedBox(height: 16),
                                    Container(
                                      padding: const EdgeInsets.all(12),
                                      decoration: BoxDecoration(
                                        color: Theme.of(context)
                                            .primaryColor
                                            .withValues(alpha: 0.1),
                                        borderRadius: BorderRadius.circular(8),
                                        border: Border.all(
                                          color: Theme.of(context)
                                              .primaryColor
                                              .withValues(alpha: 0.3),
                                        ),
                                      ),
                                      child: const Text(
                                        '💡 Tip: Press Enter to send your question, Shift+Enter for new lines',
                                        style: TextStyle(fontSize: 12),
                                        textAlign: TextAlign.center,
                                      ),
                                    ),
                                  ],
                                ],
                              ),
                            )
                          : Column(
                              children: [
                                // Loading indicator for older messages
                                if (appState.isLoadingMessages)
                                  const Padding(
                                    padding: EdgeInsets.all(8.0),
                                    child: CircularProgressIndicator(
                                        strokeWidth: 2),
                                  ),
                                if (appState.hasMoreMessages &&
                                    !appState.isLoadingMessages)
                                  TextButton.icon(
                                    onPressed: () =>
                                        appState.loadMoreMessages(),
                                    icon:
                                        const Icon(Icons.expand_less, size: 16),
                                    label: const Text('Load older messages',
                                        style: TextStyle(fontSize: 12)),
                                  ),
                                Expanded(
                                  child:
                                      NotificationListener<ScrollNotification>(
                                    onNotification:
                                        (ScrollNotification scrollInfo) {
                                      // Only auto-scroll to bottom when content is first loaded and user hasn't scrolled manually
                                      if (scrollInfo is ScrollEndNotification &&
                                          visibleQueryHistory.isNotEmpty &&
                                          _scrollController.position.pixels ==
                                              0 &&
                                          _scrollController
                                                  .position.maxScrollExtent >
                                              0) {
                                        // Only auto-scroll if we're at the very bottom (natural position for new content)
                                        _forceScrollToBottom();
                                      }
                                      return false;
                                    },
                                    child: ListView.builder(
                                      controller: _scrollController,
                                      reverse:
                                          true, // Show newest messages at bottom
                                      itemCount: visibleQueryHistory.length,
                                      itemBuilder: (context, idx) {
                                        // Since reverse is true, newest messages are at index 0
                                        final q = visibleQueryHistory[idx];
                                        return Container(
                                          margin: const EdgeInsets.symmetric(
                                              vertical: 4),
                                          child: Column(
                                            crossAxisAlignment:
                                                CrossAxisAlignment.start,
                                            children: [
                                              // User question
                                              Container(
                                                alignment:
                                                    Alignment.centerRight,
                                                child: Container(
                                                  padding:
                                                      const EdgeInsets.all(12),
                                                  margin: const EdgeInsets.only(
                                                      left: 40),
                                                  decoration: BoxDecoration(
                                                    color: Colors.blue
                                                        .withValues(alpha: 0.1),
                                                    borderRadius:
                                                        BorderRadius.circular(
                                                            12),
                                                  ),
                                                  child: Text(
                                                    q['question'] ?? '',
                                                    style: const TextStyle(
                                                        fontWeight:
                                                            FontWeight.w500),
                                                  ),
                                                ),
                                              ),
                                              const SizedBox(height: 8),
                                              // AI response
                                              Container(
                                                alignment: Alignment.centerLeft,
                                                child: Container(
                                                  padding:
                                                      const EdgeInsets.all(12),
                                                  margin: const EdgeInsets.only(
                                                      right: 40),
                                                  decoration: BoxDecoration(
                                                    color: Colors.orange
                                                        .withValues(alpha: 0.1),
                                                    borderRadius:
                                                        BorderRadius.circular(
                                                            12),
                                                  ),
                                                  child: Column(
                                                    crossAxisAlignment:
                                                        CrossAxisAlignment
                                                            .start,
                                                    children: [
                                                      Text(q['answer'] ?? ''),
                                                      if ((q['audio_url'] ?? '')
                                                          .isNotEmpty)
                                                        FutureBuilder<bool>(
                                                          future:
                                                              _isAudioAvailable(
                                                                  q['audio_url']!),
                                                          builder: (context,
                                                              snapshot) {
                                                            final isAvailable =
                                                                snapshot.data ??
                                                                    false;
                                                            if (!isAvailable)
                                                              return const SizedBox
                                                                  .shrink();

                                                            return Align(
                                                              alignment: Alignment
                                                                  .centerRight,
                                                              child: IconButton(
                                                                icon: const Icon(
                                                                    Icons
                                                                        .volume_up,
                                                                    size: 20),
                                                                onPressed: _isLoading
                                                                    ? null
                                                                    : () => _playTTS(
                                                                        q['audio_url']!),
                                                                tooltip:
                                                                    'Replay audio',
                                                              ),
                                                            );
                                                          },
                                                        ),
                                                    ],
                                                  ),
                                                ),
                                              ),
                                              if (idx <
                                                  visibleQueryHistory.length -
                                                      1)
                                                const SizedBox(height: 16),
                                            ],
                                          ),
                                        );
                                      },
                                    ),
                                  ),
                                ),
                              ],
                            ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  void _setupWebKeyboardShortcuts() {
    // Add keyboard shortcuts for web users
    _textFocusNode.onKeyEvent = (node, event) {
      if (event is KeyDownEvent &&
          event.logicalKey == LogicalKeyboardKey.enter) {
        if (HardwareKeyboard.instance.isShiftPressed) {
          // Shift+Enter = new line (let default behavior handle it)
          return KeyEventResult.ignored;
        } else {
          // Enter = send message
          _submitTextQuestion();
          return KeyEventResult.handled;
        }
      }
      return KeyEventResult.ignored;
    };
  }

  Future<void> _submitTextQuestion() async {
    final text = _textController.text.trim();
    if (text.isEmpty || _isLoading) return;

    _textController.clear();

    final appState = Provider.of<AppState>(context, listen: false);
    final userId = appState.userId ?? appState.hashCode.toString();
    final vehicle = appState.activeVehicle;

    setState(() => _isLoading = true);

    try {
      final answer = await ApiService.askQuestion(
        userId: userId,
        question: text,
        car: vehicle?.name,
        engine: vehicle?.engine,
        notes: vehicle?.notes,
        unitPreferences: appState.unitPreferences,
      );

      if (answer == null) {
        setState(() => _isLoading = false);
        _showError('Backend error.');
        return;
      }

      String audioUrl = answer['audio_url'] ?? '';

      if (vehicle == null) {
        await appState.addQueryToHistory({
          'question': text,
          'answer':
              'Before I answer, which car is this for? (Please set an active vehicle in your garage.)',
          'audio_url': '',
        });
      } else {
        await appState.addQueryToHistory({
          'question': text,
          'answer': answer['answer'] ?? 'No answer',
          'audio_url': audioUrl,
        });

        // Track usage for analytics and billing
        await UsageService.trackQuestionUsage(
          userId,
          question: text,
          vehicleId: vehicle.name,
          hadAudio: false,
        );
      }

      setState(() => _isLoading = false);

      // Auto-scroll to bottom to show new message
      _forceScrollToBottom();

      if (audioUrl.isNotEmpty && vehicle != null && _autoPlay) {
        await _playTTS(audioUrl);
      }
    } catch (e) {
      setState(() => _isLoading = false);
      _showError('Failed to submit question: $e');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Consumer<AppState>(
      builder: (context, appState, child) {
        final vehicle = appState.activeVehicle;
        final isWideScreen = kIsWeb && MediaQuery.of(context).size.width > 768;

        return Scaffold(
          appBar: AppBar(
            title: GestureDetector(
              onTap: () => _showVehicleSwitcher(context),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    Icons.directions_car,
                    size: 24,
                    color: vehicle != null ? Colors.orange : Colors.grey,
                  ),
                  const SizedBox(width: 8),
                  Flexible(
                    child: Text(
                      vehicle != null
                          ? _getVehicleDisplayName(vehicle)
                          : 'Select Vehicle',
                      style: const TextStyle(
                          fontSize: 18, fontWeight: FontWeight.bold),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  const SizedBox(width: 4),
                  const Icon(Icons.keyboard_arrow_down, size: 20),
                ],
              ),
            ),
            actions: [
              IconButton(
                icon: const Icon(Icons.garage),
                onPressed: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(
                        builder: (context) => const GarageDashboard()),
                  );
                },
                tooltip: 'Manage Garage',
              ),
              PopupMenuButton<String>(
                onSelected: (value) {
                  if (value == 'settings') {
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => const SettingsScreen(),
                      ),
                    ).then((_) {
                      // Refresh audio settings when returning from settings
                      _refreshAudioSettings();
                    });
                  }
                },
                itemBuilder: (context) => [
                  const PopupMenuItem(
                    value: 'settings',
                    child: Text('Settings'),
                  ),
                ],
              ),
            ],
          ),
          body: isWideScreen ? _buildWideScreenLayout() : _buildMobileLayout(),
        );
      },
    );
  }

  Widget _buildWideScreenLayout() {
    return Container(
      constraints: const BoxConstraints(maxWidth: 1200),
      margin: const EdgeInsets.symmetric(horizontal: 20),
      child: Row(
        children: [
          // Left sidebar with controls
          Container(
            width: 320,
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Vehicle info card
                Card(
                  child: Consumer<AppState>(
                    builder: (context, appState, child) {
                      final vehicle = appState.activeVehicle;
                      return Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Icon(
                                  Icons.directions_car,
                                  color: vehicle != null
                                      ? Colors.orange
                                      : Colors.grey,
                                ),
                                const SizedBox(width: 8),
                                const Text(
                                  'Active Vehicle',
                                  style: TextStyle(fontWeight: FontWeight.bold),
                                ),
                              ],
                            ),
                            const SizedBox(height: 8),
                            Text(
                              vehicle != null
                                  ? _getVehicleDisplayName(vehicle)
                                  : 'No vehicle selected',
                              style: TextStyle(
                                color: vehicle != null ? null : Colors.grey,
                              ),
                            ),
                            if (vehicle?.engine != null) ...[
                              const SizedBox(height: 4),
                              Text(
                                'Engine: ${vehicle!.engine}',
                                style: const TextStyle(
                                    fontSize: 12, color: Colors.grey),
                              ),
                            ],
                            const SizedBox(height: 12),
                            ElevatedButton.icon(
                              onPressed: () {
                                Navigator.push(
                                  context,
                                  MaterialPageRoute(
                                    builder: (context) =>
                                        const GarageDashboard(),
                                  ),
                                );
                              },
                              icon: const Icon(Icons.garage, size: 16),
                              label: const Text('Manage Garage'),
                              style: ElevatedButton.styleFrom(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 16,
                                  vertical: 8,
                                ),
                              ),
                            ),
                          ],
                        ),
                      );
                    },
                  ),
                ),
                const SizedBox(height: 16),
                // Input controls
                Expanded(
                  child: Card(
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          const Text(
                            'Ask a Question',
                            style: TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          const SizedBox(height: 16),
                          // Text input area
                          Expanded(
                            child: Container(
                              decoration: BoxDecoration(
                                border: Border.all(
                                    color: Colors.grey.withValues(alpha: 0.3)),
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: TextField(
                                controller: _textController,
                                focusNode: _textFocusNode,
                                decoration: const InputDecoration(
                                  hintText: 'Type your car question here...',
                                  border: InputBorder.none,
                                  contentPadding: EdgeInsets.all(16),
                                ),
                                maxLines: null,
                                expands: true,
                                textAlignVertical: TextAlignVertical.top,
                              ),
                            ),
                          ),
                          const SizedBox(height: 12),
                          ElevatedButton.icon(
                            onPressed: _isLoading ? null : _submitTextQuestion,
                            icon: _isLoading
                                ? const SizedBox(
                                    width: 16,
                                    height: 16,
                                    child: CircularProgressIndicator(
                                        strokeWidth: 2),
                                  )
                                : const Icon(Icons.send),
                            label: const Text('Send Question'),
                          ),
                          const SizedBox(height: 16),
                          const Divider(),
                          const SizedBox(height: 16),
                          // Voice controls
                          _buildVoiceInterface(
                            Provider.of<AppState>(context, listen: false),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 16),
          // Main conversation area
          Expanded(
            child: _buildTranscriptContainer(),
          ),
        ],
      ),
    );
  }

  Widget _buildMobileLayout() {
    return Column(
      children: [
        _buildTranscriptContainer(),
        if (_isPlayingTTS)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 4.0),
            child: SizedBox(
              height: 20,
              width: 20,
              child: CircularProgressIndicator(strokeWidth: 2),
            ),
          ),
        _buildMainButtonWithToggle(),
      ],
    );
  }
}
