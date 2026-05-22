import 'package:ddd_mobile/models/project.dart';
import 'package:ddd_mobile/screens/swipe_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('waits for cards instead of rendering fixture cards', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        home: SwipeScreen(
          connectOnInit: false,
          project: Project(
            id: 'project-1',
            title: 'Test project',
            initialPrompt: 'Build a test app',
          ),
        ),
      ),
    );

    expect(
      find.text('Waiting for the next card from the VS Code extension.'),
      findsOneWidget,
    );
    expect(find.byType(CircularProgressIndicator), findsOneWidget);
    expect(find.text('0 / 0'), findsOneWidget);
  });
}
