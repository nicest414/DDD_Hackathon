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
      'type': 'moment',
      'title': '習慣の登録・管理',
      'hook': '続けたいことを迷わず1分でセットできます。',
      'description': 'ユーザーが習慣を名前・頻度・カテゴリで登録できます。アイコンやカラーで視覚的に区別できるようにします。',
      'payoff': '始めた瞬間に、自分専用の習慣リストが育ち始めます。',
      'acceptLabel': 'これ欲しい',
      'rejectLabel': '今はいらない',
      'predictedReward': 'アプリの基本機能が揃います',
      'noveltyScore': 0.8,
      'effortScore': 0.5,
      'dopamineScore': 0.7,
    },
    {
      'id': 'mock-2',
      'type': 'reward',
      'title': '今日の達成チェック',
      'hook': '今日やることが開いた瞬間に見えます。',
      'description': 'ホーム画面に今日完了すべき習慣を一覧表示し、タップ一つで達成マークをつけられます。',
      'payoff': 'ワンタップで今日の前進が記録され、達成感がすぐ返ってきます。',
      'acceptLabel': '入れたい',
      'rejectLabel': '後でいい',
      'predictedReward': '毎日の操作の中心になります',
      'noveltyScore': 0.7,
      'effortScore': 0.4,
      'dopamineScore': 0.9,
    },
    {
      'id': 'mock-3',
      'type': 'reward',
      'title': '連続達成日数（ストリーク）',
      'hook': '続いている自分が数字で見えます。',
      'description': '何日連続で達成できているかをカウント表示します。途切れると0にリセットされ、継続のモチベーションになります。',
      'payoff': '途切れさせたくない気持ちが自然に生まれます。',
      'acceptLabel': '燃える',
      'rejectLabel': '不要',
      'predictedReward': '継続意欲が上がります',
      'noveltyScore': 0.9,
      'effortScore': 0.6,
      'dopamineScore': 0.95,
    },
    {
      'id': 'mock-4',
      'type': 'polish',
      'title': '週間グラフ',
      'hook': '1週間の頑張りがひと目でわかります。',
      'description': '達成率をグラフで可視化し、どの習慣が続いているかを一目で把握できます。',
      'payoff': '振り返るたびに次も続けようと思えます。',
      'acceptLabel': '見たい',
      'rejectLabel': 'いらない',
      'predictedReward': '振り返りがしやすくなります',
      'noveltyScore': 0.6,
      'effortScore': 0.7,
      'dopamineScore': 0.65,
    },
    {
      'id': 'mock-5',
      'type': 'risk',
      'title': 'リマインダー通知',
      'hook': '忘れる前にやさしく背中を押します。',
      'description': '習慣ごとに好きな時間にプッシュ通知を設定できます。「やり忘れ」を防ぎます。',
      'payoff': '忙しい日でも習慣が生活の流れから消えにくくなります。',
      'acceptLabel': '助かる',
      'rejectLabel': '通知は不要',
      'predictedReward': '継続率が上がります',
      'noveltyScore': 0.7,
      'effortScore': 0.8,
      'dopamineScore': 0.75,
    },
    {
      'id': 'mock-6',
      'type': 'polish',
      'title': 'ダークモード対応',
      'hook': '夜でも気持ちよく開けます。',
      'description': 'システム設定に応じて自動でダーク/ライトを切り替えます。夜間の使用でも目に優しくなります。',
      'payoff': '毎日使う画面のストレスが小さくなります。',
      'acceptLabel': '整えたい',
      'rejectLabel': '後回し',
      'predictedReward': '視認性が向上します',
      'noveltyScore': 0.4,
      'effortScore': 0.3,
      'dopamineScore': 0.5,
    },
  ];

  DecisionCard getNextCard(List<Decision> decisions) {
    final usedIds = decisions.map((d) => d.cardId).toSet();
    final remaining = _mockCards
        .where((c) => !usedIds.contains(c['id']))
        .toList();
    if (remaining.isEmpty) return _fromMap(_mockCards.last, 'mock-extra');
    return _fromMap(remaining.first, remaining.first['id'] as String);
  }

  bool hasMore(List<Decision> decisions) {
    final usedIds = decisions.map((d) => d.cardId).toSet();
    return _mockCards.any((c) => !usedIds.contains(c['id']));
  }

  int totalCards() => _mockCards.length;

  DecisionCard _fromMap(Map<String, dynamic> m, String id) =>
      DecisionCard.fromJson({
        ...m,
        'id': id,
        'projectId': 'mock-project',
        'payload': {},
      });
}
