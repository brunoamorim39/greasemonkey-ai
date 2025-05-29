import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'dart:convert';
import '../models/vehicle.dart';

class AppState extends ChangeNotifier {
  final List<Vehicle> _vehicles = [];
  Vehicle? _activeVehicle;
  String? _userId;
  List<Map<String, String>> _queryHistory = [];

  List<Vehicle> get vehicles => List.unmodifiable(_vehicles);
  Vehicle? get activeVehicle => _activeVehicle;
  String? get userId => _userId;
  List<Map<String, String>> get queryHistory => List.unmodifiable(_queryHistory);

  AppState() {
    _loadQueryHistory();
  }

  void addVehicle(Vehicle vehicle) {
    _vehicles.add(vehicle);
    notifyListeners();
  }

  void setActiveVehicle(Vehicle vehicle) {
    _activeVehicle = vehicle;
    notifyListeners();
  }

  void setUserId(String userId) {
    _userId = userId;
    notifyListeners();
  }

  Future<void> _loadQueryHistory() async {
    final prefs = await SharedPreferences.getInstance();
    final data = prefs.getString('query_history');
    if (data != null) {
      final List<dynamic> decoded = json.decode(data);
      _queryHistory = decoded.map((e) => Map<String, String>.from(e)).toList();
      notifyListeners();
    }
  }

  Future<void> addQueryToHistory(Map<String, String> query) async {
    _queryHistory.insert(0, query);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('query_history', json.encode(_queryHistory));
    notifyListeners();
  }

  Future<void> clearQueryHistory() async {
    _queryHistory.clear();
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('query_history');
    notifyListeners();
  }
}
