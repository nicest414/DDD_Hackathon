import 'package:flutter/material.dart';
import '../models/decision_card.dart';

class ProposalCardWidget extends StatefulWidget {
  final DecisionCard card;
  final bool heartActive;
  final VoidCallback onAdopt;
  final VoidCallback onSkip;
  final VoidCallback onPrevious;
  final VoidCallback? onHeartTap;

  const ProposalCardWidget({
    super.key,
    required this.card,
    required this.heartActive,
    required this.onAdopt,
    required this.onSkip,
    required this.onPrevious,
    this.onHeartTap,
  });

  @override
  State<ProposalCardWidget> createState() => _ProposalCardWidgetState();
}

class _ProposalCardWidgetState extends State<ProposalCardWidget>
    with SingleTickerProviderStateMixin {
  double _dragY = 0;
  static const _threshold = 100.0;

  late final AnimationController _heartAnim;
  bool _heartAnimActive = false;
  Offset _doubleTapPos = Offset.zero;

  @override
  void initState() {
    super.initState();
    _heartAnim = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 700),
    );
  }

  @override
  void dispose() {
    _heartAnim.dispose();
    super.dispose();
  }

  void _onDragUpdate(DragUpdateDetails d) =>
      setState(() => _dragY += d.delta.dy);

  void _onDragEnd(DragEndDetails _) {
    if (_dragY < -_threshold) {
      if (widget.heartActive) {
        widget.onAdopt();
      } else {
        widget.onSkip();
      }
    } else if (_dragY > _threshold) {
      widget.onPrevious();
    }
    if (mounted) setState(() => _dragY = 0);
  }

  void _onDoubleTapDown(TapDownDetails d) {
    _doubleTapPos = d.localPosition;
  }

  void _onDoubleTap() {
    widget.onHeartTap?.call();
    setState(() => _heartAnimActive = true);
    _heartAnim.forward(from: 0).then((_) {
      if (mounted) setState(() => _heartAnimActive = false);
    });
  }

  @override
  Widget build(BuildContext context) {
    final ratio = (_dragY.abs() / _threshold).clamp(0.0, 1.0);
    final isUp = _dragY < 0;

    final Color stampColor;
    final String stampLabel;
    if (isUp) {
      stampColor = widget.heartActive
          ? const Color(0xFF22c55e)
          : const Color(0xFFef4444);
      stampLabel = widget.heartActive
          ? widget.card.acceptLabel
          : widget.card.rejectLabel;
    } else {
      stampColor = const Color(0xFF64748b);
      stampLabel = '戻る';
    }

    return GestureDetector(
      onVerticalDragUpdate: _onDragUpdate,
      onVerticalDragEnd: _onDragEnd,
      onDoubleTapDown: _onDoubleTapDown,
      onDoubleTap: _onDoubleTap,
      child: Transform(
        transform: Matrix4.translationValues(0, _dragY, 0),
        alignment: Alignment.center,
        child: Stack(
          fit: StackFit.expand,
          children: [
            _CardBody(card: widget.card),
            if (ratio > 0.15)
              Positioned(
                top: isUp ? 60 : null,
                bottom: isUp ? null : 60,
                left: 0,
                right: 0,
                child: Center(
                  child: _Stamp(
                    label: stampLabel,
                    color: stampColor,
                    opacity: ratio,
                  ),
                ),
              ),
            if (_heartAnimActive)
              AnimatedBuilder(
                animation: _heartAnim,
                builder: (context, _) {
                  final t = _heartAnim.value;
                  final opacity =
                      t < 0.3 ? t / 0.3 : (1 - (t - 0.3) / 0.7);
                  final scale = 0.5 + t * 1.5;
                  return Positioned(
                    left: _doubleTapPos.dx - 40,
                    top: _doubleTapPos.dy - 40,
                    child: Opacity(
                      opacity: opacity.clamp(0.0, 1.0),
                      child: Transform.scale(
                        scale: scale,
                        child: const Icon(
                          Icons.favorite_rounded,
                          color: Color(0xFFef4444),
                          size: 80,
                        ),
                      ),
                    ),
                  );
                },
              ),
          ],
        ),
      ),
    );
  }
}

class _CardBody extends StatelessWidget {
  final DecisionCard card;
  const _CardBody({required this.card});

  @override
  Widget build(BuildContext context) {
    final colors = _typeColors(card.type);

    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFF1a1a2e),
        border: Border.all(color: colors.accent.withAlpha(130), width: 1.5),
        borderRadius: BorderRadius.circular(20),
      ),
      padding: const EdgeInsets.fromLTRB(24, 24, 24, 110),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.max,
        children: [
          Row(
            children: [
              _CategoryBadge(type: card.type, colors: colors),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  '#${card.id}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 12,
                    color: Color(0xFF64748b),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Text(
            card.title,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              fontSize: 18,
              color: Color(0xFF94a3b8),
              height: 1.3,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            card.hook,
            maxLines: 3,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              fontSize: 26,
              fontWeight: FontWeight.w800,
              height: 1.25,
            ),
          ),
          const SizedBox(height: 8),
          Flexible(
            child: Text(
              card.description,
              overflow: TextOverflow.fade,
              style: const TextStyle(
                fontSize: 14,
                color: Color(0xFF94a3b8),
                height: 1.6,
              ),
            ),
          ),
          const SizedBox(height: 12),
          _ScoreStrip(card: card, accent: colors.accent),
          if (card.payoff.isNotEmpty || card.predictedReward.isNotEmpty) ...[
            const SizedBox(height: 12),
            Container(
              decoration: BoxDecoration(
                color: Colors.white.withAlpha(10),
                border: Border.all(color: colors.accent.withAlpha(70)),
                borderRadius: BorderRadius.circular(12),
              ),
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Text(
                    '採用したら',
                    style: TextStyle(
                      fontSize: 11,
                      letterSpacing: 1,
                      color: Color(0xFF64748b),
                    ),
                  ),
                  const SizedBox(height: 4),
                  if (card.predictedReward.isNotEmpty)
                    Text(
                      card.predictedReward,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 13,
                        color: Color(0xFF94a3b8),
                        height: 1.5,
                      ),
                    ),
                  if (card.payoff.isNotEmpty) ...[
                    const SizedBox(height: 4),
                    Text(
                      card.payoff,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 13,
                        color: Color(0xFFcbd5e1),
                        height: 1.5,
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _CategoryBadge extends StatelessWidget {
  final String type;
  final _CardTypeColors colors;
  const _CategoryBadge({required this.type, required this.colors});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: colors.background,
        border: Border.all(color: colors.accent.withAlpha(100)),
        borderRadius: BorderRadius.circular(20),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
      child: Text(
        type,
        style: TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w600,
          color: colors.accent,
        ),
      ),
    );
  }
}

class _ScoreStrip extends StatelessWidget {
  final DecisionCard card;
  final Color accent;
  const _ScoreStrip({required this.card, required this.accent});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: _ScoreMeter(
            label: '快感',
            value: card.dopamineScore,
            color: accent,
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: _ScoreMeter(
            label: '新規性',
            value: card.noveltyScore,
            color: const Color(0xFF38bdf8),
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: _ScoreMeter(
            label: '軽さ',
            value: 1 - card.effortScore,
            color: const Color(0xFF22c55e),
          ),
        ),
      ],
    );
  }
}

class _ScoreMeter extends StatelessWidget {
  final String label;
  final double value;
  final Color color;
  const _ScoreMeter({
    required this.label,
    required this.value,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    final percent = (value.clamp(0.0, 1.0) * 100).round();

    return Container(
      decoration: BoxDecoration(
        color: Colors.white.withAlpha(8),
        borderRadius: BorderRadius.circular(10),
      ),
      padding: const EdgeInsets.all(8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 11,
                    color: Color(0xFF94a3b8),
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
              Text(
                '$percent',
                style: TextStyle(
                  fontSize: 11,
                  color: color,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          ClipRRect(
            borderRadius: BorderRadius.circular(999),
            child: LinearProgressIndicator(
              value: value.clamp(0.0, 1.0),
              minHeight: 4,
              backgroundColor: const Color(0xFF2a2a3e),
              valueColor: AlwaysStoppedAnimation<Color>(color),
            ),
          ),
        ],
      ),
    );
  }
}

class _CardTypeColors {
  final Color accent;
  final Color background;

  const _CardTypeColors({required this.accent, required this.background});
}

_CardTypeColors _typeColors(String type) {
  final accent = switch (type) {
    'concept' => const Color(0xFFf59e0b),
    'feature' => const Color(0xFF38bdf8),
    'ui' => const Color(0xFFec4899),
    'flow' => const Color(0xFF14b8a6),
    'data' => const Color(0xFF60a5fa),
    'moment' => const Color(0xFFf97316),
    'reward' => const Color(0xFF22c55e),
    'polish' => const Color(0xFFa855f7),
    'risk' => const Color(0xFFef4444),
    _ => const Color(0xFF94a3b8),
  };

  return _CardTypeColors(accent: accent, background: accent.withAlpha(35));
}

class _Stamp extends StatelessWidget {
  final String label;
  final Color color;
  final double opacity;
  const _Stamp({
    required this.label,
    required this.color,
    required this.opacity,
  });

  @override
  Widget build(BuildContext context) {
    return Opacity(
      opacity: opacity,
      child: Container(
        decoration: BoxDecoration(
          border: Border.all(color: color, width: 3),
          borderRadius: BorderRadius.circular(6),
        ),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        child: Text(
          label,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(
            color: color,
            fontSize: 28,
            fontWeight: FontWeight.w900,
          ),
        ),
      ),
    );
  }
}
