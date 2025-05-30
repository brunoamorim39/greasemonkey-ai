// This is a basic Flutter widget test.
//
// To perform an interaction with a widget in your test, use the WidgetTester
// utility in the flutter_test package. For example, you can send tap and scroll
// gestures. You can also use WidgetTester to find child widgets in the widget
// tree, read text, and verify that the values of widget properties are correct.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';

import 'package:greasemonkey_ai/state/app_state.dart';

void main() {
  testWidgets('App state and basic widget test', (WidgetTester tester) async {
    // Test the core app state without Supabase dependencies
    final appState = AppState();

    // Create a minimal test app
    await tester.pumpWidget(
      MaterialApp(
        home: ChangeNotifierProvider.value(
          value: appState,
          child: Scaffold(
            body: Consumer<AppState>(
              builder: (context, state, child) {
                return Column(
                  children: [
                    const Text('GreaseMonkey AI'),
                    Text('Vehicles: ${state.vehicles.length}'),
                    Text('User ID: ${state.userId ?? 'None'}'),
                  ],
                );
              },
            ),
          ),
        ),
      ),
    );

    // Verify basic app state functionality
    expect(find.text('GreaseMonkey AI'), findsOneWidget);
    expect(find.text('Vehicles: 0'), findsOneWidget);
    expect(find.text('User ID: None'), findsOneWidget);

    // Test adding a vehicle
    appState.setUserId('test-user');
    await tester.pump();
    expect(find.text('User ID: test-user'), findsOneWidget);
  });
}
