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
  // cardId → send timer (pending decisions not yet sent to server)
  final _pending = <String, Timer>{};
  int _currentIndex = 0;
  final _likedCardIds = <String>{};
  bool _waitingForCard = true;
  bool _showVideo = false;
  String? _videoPath;
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
          _waitingForCard = false;
          _sessionErrorMessage = null;
        });
        if (wasWaiting && !_showVideo) _audio.playRandom();
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

  DecisionCard? get _currentCard =>
      _currentIndex < _cards.length ? _cards[_currentIndex] : null;

  void _recordDecision(int cardIndex) {
    if (cardIndex < 0 || cardIndex >= _cards.length) return;
    if (_decisions.length > cardIndex) return;

    _audio.stop();

    final card = _cards[cardIndex];
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
    if (nextIndex == _currentIndex) return;

    if (nextIndex > _currentIndex) {
      final previousIndex = _currentIndex;
      for (var i = _currentIndex; i < nextIndex && i < _cards.length; i++) {
        _recordDecision(i);
      }

      final waitingForCard = nextIndex >= _cards.length;
      setState(() {
        _currentIndex = nextIndex;
        _waitingForCard = waitingForCard;
      });

      if (waitingForCard && previousIndex < _cards.length) {
        _sendPendingDecisionNow(_cards[previousIndex].id);
        _scheduleLoadingVideo();
      } else {
        _maybeShowVideo();
        if (!_showVideo) _audio.playRandom();
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
        _showVideo = true;
        _videoPath = path;
      });
    });
  }

  void _maybeShowVideo() {
    if (_random.nextInt(5) != 0) return;
    final path = _video.pickRandom();
    if (path == null) return;
    setState(() {
      _showVideo = true;
      _videoPath = path;
    });
  }

  void _goBackTo(int index) {
    if (index < 0 || index >= _currentIndex) return;
    if (!_showVideo) _audio.playRandom();

    for (var i = index; i < _currentIndex && i < _cards.length; i++) {
      _pending[_cards[i].id]?.cancel();
      _pending.remove(_cards[i].id);
    }

    setState(() {
      _currentIndex = index;
      _waitingForCard = _currentCard == null;
      while (_decisions.length > _currentIndex) {
        _decisions.removeLast();
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final total = _cards.length;
    final displayIndex = total > 0 ? _currentIndex.clamp(0, total - 1) : 0;
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
                    cards: _cards,
                    currentIndex: _currentIndex,
                    heartActive: _heartActive,
                    waitingForCard: _waitingForCard,
                    pageController: _pageController,
                    onPageChanged: _handlePageChanged,
                  ),
                ),
              ],
            ),

            // Wait / error overlay
            if (currentCard == null)
              Positioned.fill(
                child: _CardWaitState(
                  waitingForCard: _waitingForCard,
                  connectionMessage: _connectionMessage,
                  sessionErrorMessage: _sessionErrorMessage,
                  onRetry: widget.connectOnInit ? _tryConnect : null,
                ),
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

            // Video overlay (loading wait / random interstitial)
            if (_showVideo && _videoPath != null)
              Positioned.fill(
                child: VideoOverlay(
                  key: ValueKey(_videoPath),
                  assetPath: _videoPath!,
                  onFinished: () {
                    setState(() {
                      _showVideo = false;
                      _videoPath = null;
                    });
                    _audio.playRandom();
                  },
                  onSwiped: () {
                    if (_waitingForCard) {
                      final next = _video.pickRandom(exclude: _videoPath);
                      setState(() => _videoPath = next ?? _videoPath);
                    } else {
                      setState(() {
                        _showVideo = false;
                        _videoPath = null;
                      });
                      _audio.playRandom();
                    }
                  },
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
  final List<DecisionCard> cards;
  final int currentIndex;
  final bool heartActive;
  final bool waitingForCard;
  final PageController pageController;
  final ValueChanged<int> onPageChanged;

  const _CardStack({
    required this.cards,
    required this.currentIndex,
    required this.heartActive,
    required this.waitingForCard,
    required this.pageController,
    required this.onPageChanged,
  });

  @override
  Widget build(BuildContext context) {
    final itemCount = cards.length + (waitingForCard ? 1 : 0);
    if (itemCount == 0) return const SizedBox.shrink();

    return PageView.builder(
      controller: pageController,
      scrollDirection: Axis.vertical,
      itemCount: itemCount,
      onPageChanged: onPageChanged,
      itemBuilder: (context, index) {
        if (index >= cards.length) return const SizedBox.shrink();

        return Padding(
          padding: const EdgeInsets.only(bottom: 72),
          child: ProposalCardWidget(
            key: ValueKey(cards[index].id),
            card: cards[index],
            heartActive: index == currentIndex && heartActive,
            onAdopt: () {},
            onSkip: () {},
            onPrevious: () {},
          ),
        );
      },
    );
  }
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
