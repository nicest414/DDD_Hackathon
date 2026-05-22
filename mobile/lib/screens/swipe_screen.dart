import 'dart:async';

import 'package:flutter/material.dart';
import 'package:uuid/uuid.dart';
import '../models/decision_card.dart';
import '../models/decision.dart';
import '../models/project.dart';
import '../config/app_config.dart';
import '../services/websocket_service.dart';
import '../widgets/proposal_card.dart';

class SwipeScreen extends StatefulWidget {
  final Project project;
  final bool connectOnInit;

  const SwipeScreen({
    super.key,
    required this.project,
    this.connectOnInit = true,
  });

  @override
  State<SwipeScreen> createState() => _SwipeScreenState();
}

class _SwipeScreenState extends State<SwipeScreen> {
  final _ws = WebSocketService();
  final _decisions = <Decision>[];
  final _cards = <DecisionCard>[];
  int _currentIndex = 0;
  bool _animating = false;
  bool _waitingForCard = true;
  String? _connectionMessage;
  String? _sessionErrorMessage;
  StreamSubscription<WsIncomingEvent>? _wsSub;

  @override
  void initState() {
    super.initState();
    _wsSub = _ws.events.listen((event) {
      if (!mounted) return;
      if (event is WsCardEvent && event.card.projectId == widget.project.id) {
        setState(() {
          _cards.add(event.card);
          _waitingForCard = false;
          _sessionErrorMessage = null;
        });
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
    _wsSub?.cancel();
    _ws.disconnect();
    super.dispose();
  }

  Future<void> _tryConnect() async {
    setState(() {
      _waitingForCard = true;
      _connectionMessage = null;
    });
    await _ws.connect(AppConfig.serverUrl);
    if (_ws.status == WsStatus.connected) {
      _ws.sendStartSession(widget.project);
    } else if (mounted) {
      setState(() {
        _waitingForCard = false;
        _connectionMessage =
            'Could not connect to the VS Code extension at ${AppConfig.serverUrl}.';
      });
    }
  }

  DecisionCard? get _currentCard =>
      _currentIndex < _cards.length ? _cards[_currentIndex] : null;

  void _decide(String action) {
    if (_animating || _currentCard == null) return;
    setState(() => _animating = true);

    final card = _currentCard!;
    final decision = Decision(
      id: const Uuid().v4(),
      projectId: widget.project.id,
      cardId: card.id,
      action: action,
    );
    _decisions.add(decision);
    _ws.sendDecision(decision);

    Future.delayed(const Duration(milliseconds: 350), () {
      if (!mounted) return;
      setState(() {
        _currentIndex++;
        _animating = false;
        _waitingForCard = _currentCard == null;
      });
    });
  }

  @override
  Widget build(BuildContext context) {
    final total = _cards.length;
    final displayIndex = total > 0 ? _currentIndex.clamp(0, total - 1) : 0;
    final progress = total > 0 ? (displayIndex + 1) / total : 0.0;
    final currentCard = _currentCard;

    return Scaffold(
      body: SafeArea(
        child: Column(
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
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    _CardStack(
                      cards: _cards,
                      currentIndex: _currentIndex,
                      onAdopt: () => _decide('accepted'),
                      onReject: () => _decide('rejected'),
                    ),
                    if (currentCard == null)
                      Expanded(
                        child: _CardWaitState(
                          waitingForCard: _waitingForCard,
                          connectionMessage: _connectionMessage,
                          sessionErrorMessage: _sessionErrorMessage,
                          onRetry: widget.connectOnInit ? _tryConnect : null,
                        ),
                      ),
                    const SizedBox(height: 20),
                    _SwipeHints(card: currentCard),
                  ],
                ),
              ),
            ),
            _ActionButtons(
              card: currentCard,
              onReject: () => _decide('rejected'),
              onAdopt: () => _decide('accepted'),
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
  final VoidCallback onAdopt;
  final VoidCallback onReject;

  const _CardStack({
    required this.cards,
    required this.currentIndex,
    required this.onAdopt,
    required this.onReject,
  });

  @override
  Widget build(BuildContext context) {
    final visible = cards.skip(currentIndex).take(3).toList();
    if (visible.isEmpty) return const SizedBox.shrink();

    return SizedBox(
      height: 420,
      child: Stack(
        alignment: Alignment.topCenter,
        children: [
          for (int i = visible.length - 1; i >= 0; i--)
            Positioned(
              top: i == 0
                  ? 0
                  : i == 1
                  ? 6.0
                  : 12.0,
              bottom: 0,
              left: 0,
              right: 0,
              child: Transform.scale(
                scale: i == 0
                    ? 1.0
                    : i == 1
                    ? 0.97
                    : 0.94,
                child: Opacity(
                  opacity: i == 0
                      ? 1.0
                      : i == 1
                      ? 0.75
                      : 0.5,
                  child: i == 0
                      ? ProposalCardWidget(
                          card: visible[i],
                          onAdopt: onAdopt,
                          onReject: onReject,
                        )
                      : IgnorePointer(
                          child: ProposalCardWidget(
                            card: visible[i],
                            onAdopt: () {},
                            onReject: () {},
                          ),
                        ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _SwipeHints extends StatelessWidget {
  final DecisionCard? card;
  const _SwipeHints({required this.card});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Flexible(
          child: _Hint(
            label: card?.rejectLabel ?? '却下',
            icon: '✕',
            color: const Color(0xFFef4444),
          ),
        ),
        Flexible(
          child: _Hint(
            label: card?.acceptLabel ?? '採用',
            icon: '✓',
            color: const Color(0xFF22c55e),
            reverse: true,
          ),
        ),
      ],
    );
  }
}

class _Hint extends StatelessWidget {
  final String label;
  final String icon;
  final Color color;
  final bool reverse;
  const _Hint({
    required this.label,
    required this.icon,
    required this.color,
    this.reverse = false,
  });

  @override
  Widget build(BuildContext context) {
    final children = [
      Container(
        width: 36,
        height: 36,
        decoration: BoxDecoration(
          color: color.withAlpha(40),
          shape: BoxShape.circle,
        ),
        child: Center(
          child: Text(icon, style: TextStyle(color: color, fontSize: 16)),
        ),
      ),
      const SizedBox(width: 6),
      Flexible(
        child: Text(
          label,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(
            color: color,
            fontSize: 13,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
    ];
    return Opacity(
      opacity: 0.5,
      child: Row(children: reverse ? children.reversed.toList() : children),
    );
  }
}

class _ActionButtons extends StatelessWidget {
  final DecisionCard? card;
  final VoidCallback onReject;
  final VoidCallback onAdopt;
  const _ActionButtons({
    required this.card,
    required this.onReject,
    required this.onAdopt,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(24, 16, 24, 32),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Expanded(
            child: _ChoiceButton(
              icon: '✕',
              label: card?.rejectLabel ?? '却下',
              color: const Color(0xFFef4444),
              onTap: onReject,
              size: 64,
            ),
          ),
          const SizedBox(width: 24),
          Expanded(
            child: _ChoiceButton(
              icon: '✓',
              label: card?.acceptLabel ?? '採用',
              color: const Color(0xFF22c55e),
              onTap: onAdopt,
              size: 64,
            ),
          ),
        ],
      ),
    );
  }
}

class _ChoiceButton extends StatelessWidget {
  final String icon;
  final String label;
  final Color color;
  final VoidCallback onTap;
  final double size;
  const _ChoiceButton({
    required this.icon,
    required this.label,
    required this.color,
    required this.onTap,
    required this.size,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: size,
            height: size,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              border: Border.all(color: color, width: 2),
            ),
            child: Center(
              child: Text(
                icon,
                style: TextStyle(color: color, fontSize: size * 0.38),
              ),
            ),
          ),
          const SizedBox(height: 8),
          Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            textAlign: TextAlign.center,
            style: TextStyle(
              color: color,
              fontSize: 13,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}
