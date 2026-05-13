# Dopamine Driven Development 技術計画書

## 1. 技術方針

DDDはFlutter単体のスマホアプリではなく、**スマホを意思決定UI、PCを生成・実行・保存環境として使うAI開発システム** として実装する。

クライアントにはDart / Flutterを使う。生成、実行、GitHub保存はPC側のローカルエージェントが担当する。これにより、スマホの軽い操作感と、PC上の開発環境の強さを両立する。

技術構成の中心は**報酬予測誤差を短い開発ループに変換すること** に置く。ユーザーのスワイプをイベントとして保存し、AIの次の提案、プレビュー更新、GitHub PR作成に即座に反映する。

## 2. 推奨スタック

- Mobile Client: Dart / Flutter
- Local Agent: Node.js / TypeScript
- AI Orchestrator: Python / FastAPI
- Realtime Transport: WebSocket
- Local Execution: Docker またはローカルCLI実行
- Preview Runtime: Vite / React または Flutter Web
- Storage: SQLite
- Repository Integration: GitHub API または GitHub CLI
- State Management: Flutter側はChangeNotifier、PC側はSQLiteとイベントログ

## 3. Dopamine Loop Stack

| 報酬ループ | コンポーネント | 技術 | 役割 |
| --- | --- | --- |
| Stimulus | **Cue Deck** | Flutter | AI提案カードを提示し、次に判断すべき刺激を作る |
| Prediction | **Reward Predictor** | Python / FastAPI | 採用した場合の変化、実装コスト、デモ映えを推定する |
| Action | **Swipe Synapse** | Flutter / WebSocket | 右スワイプ/左スワイプを低遅延イベントとしてPC側へ送る |
| Memory | **Decision Hippocampus** | SQLite / Event Log | 採用、却下、生成結果、PR URLを時系列で保存する |
| Generation | **Builder Cortex** | Node.js / TypeScript | 判断履歴からコード、README、仕様JSONを生成する |
| Reward | **Feedback Nucleus** | Vite / React / Screenshot | プレビュー、差分、実行ログ、PR URLを即時報酬として返す |
| Safety | **Sandbox Striatum** | Docker / temp workspace | 生成コードを隔離実行し、失敗してもデモを継続する |
| Sharing | **GitHub Reward Pathway** | GitHub API / GitHub CLI | 生成結果をPRとして保存し、外部共有可能な報酬にする |
| Fallback | **Baseline Dopamine** | Mock Data | AI APIやGitHubが落ちても最低限の報酬ループを維持する |

## 4. 技術的な面白さ

- スワイプは単なるUI操作ではなく、イベントソーシングされた開発判断として保存する
- AIはコードを一発生成するのではなく、ユーザーの採用/却下履歴から次の提案を変える
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

### Phase 2: PC側エージェント

- Builder CortexをNode.js / TypeScriptで実装する
- FlutterクライアントとWebSocketで接続する
- 一時ワークスペースに生成コードを書き出す
- Vite / ReactまたはFlutter Webでプレビューを起動する
- Decision HippocampusとしてSQLiteイベントログを保存する

### Phase 3: AI Orchestrator

- Python / FastAPIでAI Orchestratorを実装する
- `generateNextCard` と `generateApp` をAPI化する
- JSON SchemaでAIレスポンスを検証する
- Reward Predictorで提案の変化量とデモ映えを返す
- AI API失敗時はBaseline Dopamineへフォールバックする

### Phase 4: GitHub連携

- RepositoryPublisherを実装する
- `ddd/<project-id>` ブランチを作成する
- 生成コード、`ddd-spec.json`、`ddd-decisions.json`、READMEをコミットする
- push後にPull Requestを作成する
- スマホ側にリポジトリURL、ブランチ名、Pull Request URLを表示する
- GitHub PRをFeedback Nucleusの最終報酬として表示する

## 6. GitHub連携方針

GitHub連携はMVPの実装対象とする。

- PC側のBuilder CortexがGitHub CLIのログイン状態またはPersonal Access Tokenを利用する
- スマホ側にはGitHubトークンを保存しない
- 書き込み先はデモ用リポジトリまたは新規ブランチに限定する
- 認証失敗時はローカル保存とプレビューを成功扱いにし、GitHub保存のみ再試行可能なエラーにする

## 7. 受け入れ条件

- ユーザーが初期プロンプトを入力してプロジェクトを開始できる
- AI提案カードが1枚ずつ表示される
- 右スワイプまたは採用ボタンで提案を採用できる
- 左スワイプまたは却下ボタンで提案を却下できる
- 採用済み提案をもとにPC側でミニアプリを生成できる
- PC側で起動したプレビューURLまたはスクリーンショットをスマホ側で確認できる
- 生成コードをGitHubの作業ブランチへpushできる
- Pull Requestを作成し、スマホ側でURLを確認できる
- GitHub認証に失敗した場合も、ローカル保存とプレビューは継続できる
- 採用/却下/生成/PR作成がイベントログとして保存される
- ユーザーの判断履歴に応じて次の提案カードが変化する

## 8. テスト計画

- 右スワイプ時、Decisionのactionがacceptedになる
- 左スワイプ時、Decisionのactionがrejectedになる
- 採用済み提案のみがGeneratedApp生成に使われる
- AIレスポンスが不正JSONの場合にエラー状態になる
- AI API失敗時にBaseline Dopamineへフォールバックする
- RepositoryPublisherが生成コード、仕様JSON、判断履歴JSONを保存対象に含める
- GitHub保存失敗時にGeneratedAppのローカル生成状態が失われない
- スマホからPCへ接続し、スワイプ結果でPC側プレビューが更新される
- 生成コードをGitHubへpushし、Pull Request URLをスマホで確認できる
- イベントログを再生して、同じGeneratedApp状態を復元できる
