import 'package:flutter/material.dart';

class QueryHistoryScreen extends StatelessWidget {
  final List<Map<String, String>> queryLog;
  const QueryHistoryScreen({super.key, required this.queryLog});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Query History')),
      body: queryLog.isEmpty
          ? const Center(child: Text('No queries yet.'))
          : ListView.builder(
              reverse: true,
              itemCount: queryLog.length,
              itemBuilder: (context, idx) {
                final q = queryLog[idx];
                return Card(
                  margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  child: ListTile(
                    title: Text(q['question'] ?? '', style: const TextStyle(fontWeight: FontWeight.bold)),
                    subtitle: Text(q['answer'] ?? ''),
                  ),
                );
              },
            ),
    );
  }
}
