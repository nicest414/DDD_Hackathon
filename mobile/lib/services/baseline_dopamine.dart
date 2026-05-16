import '../models/decision_card.dart';
import '../models/decision.dart';

// Fallback mock cards used when WebSocket is not connected.
class BaselineDopamine {
  static final BaselineDopamine _instance = BaselineDopamine._();
  factory BaselineDopamine() => _instance;
  BaselineDopamine._();

  static const _mockCards = [
    {
      'id': 'mock-1',
      'type': 'feature',
      'title': '習慣の登録・管理',
      'description': 'ユーザーが習慣を名前・頻度・カテゴリで登録できます。アイコンやカラーで視覚的に区別できるようにします。',
      'predictedReward': 'アプリの基本機能が揃います',
      'noveltyScore': 0.8,
      'effortScore': 0.5,
    },
    {
      'id': 'mock-2',
      'type': 'feature',
      'title': '今日の達成チェック',
      'description': 'ホーム画面に今日完了すべき習慣を一覧表示し、タップ一つで達成マークをつけられます。',
      'predictedReward': '毎日の操作の中心になります',
      'noveltyScore': 0.7,
      'effortScore': 0.4,
    },
    {
      'id': 'mock-3',
      'type': 'feature',
      'title': '連続達成日数（ストリーク）',
      'description': '何日連続で達成できているかをカウント表示します。途切れると0にリセットされ、継続のモチベーションになります。',
      'predictedReward': '継続意欲が上がります',
      'noveltyScore': 0.9,
      'effortScore': 0.6,
    },
    {
      'id': 'mock-4',
      'type': 'ui',
      'title': '週間グラフ',
      'description': '達成率をグラフで可視化し、どの習慣が続いているかを一目で把握できます。',
      'predictedReward': '振り返りがしやすくなります',
      'noveltyScore': 0.6,
      'effortScore': 0.7,
    },
    {
      'id': 'mock-5',
      'type': 'feature',
      'title': 'リマインダー通知',
      'description': '習慣ごとに好きな時間にプッシュ通知を設定できます。「やり忘れ」を防ぎます。',
      'predictedReward': '継続率が上がります',
      'noveltyScore': 0.7,
      'effortScore': 0.8,
    },
    {
      'id': 'mock-6',
      'type': 'ui',
      'title': 'ダークモード対応',
      'description': 'システム設定に応じて自動でダーク/ライトを切り替えます。夜間の使用でも目に優しくなります。',
      'predictedReward': '視認性が向上します',
      'noveltyScore': 0.4,
      'effortScore': 0.3,
    },
  ];

  DecisionCard getNextCard(List<Decision> decisions) {
    final usedIds = decisions.map((d) => d.cardId).toSet();
    final remaining = _mockCards.where((c) => !usedIds.contains(c['id'])).toList();
    if (remaining.isEmpty) return _fromMap(_mockCards.last, 'mock-extra');
    return _fromMap(remaining.first, remaining.first['id'] as String);
  }

  bool hasMore(List<Decision> decisions) {
    final usedIds = decisions.map((d) => d.cardId).toSet();
    return _mockCards.any((c) => !usedIds.contains(c['id']));
  }

  int totalCards() => _mockCards.length;

  DecisionCard _fromMap(Map<String, dynamic> m, String id) => DecisionCard(
        id: id,
        projectId: 'mock-project',
        type: m['type'] as String,
        title: m['title'] as String,
        description: m['description'] as String,
        payload: {},
        predictedReward: m['predictedReward'] as String,
        noveltyScore: m['noveltyScore'] as double,
        effortScore: m['effortScore'] as double,
      );
}
