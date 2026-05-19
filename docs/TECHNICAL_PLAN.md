# Dopamine Driven Development 技術計画書

## 1. 技術方針

DDDはFlutter単体のスマホアプリではなく、**スマホを意思決定UI、PC上のVS Code拡張を生成・実行・保存環境として使うAI開発システム** として実装する。

クライアントにはDart / Flutterを使う。生成、実行、GitHub保存はPC側のVS Code拡張が担当する。これにより、スマホの軽い操作感と、PC上の開発環境の強さを両立する。

技術構成の中心は**報酬予測誤差を短い開発ループに変換すること** に置く。ユーザーのスワイプをイベントとして保存し、各ユーザーが契約・所有するAIリソースによる次の提案、プレビュー更新、GitHub PR作成に即座に反映する。

## 2. 推奨スタック

- Mobile Client: Dart / Flutter
- PC Extension: VS Code Extension / Node.js / TypeScript
- AI Runtime: User-owned local AI runtime / Codex CLI / Claude Code CLI / Ollama / OpenAI-compatible API
- AI Runtime Adapter: VS Code Extension / TypeScript
- Realtime Transport: WebSocket
- Local Execution: VS Code Task / 統合ターミナル / Docker またはローカルCLI実行
- Preview Runtime: Vite / React または Flutter Web
- Storage: PGlite / Postgres-compatible local store under VS Code globalStorageUri
- Repository Integration: GitHub API または GitHub CLI
- State Management: Flutter側はChangeNotifier、VS Code拡張側はPGliteとイベントログ

## 2.1 技術構成

DDDは、1つのアプリケーションを単体で動かす構成ではなく、スマホUI、VS Code拡張、AI接続、ローカル実行環境、GitHub連携を組み合わせる構成にする。

```text
Flutter Mobile App
  - 入力UI
  - カード表示
  - スワイプ操作
  - 結果/PR URL表示
        |
        | WebSocket JSON Events
        v
VS Code Extension / Builder Cortex
  - セッション管理
  - カード生成
  - 判断履歴保存
  - AI Runtime Adapter
  - 生成処理
  - プレビュー起動
  - GitHub Publish
        |
        +-- PGlite / globalStorageUri
        +-- User-owned AI API
        +-- VS Code Terminal / Task
        +-- Git / GitHub CLI
```

### Mobile Client / Flutter

Flutter側は、ユーザーが短い判断を気持ちよく行うためのクライアントである。

- `HomeScreen`: 初期プロンプト入力
- `SwipeScreen`: `DecisionCard` の表示と採用/却下操作
- `ResultScreen`: 採用結果、生成結果、PR URL表示
- `WebSocketService`: VS Code拡張との接続
- `ProposalCard`: type別のカードUI、アニメーション、触感、表示演出

Flutter側はAI APIキー、GitHubトークン、生成コード実行環境を持たない。実セッションではカード生成も担当しない。

### VS Code Extension / TypeScript

VS Code拡張側は、PC上の生成・保存・外部連携ランタイムである。

- `extension.ts`: VS Codeコマンド登録、サービス初期化
- `DDDWebSocketServer`: FlutterとのWebSocket接続
- `BuilderCortex`: セッション、カード、判断、生成フローの中核
- `AIRuntimeAdapter`: Codex CLI、Claude Code CLI、Ollama、OpenAI互換API、Mockの呼び出し
- `BaselineDopamine`: AI失敗時のフォールバックカード/仕様
- `DecisionStore`: PGlite保存
- `GitHubPublisher`: Git操作、push、PR作成

VS Code拡張は `onStartupFinished` で起動し、ユーザー操作はコマンドパレットから開始する。

### Transport / WebSocket

スマホとPCはWebSocketで接続する。MVPではローカルネットワークまたは同一マシン前提で `ws://localhost:3000` を使う。

FlutterからVS Code拡張へ送るイベント:

- `startSession`: Projectを開始する
- `swipe`: カードの採用/却下を送る

VS Code拡張からFlutterへ返すイベント:

- `card`: 次に表示する `DecisionCard`
- `preview`: プレビューURL
- `pr`: GitHub Pull Request情報

イベントはJSON Schemaまたは同等のバリデーションを行う。未知のtype、不足フィールド、不正なcardIdはログに残して無視する。

### Storage / PGlite

判断履歴と生成履歴はVS Code拡張の `globalStorageUri` 配下にPGliteで保存する。

保存対象:

- Project
- DecisionCard
- Decision
- GeneratedApp
- PR URL、branchName、repositoryUrl

Flutter側のローカル状態は画面表示のための一時状態に限定する。復元可能な正規状態はPC側のPGliteに置く。

### AI Runtime

AIはサービス共通キーではなく、ユーザー自身が普段使っているローカルAIランタイムを優先して使う。

- 標準はCodex CLI、Claude Code CLI、Ollamaなどのローカルランタイム呼び出しにする
- DDD側はClaude/CodexのAPIキーを保持しない
- APIキー入力方式はOpenAI互換API用のオプションとして残す
- runtime、commandPath、profile、model、timeout、maxTokensはVS Code設定に保存する
- OpenAI互換APIを使う場合のみ、APIキーをVS Code SecretStorageまたは環境変数で参照する
- AI未ログイン、CLI未検出、出力不正、実行タイムアウト時はBaseline Dopamineへフォールバックする

AIが返すカードは、機能名だけでなく、`hook`、`payoff`、`acceptLabel`、`rejectLabel`、`dopamineScore` を含む体験寄りのDTOにする。

### Preview Runtime

生成アプリのプレビューはPC側で起動する。

- MVPではVS Code統合ターミナルから `npm run dev` を起動する
- 将来的にはVS Code Task化し、起動ポートを検出する
- プレビューURLは `preview` イベントでFlutterへ返す
- 生成失敗時も、ログと失敗状態をFeedback Nucleusとして返す

### GitHub Integration

GitHub連携はPC側で行う。

- GitHub CLIまたはGitHub APIを使う
- Flutter側にはGitHubトークンを渡さない
- 生成結果、仕様JSON、判断履歴JSONを専用ブランチへ保存する
- PR URLをFlutter側へ返す

Git操作前には、未コミット変更、現在ブランチ、remote設定、GitHub認証状態を確認する。ユーザーの作業ツリーを壊さないことを優先する。

## 3. Dopamine Loop Stack

| 報酬ループ | コンポーネント | 技術 | 役割 |
| --- | --- | --- |
| Stimulus | **Cue Deck** | Flutter | AI提案カードを提示し、次に判断すべき刺激を作る |
| Prediction | **Reward Predictor** | User-owned AI / TypeScript Adapter | 採用した場合の変化、実装コスト、デモ映えを推定する |
| Action | **Swipe Synapse** | Flutter / WebSocket | 右スワイプ/左スワイプを低遅延イベントとしてVS Code拡張へ送る |
| Memory | **Decision Hippocampus** | PGlite / Event Log | 採用、却下、生成結果、PR URLを時系列で保存する |
| Generation | **Builder Cortex** | VS Code Extension / Node.js / TypeScript | 判断履歴からコード、README、仕様JSONを生成する |
| Reward | **Feedback Nucleus** | Vite / React / Screenshot | プレビュー、差分、実行ログ、PR URLを即時報酬として返す |
| Safety | **Sandbox Striatum** | Docker / temp workspace | 生成コードを隔離実行し、失敗してもデモを継続する |
| Sharing | **GitHub Reward Pathway** | GitHub API / GitHub CLI | 生成結果をPRとして保存し、外部共有可能な報酬にする |
| Fallback | **Baseline Dopamine** | Mock Data | ユーザーのAI接続やGitHubが落ちても最低限の報酬ループを維持する |

## 4. 技術的な面白さ

- スワイプは単なるUI操作ではなく、イベントソーシングされた開発判断として保存する
- AIはコードを一発生成するのではなく、ユーザーの採用/却下履歴から次の提案を変える
- 推論リソースは各ユーザーの契約・所有物を使うため、サービス側はAI APIコストを負担しない
- 秘密情報と生成コード実行をPC側のVS Code拡張へ集約し、スマホ側を薄い判断UIに保つ
- プレビュー、差分、GitHub PRを「報酬」として扱い、ユーザーに短いフィードバックループを返す
- 保存したイベントログを再生すれば、アプリができるまでの判断過程をタイムライン表示できる
- GitHub PRには生成コードだけでなく、判断履歴JSONも含めるため「なぜこのアプリになったか」が残る

## 5. 実装フェーズ

3人での具体的な分担と統合順は [MVP実装計画](MVP_IMPLEMENTATION_PLAN.md) を参照する。

### Phase 1: スワイプ体験

- Flutterでホーム、Swipe Builder、Preview、Historyを実装する
- UI確認用fixtureの提案カードを表示する
- 右スワイプでaccepted、左スワイプでrejectedを記録する
- 採用済みカードから疑似プレビューを生成する
- Cue Deck、Swipe Synapse、ProposalCard Widgetを先に作る
- Flutter側のfixtureカードはWidget開発とデモ用に限定し、実セッションのカード生成の正にはしない

### Phase 2: PC側VS Code拡張

- Builder CortexをVS Code拡張としてNode.js / TypeScriptで実装する
- VS Codeコマンドとして「AI設定」「接続開始」「生成実行」「プレビュー起動」「GitHub保存」を提供する
- FlutterクライアントとWebSocketで接続する
- `startSession` 後にBuilder Cortexが最初の `DecisionCard` を生成してFlutterへ返す
- `swipe` 受信後にDecisionを保存し、次の `DecisionCard` を生成してFlutterへ返す
- VS Codeワークスペースまたは一時ワークスペースに生成コードを書き出す
- VS Code Taskまたは統合ターミナルでVite / ReactまたはFlutter Webのプレビューを起動する
- VS Code Webviewまたは外部ブラウザでプレビューを確認できるようにする
- Decision HippocampusとしてPGliteイベントログを保存する

### Phase 3: User AI Runtime Adapter

- VS Code拡張内にUser AI Runtime Adapterを実装する
- `generateNextCard` と `generateApp` を拡張内サービスとして定義する
- `generateNextCard` は機能名だけでなく、hook、payoff、acceptLabel、rejectLabel、dopamineScoreを含む体験寄りのカードを返す
- ユーザーがVS Code設定でAIランタイム、commandPath、profile、modelを選べるようにする
- Codex CLI Adapter、Claude CLI Adapter、Ollama Adapter、OpenAI Compatible Adapter、Mock Adapterを差し替え可能にする
- OpenAI互換APIを選んだ場合のみ、APIキーをVS Code SecretStorageまたは環境変数から読み込む
- JSON SchemaでAIレスポンスを検証する
- Reward Predictorで提案の変化量とデモ映えを返す
- AI未設定、CLI未検出、未ログイン、利用上限到達、レスポンス不正時はBaseline Dopamineへフォールバックする

## 5.1 DecisionCard責務方針

実セッションでは、DecisionCardの生成、順序決定、意味づけ、採用時の仕様反映はPC側のVS Code拡張に集約する。Flutter側はカードを生成せず、Builder Cortexから受け取ったDTOを表示する。

Flutter側の責務:

- `DecisionCard` DTOを受け取る
- typeに応じてカードUIを出し分ける
- スワイプ、ボタン、アニメーション、触感、ローディング、エラー表示を実装する
- UI単体確認用のfixtureカードを持つ

VS Code拡張側の責務:

- ユーザーの判断履歴から次のカードを決める
- AIまたはBaseline Dopamineでカードを生成する
- カードIDとDecisionをPGliteに保存する
- 採用済みカードを `generateApp` の入力にする
- AIプロンプトとJSON Schemaでカード品質を管理する

この分担により、Flutter側のUI改修と、PC側のAI生成・保存・GitHub連携を独立して進められる。

### Phase 4: GitHub連携

- RepositoryPublisherを実装する
- `ddd/<project-id>` ブランチを作成する
- 生成コード、`ddd-spec.json`、`ddd-decisions.json`、READMEをコミットする
- push後にPull Requestを作成する
- スマホ側にリポジトリURL、ブランチ名、Pull Request URLを表示する
- GitHub PRをFeedback Nucleusの最終報酬として表示する

## 6. GitHub連携方針

GitHub連携はMVPの実装対象とする。

- PC側のBuilder Cortex拡張がGitHub CLIのログイン状態またはPersonal Access Tokenを利用する
- スマホ側にはGitHubトークンを保存しない
- 書き込み先はデモ用リポジトリまたは新規ブランチに限定する
- 認証失敗時はローカル保存とプレビューを成功扱いにし、GitHub保存のみ再試行可能なエラーにする

## 7. VS Code拡張の実装方針

PC側は独立したデスクトップアプリではなく、VS Code拡張として実装する。

- `package.json` でDDD用コマンドを登録する
- `extension.ts` のactivate時にBuilder Cortexを初期化する
- `DDD: Configure AI Runtime` でユーザー自身のAIランタイムを設定する
- `DDD: Start Session` でWebSocketサーバーを起動し、スマホ接続用URLまたはQRコードを表示する
- `DDD: Generate App` で採用済みDecisionから生成コードを書き出す
- `DDD: Open Preview` でVS Code Taskまたは統合ターミナルからプレビューを起動する
- `DDD: Publish to GitHub` でGitHub CLIまたはGitHub APIを呼び出す
- 生成コード、イベントログ、仕様JSONはVS Codeワークスペース配下、または拡張が作成した一時ワークスペースに保存する
- プレビュー、ログ、PR URLはVS Code Webview、通知、またはスマホ側Feedback Nucleusへ返す

## 8. AIリソース利用方針

AIの推論リソースはDDD側で一括提供しない。各ユーザーが契約・ログイン・設定済みのAIランタイムをVS Code拡張から呼び出して利用する。

- サービス側は共通APIキーを配布・保持しない
- DDDは原則としてClaude/Codex等のAPIキー入力を求めない
- スマホアプリにはAI APIキーやAI認証情報を保存しない
- VS Code拡張がユーザーのAIランタイム設定を保持し、PC側からCLIまたはローカルHTTP APIを呼ぶ
- Codex CLI、Claude Code CLI、Ollamaを優先ランタイムにする
- OpenAI互換APIは直接APIを使いたいユーザー向けのオプションとして残す
- AI未設定でもモックカードと疑似生成でデモを継続できるようにする
- 利用料金、レート制限、モデル選択、ログイン状態は各ユーザーが利用するAIランタイム側の条件に従う

## 9. 受け入れ条件

- ユーザーが初期プロンプトを入力してプロジェクトを開始できる
- ユーザーがVS Code拡張に自身のAIランタイム設定を登録できる
- AI提案カードが1枚ずつ表示される
- 右スワイプまたは採用ボタンで提案を採用できる
- 左スワイプまたは却下ボタンで提案を却下できる
- 採用済み提案をもとにVS Code拡張でミニアプリを生成できる
- VS Code拡張から起動したプレビューURLまたはスクリーンショットをスマホ側で確認できる
- 生成コードをGitHubの作業ブランチへpushできる
- Pull Requestを作成し、スマホ側でURLを確認できる
- GitHub認証に失敗した場合も、ローカル保存とプレビューは継続できる
- AI未設定またはAI認証失敗の場合も、モック提案と疑似生成で体験を継続できる
- 採用/却下/生成/PR作成がイベントログとして保存される
- ユーザーの判断履歴に応じて次の提案カードが変化する

## 10. テスト計画

- 右スワイプ時、Decisionのactionがacceptedになる
- 左スワイプ時、Decisionのactionがrejectedになる
- 採用済み提案のみがGeneratedApp生成に使われる
- AIレスポンスが不正JSONの場合にエラー状態になる
- ユーザーのAI API認証失敗時にBaseline Dopamineへフォールバックする
- AI未設定時にスマホ側へ秘密情報入力を求めず、VS Code拡張側の設定導線を返す
- RepositoryPublisherが生成コード、仕様JSON、判断履歴JSONを保存対象に含める
- GitHub保存失敗時にGeneratedAppのローカル生成状態が失われない
- スマホからVS Code拡張へ接続し、スワイプ結果でPC側プレビューが更新される
- 生成コードをGitHubへpushし、Pull Request URLをスマホで確認できる
- イベントログを再生して、同じGeneratedApp状態を復元できる
- VS Code拡張の各コマンドが未接続、生成失敗、GitHub未認証の状態でも復帰可能なエラーを返す
