class AppConfig {
  static const serverUrl = String.fromEnvironment(
    'DDD_SERVER_URL',
    defaultValue: 'ws://localhost:3000',
  );
}
