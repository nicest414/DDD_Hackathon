import 'dart:math';

class VideoService {
  // ここに動画ファイル名を追加する（assets/videos/ 以下のフルパス）
  static const _videos = <String>[
    'assets/videos/52F629A705A9BD4C1E3B69836A7C9D0EABCF6C76.mp4',
    'assets/videos/progate.mp4',
    'assets/videos/ad1dc989536f4223bb99b9dd4e25bee6.mp4',
  ];

  final _random = Random();

  String? pickRandom({String? exclude}) {
    if (_videos.isEmpty) return null;
    final available = exclude == null
        ? _videos
        : _videos.where((v) => v != exclude).toList();
    if (available.isEmpty) return _videos[_random.nextInt(_videos.length)];
    return available[_random.nextInt(available.length)];
  }

  static bool get hasVideos => _videos.isNotEmpty;
}
