import 'dart:math';

class VideoMeta {
  final String username;
  final String description;

  const VideoMeta({required this.username, required this.description});
}

class VideoEntry {
  final String path;
  final VideoMeta meta;

  const VideoEntry({required this.path, required this.meta});
}



class VideoService {
  static const _entries = <VideoEntry>[
    VideoEntry(
      path: 'assets/videos/52F629A705A9BD4C1E3B69836A7C9D0EABCF6C76.mp4',
      meta: VideoMeta(
        username: '@ddd_hackathon',
        description: 'ドーパミン駆動開発、はじめました 🧠⚡ #hackathon #dev',
      ),
    ),
    VideoEntry(
      path: 'assets/videos/progate.mp4',
      meta: VideoMeta(
        username: '@progate_jp',
        description: 'コードを書けば、世界が変わる。今日も一緒に学ぼう 💻 #progate #プログラミング',
      ),
    ),
    VideoEntry(
      path: 'assets/videos/ad1dc989536f4223bb99b9dd4e25bee6.mp4',
      meta: VideoMeta(
        username: '@vscode_life',
        description: 'AIがコードを書く時代,でもアイデアはあなたが出す ✨ #ai #coding',
      ),
    ),
  ];

  final _random = Random();

  VideoEntry? pickRandomEntry({String? exclude}) {
    if (_entries.isEmpty) return null;
    final available = exclude == null
        ? _entries
        : _entries.where((e) => e.path != exclude).toList();
    if (available.isEmpty) return _entries[_random.nextInt(_entries.length)];
    return available[_random.nextInt(available.length)];
  }

  String? pickRandom({String? exclude}) =>
      pickRandomEntry(exclude: exclude)?.path;

  static bool get hasVideos => _entries.isNotEmpty;
}
