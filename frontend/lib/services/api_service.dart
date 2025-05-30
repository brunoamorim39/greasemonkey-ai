import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import 'package:flutter_dotenv/flutter_dotenv.dart';
import '../state/app_state.dart';

class ApiService {
  static String get backendUrl => dotenv.env['BACKEND_URL'] ?? 'http://localhost:8000';
  static String get apiKey => dotenv.env['API_KEY'] ?? 'your-secure-api-key-here';

  static Future<String?> transcribeAudio(File audioFile) async {
    final uri = Uri.parse('$backendUrl/stt');
    final request = http.MultipartRequest('POST', uri)
      ..headers['x-api-key'] = apiKey
      ..files.add(await http.MultipartFile.fromPath('file', audioFile.path));
    final response = await request.send();
    if (response.statusCode == 200) {
      final respStr = await response.stream.bytesToString();
      final data = json.decode(respStr);
      return data['text'] ?? data['transcription'];
    } else {
      return null;
    }
  }

  static Future<Map<String, dynamic>?> askQuestion({
    required String userId,
    required String question,
    String? car,
    String? engine,
    String? notes,
    UnitPreferences? unitPreferences,
  }) async {
    final uri = Uri.parse('$backendUrl/ask');

    // Prepare the request body - explicitly declare as Map<String, dynamic>
    final Map<String, dynamic> requestBody = {
      'user_id': userId,
      'question': question,
      'car': car,
      'engine': engine,
      'notes': notes,
    };

    // Add unit preferences if provided
    if (unitPreferences != null) {
      requestBody['unit_preferences'] = {
        'torque_unit': unitPreferences.torqueUnit,
        'pressure_unit': unitPreferences.pressureUnit,
        'length_unit': unitPreferences.lengthUnit,
        'volume_unit': unitPreferences.volumeUnit,
        'temperature_unit': unitPreferences.temperatureUnit,
        'weight_unit': unitPreferences.weightUnit,
        'socket_unit': unitPreferences.socketUnit,
      };
    }

    final response = await http.post(
      uri,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: json.encode(requestBody),
    );

    if (response.statusCode == 200) {
      return json.decode(response.body);
    } else {
      return null;
    }
  }
}
