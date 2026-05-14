import 'dart:async';
import 'dart:convert';
import 'package:web_socket_channel/web_socket_channel.dart';
import '../models/decision.dart';

enum WsStatus { disconnected, connecting, connected }

class WebSocketService {
  static final WebSocketService _instance = WebSocketService._();
  factory WebSocketService() => _instance;
  WebSocketService._();

  WebSocketChannel? _channel;
  final _controller = StreamController<Map<String, dynamic>>.broadcast();
  WsStatus status = WsStatus.disconnected;

  Stream<Map<String, dynamic>> get messages => _controller.stream;

  Future<void> connect(String url) async {
    if (status != WsStatus.disconnected) return;
    status = WsStatus.connecting;
    try {
      _channel = WebSocketChannel.connect(Uri.parse(url));
      await _channel!.ready;
      status = WsStatus.connected;
      _channel!.stream.listen(
        (raw) {
          final data = jsonDecode(raw as String) as Map<String, dynamic>;
          _controller.add(data);
        },
        onDone: _onDisconnect,
        onError: (_) => _onDisconnect(),
      );
    } catch (_) {
      status = WsStatus.disconnected;
    }
  }

  void disconnect() {
    _channel?.sink.close();
    _onDisconnect();
  }

  void sendDecision(Decision decision, String projectId) {
    if (status != WsStatus.connected) return;
    _channel!.sink.add(jsonEncode({
      'type': 'swipe',
      'projectId': projectId,
      'cardId': decision.cardId,
      'action': decision.action,
      'createdAt': decision.createdAt.toIso8601String(),
    }));
  }

  void sendStartSession(Map<String, dynamic> project) {
    if (status != WsStatus.connected) return;
    _channel!.sink.add(jsonEncode({'type': 'startSession', 'project': project}));
  }

  void _onDisconnect() {
    status = WsStatus.disconnected;
    _channel = null;
  }
}
