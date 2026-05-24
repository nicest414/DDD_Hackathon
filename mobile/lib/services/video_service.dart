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
    VideoEntry(
      path: 'assets/videos/v24025gl0000d83h38nog65tkscvjmog.mov',
      meta: VideoMeta(
        username: '@user13000012993632',
        description: '性格悪いやつ🫠「明日のユニバだけど人数多いから来ないでくれ頼む」#性格悪い #実話 #ユニバ',
      ),
    ),
    VideoEntry(
      path: 'assets/videos/v14044g50000d88q2bnog65mukrkat7g.mov',
      meta: VideoMeta(
        username: '@織莉叶さん',
        description: 'ふわふわコーデ見て🎀🩷 #ロリータ #かわいい #fashion',
      ),
    ),
    VideoEntry(
      path: 'assets/videos/v12025gd0000d862dbvog65u6rab6cp0.mov',
      meta: VideoMeta(
        username: '@nihiwish67',
        description: 'スカッと迷言集 ゴミ対応vs神対応… 驚いて口の中のものが💦 #スカッと #実話',
      ),
    ),
    VideoEntry(
      path: 'assets/videos/v14044g50000d84l10vog65g0vr60dhg.mov',
      meta: VideoMeta(
        username: '阿部かれん',
        description: '左：阿部かれん、右：小野寺梓 #favme #ふぁぼみー #fyp',
      ),
    ),
    VideoEntry(
      path: 'assets/videos/v1c044g50000d7rksjvog65gs2nfhc40.mov',
      meta: VideoMeta(
        username: '@NiziU_official',
        description: '本当にかわいい💕 #NiziU #MAYUKA #WithU',
      ),
    ),
    VideoEntry(
      path: 'assets/videos/v14044g50000d5n0uavog65s9am0ficg.mov',
      meta: VideoMeta(
        username: '大場花菜',
        description: 'チェック柄ワンピ🎀リボンつけて推し活してきた〜！ #=LOVE ',
      ),
    ),
    VideoEntry(
      path: 'assets/videos/3438DB8A2827BC569F3DE27623E94535A4D3DAA0.mov',
      meta: VideoMeta(
        username: '@ddd_dev',
        description: 'ハッカソン会場でテンション上がりすぎた件🔥 #hackathon #エンジニア #DDD',
      ),
    ),
    VideoEntry(
      path: 'assets/videos/63E637FC85620FA33F4566B03E8F36914D51426F.mov',
      meta: VideoMeta(
        username: '@ddd_dev',
        description: 'ドーパミン駆動開発、参戦中⚡ランヤードが証拠 #DDD #hackathon #dev',
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
