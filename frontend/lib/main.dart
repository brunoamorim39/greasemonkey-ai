import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'state/app_state.dart';
import 'models/vehicle.dart';
import 'screens/query_screen.dart';
import 'screens/launch_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await dotenv.load(fileName: ".env");
  runApp(const GreaseMonkeyApp());
}

class GreaseMonkeyApp extends StatelessWidget {
  const GreaseMonkeyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AppState()),
      ],
      child: MaterialApp(
        title: 'GreaseMonkey AI',
        theme: ThemeData(
          colorScheme: ColorScheme.fromSeed(
            seedColor: Colors.deepOrange,
            brightness: Brightness.dark,
          ),
          useMaterial3: true,
        ),
        debugShowCheckedModeBanner: false,
        initialRoute: '/',
        routes: {
          '/': (context) => const LaunchScreen(),
          '/garage': (context) => const GarageDashboard(),
          '/query': (context) => const QueryScreen(),
        },
      ),
    );
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
    final appState = Provider.of<AppState>(context);
    return Scaffold(
      appBar: AppBar(
        title: const Text('Your Garage'),
        actions: [
          IconButton(
            icon: const Icon(Icons.settings),
            onPressed: () {
              // TODO: Navigate to settings
            },
          ),
        ],
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
                      return ListTile(
                        title: Text(v.name),
                        subtitle: Text(v.engine +
                            (v.notes.isNotEmpty ? ' — ${v.notes}' : '')),
                        leading: isActive
                            ? const Icon(Icons.directions_car,
                                color: Colors.orange)
                            : const Icon(Icons.directions_car),
                        trailing: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            if (!isActive)
                              TextButton(
                                child: const Text('Set Active'),
                                onPressed: () => appState.setActiveVehicle(v),
                              ),
                            if (isActive)
                              ElevatedButton.icon(
                                icon: const Icon(Icons.mic),
                                label: const Text('Ask'),
                                onPressed: () {
                                  Navigator.pushNamed(context, '/query');
                                },
                              ),
                          ],
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
    final nameController = TextEditingController();
    final engineController = TextEditingController();
    final notesController = TextEditingController();
    showDialog(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: const Text('Add Vehicle'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                  controller: nameController,
                  decoration: const InputDecoration(
                      labelText: 'Car (e.g. 2008 Subaru WRX)'),
                ),
                TextField(
                  controller: engineController,
                  decoration:
                      const InputDecoration(labelText: 'Engine (e.g. EJ255)'),
                ),
                TextField(
                  controller: notesController,
                  decoration:
                      const InputDecoration(labelText: 'Notes (optional)'),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Cancel'),
            ),
            ElevatedButton(
              onPressed: () {
                if (nameController.text.isNotEmpty &&
                    engineController.text.isNotEmpty) {
                  Provider.of<AppState>(context, listen: false).addVehicle(
                    Vehicle(
                      name: nameController.text,
                      engine: engineController.text,
                      notes: notesController.text,
                    ),
                  );
                  Navigator.pop(context);
                }
              },
              child: const Text('Add'),
            ),
          ],
        );
      },
    );
  }
}
