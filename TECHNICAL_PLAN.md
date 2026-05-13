# Dopamine Driven Development 技術計画書

## 1. 技術方針

DDDはFlutter単体のスマホアプリではなく、**スマホを意思決定UI、PC上のVS Code拡張を生成・実行・保存環境として使うAI開発システム** として実装する。

クライアントにはDart / Flutterを使う。生成、実行、GitHub保存はPC側のVS Code拡張が担当する。これにより、スマホの軽い操作感と、PC上の開発環境の強さを両立する。

技術構成の中心は**報酬予測誤差を短い開発ループに変換すること** に置く。ユーザーのスワイプをイベントとして保存し、各ユーザーが契約・所有するAIリソースによる次の提案、プレビュー更新、GitHub PR作成に即座に反映する。

## 2. 推奨スタック

- Mobile Client: Dart / Flutter
- PC Extension: VS Code Extension / Node.js / TypeScript
- AI Runtime: User-owned AI API / Local LLM / OpenAI-compatible API
- AI Adapter: VS Code Extension / TypeScript
- Realtime Transport: WebSocket
- Local Execution: VS Code Task / 統合ターミナル / Docker またはローカルCLI実行
- Preview Runtime: Vite / React または Flutter Web
- Storage: SQLite
- Repository Integration: GitHub API または GitHub CLI
- State Management: Flutter側はChangeNotifier、VS Code拡張側はSQLiteとイベントログ

## 3. Dopamine Loop Stack

| 報酬ループ | コンポーネント | 技術 | 役割 |
| --- | --- | --- |
| Stimulus | **Cue Deck** | Flutter | AI提案カードを提示し、次に判断すべき刺激を作る |
| Prediction | **Reward Predictor** | User-owned AI / TypeScript Adapter | 採用した場合の変化、実装コスト、デモ映えを推定する |
| Action | **Swipe Synapse** | Flutter / WebSocket | 右スワイプ/左スワイプを低遅延イベントとしてVS Code拡張へ送る |
| Memory | **Decision Hippocampus** | SQLite / Event Log | 採用、却下、生成結果、PR URLを時系列で保存する |
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
- SQLiteのイベントログを再生すれば、アプリができるまでの判断過程をタイムライン表示できる
- GitHub PRには生成コードだけでなく、判断履歴JSONも含めるため「なぜこのアプリになったか」が残る

## 5. 実装フェーズ

### Phase 1: スワイプ体験

- Flutterでホーム、Swipe Builder、Preview、Historyを実装する
- モックの提案カードを表示する
- 右スワイプでaccepted、左スワイプでrejectedを記録する
- 採用済みカードから疑似プレビューを生成する
- Cue Deck、Swipe Synapse、Baseline Dopamineを先に作る

### Phase 2: PC側VS Code拡張

- Builder CortexをVS Code拡張としてNode.js / TypeScriptで実装する
- VS Codeコマンドとして「AI設定」「接続開始」「生成実行」「プレビュー起動」「GitHub保存」を提供する
- FlutterクライアントとWebSocketで接続する
- VS Codeワークスペースまたは一時ワークスペースに生成コードを書き出す
- VS Code Taskまたは統合ターミナルでVite / ReactまたはFlutter Webのプレビューを起動する
- VS Code Webviewまたは外部ブラウザでプレビューを確認できるようにする
- Decision HippocampusとしてSQLiteイベントログを保存する

### Phase 3: User AI Adapter

- VS Code拡張内にUser AI Adapterを実装する
- `generateNextCard` と `generateApp` を拡張内サービスとして定義する
- ユーザーがVS Code設定でAIプロバイダ、モデル名、ベースURLを選べるようにする
- APIキーはVS Code SecretStorageまたは環境変数から読み込む
- JSON SchemaでAIレスポンスを検証する
- Reward Predictorで提案の変化量とデモ映えを返す
- AI未設定、認証失敗、利用上限到達、レスポンス不正時はBaseline Dopamineへフォールバックする

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
- `DDD: Configure AI Provider` でユーザー自身のAI接続情報を設定する
- `DDD: Start Session` でWebSocketサーバーを起動し、スマホ接続用URLまたはQRコードを表示する
- `DDD: Generate App` で採用済みDecisionから生成コードを書き出す
- `DDD: Open Preview` でVS Code Taskまたは統合ターミナルからプレビューを起動する
- `DDD: Publish to GitHub` でGitHub CLIまたはGitHub APIを呼び出す
- 生成コード、イベントログ、仕様JSONはVS Codeワークスペース配下、または拡張が作成した一時ワークスペースに保存する
- プレビュー、ログ、PR URLはVS Code Webview、通知、またはスマホ側Feedback Nucleusへ返す

## 8. AIリソース利用方針

AIの推論リソースはDDD側で一括提供しない。各ユーザーが契約・所有しているAI API、クラウドAI、またはローカルLLMをVS Code拡張に設定して利用する。

- サービス側は共通APIキーを配布・保持しない
- スマホアプリにはAI APIキーを保存しない
- VS Code拡張がユーザーのAI設定を保持し、PC側から直接AIへ問い合わせる
- OpenAI互換APIを優先インターフェースにし、将来的に複数プロバイダへ拡張できるようにする
- AI未設定でもモックカードと疑似生成でデモを継続できるようにする
- 利用料金、レート制限、モデル選択は各ユーザーの契約条件に従う

## 9. 受け入れ条件

- ユーザーが初期プロンプトを入力してプロジェクトを開始できる
- ユーザーがVS Code拡張に自身のAIプロバイダ設定を登録できる
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
