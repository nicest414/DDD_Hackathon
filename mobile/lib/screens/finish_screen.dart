import 'dart:async';

import 'package:flutter/material.dart';
import '../services/websocket_service.dart'
    show WebSocketService, WsIncomingEvent, WsPrEvent, WsErrorEvent;
import 'home_screen.dart';

class FinishScreen extends StatefulWidget {
  final String projectId;

  const FinishScreen({super.key, required this.projectId});

  @override
  State<FinishScreen> createState() => _FinishScreenState();
}

class _FinishScreenState extends State<FinishScreen> {
  _FinishState _state = const _FinishLoading();
  StreamSubscription<WsIncomingEvent>? _wsSub;

  @override
  void initState() {
    super.initState();
    _wsSub = WebSocketService().events.listen((event) {
      if (!mounted) return;
      if (event is WsPrEvent && event.projectId == widget.projectId) {
        setState(() => _state = _FinishDone(branchName: event.branchName, prUrl: event.url));
      } else if (event is WsErrorEvent &&
          (event.projectId == null || event.projectId == widget.projectId)) {
        setState(() => _state = _FinishError(message: event.message.isNotEmpty ? event.message : '不明なエラー'));
      }
    });
  }

  @override
  void dispose() {
    _wsSub?.cancel();
    WebSocketService().disconnect();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0f0f1a),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Spacer(),
              _buildContent(),
              const Spacer(),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: () => Navigator.of(context).pushAndRemoveUntil(
                    MaterialPageRoute(builder: (_) => const HomeScreen()),
                    (_) => false,
                  ),
                  style: FilledButton.styleFrom(
                    backgroundColor: const Color(0xFF7c3aed),
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                    ),
                  ),
                  child: const Text(
                    'ホームへ',
                    style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildContent() {
    return switch (_state) {
      _FinishLoading() => const Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          CircularProgressIndicator(color: Color(0xFF7c3aed)),
          SizedBox(height: 24),
          Text(
            'アプリを生成中...',
            style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700),
          ),
          SizedBox(height: 8),
          Text(
            'VS Code 拡張がコードを生成しています',
            style: TextStyle(fontSize: 13, color: Color(0xFF64748b)),
          ),
        ],
      ),
      _FinishDone(branchName: final branch, prUrl: final url) => Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Text('🎉', style: TextStyle(fontSize: 56)),
          const SizedBox(height: 16),
          const Text(
            '生成完了！',
            style: TextStyle(fontSize: 24, fontWeight: FontWeight.w800),
          ),
          if (branch.isNotEmpty) ...[
            const SizedBox(height: 12),
            Text(
              branch,
              style: const TextStyle(fontSize: 13, color: Color(0xFF64748b)),
            ),
          ],
          if (url.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(
              url,
              style: const TextStyle(fontSize: 12, color: Color(0xFFa855f7)),
              textAlign: TextAlign.center,
            ),
          ],
        ],
      ),
      _FinishError(message: final msg) => Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.error_outline_rounded, color: Color(0xFFef4444), size: 48),
          const SizedBox(height: 16),
          const Text(
            '生成に失敗しました',
            style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 8),
          Text(
            msg,
            style: const TextStyle(fontSize: 13, color: Color(0xFFf87171)),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    };
  }
}

sealed class _FinishState {
  const _FinishState();
}

class _FinishLoading extends _FinishState {
  const _FinishLoading();
}

class _FinishDone extends _FinishState {
  final String branchName;
  final String prUrl;
  const _FinishDone({required this.branchName, required this.prUrl});
}

class _FinishError extends _FinishState {
  final String message;
  const _FinishError({required this.message});
}
