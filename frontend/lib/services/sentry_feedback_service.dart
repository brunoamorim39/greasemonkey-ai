import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:sentry_flutter/sentry_flutter.dart';

class SentryFeedbackService {
  /// Shows the Sentry User Feedback dialog
  static Future<void> showFeedbackDialog(BuildContext context) async {
    try {
      // Check if Sentry is initialized
      if (!_isSentryInitialized()) {
        await _showFallbackFeedbackDialog(context);
        return;
      }

      // Show a custom dialog for mobile (since Sentry's web widget doesn't work well on mobile)
      await _showMobileFeedbackDialog(context);

    } catch (e) {
      print('Error in showFeedbackDialog: $e');
      // Fallback to a simple dialog
      try {
        await _showFallbackFeedbackDialog(context);
      } catch (fallbackError) {
        print('Error showing fallback dialog: $fallbackError');
      }
    }
  }

  /// Check if Sentry is properly initialized
  static bool _isSentryInitialized() {
    try {
      // Try to check if Sentry Hub is configured
      // This is a more reliable way to check if Sentry is initialized
      return Sentry.isEnabled;
    } catch (e) {
      return false;
    }
  }

  /// Shows a mobile-optimized feedback dialog that integrates with Sentry
  static Future<void> _showMobileFeedbackDialog(BuildContext context) async {
    final nameController = TextEditingController();
    final emailController = TextEditingController();
    final commentsController = TextEditingController();

    return showDialog<void>(
      context: context,
      builder: (BuildContext context) {
        return AlertDialog(
          title: const Text('Send Feedback'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Text(
                  'We value your feedback! Please let us know about any issues or suggestions.',
                  style: TextStyle(fontSize: 14),
                ),
                const SizedBox(height: 16),
                TextField(
                  controller: nameController,
                  decoration: const InputDecoration(
                    labelText: 'Name (Optional)',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: emailController,
                  decoration: const InputDecoration(
                    labelText: 'Email (Optional)',
                    border: OutlineInputBorder(),
                  ),
                  keyboardType: TextInputType.emailAddress,
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: commentsController,
                  decoration: const InputDecoration(
                    labelText: 'Your feedback *',
                    border: OutlineInputBorder(),
                    hintText: 'Please describe the issue or suggestion...',
                  ),
                  maxLines: 4,
                  textInputAction: TextInputAction.newline,
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('Cancel'),
            ),
            ElevatedButton(
              onPressed: () async {
                if (commentsController.text.trim().isEmpty) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Please enter your feedback'),
                      backgroundColor: Colors.orange,
                    ),
                  );
                  return;
                }

                try {
                  // Capture an event to get an event ID
                  final eventId = await Sentry.captureMessage(
                    'User Feedback: ${commentsController.text.trim()}',
                    level: SentryLevel.info,
                  );

                  // Create and send user feedback
                  final feedback = SentryUserFeedback(
                    eventId: eventId,
                    name: nameController.text.trim().isEmpty
                        ? 'Anonymous User'
                        : nameController.text.trim(),
                    email: emailController.text.trim().isEmpty
                        ? 'noreply@greasemonkey.ai'
                        : emailController.text.trim(),
                    comments: commentsController.text.trim(),
                  );

                  await Sentry.captureUserFeedback(feedback);

                  Navigator.of(context).pop();
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Thank you for your feedback!'),
                      backgroundColor: Colors.green,
                    ),
                  );
                } catch (e) {
                  print('Error submitting feedback: $e');
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Failed to send feedback. Please try again.'),
                      backgroundColor: Colors.red,
                    ),
                  );
                }
              },
              child: const Text('Send'),
            ),
          ],
        );
      },
    );
  }

  /// Fallback feedback dialog when Sentry is not available
  static Future<void> _showFallbackFeedbackDialog(BuildContext context) async {
    final commentsController = TextEditingController();

    return showDialog<void>(
      context: context,
      builder: (BuildContext context) {
        return AlertDialog(
          title: const Text('Send Feedback'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text(
                'Feedback system is currently unavailable. Your feedback is important to us!',
                style: TextStyle(fontSize: 14),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: commentsController,
                decoration: const InputDecoration(
                  labelText: 'Your feedback',
                  border: OutlineInputBorder(),
                  hintText: 'Please describe the issue or suggestion...',
                ),
                maxLines: 4,
                textInputAction: TextInputAction.newline,
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('Cancel'),
            ),
            ElevatedButton(
              onPressed: () {
                // Copy feedback to clipboard as fallback
                if (commentsController.text.trim().isNotEmpty) {
                  Clipboard.setData(ClipboardData(text: commentsController.text.trim()));
                  Navigator.of(context).pop();
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Feedback copied to clipboard. Please email it to support@greasemonkey.ai'),
                      backgroundColor: Colors.blue,
                      duration: Duration(seconds: 4),
                    ),
                  );
                } else {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Please enter your feedback'),
                      backgroundColor: Colors.orange,
                    ),
                  );
                }
              },
              child: const Text('Copy to Clipboard'),
            ),
          ],
        );
      },
    );
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
          scope.setContexts('feedback', {
            'type': 'user_feedback',
            'source': 'mobile_app',
            'user_email': email,
            'user_name': name,
          });
        },
      );
    } catch (e) {
      // If Sentry submission fails, at least log it locally
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
      rethrow;
    }
  }
}
