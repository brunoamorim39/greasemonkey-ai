import 'package:flutter/material.dart';
import 'dart:io';
import 'package:just_audio/just_audio.dart';
import 'package:provider/provider.dart';
import '../services/api_service.dart';
import '../services/audio_recording_service.dart';
import '../services/wakeword_service_web.dart'
    if (dart.library.io) '../services/wakeword_service_mobile.dart';
import '../state/app_state.dart';
import 'query_history_screen.dart';
import 'settings_screen.dart';
import 'package:shared_preferences/shared_preferences.dart';

class QueryScreen extends StatefulWidget {
  const QueryScreen({super.key});

  @override
  State<QueryScreen> createState() => _QueryScreenState();
}

class _QueryScreenState extends State<QueryScreen> {
  bool _isRecording = false;
  bool _wakeWordEnabled = false;
  bool _isListening = false;
  bool _isPlayingTTS = false;
  AudioRecordingService? _audioService;
  String? _audioPath;
  WakeWordService? _wakeWordService;
  final AudioPlayer _audioPlayer = AudioPlayer();
  bool _isLoading = false;
  double _playbackSpeed = 1.0;
  bool _autoPlay = true;

  @override
  void initState() {
    super.initState();
    _audioService = AudioRecordingService();
    _loadAudioSettings();
  }

  Future<void> _loadAudioSettings() async {
    final prefs = await SharedPreferences.getInstance();
    setState(() {
      _playbackSpeed = prefs.getDouble('playback_speed') ?? 1.0;
      _autoPlay = prefs.getBool('auto_play') ?? true;
    });
  }

  @override
  void dispose() {
    _audioService?.dispose();
    _wakeWordService?.stop();
    _audioPlayer.dispose();
    super.dispose();
  }

  Future<void> _onMicPressed() async {
    if (_isLoading) return;
    if (!_isRecording) {
      await _startRecording();
    } else {
      await _stopRecordingAndQuery();
    }
  }

  Future<void> _startRecording() async {
    if (_audioService == null) return;

    final success = await _audioService!.startRecording();
    if (success) {
      setState(() => _isRecording = true);
    } else {
      _showError(
          'Failed to start recording. Please check microphone permissions.');
    }
  }

  Future<void> _stopRecordingAndQuery() async {
    final appState = Provider.of<AppState>(context, listen: false);
    final userId = appState.userId ?? appState.hashCode.toString();
    final vehicle = appState.activeVehicle;

    final audioPath = await _audioService!.stopRecording();
    setState(() => _isRecording = false);

    if (audioPath == null) {
      _showError('Failed to save recording.');
      return;
    }

    _audioPath = audioPath;

    if (_audioPath != null) {
      setState(() {
        _isLoading = true;
      });
      final audioFile = File(_audioPath!);
      final text = await ApiService.transcribeAudio(audioFile);
      if (text == null || text.isEmpty) {
        setState(() {
          _isLoading = false;
        });
        _showError('Could not transcribe audio.');
        return;
      }
      final answer = await ApiService.askQuestion(
        userId: userId,
        question: text,
        car: vehicle?.name,
        engine: vehicle?.engine,
        notes: vehicle?.notes,
      );
      if (answer == null) {
        setState(() {
          _isLoading = false;
        });
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
      }
      await appState.addQueryToHistory({
        'question': text,
        'answer': answer['answer'] ?? 'No answer',
        'audio_url': audioUrl,
      });
      setState(() {
        _isLoading = false;
      });
      if (audioUrl.isNotEmpty && vehicle != null && _autoPlay) {
        await _playTTS(audioUrl);
      }
    }
  }

  void _toggleWakeWord(bool enabled) async {
    if (_isLoading) return;
    setState(() {
      _wakeWordEnabled = enabled;
      _isListening = enabled;
    });
    if (enabled) {
      _wakeWordService = WakeWordService(onWakeWord: () async {
        setState(() {
          _isListening = false;
        });
        await _startRecording();
      });
      await _wakeWordService!.start();
    } else {
      await _wakeWordService?.stop();
      setState(() {
        _isListening = false;
      });
    }
  }

  Future<void> _playTTS(String audioUrl) async {
    setState(() => _isPlayingTTS = true);
    try {
      await _audioPlayer.setUrl(audioUrl);
      await _audioPlayer.seek(Duration.zero);
      await _audioPlayer.setSpeed(_playbackSpeed);
      await _audioPlayer.play();
    } catch (e) {
      // ignore
    }
    setState(() => _isPlayingTTS = false);
  }

  void _showError(String msg) {
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(msg), backgroundColor: Colors.red),
      );
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
                    style: TextStyle(fontWeight: FontWeight.bold))),
            ...appState.vehicles.map((v) => ListTile(
                  title: Text(v.name),
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

  @override
  Widget build(BuildContext context) {
    final appState = Provider.of<AppState>(context);
    final queryHistory = appState.queryHistory;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Ask GreaseMonkey'),
        actions: [
          PopupMenuButton<String>(
            onSelected: (value) {
              if (value == 'switch_vehicle') {
                _showVehicleSwitcher(context);
              } else if (value == 'history') {
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (_) => QueryHistoryScreen(queryLog: queryHistory),
                  ),
                );
              } else if (value == 'settings') {
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (_) => const SettingsScreen(),
                  ),
                );
              }
            },
            itemBuilder: (context) => [
              const PopupMenuItem(
                  value: 'switch_vehicle', child: Text('Switch Vehicle')),
              const PopupMenuItem(
                  value: 'history', child: Text('Query History')),
              const PopupMenuItem(value: 'settings', child: Text('Settings')),
            ],
          ),
        ],
      ),
      body: Column(
        children: [
          const SizedBox(height: 16),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Switch(
                value: _wakeWordEnabled,
                onChanged: _isLoading ? null : (val) => _toggleWakeWord(val),
              ),
              const Text('Wake Word'),
              if (_isListening)
                const Padding(
                  padding: EdgeInsets.only(left: 8.0),
                  child: Icon(Icons.hearing, color: Colors.green),
                ),
            ],
          ),
          const SizedBox(height: 8),
          Center(
            child: GestureDetector(
              onTap: _isLoading ? null : _onMicPressed,
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                width: _isRecording ? 120 : 100,
                height: _isRecording ? 120 : 100,
                decoration: BoxDecoration(
                  color: _isRecording
                      ? Colors.redAccent
                      : (_isLoading ? Colors.grey : Colors.orange),
                  shape: BoxShape.circle,
                  boxShadow: [
                    if (_isRecording)
                      BoxShadow(
                        color: Colors.red.withValues(alpha: 0.5),
                        blurRadius: 24,
                        spreadRadius: 4,
                      ),
                  ],
                ),
                child: _isLoading
                    ? const CircularProgressIndicator(color: Colors.white)
                    : Icon(
                        _isRecording ? Icons.mic : Icons.mic_none,
                        size: 48,
                        color: Colors.white,
                      ),
              ),
            ),
          ),
          const SizedBox(height: 24),
          if (_isPlayingTTS)
            const Padding(
              padding: EdgeInsets.all(8.0),
              child: CircularProgressIndicator(),
            ),
          Expanded(
            child: queryHistory.isEmpty
                ? const Center(child: Text('Ask your first question!'))
                : ListView.builder(
                    reverse: true,
                    itemCount: queryHistory.length,
                    itemBuilder: (context, idx) {
                      final q = queryHistory[idx];
                      return Card(
                        margin: const EdgeInsets.symmetric(
                            horizontal: 16, vertical: 8),
                        child: ListTile(
                          title: Text(q['question'] ?? '',
                              style:
                                  const TextStyle(fontWeight: FontWeight.bold)),
                          subtitle: Text(q['answer'] ?? ''),
                          trailing: IconButton(
                            icon: const Icon(Icons.volume_up),
                            onPressed:
                                (_isLoading || (q['audio_url'] ?? '').isEmpty)
                                    ? null
                                    : () => _playTTS(q['audio_url']!),
                          ),
                        ),
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }
}
