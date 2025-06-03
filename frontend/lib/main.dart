import 'package:flutter/material.dart';
import 'package:provider/provider.dart' as provider_pkg;
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:sentry_flutter/sentry_flutter.dart';
import 'state/app_state.dart';
import 'models/vehicle.dart';
import 'screens/main_screen.dart';
import 'screens/launch_screen.dart';
import 'screens/signup_screen.dart';
import 'screens/settings_screen.dart';
import 'screens/vehicle_edit_screen.dart';
import 'services/usage_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Try to load .env file, but don't fail if it doesn't exist
  try {
    await dotenv.load(fileName: ".env");
  } catch (e) {
    print('Warning: .env file not found, using default values: $e');
    // Load default values using testLoad when .env file doesn't exist
    dotenv.testLoad(fileInput: '''
BACKEND_URL=http://localhost:8000
API_KEY=your-secure-api-key-here
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
''');
  }

  // Initialize Supabase
  await Supabase.initialize(
    url: dotenv.env['SUPABASE_URL'] ?? 'https://your-project.supabase.co',
    anonKey: dotenv.env['SUPABASE_ANON_KEY'] ?? 'your-anon-key-here',
  );

  // Initialize Sentry only if DSN is provided
  final sentryDsn = dotenv.env['SENTRY_DSN'];
  if (sentryDsn != null && sentryDsn.isNotEmpty) {
    await SentryFlutter.init(
      (options) {
        options.dsn = sentryDsn;
        options.tracesSampleRate = 0.1;
        options.debug = dotenv.env['ENVIRONMENT'] == 'development';
        options.enableAutoPerformanceTracing = true;
        options.attachScreenshot = true;
        options.attachViewHierarchy = true;
        options.enableUserInteractionTracing = true;
      },
      appRunner: () => runApp(const GreaseMonkeyApp()),
    );
  } else {
    print('Sentry DSN not provided, skipping Sentry initialization');
    runApp(const GreaseMonkeyApp());
  }
}

class GreaseMonkeyApp extends StatelessWidget {
  const GreaseMonkeyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return provider_pkg.MultiProvider(
      providers: [
        provider_pkg.ChangeNotifierProvider(create: (_) => AppState()),
      ],
      child: MaterialApp(
        title: 'GreaseMonkey AI',
        theme: _buildTheme(),
        routes: _buildRoutes(),
        debugShowCheckedModeBanner: false,
      ),
    );
  }

  ThemeData _buildTheme() {
    return ThemeData(
      colorScheme: ColorScheme.fromSeed(
        seedColor: Colors.deepOrange,
        brightness: Brightness.dark,
      ),
      useMaterial3: true,
    );
  }

  Map<String, WidgetBuilder> _buildRoutes() {
    return {
      '/': (context) => const LaunchScreen(),
      '/main': (context) => const MainScreen(),
      '/garage': (context) => const GarageDashboard(),
      '/signup': (context) => const SignupScreen(),
      '/settings': (context) => const SettingsScreen(),
    };
  }
}

// --- Launch Screen ---
// class LaunchScreen extends StatelessWidget {
//   const LaunchScreen({super.key});
//
//   @override
//   Widget build(BuildContext context) {
//     // TODO: Add animated loading icon and auto-login logic
//     return Scaffold(
//       body: Center(
//         child: Column(
//           mainAxisAlignment: MainAxisAlignment.center,
//           children: [
//             const Text(
//               'GreaseMonkey AI',
//               style: TextStyle(fontSize: 32, fontWeight: FontWeight.bold),
//             ),
//             const SizedBox(height: 24),
//             const CircularProgressIndicator(),
//             const SizedBox(height: 24),
//             TextButton(
//               onPressed: () {
//                 Navigator.pushReplacementNamed(context, '/garage');
//               },
//               child: const Text('Continue'),
//             ),
//           ],
//         ),
//       ),
//     );
//   }
// }

// --- Garage Dashboard ---
class GarageDashboard extends StatelessWidget {
  const GarageDashboard({super.key});

  @override
  Widget build(BuildContext context) {
    final appState = provider_pkg.Provider.of<AppState>(context);
    return Scaffold(
      appBar: AppBar(
        title: const Text('Your Garage'),
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(16.0),
            child: ElevatedButton.icon(
              icon: const Icon(Icons.add),
              label: const Text('Add Vehicle'),
              onPressed: () => _showAddVehicleDialog(context),
            ),
          ),
          Expanded(
            child: appState.vehicles.isEmpty
                ? const Center(
                    child: Text('No vehicles yet. Add your first car!'))
                : ListView.builder(
                    itemCount: appState.vehicles.length,
                    itemBuilder: (context, idx) {
                      final v = appState.vehicles[idx];
                      final isActive = v == appState.activeVehicle;

                      return Card(
                        margin: const EdgeInsets.symmetric(
                            horizontal: 16, vertical: 4),
                        child: ListTile(
                          title: Text(
                            _getVehicleDisplayName(v),
                            style: TextStyle(
                              fontWeight: isActive
                                  ? FontWeight.bold
                                  : FontWeight.normal,
                            ),
                          ),
                          subtitle: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('Engine: ${v.engine}'),
                              if (v.notes.isNotEmpty)
                                Text(v.notes,
                                    style: const TextStyle(
                                        fontSize: 12,
                                        fontStyle: FontStyle.italic)),
                            ],
                          ),
                          leading: Icon(
                            Icons.directions_car,
                            color: isActive ? Colors.orange : null,
                          ),
                          trailing: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              IconButton(
                                icon: const Icon(Icons.edit),
                                onPressed: () {
                                  Navigator.push(
                                    context,
                                    MaterialPageRoute(
                                      builder: (context) => VehicleEditScreen(
                                        vehicle: v,
                                        vehicleIndex: idx,
                                      ),
                                    ),
                                  );
                                },
                              ),
                              if (!isActive)
                                TextButton(
                                  child: const Text('Set Active'),
                                  onPressed: () => appState.setActiveVehicle(v),
                                ),
                            ],
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

  void _showAddVehicleDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (context) => const AddVehicleDialog(),
    );
  }

  String _getVehicleDisplayName(Vehicle vehicle) {
    if (vehicle.nickname.isNotEmpty) {
      return '${vehicle.nickname} (${vehicle.name})';
    } else {
      return vehicle.name;
    }
  }
}

class AddVehicleDialog extends StatefulWidget {
  const AddVehicleDialog({super.key});

  @override
  State<AddVehicleDialog> createState() => _AddVehicleDialogState();
}

class _AddVehicleDialogState extends State<AddVehicleDialog> {
  final nameController = TextEditingController();
  final engineController = TextEditingController();
  final nicknameController = TextEditingController();
  bool isLoading = false;

  @override
  void initState() {
    super.initState();
    // Add listeners to update button state when text changes
    nameController.addListener(_updateButtonState);
    engineController.addListener(_updateButtonState);
  }

  @override
  void dispose() {
    nameController.removeListener(_updateButtonState);
    engineController.removeListener(_updateButtonState);
    nameController.dispose();
    engineController.dispose();
    nicknameController.dispose();
    super.dispose();
  }

  void _updateButtonState() {
    setState(() {
      // This will trigger a rebuild and re-evaluate the button state
    });
  }

  bool get _isFormValid {
    return nameController.text.trim().isNotEmpty &&
        engineController.text.trim().isNotEmpty;
  }

  Future<void> _addVehicle() async {
    if (!_isFormValid) {
      return;
    }

    setState(() {
      isLoading = true;
    });

    try {
      final appState =
          provider_pkg.Provider.of<AppState>(context, listen: false);

      // Check vehicle limits before adding
      if (appState.userId != null) {
        final canAdd = await UsageService.canAddVehicle(
            appState.userId!, appState.vehicles.length);
        if (!canAdd) {
          if (mounted) {
            setState(() {
              isLoading = false;
            });

            // Show upgrade dialog
            _showUpgradeDialog();
            return;
          }
        }
      }

      final newVehicle = Vehicle(
        name: nameController.text.trim(),
        engine: engineController.text.trim(),
        nickname: nicknameController.text.trim(),
      );

      await appState.addVehicle(newVehicle);

      if (mounted) {
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
                'Vehicle added! Tap the edit button to add notes and other details.'),
            duration: Duration(seconds: 3),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          isLoading = false;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error adding vehicle: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  void _showUpgradeDialog() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Vehicle Limit Reached'),
        content: const Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('You\'ve reached the vehicle limit for your current plan.'),
            SizedBox(height: 16),
            Text('Free Plan: 1 vehicle'),
            Text('Paid Plans: Unlimited vehicles'),
            SizedBox(height: 16),
            Text('Upgrade to add more vehicles to your garage!'),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(context);
              // TODO: Navigate to upgrade/pricing screen
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                  content: Text('Upgrade functionality coming soon!'),
                ),
              );
            },
            child: const Text('Upgrade'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Add Vehicle'),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: nameController,
              enabled: !isLoading,
              decoration: const InputDecoration(
                labelText: 'Vehicle Name *',
                hintText: 'e.g. 2008 Subaru WRX',
              ),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: nicknameController,
              enabled: !isLoading,
              decoration: const InputDecoration(
                labelText: 'Nickname (Optional)',
                hintText: 'e.g. "Blue Beast", "Daily Driver"',
              ),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: engineController,
              enabled: !isLoading,
              decoration: const InputDecoration(
                labelText: 'Engine *',
                hintText: 'e.g. EJ255, LS3, 2JZ-GTE',
              ),
            ),
            const SizedBox(height: 8),
            const Text(
              'You can add notes and other details after creating the vehicle.',
              style: TextStyle(fontSize: 12, color: Colors.grey),
            ),
            if (isLoading) ...[
              const SizedBox(height: 16),
              const CircularProgressIndicator(),
            ],
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: isLoading ? null : () => Navigator.pop(context),
          child: const Text('Cancel'),
        ),
        ElevatedButton(
          onPressed: isLoading || !_isFormValid ? null : _addVehicle,
          child: isLoading
              ? const SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : const Text('Add'),
        ),
      ],
    );
  }
}
