import 'dart:async';
import 'dart:math';

import 'package:flutter/material.dart';
import 'package:uuid/uuid.dart';
import '../models/decision_card.dart';
import '../models/decision.dart';
import '../models/project.dart';
import '../config/app_config.dart';
import '../services/websocket_service.dart';
import '../services/audio_service.dart';
import '../services/video_service.dart';
import '../widgets/proposal_card.dart';
import '../widgets/video_overlay.dart';
import 'finish_screen.dart';

class SwipeScreen extends StatefulWidget {
  final Project project;
  final bool connectOnInit;
  final String serverUrl;

  const SwipeScreen({
    super.key,
    required this.project,
    this.connectOnInit = true,
    this.serverUrl = AppConfig.serverUrl,
  });

  @override
  State<SwipeScreen> createState() => _SwipeScreenState();
}

class _SwipeScreenState extends State<SwipeScreen> {
  final _ws = WebSocketService();
  final _audio = AudioService();
  final _video = VideoService();
  final _random = Random();
  final _pageController = PageController();
  final _decisions = <Decision>[];
  final _cards = <DecisionCard>[];
  final _feedItems = <_FeedItem>[];
  // cardId → send timer (pending decisions not yet sent to server)
  final _pending = <String, Timer>{};
  int _currentFeedIndex = 0;
  final _likedCardIds = <String>{};
  bool _waitingForCard = true;
  Timer? _loadingVideoTimer;
  bool _navigatingToFinish = false;

  bool get _heartActive =>
      _currentCard != null && _likedCardIds.contains(_currentCard!.id);
  String? _connectionMessage;
  String? _sessionErrorMessage;
  StreamSubscription<WsIncomingEvent>? _wsSub;

  @override
  void initState() {
    super.initState();
    _wsSub = _ws.events.listen((event) {
      if (!mounted) return;
      if (event is WsCardEvent && event.card.projectId == widget.project.id) {
        _loadingVideoTimer?.cancel();
        _loadingVideoTimer = null;
        final wasWaiting = _waitingForCard;
        setState(() {
          _cards.add(event.card);
          final videoPath = _pickInterstitialVideo();
          if (videoPath != null) _feedItems.add(_FeedItem.video(videoPath));
          _feedItems.add(_FeedItem.card(event.card));
          _waitingForCard = false;
          _sessionErrorMessage = null;
        });
        if (wasWaiting) _audio.playRandom();
      } else if (event is WsErrorEvent &&
          (event.projectId == null || event.projectId == widget.project.id)) {
        setState(() {
          _waitingForCard = false;
          _sessionErrorMessage = event.message.trim().isNotEmpty
              ? event.message
              : 'Session error: ${event.code}';
        });
      }
    });
    if (widget.connectOnInit) {
      _tryConnect();
    }
  }

  @override
  void dispose() {
    for (final t in _pending.values) {
      t.cancel();
    }
    _wsSub?.cancel();
    _audio.dispose();
    _pageController.dispose();
    _loadingVideoTimer?.cancel();
    if (!_navigatingToFinish) {
      _ws.disconnect();
    }
    super.dispose();
  }

  void _finish() {
    if (_navigatingToFinish) return;

    // 送信待ちの決定を即時送信してからセッションを終了する
    for (final cardId in _pending.keys.toList()) {
      _pending[cardId]!.cancel();
      final decision = _decisions.lastWhere((d) => d.cardId == cardId);
      _ws.sendDecision(decision);
    }
    _pending.clear();

    _navigatingToFinish = true;
    _ws.sendFinish(widget.project.id);

    if (!mounted) return;
    Navigator.of(
      context,
    ).pushReplacement(MaterialPageRoute(builder: (_) => const FinishScreen()));
  }

  Future<void> _tryConnect() async {
    setState(() {
      _waitingForCard = true;
      _connectionMessage = null;
    });
    _scheduleLoadingVideo();
    await _ws.connect(widget.serverUrl);
    if (_ws.status == WsStatus.connected) {
      _ws.sendStartSession(widget.project);
    } else if (mounted) {
      setState(() {
        _waitingForCard = false;
        _connectionMessage =
            'Could not connect to the VS Code extension at ${widget.serverUrl}.';
      });
    }
  }

  DecisionCard? get _currentCard => _currentFeedIndex < _feedItems.length
      ? _feedItems[_currentFeedIndex].card
      : null;

  void _recordDecision(DecisionCard card) {
    if (_decisions.any((d) => d.cardId == card.id)) return;

    _audio.stop();

    final decision = Decision(
      id: const Uuid().v4(),
      projectId: widget.project.id,
      cardId: card.id,
      action: _likedCardIds.contains(card.id) ? 'accepted' : 'rejected',
    );
    _decisions.add(decision);

    // 送信を500ms遅延してgoBackによるキャンセルを可能にする
    _pending[card.id] = Timer(const Duration(milliseconds: 500), () {
      _pending.remove(card.id);
      if (mounted) _ws.sendDecision(decision);
    });
  }

  void _handlePageChanged(int nextIndex) {
    if (nextIndex == _currentFeedIndex) return;

    if (nextIndex > _currentFeedIndex) {
      final previousIndex = _currentFeedIndex;
      for (
        var i = _currentFeedIndex;
        i < nextIndex && i < _feedItems.length;
        i++
      ) {
        final card = _feedItems[i].card;
        if (card != null) _recordDecision(card);
      }

      final waitingForCard = nextIndex >= _feedItems.length;
      setState(() {
        _currentFeedIndex = nextIndex;
        _waitingForCard = waitingForCard;
      });

      final previousCard = previousIndex < _feedItems.length
          ? _feedItems[previousIndex].card
          : null;
      if (waitingForCard) {
        if (previousCard != null) {
          _sendPendingDecisionNow(previousCard.id);
        }
        _scheduleLoadingVideo();
      } else {
        _audio.playRandom();
      }
      return;
    }

    _goBackTo(nextIndex);
  }

  void _sendPendingDecisionNow(String cardId) {
    final timer = _pending.remove(cardId);
    if (timer == null) return;

    timer.cancel();
    final decision = _decisions.lastWhere((d) => d.cardId == cardId);
    _ws.sendDecision(decision);
  }

  void _scheduleLoadingVideo() {
    _loadingVideoTimer?.cancel();
    _loadingVideoTimer = Timer(const Duration(milliseconds: 1500), () {
      _loadingVideoTimer = null;
      if (!mounted || !_waitingForCard) return;
      final path = _video.pickRandom();
      if (path == null) return;
      setState(() {
        _feedItems.add(_FeedItem.video(path));
      });
    });
  }

  String? _pickInterstitialVideo() {
    if (_feedItems.isEmpty || !VideoService.hasVideos) return null;
    if (_random.nextInt(5) != 0) return null;

    String? previousVideo;
    for (final item in _feedItems.reversed) {
      if (item.videoPath == null) continue;
      previousVideo = item.videoPath;
      break;
    }
    return _video.pickRandom(exclude: previousVideo);
  }

  void _goBackTo(int index) {
    if (index < 0 || index >= _currentFeedIndex) return;
    _audio.playRandom();

    final restoredCardIds = <String>{};
    for (var i = index; i < _currentFeedIndex && i < _feedItems.length; i++) {
      final card = _feedItems[i].card;
      if (card == null) continue;
      restoredCardIds.add(card.id);
      _pending[card.id]?.cancel();
      _pending.remove(card.id);
    }

    setState(() {
      _currentFeedIndex = index;
      _waitingForCard = _currentCard == null;
      _decisions.removeWhere((d) => restoredCardIds.contains(d.cardId));
    });
  }

  @override
  Widget build(BuildContext context) {
    final total = _cards.length;
    final cardIndex = _currentCard == null ? -1 : _cards.indexOf(_currentCard!);
    final displayIndex = total > 0 ? cardIndex.clamp(0, total - 1) : 0;
    final progress = total > 0 ? (displayIndex + 1) / total : 0.0;
    final currentCard = _currentCard;

    return Scaffold(
      backgroundColor: const Color(0xFF0f0f1a),
      body: SafeArea(
        child: Stack(
          children: [
            // Card area fills everything below the header
            Column(
              children: [
                ValueListenableBuilder<WsStatus>(
                  valueListenable: _ws.statusNotifier,
                  builder: (context, wsStatus, child) => _Header(
                    projectTitle: widget.project.title,
                    current: total > 0 ? displayIndex + 1 : 0,
                    total: total,
                    progress: progress,
                    wsStatus: wsStatus,
                  ),
                ),
                Expanded(
                  child: _CardStack(
                    feedItems: _feedItems,
                    currentFeedIndex: _currentFeedIndex,
                    heartActive: _heartActive,
                    waitingForCard: _waitingForCard,
                    pageController: _pageController,
                    onPageChanged: _handlePageChanged,
                  ),
                ),
              ],
            ),

            // Error overlay
            if (currentCard == null &&
                (_connectionMessage != null || _sessionErrorMessage != null))
              Positioned.fill(
                child: _CardWaitState(
                  waitingForCard: _waitingForCard,
                  connectionMessage: _connectionMessage,
                  sessionErrorMessage: _sessionErrorMessage,
                  onRetry: widget.connectOnInit ? _tryConnect : null,
                ),
              ),

            if (_waitingForCard &&
                _feedItems.isNotEmpty &&
                _connectionMessage == null &&
                _sessionErrorMessage == null)
              const Positioned(
                left: 0,
                right: 0,
                top: 56,
                child: IgnorePointer(child: _GeneratingBadge()),
              ),

            // TikTok-style right action bar
            if (currentCard != null)
              Positioned(
                right: 16,
                bottom: 96,
                child: _SideActionBar(
                  card: currentCard,
                  heartActive: _heartActive,
                  onHeartTap: () => setState(() {
                    final id = currentCard.id;
                    if (_likedCardIds.contains(id)) {
                      _likedCardIds.remove(id);
                    } else {
                      _likedCardIds.add(id);
                    }
                  }),
                ),
              ),

            // Finish button
            Positioned(
              left: 20,
              right: 20,
              bottom: 20,
              child: FilledButton(
                onPressed: _finish,
                style: FilledButton.styleFrom(
                  backgroundColor: const Color(0xFF7c3aed),
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                  ),
                ),
                child: const Text(
                  'Finish',
                  style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
                ),
              ),
            ),
          ],
        ),
      ),
    );
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

class _CardWaitState extends StatelessWidget {
  final bool waitingForCard;
  final String? connectionMessage;
  final String? sessionErrorMessage;
  final VoidCallback? onRetry;

  const _CardWaitState({
    required this.waitingForCard,
    required this.connectionMessage,
    required this.sessionErrorMessage,
    required this.onRetry,
  });

  @override
  Widget build(BuildContext context) {
    final errorMessage = sessionErrorMessage ?? connectionMessage;
    final child = errorMessage == null
        ? Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (waitingForCard)
                const CircularProgressIndicator(strokeWidth: 3),
              const SizedBox(height: 16),
              const Text(
                'Waiting for the next card from the VS Code extension.',
                textAlign: TextAlign.center,
                style: TextStyle(color: Color(0xFFcbd5e1)),
              ),
            ],
          )
        : Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(
                Icons.wifi_off_rounded,
                color: Color(0xFFef4444),
                size: 28,
              ),
              const SizedBox(height: 12),
              Text(
                errorMessage,
                textAlign: TextAlign.center,
                style: const TextStyle(color: Color(0xFFfca5a5)),
              ),
              if (onRetry != null) ...[
                const SizedBox(height: 12),
                OutlinedButton.icon(
                  onPressed: onRetry,
                  icon: const Icon(Icons.refresh_rounded),
                  label: const Text('Retry'),
                ),
              ],
            ],
          );

    return Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 300),
        child: child,
      ),
    );
  }
}

class _Header extends StatelessWidget {
  final String projectTitle;
  final int current;
  final int total;
  final double progress;
  final WsStatus wsStatus;

  const _Header({
    required this.projectTitle,
    required this.current,
    required this.total,
    required this.progress,
    required this.wsStatus,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 8),
      child: Row(
        children: [
          Expanded(
            child: Text(
              projectTitle,
              style: const TextStyle(fontSize: 14, color: Color(0xFF64748b)),
              overflow: TextOverflow.ellipsis,
            ),
          ),
          _WsStatusDot(wsStatus),
          const SizedBox(width: 8),
          Text(
            '$current / $total',
            style: const TextStyle(fontSize: 13, color: Color(0xFF64748b)),
          ),
          const SizedBox(width: 8),
          SizedBox(
            width: 80,
            child: ClipRRect(
              borderRadius: BorderRadius.circular(2),
              child: LinearProgressIndicator(
                value: progress,
                backgroundColor: const Color(0xFF1e1e2e),
                valueColor: const AlwaysStoppedAnimation<Color>(
                  Color(0xFF7c3aed),
                ),
                minHeight: 4,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _WsStatusDot extends StatelessWidget {
  final WsStatus status;
  const _WsStatusDot(this.status);

  @override
  Widget build(BuildContext context) {
    final color = switch (status) {
      WsStatus.connected => const Color(0xFF22c55e),
      WsStatus.connecting => const Color(0xFFf59e0b),
      WsStatus.disconnected => const Color(0xFF64748b),
    };
    return Container(
      width: 8,
      height: 8,
      decoration: BoxDecoration(color: color, shape: BoxShape.circle),
    );
  }
}

class _CardStack extends StatelessWidget {
  final List<_FeedItem> feedItems;
  final int currentFeedIndex;
  final bool heartActive;
  final bool waitingForCard;
  final PageController pageController;
  final ValueChanged<int> onPageChanged;

  const _CardStack({
    required this.feedItems,
    required this.currentFeedIndex,
    required this.heartActive,
    required this.waitingForCard,
    required this.pageController,
    required this.onPageChanged,
  });

  @override
  Widget build(BuildContext context) {
    final itemCount = feedItems.length + (waitingForCard ? 1 : 0);
    if (itemCount == 0) return const SizedBox.shrink();

    return PageView.builder(
      controller: pageController,
      scrollDirection: Axis.vertical,
      itemCount: itemCount,
      onPageChanged: onPageChanged,
      itemBuilder: (context, index) {
        if (index >= feedItems.length) {
          return _CardWaitState(
            waitingForCard: waitingForCard,
            connectionMessage: null,
            sessionErrorMessage: null,
            onRetry: null,
          );
        }

        final item = feedItems[index];
        final card = item.card;
        if (card != null) {
          return Padding(
            padding: const EdgeInsets.only(bottom: 72),
            child: ProposalCardWidget(
              key: ValueKey(card.id),
              card: card,
              heartActive: index == currentFeedIndex && heartActive,
              onAdopt: () {},
              onSkip: () {},
              onPrevious: () {},
            ),
          );
        }

        return Padding(
          padding: const EdgeInsets.only(bottom: 72),
          child: VideoOverlay(
            key: ValueKey(item.videoPath),
            assetPath: item.videoPath!,
            enableVerticalSwipeDismiss: false,
            onFinished: () {},
          ),
        );
      },
    );
  }
}

class _FeedItem {
  final DecisionCard? card;
  final String? videoPath;

  const _FeedItem.card(this.card) : videoPath = null;
  const _FeedItem.video(this.videoPath) : card = null;
}

class _SideActionBar extends StatelessWidget {
  final DecisionCard card;
  final bool heartActive;
  final VoidCallback onHeartTap;

  const _SideActionBar({
    required this.card,
    required this.heartActive,
    required this.onHeartTap,
  });

  @override
  Widget build(BuildContext context) {
    return _SideButton(active: heartActive, onTap: onHeartTap);
  }
}

class _SideButton extends StatelessWidget {
  final bool active;
  final VoidCallback onTap;

  const _SideButton({required this.active, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final color = active ? const Color(0xFFef4444) : Colors.white;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 56,
        height: 56,
        decoration: BoxDecoration(
          color: color.withAlpha(active ? 40 : 20),
          shape: BoxShape.circle,
          border: Border.all(
            color: color.withAlpha(active ? 200 : 120),
            width: 1.5,
          ),
        ),
        child: Icon(Icons.favorite_rounded, color: color, size: 26),
      ),
    );
  }
}
