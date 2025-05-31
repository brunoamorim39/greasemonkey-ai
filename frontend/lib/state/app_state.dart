import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'dart:convert';
import '../models/vehicle.dart';
import '../services/vehicle_service.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../services/sentry_user_service.dart';

class UnitPreferences {
  // Torque measurements
  String torqueUnit;

  // Pressure measurements
  String pressureUnit;

  // Length/distance measurements
  String lengthUnit;

  // Volume measurements
  String volumeUnit;

  // Temperature measurements
  String temperatureUnit;

  // Weight measurements
  String weightUnit;

  // Socket/tool sizes
  String socketUnit;

  UnitPreferences({
    this.torqueUnit = 'newton_meters',  // "newton_meters" or "pound_feet"
    this.pressureUnit = 'psi',  // "psi", "bar", "kilopascals"
    this.lengthUnit = 'metric',  // "metric" (mm, cm, m) or "imperial" (inches, feet)
    this.volumeUnit = 'metric',  // "metric" (liters, ml) or "imperial" (quarts, gallons, ounces)
    this.temperatureUnit = 'fahrenheit',  // "celsius" or "fahrenheit"
    this.weightUnit = 'imperial',  // "metric" (kg, g) or "imperial" (lbs, oz)
    this.socketUnit = 'metric',  // "metric" (mm) or "imperial" (inches)
  });

  Map<String, dynamic> toJson() {
    return {
      'torqueUnit': torqueUnit,
      'pressureUnit': pressureUnit,
      'lengthUnit': lengthUnit,
      'volumeUnit': volumeUnit,
      'temperatureUnit': temperatureUnit,
      'weightUnit': weightUnit,
      'socketUnit': socketUnit,
    };
  }

  factory UnitPreferences.fromJson(Map<String, dynamic> json) {
    return UnitPreferences(
      torqueUnit: json['torqueUnit'] ?? 'newton_meters',
      pressureUnit: json['pressureUnit'] ?? 'psi',
      lengthUnit: json['lengthUnit'] ?? 'metric',
      volumeUnit: json['volumeUnit'] ?? 'metric',
      temperatureUnit: json['temperatureUnit'] ?? 'fahrenheit',
      weightUnit: json['weightUnit'] ?? 'imperial',
      socketUnit: json['socketUnit'] ?? 'metric',
    );
  }
}

class AppState extends ChangeNotifier {
  final List<Vehicle> _vehicles = [];
  Vehicle? _activeVehicle;
  String? _userId;
  Map<String, List<Map<String, String>>> _vehicleQueryHistory = {};
  bool _isPushToTalkMode = true; // Default to PTT mode
  UnitPreferences _unitPreferences = UnitPreferences();

  // Pagination support for query history
  static const int _messagesPerPage = 20;
  Map<String, int> _currentMessagePages = {};
  Map<String, bool> _hasMoreMessages = {};
  Map<String, bool> _isLoadingMessages = {};
  Map<String, List<Map<String, String>>> _visibleQueryHistory = {};

  List<Vehicle> get vehicles => List.unmodifiable(_vehicles);
  Vehicle? get activeVehicle => _activeVehicle;
  String? get userId => _userId;

  // Get query history for the active vehicle
  List<Map<String, String>> get queryHistory {
    if (_activeVehicle == null) return [];
    final vehicleId = _getVehicleId(_activeVehicle!);
    return List.unmodifiable(_vehicleQueryHistory[vehicleId] ?? []);
  }

  // Get visible query history for the active vehicle
  List<Map<String, String>> get visibleQueryHistory {
    if (_activeVehicle == null) return [];
    final vehicleId = _getVehicleId(_activeVehicle!);
    return List.unmodifiable(_visibleQueryHistory[vehicleId] ?? []);
  }

  bool get isPushToTalkMode => _isPushToTalkMode;
  UnitPreferences get unitPreferences => _unitPreferences;

  bool get hasMoreMessages {
    if (_activeVehicle == null) return false;
    final vehicleId = _getVehicleId(_activeVehicle!);
    return _hasMoreMessages[vehicleId] ?? false;
  }

  bool get isLoadingMessages {
    if (_activeVehicle == null) return false;
    final vehicleId = _getVehicleId(_activeVehicle!);
    return _isLoadingMessages[vehicleId] ?? false;
  }

  // Helper method to generate a consistent vehicle ID
  String _getVehicleId(Vehicle vehicle) {
    return '${vehicle.name}_${vehicle.engine}'.replaceAll(' ', '_').toLowerCase();
  }

  AppState() {
    _loadQueryHistory();
    _loadSettings();
    _loadUnitPreferences();
  }

  /// Load vehicles from Supabase for the current user
  Future<void> loadVehicles() async {
    if (_userId == null) return;

    try {
      final loadedVehicles = await VehicleService.loadVehicles(_userId!);
      _vehicles.clear();
      _vehicles.addAll(loadedVehicles);

      // Restore the last selected vehicle or set a default
      await _loadActiveVehicle();

      notifyListeners();
    } catch (e) {
      print('Error loading vehicles: $e');
    }
  }

  Future<void> addVehicle(Vehicle vehicle) async {
    if (_userId == null) {
      // If no user, just add to local state (fallback)
      _vehicles.add(vehicle);

      // If this is the first vehicle, set it as active
      if (_activeVehicle == null) {
        setActiveVehicle(vehicle);
      }

      notifyListeners();
      return;
    }

    try {
      final success = await VehicleService.addVehicle(_userId!, vehicle, _vehicles);
      if (success) {
        _vehicles.add(vehicle);

        // If this is the first vehicle, set it as active
        if (_activeVehicle == null) {
          setActiveVehicle(vehicle);
        }

        notifyListeners();
      } else {
        // Show error but still add locally as fallback
        _vehicles.add(vehicle);

        // If this is the first vehicle, set it as active
        if (_activeVehicle == null) {
          setActiveVehicle(vehicle);
        }

        notifyListeners();
        print('Failed to save vehicle to database, but added locally');
      }
    } catch (e) {
      print('Error adding vehicle: $e');
      // Add locally as fallback
      _vehicles.add(vehicle);

      // If this is the first vehicle, set it as active
      if (_activeVehicle == null) {
        setActiveVehicle(vehicle);
      }

      notifyListeners();
    }
  }

  Future<void> updateVehicle(int index, Vehicle updatedVehicle) async {
    if (index < 0 || index >= _vehicles.length) return;

    if (_userId == null) {
      // If no user, just update local state (fallback)
      final oldVehicle = _vehicles[index];
      _vehicles[index] = updatedVehicle;

      if (_activeVehicle == oldVehicle) {
        _activeVehicle = updatedVehicle;
      }

      notifyListeners();
      return;
    }

    try {
      final success = await VehicleService.updateVehicle(_userId!, index, updatedVehicle, _vehicles);
      if (success) {
        final oldVehicle = _vehicles[index];
        _vehicles[index] = updatedVehicle;

        // If the updated vehicle was the active one, update the active vehicle reference
        if (_activeVehicle == oldVehicle) {
          _activeVehicle = updatedVehicle;
        }

        notifyListeners();
      } else {
        // Update locally as fallback
        final oldVehicle = _vehicles[index];
        _vehicles[index] = updatedVehicle;

        if (_activeVehicle == oldVehicle) {
          _activeVehicle = updatedVehicle;
        }

        notifyListeners();
        print('Failed to save vehicle update to database, but updated locally');
      }
    } catch (e) {
      print('Error updating vehicle: $e');
      // Update locally as fallback
      final oldVehicle = _vehicles[index];
      _vehicles[index] = updatedVehicle;

      if (_activeVehicle == oldVehicle) {
        _activeVehicle = updatedVehicle;
      }

      notifyListeners();
    }
  }

  Future<void> removeVehicle(int index) async {
    if (index < 0 || index >= _vehicles.length) return;

    if (_userId == null) {
      // If no user, just remove from local state (fallback)
      final removedVehicle = _vehicles.removeAt(index);

      if (_activeVehicle == removedVehicle) {
        if (_vehicles.isNotEmpty) {
          setActiveVehicle(_vehicles.first);
        } else {
          _activeVehicle = null;
          // Clear saved active vehicle since no vehicles remain
          final prefs = await SharedPreferences.getInstance();
          await prefs.remove('active_vehicle_id');
        }
      }

      notifyListeners();
      return;
    }

    try {
      final success = await VehicleService.removeVehicle(_userId!, index, _vehicles);
      if (success) {
        final removedVehicle = _vehicles.removeAt(index);

        // If the removed vehicle was the active one, clear or set a new active vehicle
        if (_activeVehicle == removedVehicle) {
          if (_vehicles.isNotEmpty) {
            setActiveVehicle(_vehicles.first);
          } else {
            _activeVehicle = null;
            // Clear saved active vehicle since no vehicles remain
            final prefs = await SharedPreferences.getInstance();
            await prefs.remove('active_vehicle_id');
          }
        }

        notifyListeners();
      } else {
        // Remove locally as fallback
        final removedVehicle = _vehicles.removeAt(index);

        if (_activeVehicle == removedVehicle) {
          if (_vehicles.isNotEmpty) {
            setActiveVehicle(_vehicles.first);
          } else {
            _activeVehicle = null;
            // Clear saved active vehicle since no vehicles remain
            final prefs = await SharedPreferences.getInstance();
            await prefs.remove('active_vehicle_id');
          }
        }

        notifyListeners();
        print('Failed to remove vehicle from database, but removed locally');
      }
    } catch (e) {
      print('Error removing vehicle: $e');
      // Remove locally as fallback
      final removedVehicle = _vehicles.removeAt(index);

      if (_activeVehicle == removedVehicle) {
        if (_vehicles.isNotEmpty) {
          setActiveVehicle(_vehicles.first);
        } else {
          _activeVehicle = null;
          // Clear saved active vehicle since no vehicles remain
          final prefs = await SharedPreferences.getInstance();
          await prefs.remove('active_vehicle_id');
        }
      }

      notifyListeners();
    }
  }

  void setActiveVehicle(Vehicle vehicle) async {
    _activeVehicle = vehicle;
    _initializePaginationForVehicle(vehicle);

    // Update Sentry context with new active vehicle
    SentryUserService.setVehicleContext({
      'name': vehicle.name,
      'engine': vehicle.engine,
      'nickname': vehicle.nickname,
      'has_notes': vehicle.notes.isNotEmpty,
    });

    // Save the active vehicle
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('active_vehicle_id', _getVehicleId(vehicle));

    notifyListeners();
  }

  Future<void> _saveActiveVehicle(Vehicle vehicle) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final vehicleId = _getVehicleId(vehicle);
      await prefs.setString('active_vehicle_id', vehicleId);
      debugPrint('Saved active vehicle: $vehicleId');
    } catch (e) {
      print('Error saving active vehicle: $e');
    }
  }

  Future<void> _loadActiveVehicle() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final savedVehicleId = prefs.getString('active_vehicle_id');

      if (savedVehicleId != null && _vehicles.isNotEmpty) {
        // Find the vehicle with the saved ID
        for (final vehicle in _vehicles) {
          if (_getVehicleId(vehicle) == savedVehicleId) {
            _activeVehicle = vehicle;
            _initializePaginationForVehicle(vehicle);
            debugPrint('Restored active vehicle: ${vehicle.name}');
            break;
          }
        }

        // If saved vehicle not found, default to the first vehicle
        if (_activeVehicle == null && _vehicles.isNotEmpty) {
          _activeVehicle = _vehicles.first;
          _initializePaginationForVehicle(_vehicles.first);
          debugPrint('Saved vehicle not found, defaulting to: ${_vehicles.first.name}');
        }
      } else if (_vehicles.isNotEmpty) {
        // No saved vehicle, default to first one
        _activeVehicle = _vehicles.first;
        _initializePaginationForVehicle(_vehicles.first);
        debugPrint('No saved vehicle, defaulting to: ${_vehicles.first.name}');
      }
    } catch (e) {
      print('Error loading active vehicle: $e');
      // Fallback to first vehicle if error
      if (_vehicles.isNotEmpty) {
        _activeVehicle = _vehicles.first;
        _initializePaginationForVehicle(_vehicles.first);
      }
    }
  }

  void setUserId(String userId) {
    _userId = userId;

    // Set Sentry user context when user logs in
    if (userId.isNotEmpty) {
      final user = Supabase.instance.client.auth.currentUser;
      if (user != null) {
        SentryUserService.setUser(user);

        // Set app context
        SentryUserService.setAppStateContext(
          isPushToTalkMode: _isPushToTalkMode,
          totalVehicles: _vehicles.length,
          activeVehicle: _activeVehicle?.name,
        );
      }
      loadVehicles();
    } else {
      // Clear user context when user logs out
      SentryUserService.clearUser();
      // Clear vehicles when user logs out
      _vehicles.clear();
      _activeVehicle = null;
    }
    notifyListeners();
  }

  void togglePushToTalkMode() async {
    _isPushToTalkMode = !_isPushToTalkMode;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('push_to_talk_mode', _isPushToTalkMode);
    notifyListeners();
  }

  Future<void> updateUnitPreferences(UnitPreferences newPreferences) async {
    _unitPreferences = newPreferences;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('unit_preferences', json.encode(_unitPreferences.toJson()));
    notifyListeners();
  }

  Future<void> _loadUnitPreferences() async {
    final prefs = await SharedPreferences.getInstance();
    final data = prefs.getString('unit_preferences');
    if (data != null) {
      try {
        final Map<String, dynamic> decoded = json.decode(data);
        _unitPreferences = UnitPreferences.fromJson(decoded);
        notifyListeners();
      } catch (e) {
        print('Error loading unit preferences: $e');
        // Keep default preferences if loading fails
      }
    }
  }

  Future<void> _loadSettings() async {
    final prefs = await SharedPreferences.getInstance();
    _isPushToTalkMode = prefs.getBool('push_to_talk_mode') ?? true;
    notifyListeners();
  }

  Future<void> _loadQueryHistory() async {
    final prefs = await SharedPreferences.getInstance();
    final data = prefs.getString('query_history');
    if (data != null) {
      try {
        // Try to load new format (per-vehicle)
        final Map<String, dynamic> decoded = json.decode(data);
        _vehicleQueryHistory = {};
        for (var entry in decoded.entries) {
          final vehicleId = entry.key;
          final queries = (entry.value as List).map((e) => Map<String, String>.from(e)).toList();
          _vehicleQueryHistory[vehicleId] = queries;
        }
      } catch (e) {
        // Fallback: try to load old format (global list) and migrate
        try {
          final List<dynamic> decoded = json.decode(data);
          if (decoded.isNotEmpty && _activeVehicle != null) {
            final vehicleId = _getVehicleId(_activeVehicle!);
            _vehicleQueryHistory[vehicleId] = decoded.map((e) => Map<String, String>.from(e)).toList();
            // Save in new format
            await prefs.setString('query_history', json.encode(_vehicleQueryHistory));
          }
        } catch (e2) {
          print('Error loading query history: $e2');
          _vehicleQueryHistory = {};
        }
      }
    }

    // Initialize pagination for active vehicle
    if (_activeVehicle != null) {
      _initializePaginationForVehicle(_activeVehicle!);
    }
    notifyListeners();
  }

  Future<void> addQueryToHistory(Map<String, String> query) async {
    if (_activeVehicle == null) return;

    final vehicleId = _getVehicleId(_activeVehicle!);

    // Ensure the vehicle has a history list
    if (_vehicleQueryHistory[vehicleId] == null) {
      _vehicleQueryHistory[vehicleId] = [];
    }
    if (_visibleQueryHistory[vehicleId] == null) {
      _visibleQueryHistory[vehicleId] = [];
    }

    _vehicleQueryHistory[vehicleId]!.insert(0, query);
    _visibleQueryHistory[vehicleId]!.insert(0, query);

    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('query_history', json.encode(_vehicleQueryHistory));

    notifyListeners();
  }

  Future<void> clearQueryHistory() async {
    if (_activeVehicle == null) {
      // Clear all histories
      _vehicleQueryHistory.clear();
      _visibleQueryHistory.clear();
      _resetPagination();
    } else {
      // Clear only active vehicle's history
      final vehicleId = _getVehicleId(_activeVehicle!);
      _vehicleQueryHistory[vehicleId] = [];
      _visibleQueryHistory[vehicleId] = [];
      _resetPaginationForVehicle(vehicleId);
    }

    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('query_history', json.encode(_vehicleQueryHistory));
    notifyListeners();
  }

  void _initializePaginationForVehicle(Vehicle vehicle) {
    final vehicleId = _getVehicleId(vehicle);

    // Initialize pagination state for this vehicle if not exists
    if (_currentMessagePages[vehicleId] == null) {
      _currentMessagePages[vehicleId] = 0;
      _hasMoreMessages[vehicleId] = true;
      _isLoadingMessages[vehicleId] = false;
      _visibleQueryHistory[vehicleId] = [];

      // Ensure the vehicle has a history list
      if (_vehicleQueryHistory[vehicleId] == null) {
        _vehicleQueryHistory[vehicleId] = [];
      }

      // Load first page
      _loadNextMessagePageForVehicle(vehicleId);
    }
  }

  void _resetPagination() {
    _currentMessagePages.clear();
    _hasMoreMessages.clear();
    _isLoadingMessages.clear();
    _visibleQueryHistory.clear();
  }

  void _resetPaginationForVehicle(String vehicleId) {
    _currentMessagePages[vehicleId] = 0;
    _hasMoreMessages[vehicleId] = true;
    _isLoadingMessages[vehicleId] = false;
    _visibleQueryHistory[vehicleId] = [];
  }

  void _loadNextMessagePage() {
    if (_activeVehicle == null) return;
    final vehicleId = _getVehicleId(_activeVehicle!);
    _loadNextMessagePageForVehicle(vehicleId);
  }

  void _loadNextMessagePageForVehicle(String vehicleId) {
    if ((_hasMoreMessages[vehicleId] ?? false) == false ||
        (_isLoadingMessages[vehicleId] ?? false) == true) return;

    _isLoadingMessages[vehicleId] = true;

    final currentPage = _currentMessagePages[vehicleId] ?? 0;
    final vehicleHistory = _vehicleQueryHistory[vehicleId] ?? [];
    final startIndex = currentPage * _messagesPerPage;
    final endIndex = (startIndex + _messagesPerPage).clamp(0, vehicleHistory.length);

    if (startIndex >= vehicleHistory.length) {
      _hasMoreMessages[vehicleId] = false;
      _isLoadingMessages[vehicleId] = false;
      return;
    }

    // Ensure visible history list exists
    if (_visibleQueryHistory[vehicleId] == null) {
      _visibleQueryHistory[vehicleId] = [];
    }

    // Add the next page of messages to visible history
    for (int i = startIndex; i < endIndex; i++) {
      _visibleQueryHistory[vehicleId]!.add(vehicleHistory[i]);
    }

    _currentMessagePages[vehicleId] = currentPage + 1;
    _hasMoreMessages[vehicleId] = endIndex < vehicleHistory.length;
    _isLoadingMessages[vehicleId] = false;
  }

  Future<void> loadMoreMessages() async {
    if (!hasMoreMessages || isLoadingMessages) return;

    _loadNextMessagePage();
    notifyListeners();
  }
}
