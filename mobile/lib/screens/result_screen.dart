import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../models/decision.dart';
import '../models/decision_card.dart';
import '../models/project.dart';
import '../services/websocket_service.dart'
    show
        WebSocketService,
        WsIncomingEvent,
        WsPreviewEvent,
        WsPrEvent,
        WsErrorEvent;
import 'home_screen.dart';

class ResultScreen extends StatefulWidget {
  final Project project;
  final List<Decision> decisions;
  final List<DecisionCard> cards;

  const ResultScreen({
    super.key,
    required this.project,
    required this.decisions,
    required this.cards,
  });

  @override
  State<ResultScreen> createState() => _ResultScreenState();
}

class _ResultScreenState extends State<ResultScreen> {
  ResultEventSummary _result = const ResultEventSummary();
  StreamSubscription<WsIncomingEvent>? _wsSub;

  @override
  void initState() {
    super.initState();
    _wsSub = WebSocketService().events.listen((event) {
      if (!mounted || !_belongsToProject(event)) return;
      final next = _result.apply(event);
      if (next != _result) {
        setState(() => _result = next);
      }
    });
  }

  @override
  void dispose() {
    _wsSub?.cancel();
    WebSocketService().disconnect();
    super.dispose();
  }

  List<Decision> get _adopted =>
      widget.decisions.where((d) => d.action == 'accepted').toList();
  List<Decision> get _rejected =>
      widget.decisions.where((d) => d.action == 'rejected').toList();

  bool _belongsToProject(WsIncomingEvent event) {
    return switch (event) {
      WsPreviewEvent e => e.projectId == widget.project.id,
      WsPrEvent e => e.projectId == widget.project.id,
      WsErrorEvent e => e.projectId == null || e.projectId == widget.project.id,
      _ => false,
    };
  }

  DecisionCard _cardFor(Decision d) => widget.cards.firstWhere(
    (c) => c.id == d.cardId,
    orElse: () => DecisionCard(
      id: d.cardId,
      projectId: '',
      type: 'feature',
      title: d.cardId,
      hook: d.cardId,
      description: '',
      payoff: '',
      acceptLabel: 'これ欲しい',
      rejectLabel: '今はいらない',
      payload: {},
      predictedReward: '',
      noveltyScore: 0,
      effortScore: 0,
      dopamineScore: 0,
    ),
  );

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: Column(
            children: [
              const SizedBox(height: 40),
              const Text('🎉', style: TextStyle(fontSize: 56)),
              const SizedBox(height: 16),
              const Text(
                'アプリが完成しました！',
                style: TextStyle(fontSize: 24, fontWeight: FontWeight.w800),
              ),
              const SizedBox(height: 8),
              const Text(
                'スワイプの判断がコードになりました。',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 14, color: Color(0xFF64748b)),
              ),
              const SizedBox(height: 32),
              if (_result.isWaiting) ...[
                const _SectionCard(
                  icon: '⏳',
                  title: '生成結果',
                  child: _WaitingResult(),
                ),
                const SizedBox(height: 12),
              ],
              if (_result.previewUrl.isNotEmpty) ...[
                _SectionCard(
                  icon: '👀',
                  title: 'Preview',
                  child: _CopyableValue(value: _result.previewUrl),
                ),
                const SizedBox(height: 12),
              ],
              if (_result.prStatus == 'created' &&
                  _result.prUrl.isNotEmpty) ...[
                _SectionCard(
                  icon: '🐙',
                  title: 'Pull Request',
                  child: _CopyableValue(value: _result.prUrl),
                ),
                const SizedBox(height: 12),
              ] else if (_result.prStatus == 'localSaved') ...[
                _SectionCard(
                  icon: '💾',
                  title: 'ローカル保存',
                  child: _LocalSavedResult(branchName: _result.branchName),
                ),
                const SizedBox(height: 12),
              ] else if (_result.previewUrl.isNotEmpty &&
                  !_result.hasError) ...[
                const _SectionCard(
                  icon: '⏳',
                  title: '公開結果',
                  child: _WaitingResult(message: 'Pull Requestの結果を待っています。'),
                ),
                const SizedBox(height: 12),
              ],
              if (_result.hasError) ...[
                _SectionCard(
                  icon: '⚠️',
                  title: 'Error',
                  child: _ErrorResult(message: _result.errorMessage),
                ),
                const SizedBox(height: 12),
              ],
              _SectionCard(
                icon: '📊',
                title: 'セッションまとめ',
                child: Row(
                  children: [
                    Expanded(
                      child: _Stat(value: _adopted.length, label: '採用'),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: _Stat(value: _rejected.length, label: '却下'),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),
              _SectionCard(
                icon: '✅',
                title: '採用した機能',
                child: Column(
                  children: widget.decisions
                      .where((d) => d.action == 'accepted')
                      .map((d) {
                        final card = _cardFor(d);
                        final adopted = d.action == 'accepted';
                        return Padding(
                          padding: const EdgeInsets.symmetric(vertical: 5),
                          child: Row(
                            children: [
                              Container(
                                width: 8,
                                height: 8,
                                decoration: BoxDecoration(
                                  color: adopted
                                      ? const Color(0xFF22c55e)
                                      : const Color(0xFFef4444),
                                  shape: BoxShape.circle,
                                ),
                              ),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Text(
                                  card.title,
                                  style: const TextStyle(
                                    fontSize: 14,
                                    color: Color(0xFF94a3b8),
                                  ),
                                ),
                              ),
                              Container(
                                decoration: BoxDecoration(
                                  color: adopted
                                      ? const Color(0xFF22c55e).withAlpha(40)
                                      : const Color(0xFFef4444).withAlpha(40),
                                  borderRadius: BorderRadius.circular(10),
                                ),
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 8,
                                  vertical: 2,
                                ),
                                child: Text(
                                  adopted ? '採用' : '却下',
                                  style: TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.w600,
                                    color: adopted
                                        ? const Color(0xFF4ade80)
                                        : const Color(0xFFf87171),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        );
                      })
                      .toList(),
                ),
              ),
              const SizedBox(height: 24),
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
                    '新しいアプリを作る',
                    style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
                  ),
                ),
              ),
              const SizedBox(height: 40),
            ],
          ),
        ),
      ),
    );
  }
}

@immutable
class ResultEventSummary {
  final String previewUrl;
  final String prUrl;
  final String prStatus;
  final String branchName;
  final String errorMessage;

  const ResultEventSummary({
    this.previewUrl = '',
    this.prUrl = '',
    this.prStatus = '',
    this.branchName = '',
    this.errorMessage = '',
  });

  bool get isWaiting =>
      previewUrl.isEmpty && prStatus.isEmpty && errorMessage.isEmpty;
  bool get hasError => errorMessage.isNotEmpty;

  ResultEventSummary apply(WsIncomingEvent event) {
    return switch (event) {
      WsPreviewEvent e => _copyWith(previewUrl: e.url, errorMessage: ''),
      WsPrEvent e => _copyWith(
        prUrl: e.url,
        prStatus: e.status,
        branchName: e.branchName,
        errorMessage: '',
      ),
      WsErrorEvent e => _copyWith(
        errorMessage: e.message.isNotEmpty ? e.message : '不明なエラー',
      ),
      _ => this,
    };
  }

  ResultEventSummary _copyWith({
    String? previewUrl,
    String? prUrl,
    String? prStatus,
    String? branchName,
    String? errorMessage,
  }) {
    return ResultEventSummary(
      previewUrl: previewUrl ?? this.previewUrl,
      prUrl: prUrl ?? this.prUrl,
      prStatus: prStatus ?? this.prStatus,
      branchName: branchName ?? this.branchName,
      errorMessage: errorMessage ?? this.errorMessage,
    );
  }

  @override
  bool operator ==(Object other) {
    return other is ResultEventSummary &&
        other.previewUrl == previewUrl &&
        other.prUrl == prUrl &&
        other.prStatus == prStatus &&
        other.branchName == branchName &&
        other.errorMessage == errorMessage;
  }

  @override
  int get hashCode =>
      Object.hash(previewUrl, prUrl, prStatus, branchName, errorMessage);
}

class _WaitingResult extends StatelessWidget {
  final String message;
  const _WaitingResult({this.message = '生成結果を待っています。'});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        const SizedBox(
          width: 18,
          height: 18,
          child: CircularProgressIndicator(strokeWidth: 2),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Text(
            message,
            style: const TextStyle(fontSize: 13, color: Color(0xFF94a3b8)),
          ),
        ),
      ],
    );
  }
}

class _CopyableValue extends StatelessWidget {
  final String value;
  const _CopyableValue({required this.value});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () {
        Clipboard.setData(ClipboardData(text: value));
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('URLをコピーしました')));
      },
      child: Container(
        decoration: BoxDecoration(
          color: const Color(0xFF7c3aed).withAlpha(25),
          border: Border.all(color: const Color(0xFF7c3aed).withAlpha(80)),
          borderRadius: BorderRadius.circular(10),
        ),
        padding: const EdgeInsets.all(12),
        child: Row(
          children: [
            const Text('🔗 '),
            Expanded(
              child: Text(
                value,
                style: const TextStyle(fontSize: 13, color: Color(0xFFa855f7)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _LocalSavedResult extends StatelessWidget {
  final String branchName;
  const _LocalSavedResult({required this.branchName});

  @override
  Widget build(BuildContext context) {
    final message = branchName.isEmpty
        ? 'GitHub連携に失敗しましたが、生成結果はローカルに保存されました。'
        : 'GitHub連携に失敗しましたが、生成結果は $branchName に保存されました。';

    return Text(
      message,
      style: const TextStyle(fontSize: 13, color: Color(0xFF94a3b8)),
    );
  }
}

class _ErrorResult extends StatelessWidget {
  final String message;
  const _ErrorResult({required this.message});

  @override
  Widget build(BuildContext context) {
    return Text(
      message,
      style: const TextStyle(fontSize: 13, color: Color(0xFFf87171)),
    );
  }
}

class _SectionCard extends StatelessWidget {
  final String icon;
  final String title;
  final Widget child;
  const _SectionCard({
    required this.icon,
    required this.title,
    required this.child,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFF1e1e2e),
        border: Border.all(color: const Color(0xFF2a2a3e)),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
            child: Row(
              children: [
                Text(icon, style: const TextStyle(fontSize: 18)),
                const SizedBox(width: 8),
                Text(
                  title,
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
          ),
          const Divider(height: 1, color: Color(0xFF2a2a3e)),
          Padding(padding: const EdgeInsets.all(16), child: child),
        ],
      ),
    );
  }
}

class _Stat extends StatelessWidget {
  final int value;
  final String label;
  const _Stat({required this.value, required this.label});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFF13131a),
        borderRadius: BorderRadius.circular(10),
      ),
      padding: const EdgeInsets.symmetric(vertical: 14),
      child: Column(
        children: [
          Text(
            '$value',
            style: const TextStyle(
              fontSize: 28,
              fontWeight: FontWeight.w800,
              color: Color(0xFFa855f7),
            ),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            style: const TextStyle(fontSize: 12, color: Color(0xFF64748b)),
          ),
        ],
      ),
    );
  }
}
