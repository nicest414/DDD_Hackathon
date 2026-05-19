# Dopamine Driven Development アーキテクチャ設計書

## 1. 全体構成

DDDは、スマホクライアント、PC側VS Code拡張、ユーザー持ち込みAI接続、GitHub連携で構成する。

アーキテクチャ上の中心概念は、開発を **Stimulus、Prediction、Action、Reward、Memory、Reinforcement** のループとして扱うことである。

設計上の前提として、スマホアプリは操作UIに徹し、AI APIキー、GitHubトークン、生成コードの実行環境は保持しない。秘密情報と生成処理はPC側のVS Code拡張に集約する。

```text
Cue Deck / Flutter App
  |
  | Swipe Synapse / WebSocket
  v
Builder Cortex / VS Code Extension
  |          \
  |           \ GitHub API / GitHub CLI
  v            v
Reward Predictor / User AI Runtime Adapter  GitHub Reward Pathway
  |
  v
User-owned LLM / Baseline Dopamine
```

Flutter Appは刺激提示と判断入力を担当する。Builder CortexはVS Code拡張としてPC上で動作し、コード生成、実行、プレビュー、GitHub保存を担当する。Reward Predictorはユーザーが契約・所有するAIリソースへの問い合わせ、提案の変化量推定、レスポンス検証を担当する。

## 2. 主要コンポーネント

### 2.1 Cue Deck

Flutter製のスマホクライアント。ユーザーに「次に判断すべき刺激」を提示する。

- 初期プロンプト入力
- 提案カード表示
- 右スワイプ/左スワイプ
- Preview表示
- History表示
- GitHubリンク表示

Cue Deckはカードの生成主体ではない。カードの意味、順序、採用時の仕様反映はBuilder Cortex側で決定し、Cue Deckは受け取った `DecisionCard` を気持ちよく表示・操作させることに集中する。

### 2.2 Swipe Synapse

ユーザー判断を低遅延イベントとしてPC側のVS Code拡張へ送る伝達レイヤー。

- `DecisionCard` を1枚ずつ表示する
- 右スワイプをacceptedとして記録する
- 左スワイプをrejectedとして記録する
- 判断結果をBuilder Cortexへ送信する

### 2.2.1 DecisionCardの責務境界

DecisionCardは、ユーザーに見せる単なる機能リストではなく、作りたいアプリの「欲しくなる瞬間」を表す刺激単位として扱う。

責務は以下のように分ける。

| 領域 | 責務 |
| --- | --- |
| Builder Cortex / Reward Predictor | 次に出すカードを決める |
| Builder Cortex / Reward Predictor | カードの意味、type、hook、payoff、採用時の仕様反映を決める |
| Builder Cortex / Decision Hippocampus | カードID、判断履歴、生成履歴を保存する |
| Baseline Dopamine | AI未設定時のフォールバックカードを生成する |
| Cue Deck / Flutter | 受け取ったカードを表示する |
| Cue Deck / Flutter | typeごとのレイアウト、アニメーション、スワイプ操作、触感、ローディング、エラー表示を担当する |

実セッションにおけるカード生成の唯一の正はPC側のBuilder Cortexである。Flutter側にカード生成ロジックを持たせる場合は、Widget確認用fixtureまたは開発用プレビューに限定し、本番セッションの状態管理には使わない。

カードのライフサイクルは以下を基本とする。

```text
Flutter: startSessionを送信
Builder Cortex: Projectを登録し、最初のDecisionCardを生成して返す
Flutter: 受け取ったDecisionCardだけを表示する
Flutter: swipeイベントを送信
Builder Cortex: Decisionを保存し、次のDecisionCardを生成して返す
Flutter: 次のDecisionCardを表示する
```

この分担により、UI改修はFlutter側で完結し、カード生成、AIプロンプト、保存、仕様反映はVS Code拡張側で一貫して扱える。

### 2.3 Decision Hippocampus

判断履歴と生成履歴を保存する記憶レイヤー。

- 採用/却下イベントをPGliteへ保存する
- 生成結果、実行ログ、PR URLをイベントとして保存する
- イベントログの再生でGeneratedApp状態を復元する
- 判断履歴を次のAI提案のコンテキストに含める

### 2.4 Builder Cortex

PC上のVS Code Extension Hostで起動する拡張機能。

- Flutter AppとのWebSocketセッション管理
- VS Codeワークスペースまたは一時ワークスペース作成
- 生成コードのファイル書き込み
- VS Code Taskまたは統合ターミナル経由のビルド、テスト、プレビュー起動
- VS Code Webviewまたは外部ブラウザでのプレビュー表示
- GitHub保存処理の呼び出し

### 2.5 Reward Predictor

ユーザー持ち込みAI接続の中核。

- `generateNextCard` で次の提案カードを生成する
- `generateApp` でアプリ仕様とコード案を生成する
- 採用した場合に何が変わるかを短く要約する
- 提案の新規性、実装コスト、デモ映えを推定する
- JSON SchemaでAIレスポンスを検証する
- 失敗時はBaseline Dopamineへフォールバックする

### 2.6 User AI Runtime Adapter

各ユーザーが普段使っているAI実行環境を接続するアダプタ。

DDDは原則としてユーザーにAPIキー入力を要求しない。標準方針は、Codex CLI、Claude Code CLI、Ollamaなど、ユーザーがローカルでログイン・設定済みのAIランタイムをVS Code拡張から呼び出すことである。

- Codex CLI、Claude Code CLI、Ollama、OpenAI互換API、Mockを差し替え可能にする
- DDD側はClaudeやCodexのAPIキーを保持しない
- スマホ側にはAI APIキー、AI認証情報、GitHubトークンを保存しない
- OpenAI互換APIは互換性確保のためのオプションとして残す
- CLIランタイムのcommandPath、profile、model、timeoutをVS Code拡張の設定として管理する
- CLI出力はJSON Schemaで検証し、不正な場合は再試行またはBaseline Dopamineへフォールバックする

### 2.7 Feedback Nucleus

ユーザーに即時報酬を返す表示レイヤー。

- プレビューURL表示
- スクリーンショット表示
- 実行ログ表示
- GitHub Pull Request URL表示
- 採用判断による変化点の表示

### 2.8 GitHub Reward Pathway

GitHub保存を担当するRepositoryレイヤー。

- 作業ブランチ作成
- 生成コードのコミット
- push
- Pull Request作成
- リポジトリURL、ブランチ名、Pull Request URLの返却

### 2.9 Baseline Dopamine

ユーザーのAI接続が未設定、上限到達、または失敗した場合でもデモの報酬ループを維持するフォールバック。

- 固定の提案カード
- 固定の生成仕様
- 疑似プレビュー
- GitHub未接続時のローカル保存完了メッセージ

## 3. データモデル

### Project

| フィールド | 型 | 説明 |
| --- | --- | --- |
| id | string | プロジェクトID |
| title | string | プロジェクト名 |
| initialPrompt | string | 初期入力 |
| status | string | draft / building / generated |
| createdAt | DateTime | 作成日時 |
| updatedAt | DateTime | 更新日時 |

### DecisionCard

| フィールド | 型 | 説明 |
| --- | --- | --- |
| id | string | カードID |
| projectId | string | 紐づくProject ID |
| type | string | concept / feature / ui / flow / data / moment / reward / polish |
| title | string | 提案タイトル |
| hook | string | 見た瞬間に欲しくなる短い訴求。任意だがUIでは優先表示する |
| description | string | 提案説明 |
| payoff | string | 採用した場合にユーザーが得る気持ちよさ、完成後の瞬間 |
| acceptLabel | string | 採用ボタンに表示する文言。例: これ欲しい |
| rejectLabel | string | 却下ボタンに表示する文言。例: 今はいらない |
| payload | object | AI生成用の構造化データ |
| predictedReward | string | 採用した場合に何が変わるかの短い説明 |
| noveltyScore | number | 新規性や変化量の推定値 |
| effortScore | number | 実装コストの推定値 |
| dopamineScore | number | 欲しくなる強さ、即時報酬感、デモ映えの推定値 |
| status | string | pending / accepted / rejected |

### Decision

| フィールド | 型 | 説明 |
| --- | --- | --- |
| id | string | 判断ID |
| cardId | string | 対象カードID |
| action | string | accepted / rejected |
| reason | string | 判断理由。MVPでは空文字でもよい |
| createdAt | DateTime | 判断日時 |

### GeneratedApp

| フィールド | 型 | 説明 |
| --- | --- | --- |
| id | string | 生成アプリID |
| projectId | string | 紐づくProject ID |
| spec | object | 生成アプリ仕様 |
| source | string | 生成コードまたは画面定義 |
| previewState | object | プレビュー表示用状態 |
| repositoryUrl | string | 生成コードの保存先GitHubリポジトリURL |
| branchName | string | 生成コードを保存するブランチ名 |
| pullRequestUrl | string | 作成済みPull RequestのURL。未作成の場合は空文字 |
| updatedAt | DateTime | 更新日時 |

### AIRuntimeConfig

| フィールド | 型 | 説明 |
| --- | --- | --- |
| runtime | string | codex-cli / claude-cli / ollama / openai-compatible / mock |
| commandPath | string | CLIランタイムの実行ファイルパス。例: codex, claude |
| profile | string | CLI側のプロファイル名。未使用の場合は空文字 |
| model | string | 利用モデル名。CLI側の既定値を使う場合はauto |
| baseUrl | string | OpenAI互換APIまたはOllama等のHTTPエンドポイント。CLI利用時は空文字可 |
| apiKeyRef | string | OpenAI互換API利用時のみ使うSecretStorageまたは環境変数への参照名 |
| timeoutMs | number | AIランタイム呼び出しのタイムアウト |
| maxTokens | number | 1回の生成で使う最大トークン数 |
| fallbackEnabled | boolean | 失敗時にBaseline Dopamineへ切り替えるか |

## 4. API設計

この章のAPIは外部公開APIではなく、VS Code拡張内のサービス境界を表す。スマホアプリはWebSocketイベントを通じてBuilder Cortexへ要求し、AI接続とGitHub接続はPC側で完結する。

### configureAIRuntime

ユーザー自身のAIランタイムをPC側のVS Code拡張に設定する。

入力:

- runtime
- commandPath
- profile
- baseUrl
- model
- apiKey or apiKeyEnvName。OpenAI互換API利用時のみ
- timeoutMs
- maxTokens

出力:

```json
{
  "runtime": "codex-cli",
  "commandPath": "/Applications/Codex.app/Contents/Resources/codex",
  "model": "auto",
  "status": "configured"
}
```

### generateNextCard

次に表示する提案カードを生成する。

入力:

- Project
- Decision一覧
- 採用済みDecisionCard一覧
- 却下済みDecisionCard一覧

出力:

```json
{
  "type": "feature",
  "title": "毎日の達成状況をチェックできる機能",
  "description": "ユーザーが習慣を完了した日を記録できるようにします。",
  "payload": {
    "impact": "習慣トラッカーとしての基本体験を作ります"
  }
}
```

### generateApp

採用済み提案をもとにミニアプリを生成する。

入力:

- Project
- acceptedのDecision一覧
- acceptedのDecisionCard一覧

出力:

```json
{
  "name": "Habit Swipe",
  "summary": "毎日の習慣を登録し、達成状況を記録するミニアプリ",
  "screens": [
    {
      "name": "Home",
      "description": "習慣一覧と今日の達成状況を表示する"
    }
  ],
  "features": [
    "習慣登録",
    "今日の達成チェック",
    "連続達成日数の表示"
  ]
}
```

### publishToGitHub

生成コードをGitHubへ保存し、Pull Requestを作成する。

入力:

- repositoryUrl
- projectId
- generatedSource
- generatedSpec
- decisions

出力:

```json
{
  "repositoryUrl": "https://github.com/example/ddd-demo",
  "branchName": "ddd/project-123",
  "pullRequestUrl": "https://github.com/example/ddd-demo/pull/1"
}
```

## 5. 保存対象

GitHubへ保存するファイル:

- 生成アプリのソースコード
- `ddd-spec.json`: 生成仕様
- `ddd-decisions.json`: 採用・却下履歴
- `README.md`: 生成アプリの概要と起動方法

## 6. 主要フロー

1. PCでVS Codeを開き、Builder Cortex拡張を起動する
2. ユーザーがVS Code拡張でAIランタイムを設定する。未設定の場合はBaseline Dopamineを使う
3. スマホアプリがWebSocketでBuilder Cortexへ接続する
4. ユーザーが初期プロンプトを入力する
5. Reward Predictorがユーザー持ち込みAIまたはBaseline Dopamineで提案カードと予測報酬を生成する
6. ユーザーがカードをスワイプする
7. Decision Hippocampusが判断イベントを保存する
8. Builder Cortexが生成コードと仕様を作る
9. VS Code Task、統合ターミナル、またはローカルCLIでプレビューを起動する
10. Feedback NucleusがプレビューURL、差分、ログをスマホへ返す
11. GitHub Reward PathwayがGitHubへpushし、Pull Request URLを返す
12. Reward Predictorが判断履歴をもとに次の提案カードを調整する

## 7. エラー設計

- AIレスポンスが不正なJSONの場合、再生成可能なエラーとして扱う
- ユーザーのAIランタイムが未設定、未ログイン、CLI未検出、上限到達、または通信失敗した場合、Baseline Dopamineへフォールバックする
- DDDは原則としてClaude/Codex等のAPIキーを扱わない。OpenAI互換APIを選んだ場合のみPC側のVS Code SecretStorageまたは環境変数で扱い、スマホ側には送信しない
- GitHub認証に失敗した場合、ローカル保存とプレビューは継続する
- GitHub pushに失敗した場合、Pull Request URLだけ空にして再試行可能にする
- 生成に失敗しても、Project、Decision、DecisionCardは失わない
