class DecisionCard {
  final String id;
  final String projectId;
  final String type; // concept / feature / ui / flow / data
  final String title;
  final String description;
  final Map<String, dynamic> payload;
  final String predictedReward;
  final double noveltyScore;
  final double effortScore;
  String status; // pending / accepted / rejected

  DecisionCard({
    required this.id,
    required this.projectId,
    required this.type,
    required this.title,
    required this.description,
    required this.payload,
    required this.predictedReward,
    required this.noveltyScore,
    required this.effortScore,
    this.status = 'pending',
  });

  factory DecisionCard.fromJson(Map<String, dynamic> json) => DecisionCard(
        id: json['id'] as String,
        projectId: json['projectId'] as String? ?? '',
        type: json['type'] as String? ?? 'feature',
        title: json['title'] as String,
        description: json['description'] as String,
        payload: (json['payload'] as Map<String, dynamic>?) ?? {},
        predictedReward: json['predictedReward'] as String? ?? '',
        noveltyScore: (json['noveltyScore'] as num?)?.toDouble() ?? 0.5,
        effortScore: (json['effortScore'] as num?)?.toDouble() ?? 0.5,
        status: json['status'] as String? ?? 'pending',
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'projectId': projectId,
        'type': type,
        'title': title,
        'description': description,
        'payload': payload,
        'predictedReward': predictedReward,
        'noveltyScore': noveltyScore,
        'effortScore': effortScore,
        'status': status,
      };
}
