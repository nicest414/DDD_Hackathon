import 'package:flutter/material.dart';
import 'package:video_player/video_player.dart';
import '../services/video_service.dart';

class VideoOverlay extends StatefulWidget {
  final String assetPath;
  final VideoMeta? meta;
  final VoidCallback onFinished;
  final VoidCallback? onSwiped;

  const VideoOverlay({
    super.key,
    required this.assetPath,
    this.meta,
    required this.onFinished,
    this.onSwiped,
  });

  @override
  State<VideoOverlay> createState() => _VideoOverlayState();
}

class _VideoOverlayState extends State<VideoOverlay>
    with SingleTickerProviderStateMixin {
  late final VideoPlayerController _controller;
  late final AnimationController _heartAnim;
  bool _initialized = false;
  double _dragOffsetY = 0;
  bool _heartActive = false;
  bool _heartAnimActive = false;
  Offset _doubleTapPos = Offset.zero;

  @override
  void initState() {
    super.initState();
    _heartAnim = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 700),
    );
    _controller = VideoPlayerController.asset(widget.assetPath);
    _controller.initialize().then((_) {
      if (!mounted) return;
      _controller.setLooping(true);
      setState(() => _initialized = true);
      _controller.play();
    }).catchError((_) {
      if (mounted) widget.onFinished();
    });
  }

  @override
  void dispose() {
    _heartAnim.dispose();
    _controller.dispose();
    super.dispose();
  }

  void _onDoubleTapDown(TapDownDetails d) {
    _doubleTapPos = d.localPosition;
  }

  void _triggerHeart() {
    setState(() {
      _heartActive = !_heartActive;
      _heartAnimActive = true;
    });
    _heartAnim.forward(from: 0).then((_) {
      if (mounted) setState(() => _heartAnimActive = false);
    });
  }

  @override
  Widget build(BuildContext context) {
    final screenHeight = MediaQuery.of(context).size.height;
    final color = _heartActive ? const Color(0xFFef4444) : Colors.white;

    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onDoubleTapDown: _onDoubleTapDown,
      onDoubleTap: _triggerHeart,
      onVerticalDragUpdate: (d) =>
          setState(() => _dragOffsetY += d.delta.dy),
      onVerticalDragEnd: (d) {
        if (_dragOffsetY.abs() > screenHeight * 0.25 ||
            (d.primaryVelocity ?? 0).abs() > 500) {
          (widget.onSwiped ?? widget.onFinished)();
        } else {
          setState(() => _dragOffsetY = 0);
        }
      },
      child: Transform.translate(
        offset: Offset(0, _dragOffsetY),
        child: Stack(
          children: [
            Container(
              color: Colors.black,
              child: _initialized
                  ? Center(
                      child: AspectRatio(
                        aspectRatio: _controller.value.aspectRatio,
                        child: VideoPlayer(_controller),
                      ),
                    )
                  : const Center(
                      child: CircularProgressIndicator(strokeWidth: 2),
                    ),
            ),
            if (widget.meta != null)
              Positioned(
                left: 16,
                right: 80,
                bottom: 88,
                child: _VideoMetaLabel(meta: widget.meta!),
              ),
            Positioned(
              right: 16,
              top: screenHeight * 0.40 - 28,
              child: GestureDetector(
                onTap: _triggerHeart,
                child: Container(
                  width: 56,
                  height: 56,
                  decoration: BoxDecoration(
                    color: color.withAlpha(_heartActive ? 40 : 20),
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: color.withAlpha(_heartActive ? 200 : 120),
                      width: 1.5,
                    ),
                  ),
                  child: Icon(
                    Icons.favorite_rounded,
                    color: color,
                    size: 26,
                  ),
                ),
              ),
            ),
            if (_heartAnimActive)
              AnimatedBuilder(
                animation: _heartAnim,
                builder: (context, _) {
                  final t = _heartAnim.value;
                  final opacity =
                      t < 0.3 ? t / 0.3 : (1 - (t - 0.3) / 0.7);
                  final scale = 0.5 + t * 1.5;
                  return Positioned(
                    left: _doubleTapPos.dx - 40,
                    top: _doubleTapPos.dy - 40,
                    child: Opacity(
                      opacity: opacity.clamp(0.0, 1.0),
                      child: Transform.scale(
                        scale: scale,
                        child: const Icon(
                          Icons.favorite_rounded,
                          color: Color(0xFFef4444),
                          size: 80,
                        ),
                      ),
                    ),
                  );
                },
              ),
          ],
        ),
      ),
    );
  }
}

class _VideoMetaLabel extends StatelessWidget {
  final VideoMeta meta;
  const _VideoMetaLabel({required this.meta});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          meta.username,
          style: const TextStyle(
            color: Colors.white,
            fontSize: 15,
            fontWeight: FontWeight.w700,
            shadows: [Shadow(blurRadius: 4, color: Colors.black54)],
          ),
        ),
        const SizedBox(height: 4),
        Text(
          meta.description,
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(
            color: Colors.white,
            fontSize: 13,
            height: 1.4,
            shadows: [Shadow(blurRadius: 4, color: Colors.black54)],
          ),
        ),
      ],
    );
  }
}
