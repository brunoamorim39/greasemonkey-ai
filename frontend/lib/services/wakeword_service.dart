import 'package:porcupine_flutter/porcupine_manager.dart';
import 'package:porcupine_flutter/porcupine_error.dart';
import 'package:flutter/foundation.dart';

class WakeWordService {
  PorcupineManager? _manager;
  final VoidCallback onWakeWord;

  WakeWordService({required this.onWakeWord});

  Future<void> start() async {
    try {
      _manager = await PorcupineManager.create(
        // Use built-in 'porcupine' keyword for demo. Replace with custom keyword for production.
        keywordAssetPaths: ["assets/porcupine_params.pv"],
        sensitivities: [0.7],
        onKeywordDetected: (idx) {
          onWakeWord();
        },
      );
      await _manager!.start();
    } on PorcupineException catch (e) {
      debugPrint('Porcupine error: $e');
    }
  }

  Future<void> stop() async {
    await _manager?.stop();
    await _manager?.delete();
    _manager = null;
  }
}
