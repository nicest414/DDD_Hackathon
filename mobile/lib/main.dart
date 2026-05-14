import 'package:flutter/material.dart';
import 'screens/home_screen.dart';

void main() {
  runApp(const DDDApp());
}

class DDDApp extends StatelessWidget {
  const DDDApp({super.key});

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
      home: const HomeScreen(),
    );
  }
}
