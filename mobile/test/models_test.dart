import 'package:flutter_test/flutter_test.dart';
import 'package:ddd_mobile/models/decision.dart';
import 'package:ddd_mobile/models/decision_card.dart';
import 'package:ddd_mobile/models/project.dart';

void main() {
  group('DecisionCard', () {
    test('restores from the card event sample JSON', () {
      final card = DecisionCard.fromJson({
        'id': 'card-1',
        'projectId': 'project-1',
        'type': 'moment',
        'title': '今日の勝ち筋が一瞬で見える',
        'hook': 'アプリを開いた瞬間、何をすればいいか迷わない',
        'description': '今日やることを1画面にまとめ、ワンタップで達成できます。',
        'payoff': '開くたびに「今日は勝てそう」と感じられます。',
        'acceptLabel': 'これ欲しい',
        'rejectLabel': '今はいらない',
        'payload': <String, dynamic>{},
        'predictedReward': '最初の体験が強くなります',
        'noveltyScore': 0.7,
        'effortScore': 0.4,
        'dopamineScore': 0.9,
        'status': 'pending',
      });

      expect(card.id, 'card-1');
      expect(card.projectId, 'project-1');
      expect(card.type, 'moment');
      expect(card.hook, 'アプリを開いた瞬間、何をすればいいか迷わない');
      expect(card.payoff, '開くたびに「今日は勝てそう」と感じられます。');
      expect(card.acceptLabel, 'これ欲しい');
      expect(card.rejectLabel, '今はいらない');
      expect(card.dopamineScore, 0.9);
      expect(card.toJson()['dopamineScore'], 0.9);
    });

    test('falls back safely for unknown types and missing values', () {
      final card = DecisionCard.fromJson({
        'id': 'card-2',
        'projectId': 'project-1',
        'type': 'unknown',
        'title': 'Fallback title',
        'noveltyScore': 2,
        'effortScore': -1,
        'dopamineScore': '0.8',
        'status': 'done',
      });

      expect(card.type, 'feature');
      expect(card.hook, 'Fallback title');
      expect(card.payoff, '');
      expect(card.acceptLabel, 'これ欲しい');
      expect(card.rejectLabel, '今はいらない');
      expect(card.noveltyScore, 1);
      expect(card.effortScore, 0);
      expect(card.dopamineScore, 0.8);
      expect(card.status, 'pending');
    });
  });

  test('Decision includes projectId in swipe JSON', () {
    final decision = Decision(
      id: 'decision-1',
      projectId: 'project-1',
      cardId: 'card-1',
      action: 'accepted',
      createdAt: DateTime.parse('2026-05-19T10:00:10.000Z'),
    );

    expect(decision.toJson(), {
      'id': 'decision-1',
      'projectId': 'project-1',
      'cardId': 'card-1',
      'action': 'accepted',
      'reason': '',
      'createdAt': '2026-05-19T10:00:10.000Z',
    });
  });

  test('Project accepts failed status and falls back for unknown status', () {
    final failed = Project.fromJson({
      'id': 'project-1',
      'title': 'Demo',
      'initialPrompt': 'Build it',
      'status': 'failed',
      'createdAt': '2026-05-19T10:00:00.000Z',
      'updatedAt': '2026-05-19T10:00:00.000Z',
    });
    final unknown = Project.fromJson({'status': 'unknown'});

    expect(failed.status, 'failed');
    expect(unknown.status, 'draft');
  });
}
