import 'package:flutter_test/flutter_test.dart';
import 'package:ddd_mobile/main.dart';

void main() {
  testWidgets('App launches without error', (WidgetTester tester) async {
    await tester.pumpWidget(const DDDApp());
    expect(find.text('DDD'), findsWidgets);
  });
}
