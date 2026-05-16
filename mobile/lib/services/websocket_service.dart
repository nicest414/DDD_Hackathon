import 'dart:async';
import 'dart:convert';
import 'dart:developer' as developer;
import 'package:web_socket_channel/web_socket_channel.dart';
import '../models/decision.dart';

enum WsStatus { disconnected, connecting, connected }

class WebSocketService {
  static final WebSocketService _instance = WebSocketService._();
  factory WebSocketService() => _instance;
  WebSocketService._();

  WebSocketChannel? _channel;
  StreamSubscription<dynamic>? _channelSub;
  final _controller = StreamController<Map<String, dynamic>>.broadcast();
  WsStatus status = WsStatus.disconnected;

  Stream<Map<String, dynamic>> get messages => _controller.stream;

  Future<void> connect(String url) async {
    if (status != WsStatus.disconnected) return;
    status = WsStatus.connecting;
    try {
      _channel = WebSocketChannel.connect(Uri.parse(url));
      await _channel!.ready.timeout(const Duration(seconds: 10));
      status = WsStatus.connected;
      _channelSub = _channel!.stream.listen(
        (raw) {
          final data = jsonDecode(raw as String) as Map<String, dynamic>;
          _controller.add(data);
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

  void sendDecision(Decision decision, String projectId) {
    if (status != WsStatus.connected) return;
    final payload = {
      'type': 'swipe',
      'projectId': projectId,
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

  void sendStartSession(Map<String, dynamic> project) {
    if (status != WsStatus.connected) return;
    final payload = {'type': 'startSession', 'project': project};
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
  }

  void _onDisconnect() {
    status = WsStatus.disconnected;
    _channel = null;
  }
}
