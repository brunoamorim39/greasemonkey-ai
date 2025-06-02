/// Service for tracking usage-based pricing and API consumption
class UsageService {
  // Usage limits for different tiers
  static const int freeMonthlyQuestions = 50;
  static const int freeVehicleLimit = 3;

  /// Check if user can add another vehicle based on their current usage
  static Future<bool> canAddVehicle(
      String userId, int currentVehicleCount) async {
    try {
      // For usage-based pricing, allow more vehicles in free tier
      if (currentVehicleCount >= freeVehicleLimit) {
        return false;
      }

      return true;
    } catch (e) {
      // On error, allow adding (fail open)
      return true;
    }
  }

  /// Check if user can ask more questions this month
  static Future<bool> canAskQuestion(String userId) async {
    try {
      // TODO: Implement actual usage tracking against backend
      // For now, allow questions (we'll track on backend)
      return true;
    } catch (e) {
      return true;
    }
  }

  /// Get remaining questions for current billing period
  static Future<int> getRemainingQuestions(String userId) async {
    try {
      // TODO: Call backend API to get actual usage
      return freeMonthlyQuestions;
    } catch (e) {
      return freeMonthlyQuestions;
    }
  }

  /// Track a question usage (called after successful API call)
  static Future<void> trackQuestionUsage(
    String userId, {
    String? question,
    String? vehicleId,
    bool hadAudio = false,
  }) async {
    try {
      // TODO: Send usage data to backend for tracking
      // This will be used for billing and analytics
      print(
          'Usage tracked: $userId asked question${hadAudio ? ' with audio' : ''}');
    } catch (e) {
      print('Failed to track usage: $e');
    }
  }

  /// Track document upload usage
  static Future<void> trackDocumentUsage(
      String userId, String documentId) async {
    try {
      // TODO: Track document processing for usage billing
      print('Document usage tracked: $userId uploaded document');
    } catch (e) {
      print('Failed to track document usage: $e');
    }
  }

  /// Get the vehicle limit for the current user
  static Future<int> getVehicleLimit(String userId) async {
    try {
      // TODO: Get from backend based on user's current plan
      return freeVehicleLimit;
    } catch (e) {
      return freeVehicleLimit;
    }
  }

  /// Check if user has exceeded usage limits
  static Future<bool> hasExceededLimits(String userId) async {
    try {
      // TODO: Check backend for current usage vs limits
      return false;
    } catch (e) {
      return false;
    }
  }
}
