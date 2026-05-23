import 'dart:math';
import 'package:audioplayers/audioplayers.dart';

class AudioService {
  static const _sounds = <String>[
    'sounds/rain.mp3',
    'sounds/morning.mp3',
  ];

  final _player = AudioPlayer();
  final _random = Random();
  String? _lastPlayed;

  Future<void> playRandom() async {
    if (_sounds.isEmpty) return;
    final available = _sounds.length > 1
        ? _sounds.where((s) => s != _lastPlayed).toList()
        : _sounds;
    final path = available[_random.nextInt(available.length)];
    _lastPlayed = path;
    await _player.setReleaseMode(ReleaseMode.loop);
    await _player.play(AssetSource(path));
  }

  Future<void> stop() async {
    await _player.stop();
  }

  Future<void> dispose() async {
    await _player.dispose();
  }
}
