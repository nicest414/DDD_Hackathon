import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:device_preview/device_preview.dart';
import 'services/websocket_service.dart';
import 'screens/root_screen.dart';

void main() {
  runApp(
    DevicePreview(enabled: !kReleaseMode, builder: (context) => const DDDApp()),
  );
}

class DDDApp extends StatefulWidget {
  const DDDApp({super.key});

  @override
  State<DDDApp> createState() => _DDDAppState();
}

class _DDDAppState extends State<DDDApp> {
  @override
  void dispose() {
    WebSocketService().dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'DDD',
      debugShowCheckedModeBanner: false,
      builder: DevicePreview.appBuilder,
      locale: DevicePreview.locale(context),
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF7c3aed),
          brightness: Brightness.dark,
          surface: const Color(0xFF0a0a0f),
        ),
        scaffoldBackgroundColor: const Color(0xFF0a0a0f),
        useMaterial3: true,
      ),
      home: const RootScreen(),
    );
  }
}
