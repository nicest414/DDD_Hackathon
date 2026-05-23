import 'package:flutter/material.dart';
import '../models/decision.dart';
import '../models/decision_card.dart';
import '../models/project.dart';

class SessionRecord {
  final Project project;
  final List<Decision> decisions;
  final List<DecisionCard> cards;
  final DateTime createdAt;

  const SessionRecord({
    required this.project,
    required this.decisions,
    required this.cards,
    required this.createdAt,
  });

  List<Decision> get adopted =>
      decisions.where((d) => d.action == 'accepted').toList();
}

class SessionStore {
  static final _instance = SessionStore._();
  SessionStore._();
  factory SessionStore() => _instance;

  final List<SessionRecord> sessions = [];

  void add(SessionRecord record) => sessions.insert(0, record);
}

class HistoryScreen extends StatelessWidget {
  const HistoryScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final sessions = SessionStore().sessions;

    return Scaffold(
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Padding(
              padding: EdgeInsets.fromLTRB(24, 24, 24, 16),
              child: Text(
                '記録',
                style: TextStyle(fontSize: 24, fontWeight: FontWeight.w800),
              ),
            ),
            Expanded(
              child: sessions.isEmpty
                  ? const _EmptyState()
                  : ListView.separated(
                      padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
                      itemCount: sessions.length,
                      separatorBuilder: (_, _) => const SizedBox(height: 10),
                      itemBuilder: (context, i) =>
                          _SessionTile(record: sessions[i]),
                    ),
            ),
          ],
        ),
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 72,
            height: 72,
            decoration: BoxDecoration(
              color: const Color(0xFF1e1e2e),
              borderRadius: BorderRadius.circular(20),
            ),
            child: const Center(
              child: Text('📂', style: TextStyle(fontSize: 32)),
            ),
          ),
          const SizedBox(height: 16),
          const Text(
            'まだ記録がありません',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w600,
              color: Color(0xFF94a3b8),
            ),
          ),
          const SizedBox(height: 8),
          const Text(
            'セッションが完了すると\nここに記録が表示されます',
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 13,
              color: Color(0xFF64748b),
              height: 1.6,
            ),
          ),
        ],
      ),
    );
  }
}

class _SessionTile extends StatelessWidget {
  final SessionRecord record;
  const _SessionTile({required this.record});

  @override
  Widget build(BuildContext context) {
    final adopted = record.adopted;
    final total = record.decisions.length;

    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFF1e1e2e),
        border: Border.all(color: const Color(0xFF2a2a3e)),
        borderRadius: BorderRadius.circular(16),
      ),
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  record.project.title,
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              Text(
                _formatDate(record.createdAt),
                style: const TextStyle(
                  fontSize: 11,
                  color: Color(0xFF64748b),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              _Chip(
                label: '採用 ${adopted.length}',
                color: const Color(0xFF22c55e),
              ),
              const SizedBox(width: 8),
              _Chip(
                label: '合計 $total',
                color: const Color(0xFF64748b),
              ),
            ],
          ),
          if (adopted.isNotEmpty) ...[
            const SizedBox(height: 12),
            const Divider(height: 1, color: Color(0xFF2a2a3e)),
            const SizedBox(height: 10),
            ...adopted.take(3).map((d) {
              final card = record.cards.where((c) => c.id == d.cardId).firstOrNull;
              return Padding(
                padding: const EdgeInsets.only(bottom: 4),
                child: Row(
                  children: [
                    const Icon(
                      Icons.favorite_rounded,
                      size: 12,
                      color: Color(0xFFef4444),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        card?.title ?? d.cardId,
                        style: const TextStyle(
                          fontSize: 13,
                          color: Color(0xFF94a3b8),
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
              );
            }),
            if (adopted.length > 3)
              Padding(
                padding: const EdgeInsets.only(top: 2),
                child: Text(
                  'ほか ${adopted.length - 3} 件',
                  style: const TextStyle(
                    fontSize: 12,
                    color: Color(0xFF64748b),
                  ),
                ),
              ),
          ],
        ],
      ),
    );
  }

  String _formatDate(DateTime dt) {
    return '${dt.month}/${dt.day} ${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
  }
}

class _Chip extends StatelessWidget {
  final String label;
  final Color color;
  const _Chip({required this.label, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: color.withAlpha(30),
        borderRadius: BorderRadius.circular(8),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w600,
          color: color,
        ),
      ),
    );
  }
}
