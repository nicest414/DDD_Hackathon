import 'package:ddd_mobile/models/decision_card.dart';
import 'package:ddd_mobile/widgets/proposal_card.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  DecisionCard card({String description = '今日やることを1画面にまとめ、ワンタップで達成できます。'}) =>
      DecisionCard(
        id: 'card-1',
        projectId: 'project-1',
        type: 'moment',
        title: '今日の勝ち筋が一瞬で見える',
        hook: 'アプリを開いた瞬間、何をすればいいか迷わない',
        description: description,
        payoff: '開くたびに「今日は勝てそう」と感じられます。',
        acceptLabel: 'これ欲しい',
        rejectLabel: '今はいらない',
        payload: const {},
        predictedReward: '最初の体験が強くなります',
        noveltyScore: 0.7,
        effortScore: 0.4,
        dopamineScore: 0.9,
      );

  Widget testBed(DecisionCard card) => MaterialApp(
    home: Scaffold(
      body: Center(
        child: SizedBox(
          width: 360,
          height: 700,
          child: ProposalCardWidget(
            card: card,
            heartActive: false,
            onAdopt: () {},
            onSkip: () {},
            onPrevious: () {},
          ),
        ),
      ),
    ),
  );

  Widget callbackTestBed({
    required DecisionCard card,
    required VoidCallback onAdopt,
    required VoidCallback onSkip,
    required VoidCallback onPrevious,
  }) => MaterialApp(
    home: Scaffold(
      body: Center(
        child: SizedBox(
          width: 360,
          height: 700,
          child: ProposalCardWidget(
            card: card,
            heartActive: true,
            onAdopt: onAdopt,
            onSkip: onSkip,
            onPrevious: onPrevious,
          ),
        ),
      ),
    ),
  );

  testWidgets('renders the main DecisionCard fields', (tester) async {
    await tester.pumpWidget(testBed(card()));

    expect(find.text('moment'), findsOneWidget);
    expect(find.text('今日の勝ち筋が一瞬で見える'), findsOneWidget);
    expect(find.text('アプリを開いた瞬間、何をすればいいか迷わない'), findsOneWidget);
    expect(find.text('今日やることを1画面にまとめ、ワンタップで達成できます。'), findsOneWidget);
    expect(find.text('最初の体験が強くなります'), findsOneWidget);
    expect(find.text('開くたびに「今日は勝てそう」と感じられます。'), findsOneWidget);
    expect(find.text('快感'), findsOneWidget);
    expect(find.text('新規性'), findsOneWidget);
    expect(find.text('軽さ'), findsOneWidget);
  });

  testWidgets('long descriptions do not overflow the card', (tester) async {
    final longDescription = List.filled(
      16,
      '長い説明文でもカード外へ押し出さず、本文領域だけで読めるようにします。',
    ).join();

    await tester.pumpWidget(testBed(card(description: longDescription)));

    expect(tester.takeException(), isNull);
  });

  testWidgets('vertical drags are reserved for the surrounding page view', (
    tester,
  ) async {
    var adoptCount = 0;
    var skipCount = 0;
    var previousCount = 0;

    await tester.pumpWidget(
      callbackTestBed(
        card: card(),
        onAdopt: () => adoptCount++,
        onSkip: () => skipCount++,
        onPrevious: () => previousCount++,
      ),
    );

    await tester.drag(find.byType(ProposalCardWidget), const Offset(0, -160));
    await tester.pump();

    expect(adoptCount, 0);
    expect(skipCount, 0);
    expect(previousCount, 0);
  });
}
