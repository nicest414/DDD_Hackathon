class Project {
  final String id;
  final String title;
  final String initialPrompt;
  String status; // draft / building / generated
  final DateTime createdAt;
  DateTime updatedAt;

  Project({
    required this.id,
    required this.title,
    required this.initialPrompt,
    this.status = 'draft',
    DateTime? createdAt,
    DateTime? updatedAt,
  })  : createdAt = createdAt ?? DateTime.now(),
        updatedAt = updatedAt ?? DateTime.now();

  Map<String, dynamic> toJson() => {
        'id': id,
        'title': title,
        'initialPrompt': initialPrompt,
        'status': status,
        'createdAt': createdAt.toIso8601String(),
        'updatedAt': updatedAt.toIso8601String(),
      };
}
