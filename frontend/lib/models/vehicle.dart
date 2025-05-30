class Vehicle {
  final String name;
  final String engine;
  final String notes;
  final String nickname;

  Vehicle({
    required this.name,
    required this.engine,
    this.notes = '',
    this.nickname = '',
  });

  Vehicle copyWith({
    String? name,
    String? engine,
    String? notes,
    String? nickname,
  }) {
    return Vehicle(
      name: name ?? this.name,
      engine: engine ?? this.engine,
      notes: notes ?? this.notes,
      nickname: nickname ?? this.nickname,
    );
  }

  // JSON serialization methods for Supabase storage
  Map<String, dynamic> toJson() {
    return {
      'name': name,
      'engine': engine,
      'notes': notes,
      'nickname': nickname,
    };
  }

  factory Vehicle.fromJson(Map<String, dynamic> json) {
    return Vehicle(
      name: json['name'] ?? '',
      engine: json['engine'] ?? '',
      notes: json['notes'] ?? '',
      nickname: json['nickname'] ?? '',
    );
  }
}
