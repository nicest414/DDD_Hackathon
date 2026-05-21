import 'package:ddd_mobile/screens/result_screen.dart';
import 'package:ddd_mobile/services/websocket_service.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('ResultEventSummary', () {
    test('tracks preview events', () {
      final summary = const ResultEventSummary().apply(
        WsPreviewEvent(projectId: 'project-1', url: 'http://localhost:5173'),
      );

      expect(summary.isWaiting, isFalse);
      expect(summary.previewUrl, 'http://localhost:5173');
    });

    test('tracks created pull request events', () {
      final summary = const ResultEventSummary().apply(
        WsPrEvent(
          projectId: 'project-1',
          repositoryUrl: 'https://github.com/example/ddd-demo',
          branchName: 'ddd/project-1',
          url: 'https://github.com/example/ddd-demo/pull/1',
          status: 'created',
        ),
      );

      expect(summary.prStatus, 'created');
      expect(summary.prUrl, 'https://github.com/example/ddd-demo/pull/1');
      expect(summary.branchName, 'ddd/project-1');
    });

    test('tracks local save fallback events', () {
      final summary = const ResultEventSummary().apply(
        WsPrEvent(
          projectId: 'project-1',
          repositoryUrl: '',
          branchName: 'ddd/project-1',
          url: '',
          status: 'localSaved',
        ),
      );

      expect(summary.prStatus, 'localSaved');
      expect(summary.prUrl, isEmpty);
      expect(summary.branchName, 'ddd/project-1');
    });

    test('tracks error events', () {
      final summary = const ResultEventSummary().apply(
        WsErrorEvent(
          projectId: 'project-1',
          code: 'PREVIEW_FAILED',
          message: 'Preview failed.',
          recoverable: true,
        ),
      );

      expect(summary.hasError, isTrue);
      expect(summary.errorMessage, 'Preview failed.');
    });

    test('transitions from preview to PR event', () {
      var summary = const ResultEventSummary();
      summary = summary.apply(
        WsPreviewEvent(projectId: 'project-1', url: 'http://localhost:5173'),
      );
      summary = summary.apply(
        WsPrEvent(
          projectId: 'project-1',
          repositoryUrl: '',
          branchName: 'ddd/project-1',
          url: 'https://github.com/example/ddd-demo/pull/1',
          status: 'created',
        ),
      );

      expect(summary.previewUrl, 'http://localhost:5173');
      expect(summary.prStatus, 'created');
      expect(summary.prUrl, 'https://github.com/example/ddd-demo/pull/1');
      expect(summary.branchName, 'ddd/project-1');
    });

    test('recovers from error state', () {
      var summary = const ResultEventSummary();
      summary = summary.apply(
        WsErrorEvent(
          projectId: 'project-1',
          code: 'PREVIEW_FAILED',
          message: 'Preview failed.',
          recoverable: true,
        ),
      );
      summary = summary.apply(
        WsPreviewEvent(projectId: 'project-1', url: 'http://localhost:5174'),
      );

      expect(summary.hasError, isFalse);
      expect(summary.errorMessage, isEmpty);
      expect(summary.previewUrl, 'http://localhost:5174');
    });

    test('updates preview url on subsequent preview events', () {
      var summary = const ResultEventSummary();
      summary = summary.apply(
        WsPreviewEvent(projectId: 'project-1', url: 'http://localhost:5173'),
      );
      summary = summary.apply(
        WsPreviewEvent(projectId: 'project-1', url: 'http://localhost:5174'),
      );

      expect(summary.previewUrl, 'http://localhost:5174');
    });

    test('preserves preview and falls back to Japanese error message', () {
      var summary = const ResultEventSummary();
      summary = summary.apply(
        WsPreviewEvent(projectId: 'project-1', url: 'http://localhost:5173'),
      );
      summary = summary.apply(
        WsErrorEvent(
          projectId: 'project-1',
          code: 'UNKNOWN_ERROR',
          message: '',
          recoverable: true,
        ),
      );

      expect(summary.previewUrl, 'http://localhost:5173');
      expect(summary.hasError, isTrue);
      expect(summary.errorMessage, '不明なエラー');
    });

    test('does not throw on empty string fields', () {
      var summary = const ResultEventSummary();

      expect(
        () => summary = summary.apply(
          WsPreviewEvent(projectId: 'project-1', url: ''),
        ),
        returnsNormally,
      );
      expect(summary.previewUrl, isEmpty);

      expect(
        () => summary = summary.apply(
          WsPrEvent(
            projectId: 'project-1',
            repositoryUrl: '',
            branchName: '',
            url: '',
            status: 'created',
          ),
        ),
        returnsNormally,
      );
      expect(summary.branchName, isEmpty);
      expect(summary.prUrl, isEmpty);

      expect(
        () => summary = summary.apply(
          WsErrorEvent(
            projectId: 'project-1',
            code: 'UNKNOWN_ERROR',
            message: '',
            recoverable: false,
          ),
        ),
        returnsNormally,
      );
      expect(summary.errorMessage, '不明なエラー');
    });
  });
}
