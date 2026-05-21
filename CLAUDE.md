# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**DDD (Dopamine Driven Development)** — ハッカソン作品。ユーザーがスマホでフィーチャーカードを左右スワイプして仕様を決め、VS Code拡張がAIでコードを生成してGitHubにPRを作るシステム。

## Development Commands

### VS Code Extension (Builder Cortex)

```bash
cd vscode-extension
npm install
npm run compile      # TypeScript → JS (one-shot)
npm run watch        # TypeScript watch mode
```

デバッグ実行: VS Codeで `F5` → Extension Development Host が起動。

### Flutter App (Cue Deck)

```bash
cd mobile
flutter pub get
flutter run
# 別URLで接続する場合
flutter run --dart-define=DDD_SERVER_URL=ws://192.168.x.x:3000
```

## Architecture

```
Flutter (Cue Deck)          VS Code Extension (Builder Cortex)
  SwipeScreen                 BuilderCortex
    |                           |-- AIAdapter (OpenAI互換API)
    | WebSocket :3000           |-- BaselineDopamine (モックフォールバック)
    v                           |-- DecisionStore (PGlite)
  WebSocketService              |-- GitHubPublisher (git + gh CLI)
```

### データフロー

1. Flutter が `startSession` を送信 → BuilderCortex がプロジェクトを登録し、最初のカードを返す
2. ユーザーがカードをスワイプ → Flutter が `swipe` イベントを送信
3. BuilderCortex が決定を保存し、AIAdapter（失敗時はBaselineDopamine）で次のカードを生成して返す
4. `DDD: Publish to GitHub` コマンド → 採用カードからappスペックを生成し、`ddd/<projectId>` ブランチにPRを作成

### WebSocketイベント型

- **Flutter → Extension**: `startSession`（プロジェクト開始）、`swipe`（カード判定）
- **Extension → Flutter**: `card`（次のカード）、`preview`（プレビューURL）、`pr`（PRリンク）

すべての型定義は [vscode-extension/src/models/types.ts](vscode-extension/src/models/types.ts) に集約。

### VS Code Extension サービス層

- **`BuilderCortex`** — メインオーケストレーター。スワイプ処理・カード生成・アプリ生成を統括
- **`AIAdapter`** — OpenAI互換API呼び出し。`generateNextCard` と `generateApp` を提供。レスポンスのJSON検証あり
- **`BaselineDopamine`** — AIが未設定・失敗した場合のモックカード提供。デモ継続用
- **`DecisionStore`** — PGlite（インプロセスPostgreSQL）による永続化。`context.globalStorageUri` 以下にDBを作成。旧JSONストアからの移行処理あり
- **`DDDWebSocketServer`** — port 3000のWebSocketサーバー。同時接続は1クライアントのみ
- **`GitHubPublisher`** — `git`/`gh` CLIをexecFileで呼び出し。`ddd-spec.json` と `ddd-decisions.json` をコミットしPRを作成

### Flutter アプリ

- **`WebSocketService`** — シングルトン。`ws://localhost:3000` に接続（`AppConfig.serverUrl` で変更可）
- **`BaselineDopamine`** (Dart) — オフライン時の表示用モックカード。本番セッションのカード生成ロジックはExtension側が正
- **`SwipeScreen`** — カードの表示・スワイプ操作のメイン画面。WebSocket接続と並行してベースラインカードをプリロード

## AI設定

Ctrl+Shift+P → `DDD: Configure AI Provider` で以下を設定：
- **Base URL**: `https://api.openai.com/v1`（OpenAI互換なら変更可）
- **Model**: `gpt-4o-mini`（任意のモデル名）
- **API Key**: VS Code Secrets に保存（設定ファイルには書かれない）

未設定でもBaselineDopamineのモックカードでデモ継続可能。

## 重要な制約

- Flutterにカード生成ロジックを追加しない。本番セッションでのカード生成の正はBuilder Cortexのみ
- `GitHubPublisher` は `shell: false` でexecFileを呼ぶためコマンドインジェクション対策済み。この設計を維持すること
- DecisionStoreは `init()` 後でないと使えない。`assertInitialized()` がガードしている
