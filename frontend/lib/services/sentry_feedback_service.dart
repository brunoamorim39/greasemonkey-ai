import 'package:flutter/material.dart';
import 'package:sentry_flutter/sentry_flutter.dart';

class SentryFeedbackService {
  /// Show Sentry User Feedback dialog
  static Future<void> showFeedbackDialog(BuildContext context) async {
    final user = Sentry.currentUser;

    // Create a simple feedback form
    final result = await showDialog<Map<String, String>>(
      context: context,
      builder: (context) => const _FeedbackDialog(),
    );

    if (result != null && result['feedback'] != null) {
      await _submitFeedback(
        feedback: result['feedback']!,
        email: result['email'] ?? user?.email ?? '',
        name: result['name'] ?? user?.username ?? '',
      );
    }
  }

  /// Submit feedback to Sentry
  static Future<void> _submitFeedback({
    required String feedback,
    String? email,
    String? name,
  }) async {
    try {
      // Capture user feedback
      await Sentry.captureUserFeedback(SentryUserFeedback(
        eventId: SentryId.newId(), // Create a new event for this feedback
        name: name?.isNotEmpty == true ? name : 'Anonymous User',
        email: email?.isNotEmpty == true ? email : 'no-email@greasemonkey.ai',
        comments: feedback,
      ));

      // Also capture as a message for better visibility in Sentry
      await Sentry.captureMessage(
        'User Feedback: $feedback',
        level: SentryLevel.info,
        withScope: (scope) {
          scope.setContext('feedback', {
            'type': 'user_feedback',
            'source': 'mobile_app',
            'user_email': email,
            'user_name': name,
          });
        },
      );
    } catch (e) {
      // If Sentry submission fails, at least log it locally
      debugPrint('Failed to submit feedback to Sentry: $e');
      rethrow;
    }
  }

  /// Capture feedback with additional context (for crashes/errors)
  static Future<void> captureWithFeedback({
    required String feedback,
    String? email,
    String? name,
    SentryId? eventId,
  }) async {
    try {
      await Sentry.captureUserFeedback(SentryUserFeedback(
        eventId: eventId ?? SentryId.newId(),
        name: name?.isNotEmpty == true ? name : 'Anonymous User',
        email: email?.isNotEmpty == true ? email : 'no-email@greasemonkey.ai',
        comments: feedback,
      ));
    } catch (e) {
      debugPrint('Failed to capture feedback with context: $e');
    }
  }
}

class _FeedbackDialog extends StatefulWidget {
  const _FeedbackDialog();

  @override
  State<_FeedbackDialog> createState() => _FeedbackDialogState();
}

class _FeedbackDialogState extends State<_FeedbackDialog> {
  final _feedbackController = TextEditingController();
  final _emailController = TextEditingController();
  final _nameController = TextEditingController();
  bool _isSubmitting = false;

  @override
  void initState() {
    super.initState();

    // Pre-fill with Sentry user data if available
    final user = Sentry.currentUser;
    if (user != null) {
      _emailController.text = user.email ?? '';
      _nameController.text = user.username ?? '';
    }
  }

  @override
  void dispose() {
    _feedbackController.dispose();
    _emailController.dispose();
    _nameController.dispose();
    super.dispose();
  }

  Future<void> _submitFeedback() async {
    if (_feedbackController.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please enter your feedback'),
          backgroundColor: Colors.orange,
        ),
      );
      return;
    }

    setState(() => _isSubmitting = true);

    try {
      final result = {
        'feedback': _feedbackController.text.trim(),
        'email': _emailController.text.trim(),
        'name': _nameController.text.trim(),
      };

      Navigator.of(context).pop(result);

      // Show success message
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Thank you! Your feedback has been sent.'),
          backgroundColor: Colors.green,
        ),
      );
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Error sending feedback: $e'),
          backgroundColor: Colors.red,
        ),
      );
    } finally {
      setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Send Feedback'),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text(
              'Help us improve GreaseMonkey AI! Your feedback will be sent to our development team.',
              style: TextStyle(fontSize: 14, color: Colors.grey),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _nameController,
              enabled: !_isSubmitting,
              decoration: const InputDecoration(
                labelText: 'Name (Optional)',
                hintText: 'Your name',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _emailController,
              enabled: !_isSubmitting,
              keyboardType: TextInputType.emailAddress,
              decoration: const InputDecoration(
                labelText: 'Email (Optional)',
                hintText: 'your@email.com',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _feedbackController,
              enabled: !_isSubmitting,
              maxLines: 4,
              decoration: const InputDecoration(
                labelText: 'Feedback *',
                hintText: 'Describe the issue, suggest a feature, or share your thoughts...',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 8),
            const Text(
              'This feedback will be linked to your app usage data to help us debug issues.',
              style: TextStyle(fontSize: 12, color: Colors.grey),
            ),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: _isSubmitting ? null : () => Navigator.of(context).pop(),
          child: const Text('Cancel'),
        ),
        ElevatedButton(
          onPressed: _isSubmitting ? null : _submitFeedback,
          child: _isSubmitting
              ? const SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : const Text('Send Feedback'),
        ),
      ],
    );
  }
}
