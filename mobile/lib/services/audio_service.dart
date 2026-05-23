import 'dart:math';
import 'package:audioplayers/audioplayers.dart';

class AudioService {
  // ここに音源ファイル名を追加する（assets/sounds/ 以下のパス）
  static const _sounds = <String>[
    // 例: 'sounds/swipe1.mp3',
    // 例: 'sounds/swipe2.mp3',
  ];

  final _player = AudioPlayer();
  final _random = Random();

  Future<void> playRandom() async {
    if (_sounds.isEmpty) return;
    final path = _sounds[_random.nextInt(_sounds.length)];
    await _player.play(AssetSource(path));
  }

  Future<void> dispose() async {
    await _player.dispose();
  }
}
