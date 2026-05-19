import 'package:flutter/material.dart';
import '../models/decision_card.dart';

class ProposalCardWidget extends StatefulWidget {
  final DecisionCard card;
  final VoidCallback onAdopt;
  final VoidCallback onReject;

  const ProposalCardWidget({
    super.key,
    required this.card,
    required this.onAdopt,
    required this.onReject,
  });

  @override
  State<ProposalCardWidget> createState() => _ProposalCardWidgetState();
}

class _ProposalCardWidgetState extends State<ProposalCardWidget> {
  double _dragX = 0;
  static const _threshold = 100.0;

  void _onDragUpdate(DragUpdateDetails d) =>
      setState(() => _dragX += d.delta.dx);

  void _onDragEnd(DragEndDetails _) {
    if (_dragX > _threshold) {
      widget.onAdopt();
    } else if (_dragX < -_threshold) {
      widget.onReject();
    } else {
      setState(() => _dragX = 0);
    }
  }

  @override
  Widget build(BuildContext context) {
    final ratio = (_dragX.abs() / _threshold).clamp(0.0, 1.0);
    final isRight = _dragX > 0;

    return GestureDetector(
      onHorizontalDragUpdate: _onDragUpdate,
      onHorizontalDragEnd: _onDragEnd,
      child: Transform(
        transform: Matrix4.translationValues(_dragX, 0, 0)
          ..rotateZ(_dragX * 0.003),
        alignment: Alignment.bottomCenter,
        child: Stack(
          children: [
            _CardBody(card: widget.card),
            if (ratio > 0.15)
              Positioned(
                top: 28,
                right: isRight ? null : 24,
                left: isRight ? 24 : null,
                child: _Stamp(
                  label: isRight
                      ? widget.card.acceptLabel
                      : widget.card.rejectLabel,
                  color: isRight
                      ? const Color(0xFF22c55e)
                      : const Color(0xFFef4444),
                  opacity: ratio,
                ),
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
    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        color: const Color(0xFF1a1a2e),
        border: Border.all(color: const Color(0xFF2a2a3e), width: 1.5),
        borderRadius: BorderRadius.circular(24),
      ),
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              _CategoryBadge(card.type),
              const SizedBox(width: 8),
              Text(
                '#${card.id}',
                style: const TextStyle(fontSize: 12, color: Color(0xFF64748b)),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Text(
            card.title,
            style: const TextStyle(
              fontSize: 18,
              color: Color(0xFF94a3b8),
              height: 1.3,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            card.hook,
            style: const TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.w800,
              height: 1.3,
            ),
          ),
          const SizedBox(height: 12),
          Expanded(
            child: Text(
              card.description,
              style: const TextStyle(
                fontSize: 15,
                color: Color(0xFF94a3b8),
                height: 1.65,
              ),
            ),
          ),
          if (card.payoff.isNotEmpty || card.predictedReward.isNotEmpty) ...[
            Container(
              decoration: BoxDecoration(
                color: Colors.white.withAlpha(10),
                border: Border.all(color: const Color(0xFF2a2a3e)),
                borderRadius: BorderRadius.circular(12),
              ),
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    '採用したら',
                    style: TextStyle(
                      fontSize: 11,
                      letterSpacing: 1,
                      color: Color(0xFF64748b),
                    ),
                  ),
                  const SizedBox(height: 6),
                  if (card.predictedReward.isNotEmpty) ...[
                    Text(
                      card.predictedReward,
                      style: const TextStyle(
                        fontSize: 13,
                        color: Color(0xFF94a3b8),
                        height: 1.5,
                      ),
                    ),
                  ],
                  if (card.payoff.isNotEmpty) ...[
                    const SizedBox(height: 6),
                    Text(
                      card.payoff,
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
  const _CategoryBadge(this.type);

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFF7c3aed).withAlpha(50),
        border: Border.all(color: const Color(0xFF7c3aed).withAlpha(80)),
        borderRadius: BorderRadius.circular(20),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
      child: Text(
        type,
        style: const TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w600,
          color: Color(0xFFa855f7),
        ),
      ),
    );
  }
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
          style: TextStyle(
            color: color,
            fontSize: 24,
            fontWeight: FontWeight.w900,
          ),
        ),
      ),
    );
  }
}
