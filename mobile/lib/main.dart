import 'package:flutter/material.dart';
import 'services/websocket_service.dart';
import 'screens/root_screen.dart';

void main() {
  runApp(const DDDApp());
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
