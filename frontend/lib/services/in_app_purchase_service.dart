import 'dart:async';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:in_app_purchase/in_app_purchase.dart';
import 'package:in_app_purchase_android/in_app_purchase_android.dart';
import 'package:in_app_purchase_storekit/in_app_purchase_storekit.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import 'package:supabase_flutter/supabase_flutter.dart';

class InAppPurchaseService {
  static final InAppPurchaseService _instance = InAppPurchaseService._internal();
  factory InAppPurchaseService() => _instance;
  InAppPurchaseService._internal();

  final InAppPurchase _inAppPurchase = InAppPurchase.instance;
  late StreamSubscription<List<PurchaseDetails>> _subscription;

  // Backend configuration - will be set from environment or config
  String? _backendUrl;
  String? _apiKey;

  // Initialize with backend configuration
  void configure({required String backendUrl, String? apiKey}) {
    _backendUrl = backendUrl;
    _apiKey = apiKey;
  }

  // Product IDs based on your pricing structure
  static const String gearheadMonthly = 'gearhead_monthly_499';
  static const String gearheadYearly = 'gearhead_yearly_4990';
  static const String masterTechMonthly = 'mastertech_monthly_2999';
  static const String masterTechYearly = 'mastertech_yearly_29990';

  static const Set<String> _productIds = {
    gearheadMonthly,
    gearheadYearly,
    masterTechMonthly,
    masterTechYearly,
  };

  List<ProductDetails> _products = [];
  bool _isAvailable = false;
  bool _purchasePending = false;
  String? _queryProductError;

  // Callbacks
  Function(List<PurchaseDetails>)? onPurchaseUpdated;
  Function(String)? onError;

  List<ProductDetails> get products => _products;
  bool get isAvailable => _isAvailable;
  bool get purchasePending => _purchasePending;
  String? get queryProductError => _queryProductError;

  Future<void> initialize() async {
    // Check if in-app purchases are available
    _isAvailable = await _inAppPurchase.isAvailable();

    if (!_isAvailable) {
      onError?.call('In-app purchases are not available on this device');
      return;
    }

    // Enable pending purchases for Android
    if (Platform.isAndroid) {
      final InAppPurchaseAndroidPlatformAddition androidAddition =
          _inAppPurchase.getPlatformAddition<InAppPurchaseAndroidPlatformAddition>();
      await androidAddition.enablePendingPurchases();
    }

    // Listen to purchase updates
    _subscription = _inAppPurchase.purchaseStream.listen(
      _onPurchaseUpdated,
      onDone: _onSubscriptionDone,
      onError: _onSubscriptionError,
    );

    // Load products
    await _loadProducts();
  }

  Future<void> _loadProducts() async {
    try {
      final ProductDetailsResponse response = await _inAppPurchase.queryProductDetails(_productIds);

      if (response.notFoundIDs.isNotEmpty) {
        debugPrint('Products not found: ${response.notFoundIDs}');
      }

      _products = response.productDetails;
      _queryProductError = response.error?.message;

      if (response.error != null) {
        onError?.call('Failed to load products: ${response.error!.message}');
      }
    } catch (e) {
      _queryProductError = e.toString();
      onError?.call('Error loading products: $e');
    }
  }

  Future<void> buyProduct(ProductDetails product) async {
    if (!_isAvailable) {
      onError?.call('In-app purchases are not available');
      return;
    }

    _purchasePending = true;

    try {
      final PurchaseParam purchaseParam = PurchaseParam(
        productDetails: product,
        applicationUserName: null, // You can set user ID here if needed
      );

      // All your products are subscriptions, so use buyNonConsumable
      await _inAppPurchase.buyNonConsumable(purchaseParam: purchaseParam);
    } catch (e) {
      _purchasePending = false;
      onError?.call('Purchase failed: $e');
    }
  }

  Future<void> restorePurchases() async {
    if (!_isAvailable) {
      onError?.call('In-app purchases are not available');
      return;
    }

    try {
      await _inAppPurchase.restorePurchases();
    } catch (e) {
      onError?.call('Restore failed: $e');
    }
  }

  void _onPurchaseUpdated(List<PurchaseDetails> purchaseDetailsList) {
    for (final PurchaseDetails purchaseDetails in purchaseDetailsList) {
      switch (purchaseDetails.status) {
        case PurchaseStatus.pending:
          debugPrint('Purchase pending: ${purchaseDetails.productID}');
          break;
        case PurchaseStatus.purchased:
        case PurchaseStatus.restored:
          debugPrint('Purchase completed: ${purchaseDetails.productID}');
          _verifyAndFinalizePurchase(purchaseDetails);
          break;
        case PurchaseStatus.error:
          debugPrint('Purchase error: ${purchaseDetails.error}');
          onError?.call('Purchase failed: ${purchaseDetails.error}');
          break;
        case PurchaseStatus.canceled:
          debugPrint('Purchase canceled: ${purchaseDetails.productID}');
          break;
      }
    }

    _purchasePending = false;
    onPurchaseUpdated?.call(purchaseDetailsList);
  }

  Future<void> _verifyAndFinalizePurchase(PurchaseDetails purchaseDetails) async {
    try {
      // Send purchase details to your backend for verification
      final success = await _verifyPurchaseWithBackend(purchaseDetails);

      if (success) {
        // Mark the purchase as complete
        if (purchaseDetails.pendingCompletePurchase) {
          await _inAppPurchase.completePurchase(purchaseDetails);
        }

        // Update user's subscription status in your app
        await _updateUserSubscription(purchaseDetails.productID);
      } else {
        onError?.call('Purchase verification failed');
      }
    } catch (e) {
      onError?.call('Failed to verify purchase: $e');
    }
  }

  Future<bool> _verifyPurchaseWithBackend(PurchaseDetails purchaseDetails) async {
    try {
      if (_backendUrl == null) {
        debugPrint('Backend URL not configured');
        return false;
      }

      // Get current user ID from Supabase Auth
      final currentUser = Supabase.instance.client.auth.currentUser;
      if (currentUser == null) {
        debugPrint('No authenticated user');
        return false;
      }

      final platform = Platform.isIOS ? 'ios' : 'android';

      // For iOS, we need the receipt data
      String receiptData = '';
      if (Platform.isIOS) {
        // On iOS, you need to get the receipt data from the app bundle
        // This is a simplified version - you might need to implement proper receipt fetching
        receiptData = purchaseDetails.verificationData.serverVerificationData;
      } else {
        // On Android, the purchase token is the verification data
        receiptData = purchaseDetails.verificationData.serverVerificationData;
      }

      final headers = <String, String>{
        'Content-Type': 'application/json',
      };

      // Add API key if available
      if (_apiKey != null) {
        headers['x-api-key'] = _apiKey!;
      }

      final response = await http.post(
        Uri.parse('$_backendUrl/subscription/verify-receipt'),
        headers: headers,
        body: jsonEncode({
          'user_id': currentUser.id,
          'platform': platform,
          'receipt_data': receiptData,
          'transaction_id': purchaseDetails.purchaseID ?? '',
          'product_id': purchaseDetails.productID,
        }),
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        return data['success'] == true;
      } else {
        debugPrint('Backend verification failed: ${response.statusCode} - ${response.body}');
        return false;
      }
    } catch (e) {
      debugPrint('Error verifying purchase with backend: $e');
      return false;
    }
  }

  Future<void> _updateUserSubscription(String productId) async {
    // Update your user's subscription status in your local storage and backend
    SubscriptionTier tier = _getSubscriptionTier(productId);
    debugPrint('User subscription updated to: ${tier.name}');
  }

  // New method to check subscription status from backend
  Future<Map<String, dynamic>?> getSubscriptionStatus(String? userId) async {
    try {
      if (_backendUrl == null) {
        debugPrint('Backend URL not configured');
        return null;
      }

      // Use provided userId or get from current user
      String? actualUserId = userId;
      if (actualUserId == null) {
        final currentUser = Supabase.instance.client.auth.currentUser;
        if (currentUser == null) {
          debugPrint('No authenticated user');
          return null;
        }
        actualUserId = currentUser.id;
      }

      final headers = <String, String>{
        'Content-Type': 'application/json',
      };

      if (_apiKey != null) {
        headers['x-api-key'] = _apiKey!;
      }

      final response = await http.get(
        Uri.parse('$_backendUrl/subscription/status/$actualUserId'),
        headers: headers,
      );

      if (response.statusCode == 200) {
        return jsonDecode(response.body);
      } else {
        debugPrint('Failed to get subscription status: ${response.statusCode} - ${response.body}');
        return null;
      }
    } catch (e) {
      debugPrint('Error getting subscription status: $e');
      return null;
    }
  }

  // New method to check if user can perform an action
  Future<bool> canUserPerformAction(String action, {String? userId}) async {
    try {
      if (_backendUrl == null) {
        debugPrint('Backend URL not configured');
        return false;
      }

      // Use provided userId or get from current user
      String? actualUserId = userId;
      if (actualUserId == null) {
        final currentUser = Supabase.instance.client.auth.currentUser;
        if (currentUser == null) {
          debugPrint('No authenticated user');
          return false;
        }
        actualUserId = currentUser.id;
      }

      final headers = <String, String>{
        'Content-Type': 'application/json',
      };

      if (_apiKey != null) {
        headers['x-api-key'] = _apiKey!;
      }

      final response = await http.post(
        Uri.parse('$_backendUrl/subscription/check-usage'),
        headers: headers,
        body: jsonEncode({
          'user_id': actualUserId,
          'action': action,
        }),
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        return data['can_perform'] == true;
      } else {
        debugPrint('Failed to check usage limits: ${response.statusCode} - ${response.body}');
        return false;
      }
    } catch (e) {
      debugPrint('Error checking usage limits: $e');
      return false;
    }
  }

  SubscriptionTier _getSubscriptionTier(String productId) {
    switch (productId) {
      case gearheadMonthly:
      case gearheadYearly:
        return SubscriptionTier.gearhead;
      case masterTechMonthly:
      case masterTechYearly:
        return SubscriptionTier.masterTech;
      default:
        return SubscriptionTier.garageVisitor;
    }
  }

  ProductDetails? getProduct(String productId) {
    try {
      return _products.firstWhere((product) => product.id == productId);
    } catch (e) {
      return null;
    }
  }

  void _onSubscriptionDone() {
    debugPrint('Purchase stream subscription closed');
  }

  void _onSubscriptionError(dynamic error) {
    debugPrint('Purchase stream error: $error');
    onError?.call('Purchase stream error: $error');
  }

  void dispose() {
    _subscription.cancel();
  }
}

enum SubscriptionTier {
  garageVisitor,
  gearhead,
  masterTech,
}

extension SubscriptionTierExtension on SubscriptionTier {
  String get name {
    switch (this) {
      case SubscriptionTier.garageVisitor:
        return 'Garage Visitor';
      case SubscriptionTier.gearhead:
        return 'Gearhead';
      case SubscriptionTier.masterTech:
        return 'Master Tech';
    }
  }

  String get description {
    switch (this) {
      case SubscriptionTier.garageVisitor:
        return '3 questions per day, 1 vehicle maximum';
      case SubscriptionTier.gearhead:
        return 'Unlimited questions, unlimited vehicles, 20 documents max';
      case SubscriptionTier.masterTech:
        return 'Unlimited everything, priority support, early access';
    }
  }

  double get monthlyPrice {
    switch (this) {
      case SubscriptionTier.garageVisitor:
        return 0.0;
      case SubscriptionTier.gearhead:
        return 4.99;
      case SubscriptionTier.masterTech:
        return 29.99;
    }
  }

  double get yearlyPrice {
    switch (this) {
      case SubscriptionTier.garageVisitor:
        return 0.0;
      case SubscriptionTier.gearhead:
        return 49.90;
      case SubscriptionTier.masterTech:
        return 299.90;
    }
  }
}
