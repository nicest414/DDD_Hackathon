import 'package:flutter/material.dart';
import 'package:uuid/uuid.dart';
import '../models/project.dart';
import 'swipe_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final _controller = TextEditingController();
  final _examples = ['習慣トラッカー', 'Todoリスト', '日記アプリ', '支出メモ', '読書記録'];
  Project? _activeProject;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _start() {
    final idea = _controller.text.trim();
    if (idea.isEmpty) return;
    final project = Project(
      id: const Uuid().v4(),
      title: idea,
      initialPrompt: idea,
    );
    setState(() => _activeProject = project);
  }

  @override
  Widget build(BuildContext context) {
    if (_activeProject != null) {
      return SwipeScreen(project: _activeProject!);
    }

    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(horizontal: 24),
                child: Column(
                  children: [
                    const SizedBox(height: 48),
                    _Logo(),
                    const SizedBox(height: 40),
                    const Text(
                      'どんなアプリを\n作りたいですか？',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 24,
                        fontWeight: FontWeight.w800,
                        height: 1.4,
                      ),
                    ),
                    const SizedBox(height: 24),
                    Container(
                      decoration: BoxDecoration(
                        color: const Color(0xFF1e1e2e),
                        border: Border.all(
                          color: const Color(0xFF2a2a3e),
                          width: 1.5,
                        ),
                        borderRadius: BorderRadius.circular(16),
                      ),
                      padding: const EdgeInsets.all(16),
                      child: TextField(
                        controller: _controller,
                        maxLines: 3,
                        style: const TextStyle(fontSize: 16),
                        decoration: const InputDecoration(
                          border: InputBorder.none,
                          hintText: '例: 毎日の習慣を記録できるアプリを作りたい',
                          hintStyle: TextStyle(color: Color(0xFF64748b)),
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: _examples
                          .map(
                            (e) => _ExampleChip(
                              label: e,
                              onTap: () =>
                                  setState(() => _controller.text = '$eを作りたい'),
                            ),
                          )
                          .toList(),
                    ),
                    const SizedBox(height: 32),
                  ],
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(24, 8, 24, 24),
              child: SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: _start,
                  style: FilledButton.styleFrom(
                    backgroundColor: const Color(0xFF7c3aed),
                    padding: const EdgeInsets.symmetric(vertical: 18),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),
                    ),
                  ),
                  child: const Text(
                    'AIに提案してもらう →',
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Logo extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Container(
          width: 56,
          height: 56,
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [Color(0xFF7c3aed), Color(0xFFa855f7)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(16),
          ),
          child: const Center(child: Text('⚡', style: TextStyle(fontSize: 28))),
        ),
        const SizedBox(height: 10),
        ShaderMask(
          shaderCallback: (b) => const LinearGradient(
            colors: [Color(0xFFc4b5fd), Color(0xFFa855f7)],
          ).createShader(b),
          child: const Text(
            'DDD',
            style: TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.w900,
              color: Colors.white,
            ),
          ),
        ),
        const SizedBox(height: 4),
        const Text(
          'Dopamine Driven Development',
          style: TextStyle(
            fontSize: 12,
            color: Color(0xFF64748b),
            letterSpacing: 0.5,
          ),
        ),
      ],
    );
  }
}

class _ExampleChip extends StatelessWidget {
  final String label;
  final VoidCallback onTap;
  const _ExampleChip({required this.label, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          color: const Color(0xFF1e1e2e),
          border: Border.all(color: const Color(0xFF2a2a3e)),
          borderRadius: BorderRadius.circular(20),
        ),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        child: Text(
          label,
          style: const TextStyle(fontSize: 13, color: Color(0xFF64748b)),
        ),
      ),
    );
  }
}
