class Decision {
  final String id;
  final String cardId;
  final String action; // accepted / rejected
  final String reason;
  final DateTime createdAt;

  Decision({
    required this.id,
    required this.cardId,
    required this.action,
    this.reason = '',
    DateTime? createdAt,
  }) : createdAt = createdAt ?? DateTime.now();

  Map<String, dynamic> toJson() => {
        'id': id,
        'cardId': cardId,
        'action': action,
        'reason': reason,
        'createdAt': createdAt.toIso8601String(),
      };
}
