import 'dart:async';

import 'package:flutter/material.dart';
import 'package:uuid/uuid.dart';
import '../models/decision_card.dart';
import '../models/decision.dart';
import '../models/project.dart';
import '../config/app_config.dart';
import '../services/baseline_dopamine.dart';
import '../services/websocket_service.dart';
import '../widgets/proposal_card.dart';
import 'result_screen.dart';

class SwipeScreen extends StatefulWidget {
  final Project project;
  const SwipeScreen({super.key, required this.project});

  @override
  State<SwipeScreen> createState() => _SwipeScreenState();
}

class _SwipeScreenState extends State<SwipeScreen> {
  final _baseline = BaselineDopamine();
  final _ws = WebSocketService();
  final _decisions = <Decision>[];
  final _cards = <DecisionCard>[];
  int _currentIndex = 0;
  bool _animating = false;
  bool _navigatingToResult = false;
  StreamSubscription<WsIncomingEvent>? _wsSub;

  @override
  void initState() {
    super.initState();
    _preloadCards();
    _wsSub = _ws.events.listen((event) {
      if (!mounted) return;
      if (event is WsCardEvent && event.card.projectId == widget.project.id) {
        setState(() => _cards.add(event.card));
      }
    });
    _tryConnect();
  }

  @override
  void dispose() {
    _wsSub?.cancel();
    if (!_navigatingToResult) {
      _ws.disconnect();
    }
    super.dispose();
  }

  void _preloadCards() {
    for (int i = 0; i < 3 && _baseline.hasMore(_decisions); i++) {
      _cards.add(_baseline.getNextCard(_decisions));
    }
  }

  Future<void> _tryConnect() async {
    await _ws.connect(AppConfig.serverUrl);
    if (_ws.status == WsStatus.connected) {
      _ws.sendStartSession(widget.project);
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
        if (_baseline.hasMore(_decisions)) {
          _cards.add(_baseline.getNextCard(_decisions));
        }
      });

      if (_currentIndex >= _cards.length) {
        _navigatingToResult = true;
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(
            builder: (_) => ResultScreen(
              project: widget.project,
              decisions: _decisions,
              cards: _cards,
            ),
          ),
        );
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
