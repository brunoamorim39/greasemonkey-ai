import 'package:supabase_flutter/supabase_flutter.dart';
import '../models/vehicle.dart';

class VehicleService {
  static final _supabase = Supabase.instance.client;

  /// Load vehicles for a user from Supabase
  static Future<List<Vehicle>> loadVehicles(String userId) async {
    try {
      final response = await _supabase
          .from('users')
          .select('garage')
          .eq('user_id', userId)
          .single();

      if (response['garage'] != null) {
        final List<dynamic> garageData = response['garage'];
        return garageData
            .map((vehicleData) => Vehicle.fromJson(vehicleData))
            .toList();
      }
      return [];
    } catch (e) {
      print('Error loading vehicles: $e');
      return [];
    }
  }

  /// Save vehicles for a user to Supabase
  static Future<bool> saveVehicles(String userId, List<Vehicle> vehicles) async {
    try {
      final vehiclesJson = vehicles.map((v) => v.toJson()).toList();

      await _supabase
          .from('users')
          .update({'garage': vehiclesJson})
          .eq('user_id', userId);

      return true;
    } catch (e) {
      print('Error saving vehicles: $e');
      return false;
    }
  }

  /// Add a single vehicle and save to Supabase
  static Future<bool> addVehicle(String userId, Vehicle vehicle, List<Vehicle> currentVehicles) async {
    try {
      final updatedVehicles = [...currentVehicles, vehicle];
      return await saveVehicles(userId, updatedVehicles);
    } catch (e) {
      print('Error adding vehicle: $e');
      return false;
    }
  }

  /// Update a vehicle and save to Supabase
  static Future<bool> updateVehicle(String userId, int index, Vehicle updatedVehicle, List<Vehicle> currentVehicles) async {
    try {
      if (index >= 0 && index < currentVehicles.length) {
        final updatedVehicles = [...currentVehicles];
        updatedVehicles[index] = updatedVehicle;
        return await saveVehicles(userId, updatedVehicles);
      }
      return false;
    } catch (e) {
      print('Error updating vehicle: $e');
      return false;
    }
  }

  /// Remove a vehicle and save to Supabase
  static Future<bool> removeVehicle(String userId, int index, List<Vehicle> currentVehicles) async {
    try {
      if (index >= 0 && index < currentVehicles.length) {
        final updatedVehicles = [...currentVehicles];
        updatedVehicles.removeAt(index);
        return await saveVehicles(userId, updatedVehicles);
      }
      return false;
    } catch (e) {
      print('Error removing vehicle: $e');
      return false;
    }
  }
}
