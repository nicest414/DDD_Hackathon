# Dopamine Driven Development アーキテクチャ設計書

## 1. 全体構成

DDDは、スマホクライアント、PC側ローカルエージェント、AI Orchestrator、GitHub連携で構成する。

アーキテクチャ上の中心概念は、開発を **Stimulus、Prediction、Action、Reward、Memory、Reinforcement** のループとして扱うことである。

```text
Cue Deck / Flutter App
  |
  | Swipe Synapse / WebSocket
  v
Builder Cortex
  |          \
  |           \ GitHub API / GitHub CLI
  v            v
Reward Predictor  GitHub Reward Pathway
  |
  v
LLM / Baseline Dopamine
```

Flutter Appは刺激提示と判断入力を担当する。Builder CortexはPC上でコード生成、実行、プレビュー、GitHub保存を担当する。Reward PredictorはAIへの問い合わせ、提案の変化量推定、レスポンス検証を担当する。

## 2. 主要コンポーネント

### 2.1 Cue Deck

Flutter製のスマホクライアント。ユーザーに「次に判断すべき刺激」を提示する。

- 初期プロンプト入力
- 提案カード表示
- 右スワイプ/左スワイプ
- Preview表示
- History表示
- GitHubリンク表示

### 2.2 Swipe Synapse

ユーザー判断を低遅延イベントとしてPC側へ送る伝達レイヤー。

- `DecisionCard` を1枚ずつ表示する
- 右スワイプをacceptedとして記録する
- 左スワイプをrejectedとして記録する
- 判断結果をBuilder Cortexへ送信する

### 2.3 Decision Hippocampus

判断履歴と生成履歴を保存する記憶レイヤー。

- 採用/却下イベントをSQLiteへ保存する
- 生成結果、実行ログ、PR URLをイベントとして保存する
- イベントログの再生でGeneratedApp状態を復元する
- 判断履歴を次のAI提案のコンテキストに含める

### 2.4 Builder Cortex

PC上で起動するローカルエージェント。

- Flutter AppとのWebSocketセッション管理
- 一時ワークスペース作成
- 生成コードのファイル書き込み
- ビルド、テスト、プレビュー起動
- GitHub保存処理の呼び出し

### 2.5 Reward Predictor

AI Orchestratorの中核。

- `generateNextCard` で次の提案カードを生成する
- `generateApp` でアプリ仕様とコード案を生成する
- 採用した場合に何が変わるかを短く要約する
- 提案の新規性、実装コスト、デモ映えを推定する
- JSON SchemaでAIレスポンスを検証する
- 失敗時はBaseline Dopamineへフォールバックする

### 2.6 Feedback Nucleus

ユーザーに即時報酬を返す表示レイヤー。

- プレビューURL表示
- スクリーンショット表示
- 実行ログ表示
- GitHub Pull Request URL表示
- 採用判断による変化点の表示

### 2.7 GitHub Reward Pathway

GitHub保存を担当するRepositoryレイヤー。

- 作業ブランチ作成
- 生成コードのコミット
- push
- Pull Request作成
- リポジトリURL、ブランチ名、Pull Request URLの返却

### 2.8 Baseline Dopamine

外部APIが失敗してもデモの報酬ループを維持するフォールバック。

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
| type | string | concept / feature / ui / flow / data |
| title | string | 提案タイトル |
| description | string | 提案説明 |
| payload | object | AI生成用の構造化データ |
| predictedReward | string | 採用した場合に何が変わるかの短い説明 |
| noveltyScore | number | 新規性や変化量の推定値 |
| effortScore | number | 実装コストの推定値 |
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

## 4. API設計

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

1. PCでBuilder Cortexを起動する
2. スマホアプリがWebSocketでBuilder Cortexへ接続する
3. ユーザーが初期プロンプトを入力する
4. Reward Predictorが提案カードと予測報酬を生成する
5. ユーザーがカードをスワイプする
6. Decision Hippocampusが判断イベントを保存する
7. Builder Cortexが生成コードと仕様を作る
8. DockerまたはローカルCLIでプレビューを起動する
9. Feedback NucleusがプレビューURL、差分、ログをスマホへ返す
10. GitHub Reward PathwayがGitHubへpushし、Pull Request URLを返す
11. Reward Predictorが判断履歴をもとに次の提案カードを調整する

## 7. エラー設計

- AIレスポンスが不正なJSONの場合、再生成可能なエラーとして扱う
- AI APIが失敗した場合、Baseline Dopamineへフォールバックする
- GitHub認証に失敗した場合、ローカル保存とプレビューは継続する
- GitHub pushに失敗した場合、Pull Request URLだけ空にして再試行可能にする
- 生成に失敗しても、Project、Decision、DecisionCardは失わない
