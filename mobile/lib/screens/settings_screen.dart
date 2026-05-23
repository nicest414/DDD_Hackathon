import 'package:flutter/material.dart';

class SettingsScreen extends StatelessWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(24, 24, 24, 40),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                '設定',
                style: TextStyle(fontSize: 24, fontWeight: FontWeight.w800),
              ),
              const SizedBox(height: 24),
              _Section(
                icon: '📱',
                title: '使い方',
                children: [
                  _Step(num: '1', text: 'ホームでアプリのアイデアを入力する'),
                  _Step(num: '2', text: 'VS Code拡張が起動していることを確認する'),
                  _Step(num: '3', text: 'AIが提案したカードをスワイプして判断する'),
                  _Step(num: '4', text: '採用カードがコードとしてGitHubにPRされる'),
                ],
              ),
              const SizedBox(height: 16),
              _Section(
                icon: '👆',
                title: 'スワイプ操作',
                children: [
                  _InfoRow(
                    icon: Icons.favorite_rounded,
                    label: 'ハートをタップ',
                    desc: '赤くなる。その状態で上スワイプすると採用',
                  ),
                  _InfoRow(
                    icon: Icons.keyboard_arrow_up_rounded,
                    label: '上スワイプ',
                    desc: 'ハートON → 採用 ／ ハートOFF → 却下',
                  ),
                  _InfoRow(
                    icon: Icons.keyboard_arrow_down_rounded,
                    label: '下スワイプ',
                    desc: '前のカードに戻る',
                  ),
                ],
              ),
              const SizedBox(height: 16),
              _Section(
                icon: 'ℹ️',
                title: 'About',
                children: [
                  _InfoRow(
                    icon: Icons.bolt_rounded,
                    label: 'DDD',
                    desc: 'Dopamine Driven Development',
                  ),
                  _InfoRow(
                    icon: Icons.tag_rounded,
                    label: 'Version',
                    desc: '1.0.0',
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Section extends StatelessWidget {
  final String icon;
  final String title;
  final List<Widget> children;

  const _Section({
    required this.icon,
    required this.title,
    required this.children,
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
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: Column(children: children),
          ),
        ],
      ),
    );
  }
}

class _Step extends StatelessWidget {
  final String num;
  final String text;
  const _Step({required this.num, required this.text});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 22,
            height: 22,
            decoration: BoxDecoration(
              color: const Color(0xFF7c3aed).withAlpha(60),
              shape: BoxShape.circle,
            ),
            child: Center(
              child: Text(
                num,
                style: const TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  color: Color(0xFFa855f7),
                ),
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              text,
              style: const TextStyle(fontSize: 14, color: Color(0xFF94a3b8), height: 1.5),
            ),
          ),
        ],
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final String desc;
  const _InfoRow({required this.icon, required this.label, required this.desc});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      child: Row(
        children: [
          Icon(icon, size: 18, color: const Color(0xFF7c3aed)),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFFcbd5e1),
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  desc,
                  style: const TextStyle(fontSize: 12, color: Color(0xFF64748b), height: 1.4),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
