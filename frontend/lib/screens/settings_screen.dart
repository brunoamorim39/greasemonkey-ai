import 'package:flutter/material.dart';
import 'package:provider/provider.dart' as provider_pkg;
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../state/app_state.dart';
import '../services/sentry_feedback_service.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  double _playbackSpeed = 1.0;
  bool _autoPlay = true;
  bool _loading = false;

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

  void _showUnitPreferences() {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => const UnitPreferencesScreen(),
      ),
    );
  }

  Future<void> _logout() async {
    setState(() => _loading = true);
    try {
      final supabase = Supabase.instance.client;
      await supabase.auth.signOut();
      if (mounted) {
        provider_pkg.Provider.of<AppState>(context, listen: false).setUserId('');
        Navigator.pushNamedAndRemoveUntil(context, '/', (route) => false);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error signing out: $e')),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _loading = false);
      }
    }
  }

  Future<void> _clearQueryHistory() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Clear Query History'),
        content: const Text(
          'This will permanently delete all your saved questions and responses. This action cannot be undone.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.of(context).pop(true),
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
            child: const Text('Clear All'),
          ),
        ],
      ),
    );

    if (confirmed == true && mounted) {
      final appState = provider_pkg.Provider.of<AppState>(context, listen: false);
      await appState.clearQueryHistory();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Query history cleared')),
        );
      }
    }
  }

  void _showFeedbackOptions(BuildContext context) {
    showModalBottomSheet(
      context: context,
      builder: (context) => Container(
        padding: const EdgeInsets.all(16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text(
              'How can we help?',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 16),
            ListTile(
              leading: const Icon(Icons.bug_report, color: Colors.red),
              title: const Text('Report a Bug'),
              subtitle: const Text('Something not working right?'),
              onTap: () {
                Navigator.pop(context);
                _showFeedback(context, 'bug');
              },
            ),
            ListTile(
              leading: const Icon(Icons.lightbulb, color: Colors.orange),
              title: const Text('Suggest a Feature'),
              subtitle: const Text('Got an idea to make us better?'),
              onTap: () {
                Navigator.pop(context);
                _showFeedback(context, 'suggestion');
              },
            ),
            ListTile(
              leading: const Icon(Icons.chat, color: Colors.blue),
              title: const Text('General Feedback'),
              subtitle: const Text('Tell us what you think'),
              onTap: () {
                Navigator.pop(context);
                _showFeedback(context, 'feedback');
              },
            ),
          ],
        ),
      ),
    );
  }

  void _showFeedback(BuildContext context, String type) {
    SentryFeedbackService.showFeedbackDialog(context);
  }

  @override
  Widget build(BuildContext context) {
    final appState = provider_pkg.Provider.of<AppState>(context);
    final supabase = Supabase.instance.client;
    final user = supabase.auth.currentUser;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Settings'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => Navigator.pop(context),
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // User Profile Section
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Profile',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 12),
                  if (user != null) ...[
                    ListTile(
                      leading: const Icon(Icons.email),
                      title: Text(user.email ?? 'No email'),
                      subtitle: const Text('Email address'),
                      contentPadding: EdgeInsets.zero,
                    ),
                    if (user.userMetadata?['first_name'] != null)
                      ListTile(
                        leading: const Icon(Icons.person),
                        title: Text('${user.userMetadata?['first_name']} ${user.userMetadata?['last_name'] ?? ''}'),
                        subtitle: const Text('Name'),
                        contentPadding: EdgeInsets.zero,
                      ),
                  ],
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),

          // Audio Settings Section
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Audio Settings',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 12),
                  ListTile(
                    leading: const Icon(Icons.speed),
                    title: const Text('TTS Playback Speed'),
                    subtitle: Text('${_playbackSpeed.toStringAsFixed(2)}x'),
                    contentPadding: EdgeInsets.zero,
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
                    subtitle: const Text('Automatically play voice responses'),
                    value: _autoPlay,
                    onChanged: (v) {
                      setState(() => _autoPlay = v);
                      _saveSettings();
                    },
                    secondary: const Icon(Icons.play_circle_fill),
                    contentPadding: EdgeInsets.zero,
                  ),
                  SwitchListTile(
                    title: const Text('Push to Talk Mode'),
                    subtitle: Text(appState.isPushToTalkMode
                        ? 'Tap to record, tap again to send'
                        : 'Use wake word "Hey GreaseMonkey" to activate'),
                    value: appState.isPushToTalkMode,
                    onChanged: (v) {
                      appState.togglePushToTalkMode();
                    },
                    secondary: Icon(appState.isPushToTalkMode ? Icons.push_pin : Icons.hearing),
                    contentPadding: EdgeInsets.zero,
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),

          // Unit Preferences Section
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Unit Preferences',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 12),
                  ListTile(
                    leading: const Icon(Icons.straighten),
                    title: const Text('Measurement Units'),
                    subtitle: const Text('Set your preferred units for different measurements'),
                    trailing: const Icon(Icons.arrow_forward_ios, size: 16),
                    contentPadding: EdgeInsets.zero,
                    onTap: _showUnitPreferences,
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),

          // Data & Privacy Section
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Data & Privacy',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 12),
                  ListTile(
                    leading: const Icon(Icons.history),
                    title: const Text('Clear Query History'),
                    subtitle: const Text('Remove all saved queries and responses'),
                    trailing: const Icon(Icons.arrow_forward_ios, size: 16),
                    contentPadding: EdgeInsets.zero,
                    onTap: _clearQueryHistory,
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),

          // App Info Section
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'About',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 12),
                  const ListTile(
                    leading: Icon(Icons.info),
                    title: Text('Version'),
                    subtitle: Text('1.0.0'),
                    contentPadding: EdgeInsets.zero,
                  ),
                  ListTile(
                    leading: const Icon(Icons.feedback),
                    title: const Text('Send Feedback'),
                    subtitle: const Text('Report bugs or suggest improvements'),
                    trailing: const Icon(Icons.arrow_forward_ios, size: 16),
                    contentPadding: EdgeInsets.zero,
                    onTap: () {
                      SentryFeedbackService.showFeedbackDialog(context);
                    },
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 24),

          // Logout Button
          ElevatedButton(
            onPressed: _loading ? null : _logout,
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.red,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 16),
            ),
            child: _loading
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: Colors.white,
                    ),
                  )
                : const Text('Sign Out'),
          ),
        ],
      ),
    );
  }
}

class UnitPreferencesScreen extends StatefulWidget {
  const UnitPreferencesScreen({super.key});

  @override
  State<UnitPreferencesScreen> createState() => _UnitPreferencesScreenState();
}

class _UnitPreferencesScreenState extends State<UnitPreferencesScreen> {
  late UnitPreferences _preferences;

  @override
  void initState() {
    super.initState();
    final appState = provider_pkg.Provider.of<AppState>(context, listen: false);
    _preferences = UnitPreferences(
      torqueUnit: appState.unitPreferences.torqueUnit,
      pressureUnit: appState.unitPreferences.pressureUnit,
      lengthUnit: appState.unitPreferences.lengthUnit,
      volumeUnit: appState.unitPreferences.volumeUnit,
      temperatureUnit: appState.unitPreferences.temperatureUnit,
      weightUnit: appState.unitPreferences.weightUnit,
      socketUnit: appState.unitPreferences.socketUnit,
    );
  }

  void _savePreferences() async {
    final appState = provider_pkg.Provider.of<AppState>(context, listen: false);
    await appState.updateUnitPreferences(_preferences);
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Unit preferences saved')),
      );
      Navigator.pop(context);
    }
  }

  Widget _buildUnitSelector({
    required String title,
    required String subtitle,
    required String currentValue,
    required List<Map<String, String>> options,
    required Function(String) onChanged,
  }) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              title,
              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 4),
            Text(
              subtitle,
              style: const TextStyle(fontSize: 12, color: Colors.grey),
            ),
            const SizedBox(height: 12),
            ...options.map((option) => RadioListTile<String>(
              title: Text(option['label']!),
              subtitle: option['example'] != null ? Text(option['example']!) : null,
              value: option['value']!,
              groupValue: currentValue,
              onChanged: (value) {
                setState(() => onChanged(value!));
              },
              contentPadding: EdgeInsets.zero,
            )),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Unit Preferences'),
        actions: [
          TextButton(
            onPressed: _savePreferences,
            child: const Text('Save'),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const Card(
            child: Padding(
              padding: EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'TTS Optimization',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                  ),
                  SizedBox(height: 8),
                  Text(
                    'These preferences help the AI provide responses in your preferred units and avoid abbreviations that sound unclear when spoken aloud.',
                    style: TextStyle(fontSize: 14, color: Colors.grey),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),

          // Torque
          _buildUnitSelector(
            title: 'Torque Specifications',
            subtitle: 'For bolt torque specs, valve covers, etc.',
            currentValue: _preferences.torqueUnit,
            options: [
              {'value': 'newton_meters', 'label': 'Newton Meters', 'example': '"10 newton meters"'},
              {'value': 'pound_feet', 'label': 'Pound Feet', 'example': '"7.5 pound feet"'},
            ],
            onChanged: (value) => _preferences.torqueUnit = value,
          ),

          // Pressure
          _buildUnitSelector(
            title: 'Pressure Measurements',
            subtitle: 'For tire pressure, boost, oil pressure',
            currentValue: _preferences.pressureUnit,
            options: [
              {'value': 'psi', 'label': 'Pounds per Square Inch', 'example': '"32 pounds per square inch"'},
              {'value': 'bar', 'label': 'Bar', 'example': '"2.2 bar"'},
              {'value': 'kilopascals', 'label': 'Kilopascals', 'example': '"220 kilopascals"'},
            ],
            onChanged: (value) => _preferences.pressureUnit = value,
          ),

          // Length
          _buildUnitSelector(
            title: 'Length & Distance',
            subtitle: 'For gaps, clearances, dimensions',
            currentValue: _preferences.lengthUnit,
            options: [
              {'value': 'metric', 'label': 'Metric', 'example': '"0.7 millimeters"'},
              {'value': 'imperial', 'label': 'Imperial', 'example': '"0.028 inches"'},
            ],
            onChanged: (value) => _preferences.lengthUnit = value,
          ),

          // Volume
          _buildUnitSelector(
            title: 'Volume Measurements',
            subtitle: 'For oil capacity, coolant, fuel',
            currentValue: _preferences.volumeUnit,
            options: [
              {'value': 'metric', 'label': 'Metric', 'example': '"4.5 liters"'},
              {'value': 'imperial', 'label': 'Imperial', 'example': '"4.5 quarts"'},
            ],
            onChanged: (value) => _preferences.volumeUnit = value,
          ),

          // Temperature
          _buildUnitSelector(
            title: 'Temperature',
            subtitle: 'For operating temps, thermostat ratings',
            currentValue: _preferences.temperatureUnit,
            options: [
              {'value': 'fahrenheit', 'label': 'Fahrenheit', 'example': '"195 degrees Fahrenheit"'},
              {'value': 'celsius', 'label': 'Celsius', 'example': '"90 degrees Celsius"'},
            ],
            onChanged: (value) => _preferences.temperatureUnit = value,
          ),

          // Weight
          _buildUnitSelector(
            title: 'Weight Measurements',
            subtitle: 'For component weights, vehicle mass',
            currentValue: _preferences.weightUnit,
            options: [
              {'value': 'imperial', 'label': 'Imperial', 'example': '"15 pounds"'},
              {'value': 'metric', 'label': 'Metric', 'example': '"7 kilograms"'},
            ],
            onChanged: (value) => _preferences.weightUnit = value,
          ),

          // Socket sizes
          _buildUnitSelector(
            title: 'Socket & Tool Sizes',
            subtitle: 'For wrench sizes, socket dimensions',
            currentValue: _preferences.socketUnit,
            options: [
              {'value': 'metric', 'label': 'Metric', 'example': '"17 millimeter socket"'},
              {'value': 'imperial', 'label': 'Imperial', 'example': '"11/16 inch socket"'},
            ],
            onChanged: (value) => _preferences.socketUnit = value,
          ),

          const SizedBox(height: 24),
        ],
      ),
    );
  }
}
