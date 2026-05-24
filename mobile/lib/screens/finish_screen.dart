import 'dart:async';

import 'package:flutter/material.dart';
import '../services/video_service.dart';
import '../services/websocket_service.dart'
    show WebSocketService, WsIncomingEvent, WsPrEvent, WsErrorEvent;
import '../widgets/video_overlay.dart';
import 'home_screen.dart';

class FinishScreen extends StatefulWidget {
  const FinishScreen({super.key});

  @override
  State<FinishScreen> createState() => _FinishScreenState();
}

class _FinishScreenState extends State<FinishScreen> {
  final _video = VideoService();
  final _pageController = PageController();
  final _loadingVideos = <String>[];
  _FinishState _state = const _FinishLoading();
  StreamSubscription<WsIncomingEvent>? _wsSub;

  @override
  void initState() {
    super.initState();
    _appendLoadingVideo();
    _wsSub = WebSocketService().events.listen((event) {
      if (!mounted) return;
      if (event is WsPrEvent) {
        setState(
          () => _state = _FinishDone(
            branchName: event.branchName,
            prUrl: event.url,
          ),
        );
      } else if (event is WsErrorEvent) {
        setState(
          () => _state = _FinishError(
            message: event.message.isNotEmpty ? event.message : '不明なエラー',
          ),
        );
      }
    });
  }

  @override
  void dispose() {
    _wsSub?.cancel();
    _pageController.dispose();
    WebSocketService().disconnect();
    super.dispose();
  }

  void _appendLoadingVideo() {
    final next = _video.pickRandom(
      exclude: _loadingVideos.isEmpty ? null : _loadingVideos.last,
    );
    if (next == null) return;
    _loadingVideos.add(next);
  }

  void _handleLoadingPageChanged(int index) {
    if (index < _loadingVideos.length - 1) return;
    setState(_appendLoadingVideo);
  }

  @override
  Widget build(BuildContext context) {
    if (_state is _FinishLoading && _loadingVideos.isNotEmpty) {
      return Scaffold(
        backgroundColor: const Color(0xFF0f0f1a),
        body: SafeArea(
          child: Stack(
            children: [
              PageView.builder(
                controller: _pageController,
                scrollDirection: Axis.vertical,
                itemCount: _loadingVideos.length,
                onPageChanged: _handleLoadingPageChanged,
                itemBuilder: (context, index) => VideoOverlay(
                  key: ValueKey('finish_${_loadingVideos[index]}_$index'),
                  assetPath: _loadingVideos[index],
                  enableVerticalSwipeDismiss: false,
                  onFinished: () {},
                ),
              ),
              const Positioned(
                left: 0,
                right: 0,
                top: 20,
                child: IgnorePointer(child: _GeneratingBadge()),
              ),
              Positioned(
                left: 20,
                right: 20,
                bottom: 20,
                child: _HomeButton(
                  label: 'ホームへ',
                  onPressed: () => Navigator.of(context).pushAndRemoveUntil(
                    MaterialPageRoute(builder: (_) => const HomeScreen()),
                    (_) => false,
                  ),
                ),
              ),
            ],
          ),
        ),
      );
    }

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
                child: _HomeButton(
                  label: 'ホームへ',
                  onPressed: () => Navigator.of(context).pushAndRemoveUntil(
                    MaterialPageRoute(builder: (_) => const HomeScreen()),
                    (_) => false,
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
          const Icon(
            Icons.error_outline_rounded,
            color: Color(0xFFef4444),
            size: 48,
          ),
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

class _GeneratingBadge extends StatelessWidget {
  const _GeneratingBadge();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: Colors.black.withAlpha(150),
          border: Border.all(color: Colors.white.withAlpha(50)),
          borderRadius: BorderRadius.circular(999),
        ),
        child: const Padding(
          padding: EdgeInsets.symmetric(horizontal: 14, vertical: 8),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              SizedBox(
                width: 14,
                height: 14,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  valueColor: AlwaysStoppedAnimation<Color>(Color(0xFFc4b5fd)),
                ),
              ),
              SizedBox(width: 8),
              Text(
                '生成中...',
                style: TextStyle(
                  color: Color(0xFFf8fafc),
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _HomeButton extends StatelessWidget {
  final String label;
  final VoidCallback onPressed;

  const _HomeButton({required this.label, required this.onPressed});

  @override
  Widget build(BuildContext context) {
    return FilledButton(
      onPressed: onPressed,
      style: FilledButton.styleFrom(
        backgroundColor: const Color(0xFF7c3aed),
        padding: const EdgeInsets.symmetric(vertical: 16),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      ),
      child: Text(
        label,
        style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
      ),
    );
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
