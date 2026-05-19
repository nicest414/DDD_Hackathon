class DecisionCard {
  static const validTypes = {
    'concept',
    'feature',
    'ui',
    'flow',
    'data',
    'moment',
    'reward',
    'polish',
    'risk',
  };

  static const validStatuses = {'pending', 'accepted', 'rejected'};

  final String id;
  final String projectId;
  final String type;
  final String title;
  final String hook;
  final String description;
  final String payoff;
  final String acceptLabel;
  final String rejectLabel;
  final Map<String, dynamic> payload;
  final String predictedReward;
  final double noveltyScore;
  final double effortScore;
  final double dopamineScore;
  String status;

  DecisionCard({
    required this.id,
    required this.projectId,
    required this.type,
    required this.title,
    required this.hook,
    required this.description,
    required this.payoff,
    required this.acceptLabel,
    required this.rejectLabel,
    required this.payload,
    required this.predictedReward,
    required this.noveltyScore,
    required this.effortScore,
    required this.dopamineScore,
    this.status = 'pending',
  });

  factory DecisionCard.fromJson(Map<String, dynamic> json) => DecisionCard(
    id: _string(json['id']),
    projectId: _string(json['projectId']),
    type: _oneOf(json['type'], validTypes, 'feature'),
    title: _string(json['title']),
    hook: _string(json['hook'], fallback: _string(json['title'])),
    description: _string(json['description']),
    payoff: _string(
      json['payoff'],
      fallback: _string(
        json['predictedReward'],
        fallback: _string(json['description']),
      ),
    ),
    acceptLabel: _string(json['acceptLabel'], fallback: 'これ欲しい'),
    rejectLabel: _string(json['rejectLabel'], fallback: '今はいらない'),
    payload: _map(json['payload']),
    predictedReward: _string(json['predictedReward']),
    noveltyScore: _score(json['noveltyScore']),
    effortScore: _score(json['effortScore']),
    dopamineScore: _score(json['dopamineScore']),
    status: _oneOf(json['status'], validStatuses, 'pending'),
  );

  Map<String, dynamic> toJson() => {
    'id': id,
    'projectId': projectId,
    'type': type,
    'title': title,
    'hook': hook,
    'description': description,
    'payoff': payoff,
    'acceptLabel': acceptLabel,
    'rejectLabel': rejectLabel,
    'payload': payload,
    'predictedReward': predictedReward,
    'noveltyScore': noveltyScore,
    'effortScore': effortScore,
    'dopamineScore': dopamineScore,
    'status': status,
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

  static double _score(Object? value) {
    final score = switch (value) {
      num n => n.toDouble(),
      String s => double.tryParse(s) ?? 0.5,
      _ => 0.5,
    };
    return score.clamp(0.0, 1.0).toDouble();
  }

  static Map<String, dynamic> _map(Object? value) {
    if (value is Map) {
      return Map<String, dynamic>.from(value);
    }
    return {};
  }
}
