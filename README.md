# DDD_Hackathon
DDDハッカソンで作成

## 起動方法

### 1. VS Code Extension（Builder Cortex）

```bash
cd vscode-extension
npm install
npm run compile   # TypeScript → JS ビルド
code .            # VS Code で開く
# F5 → Extension Development Host 起動
# Ctrl+Shift+P → "DDD: Start Session"  ← WebSocket サーバーが port 3000 で起動
```

AI を使う場合は先に `Ctrl+Shift+P → "DDD: Configure AI Runtime"` で、Codex CLI、Claude Code CLI、Ollama、OpenAI互換APIなどを選択。
未設定でもモックカードでデモ継続可。

### 2. Flutter アプリ（Cue Deck）

```bash
cd mobile
flutter pub get
flutter emulators --launch <id>   # エミュレーターがない場合
flutter run
```

起動したら「AIに提案してもらう」からセッション開始。Extension が起動していれば自動で WebSocket 接続。

---

## Documents

- [企画書](docs/CONCEPT_PROPOSAL.md)
- [技術計画書](docs/TECHNICAL_PLAN.md)
- [アーキテクチャ設計書](docs/ARCHITECTURE_DESIGN.md)
- [MVP実装計画](docs/MVP_IMPLEMENTATION_PLAN.md)
