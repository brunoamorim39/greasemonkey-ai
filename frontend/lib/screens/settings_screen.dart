import 'package:flutter/material.dart';
import 'package:provider/provider.dart' as provider_pkg;
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../state/app_state.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  double _playbackSpeed = 1.0;
  bool _autoPlay = true;

  @override
  void initState() {
    super.initState();
    _loadSettings();
  }

  Future<void> _loadSettings() async {
    final prefs = await SharedPreferences.getInstance();
    setState(() {
      _playbackSpeed = prefs.getDouble('playback_speed') ?? 1.0;
      _autoPlay = prefs.getBool('auto_play') ?? true;
    });
  }

  Future<void> _saveSettings() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setDouble('playback_speed', _playbackSpeed);
    await prefs.setBool('auto_play', _autoPlay);
  }

  @override
  Widget build(BuildContext context) {
    final appState = provider_pkg.Provider.of<AppState>(context);
    final supabase = Supabase.instance.client;
    final user = supabase.auth.currentUser;
    return Scaffold(
      appBar: AppBar(title: const Text('Settings')),
      body: ListView(
        children: [
          if (user != null)
            ListTile(
              title: Text(user.email ?? ''),
              subtitle: const Text('Logged in'),
              leading: const Icon(Icons.account_circle),
            ),
          const Divider(),
          ListTile(
            title: const Text('Audio Playback Speed'),
            subtitle: Text('${_playbackSpeed.toStringAsFixed(2)}x'),
            leading: const Icon(Icons.speed),
            trailing: SizedBox(
              width: 120,
              child: Slider(
                value: _playbackSpeed,
                min: 0.75,
                max: 1.5,
                divisions: 3,
                label: '${_playbackSpeed.toStringAsFixed(2)}x',
                onChanged: (v) {
                  setState(() => _playbackSpeed = v);
                  _saveSettings();
                },
              ),
            ),
          ),
          SwitchListTile(
            title: const Text('Auto-Play TTS'),
            value: _autoPlay,
            onChanged: (v) {
              setState(() => _autoPlay = v);
              _saveSettings();
            },
            secondary: const Icon(Icons.play_circle_fill),
          ),
          const Divider(),
          ListTile(
            title: const Text('Logout'),
            leading: const Icon(Icons.logout),
            onTap: () async {
              await supabase.auth.signOut();
              appState.setUserId('');
              if (context.mounted) {
                Navigator.pushNamedAndRemoveUntil(
                    context, '/', (route) => false);
              }
            },
          ),
        ],
      ),
    );
  }
}
