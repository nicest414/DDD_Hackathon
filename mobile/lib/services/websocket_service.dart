import 'dart:async';
import 'dart:convert';
import 'dart:developer' as developer;
import 'package:flutter/foundation.dart';
import 'package:web_socket_channel/web_socket_channel.dart';
import '../models/decision.dart';
import '../models/decision_card.dart';
import '../models/project.dart';

enum WsStatus { disconnected, connecting, connected }

sealed class WsIncomingEvent {}

class WsCardEvent extends WsIncomingEvent {
  final DecisionCard card;
  WsCardEvent(this.card);
}

class WsPreviewEvent extends WsIncomingEvent {
  final String projectId;
  final String url;
  WsPreviewEvent({required this.projectId, required this.url});
}

class WsPrEvent extends WsIncomingEvent {
  final String projectId;
  final String repositoryUrl;
  final String branchName;
  final String url;
  final String status;
  WsPrEvent({
    required this.projectId,
    required this.repositoryUrl,
    required this.branchName,
    required this.url,
    required this.status,
  });
}

class WsErrorEvent extends WsIncomingEvent {
  final String? projectId;
  final String code;
  final String message;
  final bool recoverable;
  WsErrorEvent({
    this.projectId,
    required this.code,
    required this.message,
    required this.recoverable,
  });
}

class WebSocketService {
  static final WebSocketService _instance = WebSocketService._();
  factory WebSocketService() => _instance;
  WebSocketService._();

  WebSocketChannel? _channel;
  StreamSubscription<dynamic>? _channelSub;
  final _controller = StreamController<WsIncomingEvent>.broadcast();
  final statusNotifier = ValueNotifier<WsStatus>(WsStatus.disconnected);

  WsStatus get status => statusNotifier.value;
  Stream<WsIncomingEvent> get events => _controller.stream;

  Future<void> connect(String url) async {
    if (status != WsStatus.disconnected) return;
    statusNotifier.value = WsStatus.connecting;
    try {
      _channel = WebSocketChannel.connect(Uri.parse(url));
      await _channel!.ready.timeout(const Duration(seconds: 10));
      statusNotifier.value = WsStatus.connected;
      _channelSub = _channel!.stream.listen(
        (raw) {
          Map<String, dynamic> data;
          try {
            data = jsonDecode(raw as String) as Map<String, dynamic>;
          } catch (e, st) {
            developer.log(
              'WebSocket JSON parse failed',
              name: 'WebSocketService',
              error: e,
              stackTrace: st,
            );
            return;
          }
          final event = _parseEvent(data);
          if (event != null) _controller.add(event);
        },
        onDone: _onDisconnect,
        onError: (Object error, StackTrace stackTrace) {
          developer.log(
            'WebSocket stream error',
            name: 'WebSocketService',
            error: error,
            stackTrace: stackTrace,
          );
          _onDisconnect();
        },
      );
    } on TimeoutException catch (error, stackTrace) {
      developer.log(
        'WebSocket connection timed out',
        name: 'WebSocketService',
        error: error,
        stackTrace: stackTrace,
      );
      await _channel?.sink.close();
      _onDisconnect();
    } catch (error, stackTrace) {
      developer.log(
        'WebSocket connection failed',
        name: 'WebSocketService',
        error: error,
        stackTrace: stackTrace,
      );
      await _channel?.sink.close();
      _onDisconnect();
    }
  }

  WsIncomingEvent? _parseEvent(Map<String, dynamic> data) {
    switch (data['type']) {
      case 'card':
        final cardData = data['card'];
        if (cardData is! Map<String, dynamic>) return null;
        try {
          return WsCardEvent(DecisionCard.fromJson(cardData));
        } catch (_) {
          return null;
        }
      case 'preview':
        final previewProjectId = data['projectId'] as String?;
        final previewUrl = data['url'] as String?;
        if (previewProjectId == null || previewUrl == null) {
          developer.log(
            'WebSocket preview event missing required fields',
            name: 'WebSocketService',
          );
          return null;
        }
        return WsPreviewEvent(projectId: previewProjectId, url: previewUrl);
      case 'pr':
        final prProjectId = data['projectId'] as String?;
        if (prProjectId == null) {
          developer.log(
            'WebSocket pr event missing required fields',
            name: 'WebSocketService',
          );
          return null;
        }
        return WsPrEvent(
          projectId: prProjectId,
          repositoryUrl: (data['repositoryUrl'] as String?) ?? '',
          branchName: (data['branchName'] as String?) ?? '',
          url: (data['url'] as String?) ?? '',
          status: (data['status'] as String?) ?? '',
        );
      case 'error':
        return WsErrorEvent(
          projectId: data['projectId'] as String?,
          code: (data['code'] as String?) ?? 'UNKNOWN_ERROR',
          message: (data['message'] as String?) ?? '',
          recoverable: (data['recoverable'] as bool?) ?? false,
        );
      default:
        developer.log(
          'WebSocket unknown event type: ${data['type']}',
          name: 'WebSocketService',
        );
        return null;
    }
  }

  Future<void> disconnect() async {
    await _channelSub?.cancel();
    _channelSub = null;
    try {
      await _channel?.sink.close();
    } catch (error, stackTrace) {
      developer.log(
        'WebSocket disconnect failed',
        name: 'WebSocketService',
        error: error,
        stackTrace: stackTrace,
      );
    }
    _onDisconnect();
  }

  void sendDecision(Decision decision) {
    if (status != WsStatus.connected) return;
    final payload = {
      'type': 'swipe',
      'projectId': decision.projectId,
      'cardId': decision.cardId,
      'action': decision.action,
      'createdAt': decision.createdAt.toIso8601String(),
    };
    try {
      _channel!.sink.add(jsonEncode(payload));
    } catch (error, stackTrace) {
      developer.log(
        'WebSocket send failed in sendDecision',
        name: 'WebSocketService',
        error: error,
        stackTrace: stackTrace,
      );
      _onDisconnect();
    }
  }

  void sendStartSession(Project project) {
    if (status != WsStatus.connected) return;
    final payload = {'type': 'startSession', 'project': project.toJson()};
    try {
      _channel!.sink.add(jsonEncode(payload));
    } catch (error, stackTrace) {
      developer.log(
        'WebSocket send failed in sendStartSession',
        name: 'WebSocketService',
        error: error,
        stackTrace: stackTrace,
      );
      _onDisconnect();
    }
  }

  Future<void> dispose() async {
    await disconnect();
    await _controller.close();
    statusNotifier.dispose();
  }

  void _onDisconnect() {
    statusNotifier.value = WsStatus.disconnected;
    _channel = null;
  }
}
