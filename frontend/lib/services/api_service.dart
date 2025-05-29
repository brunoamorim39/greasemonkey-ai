import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;

class ApiService {
  static const String backendUrl = 'http://localhost:8000'; // TODO: Set to your backend
  static const String apiKey = 'your-backend-api-key'; // TODO: Set to your API key

  static Future<String?> transcribeAudio(File audioFile) async {
    final uri = Uri.parse('$backendUrl/stt');
    final request = http.MultipartRequest('POST', uri)
      ..headers['x-api-key'] = apiKey
      ..files.add(await http.MultipartFile.fromPath('file', audioFile.path));
    final response = await request.send();
    if (response.statusCode == 200) {
      final respStr = await response.stream.bytesToString();
      final data = json.decode(respStr);
      return data['text'] ?? data['transcription'] ?? data['text'] ?? null;
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
  }) async {
    final uri = Uri.parse('$backendUrl/ask');
    final response = await http.post(
      uri,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: json.encode({
        'user_id': userId,
        'question': question,
        'car': car,
        'engine': engine,
        'notes': notes,
      }),
    );
    if (response.statusCode == 200) {
      return json.decode(response.body);
    } else {
      return null;
    }
  }
}
