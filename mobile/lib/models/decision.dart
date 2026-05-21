class Decision {
  static const validActions = {'accepted', 'rejected'};

  final String id;
  final String projectId;
  final String cardId;
  final String action;
  final String reason;
  final DateTime createdAt;

  Decision({
    required this.id,
    required this.projectId,
    required this.cardId,
    required this.action,
    this.reason = '',
    DateTime? createdAt,
  }) : createdAt = createdAt ?? DateTime.now();

  factory Decision.fromJson(Map<String, dynamic> json) => Decision(
    id: _string(json['id']),
    projectId: _string(json['projectId']),
    cardId: _string(json['cardId']),
    action: _oneOf(json['action'], validActions, 'rejected'),
    reason: _string(json['reason']),
    createdAt: _dateTime(json['createdAt']),
  );

  Map<String, dynamic> toJson() => {
    'id': id,
    'projectId': projectId,
    'cardId': cardId,
    'action': action,
    'reason': reason,
    'createdAt': createdAt.toIso8601String(),
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
    if (value is num) {
      return DateTime.fromMillisecondsSinceEpoch(value.toInt());
    }
    return DateTime.now();
  }
}
