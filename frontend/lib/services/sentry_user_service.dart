import 'package:sentry_flutter/sentry_flutter.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

class SentryUserService {
  /// Update Sentry user context when user logs in
  static void setUser(User user) {
    Sentry.configureScope((scope) {
      scope.setUser(SentryUser(
        id: user.id,
        email: user.email,
        username: user.userMetadata?['first_name'] != null
          ? '${user.userMetadata!['first_name']} ${user.userMetadata!['last_name'] ?? ''}'.trim()
          : null,
      ));
    });
  }

  /// Clear Sentry user context when user logs out
  static void clearUser() {
    Sentry.configureScope((scope) {
      scope.removeUser();
    });
  }

  /// Add additional context for better debugging
  static void setContext(String key, Map<String, dynamic> context) {
    Sentry.configureScope((scope) {
      scope.setContext(key, context);
    });
  }

  /// Remove context
  static void removeContext(String key) {
    Sentry.configureScope((scope) {
      scope.removeContext(key);
    });
  }

  /// Add tag for filtering
  static void setTag(String key, String value) {
    Sentry.configureScope((scope) {
      scope.setTag(key, value);
    });
  }

  /// Remove tag
  static void removeTag(String key) {
    Sentry.configureScope((scope) {
      scope.removeTag(key);
    });
  }

  /// Add vehicle context for automotive debugging
  static void setVehicleContext(Map<String, dynamic> vehicleData) {
    setContext('vehicle', vehicleData);
  }

  /// Add app state context
  static void setAppStateContext({
    bool? isPushToTalkMode,
    String? activeVehicle,
    int? totalVehicles,
  }) {
    final context = <String, dynamic>{};
    if (isPushToTalkMode != null) context['push_to_talk_mode'] = isPushToTalkMode;
    if (activeVehicle != null) context['active_vehicle'] = activeVehicle;
    if (totalVehicles != null) context['total_vehicles'] = totalVehicles;

    if (context.isNotEmpty) {
      setContext('app_state', context);
    }
  }
}
