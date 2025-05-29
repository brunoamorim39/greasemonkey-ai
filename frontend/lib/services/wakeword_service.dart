import 'package:porcupine_flutter/porcupine_manager.dart';
import 'package:porcupine_flutter/porcupine_error.dart';
// import 'package:porcupine_flutter/porcupine.dart'; // Not needed for PorcupineManager
import 'package:flutter/foundation.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';

class WakeWordService {
  PorcupineManager? _manager;
  final VoidCallback onWakeWord;

  WakeWordService({required this.onWakeWord});

  Future<void> start() async {
    try {
      final accessKey = dotenv.env['PICOVOICE_ACCESS_KEY'];
      if (accessKey == null) {
        debugPrint('PICOVOICE_ACCESS_KEY not found in .env file');
        return;
      }

      _manager = await PorcupineManager.fromKeywordPaths(
        accessKey,
        [
          "assets/greasemonkey.ppn"
        ], // Ensure this path is correct and file exists in assets
        _wakeWordCallback, // Pass the callback function directly
        modelPath: "assets/porcupine_params.pv", // Ensure this path is correct
        sensitivities: [0.7],
        errorCallback:
            _errorCallback, // Add an error callback for better debugging
      );

      await _manager!.start();
    } on PorcupineException catch (e) {
      debugPrint('Porcupine error during start: ${e.message}');
    }
  }

  // Define the wake word callback
  void _wakeWordCallback(int keywordIndex) {
    // keywordIndex tells you which keyword was detected if you have multiple.
    // Here, we only have one, so we can just call onWakeWord.
    onWakeWord();
  }

  // Define an error callback for PorcupineManager
  void _errorCallback(PorcupineException error) {
    debugPrint('Porcupine runtime error: ${error.message}');
  }

  Future<void> stop() async {
    try {
      await _manager?.stop();
      await _manager?.delete();
      _manager = null;
    } on PorcupineException catch (e) {
      debugPrint('Porcupine error during stop: ${e.message}');
    }
  }
}
