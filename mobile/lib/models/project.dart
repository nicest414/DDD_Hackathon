class Project {
  static const validStatuses = {'draft', 'building', 'generated', 'failed'};

  final String id;
  final String title;
  final String initialPrompt;
  String status;
  final DateTime createdAt;
  DateTime updatedAt;

  Project({
    required this.id,
    required this.title,
    required this.initialPrompt,
    this.status = 'draft',
    DateTime? createdAt,
    DateTime? updatedAt,
  }) : createdAt = createdAt ?? DateTime.now(),
       updatedAt = updatedAt ?? DateTime.now();

  factory Project.fromJson(Map<String, dynamic> json) => Project(
    id: _string(json['id']),
    title: _string(json['title']),
    initialPrompt: _string(json['initialPrompt']),
    status: _oneOf(json['status'], validStatuses, 'draft'),
    createdAt: _dateTime(json['createdAt']),
    updatedAt: _dateTime(json['updatedAt']),
  );

  Map<String, dynamic> toJson() => {
    'id': id,
    'title': title,
    'initialPrompt': initialPrompt,
    'status': status,
    'createdAt': createdAt.toIso8601String(),
    'updatedAt': updatedAt.toIso8601String(),
  };

  static String _string(Object? value, {String fallback = ''}) {
    if (value is String && value.trim().isNotEmpty) {
      return value;
    }
    return fallback;
  }

  static String _oneOf(Object? value, Set<String> allowed, String fallback) {
    if (value is String && allowed.contains(value)) {
      return value;
    }
    return fallback;
  }

  static DateTime _dateTime(Object? value) {
    if (value is DateTime) {
      return value;
    }
    if (value is String) {
      return DateTime.tryParse(value) ?? DateTime.now();
    }
    return DateTime.now();
  }
}
