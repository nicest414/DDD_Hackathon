import 'package:flutter/material.dart';
import 'package:video_player/video_player.dart';

class VideoOverlay extends StatefulWidget {
  final String assetPath;
  final VoidCallback onFinished;
  final VoidCallback? onSwiped;
  final bool enableVerticalSwipeDismiss;

  const VideoOverlay({
    super.key,
    required this.assetPath,
    required this.onFinished,
    this.onSwiped,
    this.enableVerticalSwipeDismiss = true,
  });

  @override
  State<VideoOverlay> createState() => _VideoOverlayState();
}

class _VideoOverlayState extends State<VideoOverlay> {
  late final VideoPlayerController _controller;
  bool _initialized = false;
  double _dragOffsetY = 0;
  bool _heartActive = false;

  @override
  void initState() {
    super.initState();
    _controller = VideoPlayerController.asset(widget.assetPath);
    _controller
        .initialize()
        .then((_) {
          if (!mounted) return;
          _controller.setLooping(true);
          setState(() => _initialized = true);
          _controller.play();
        })
        .catchError((_) {
          if (mounted) widget.onFinished();
        });
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final screenHeight = MediaQuery.of(context).size.height;
    final color = _heartActive ? const Color(0xFFef4444) : Colors.white;

    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onDoubleTap: () => setState(() => _heartActive = !_heartActive),
      onVerticalDragUpdate: widget.enableVerticalSwipeDismiss
          ? (d) => setState(() => _dragOffsetY += d.delta.dy)
          : null,
      onVerticalDragEnd: widget.enableVerticalSwipeDismiss
          ? (d) {
              if (_dragOffsetY.abs() > screenHeight * 0.25 ||
                  (d.primaryVelocity ?? 0).abs() > 500) {
                (widget.onSwiped ?? widget.onFinished)();
              } else {
                setState(() => _dragOffsetY = 0);
              }
            }
          : null,
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
            Positioned(
              right: 16,
              top: screenHeight * 0.40 - 28,
              child: GestureDetector(
                onTap: () => setState(() => _heartActive = !_heartActive),
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
                  child: Icon(Icons.favorite_rounded, color: color, size: 26),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
