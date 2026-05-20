# Issue 001: 共通DTOとWebSocketイベント仕様を確定する

## 背景

MVPでは、FlutterアプリとVS Code拡張がWebSocketで接続し、カード表示、採用/却下、生成結果表示までを連携する。

このとき、Flutter側、VS Code拡張側、AI Runtime側で `DecisionCard` やイベントJSONの形がズレると、3人で並行実装しても最後に統合できなくなる。

そのため、最初に共通DTOとWebSocketイベント仕様を固定する。

## ゴール

- FlutterとVS Code拡張が同じ `DecisionCard` 仕様を使う
- `startSession -> card -> swipe -> card` の通信フローを固定する
- `preview`、`pr`、`error` の最小イベント仕様を決める
- AI Runtime Adapterが返すJSONと、Flutterが表示するJSONの境界を揃える
- 以降のIssueでは、この仕様を前提に実装できる状態にする

## 対象範囲

対象:

- `DecisionCard`
- `Project`
- `Decision`
- `GeneratedApp`
- WebSocket Incoming Event
- WebSocket Outgoing Event
- エラーイベント

対象外:

- 実際のUI実装
- 保存ストアの内部形式変更
- AI Runtime Adapter実装
- GitHub Publish実装
- 本格コード生成

## 決定事項

### カード生成の責務

実セッションでは、カード生成の唯一の正はVS Code拡張側に置く。

```text
VS Code拡張:
カード生成、順序決定、採用時の仕様反映、保存

Flutter:
カード表示、スワイプ、アニメーション、ローディング、エラー表示
```

Flutter側にfixtureカードを置いてよいが、それはWidget確認用に限定する。実セッションでは使用しない。

### 仕様変更の扱い

このIssue完了後、後続IssueではDTOフィールドやイベント名を勝手に増減しない。
不足が見つかった場合は、まずこの仕様を更新してから実装へ反映する。

### タイムスタンプ

`createdAt` / `updatedAt` はISO 8601文字列に統一する。
サンプルではUTCの `Z` 表記を使う。

## DTO仕様

### Project

```ts
type ProjectStatus = 'draft' | 'building' | 'generated' | 'failed';

interface Project {
  id: string;
  title: string;
  initialPrompt: string;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
}
```

### DecisionCard

```ts
type DecisionCardType =
  | 'concept'
  | 'feature'
  | 'ui'
  | 'flow'
  | 'data'
  | 'moment'
  | 'reward'
  | 'polish'
  | 'risk';

type DecisionCardStatus = 'pending' | 'accepted' | 'rejected';

interface DecisionCard {
  id: string;
  projectId: string;
  type: DecisionCardType;
  title: string;
  hook: string;
  description: string;
  payoff: string;
  acceptLabel: string;
  rejectLabel: string;
  payload: Record<string, unknown>;
  predictedReward: string;
  noveltyScore: number;
  effortScore: number;
  dopamineScore: number;
  status: DecisionCardStatus;
}
```

### Decision

```ts
type DecisionAction = 'accepted' | 'rejected';

interface Decision {
  id: string;
  projectId: string;
  cardId: string;
  action: DecisionAction;
  reason: string;
  createdAt: string;
}
```

`projectId` は必須にする。  
`cardId` 経由のJOINだけに依存すると、後で履歴表示や復元が面倒になるため。

### GeneratedApp

```ts
interface GeneratedApp {
  id: string;
  projectId: string;
  spec: Record<string, unknown>;
  source: string;
  previewState: Record<string, unknown>;
  repositoryUrl: string;
  branchName: string;
  pullRequestUrl: string;
  updatedAt: string;
}
```

## WebSocketイベント仕様

### Flutter -> VS Code拡張

#### startSession

Flutterが新しいプロジェクトを開始するときに送る。

```json
{
  "type": "startSession",
  "project": {
    "id": "project-1",
    "title": "習慣トラッカー",
    "initialPrompt": "毎日の習慣を記録できるアプリを作りたい",
    "status": "draft",
    "createdAt": "2026-05-19T10:00:00.000Z",
    "updatedAt": "2026-05-19T10:00:00.000Z"
  }
}
```

期待する応答:

```text
VS Code拡張はProjectを保存し、最初のcardイベントを返す。
```

#### swipe

Flutterがカードの採用/却下を送る。

```json
{
  "type": "swipe",
  "projectId": "project-1",
  "cardId": "card-1",
  "action": "accepted",
  "createdAt": "2026-05-19T10:00:10.000Z"
}
```

期待する応答:

```text
VS Code拡張はDecisionを保存し、次のcardイベントを返す。
カードが尽きた場合の専用イベントはMVPでは追加しない。
MVPでは十分なBaselineカードを返すか、生成フェーズへ進めるUI操作で対応する。
```

### VS Code拡張 -> Flutter

#### card

次に表示するカードを返す。

```json
{
  "type": "card",
  "card": {
    "id": "card-1",
    "projectId": "project-1",
    "type": "moment",
    "title": "今日の勝ち筋が一瞬で見える",
    "hook": "アプリを開いた瞬間、何をすればいいか迷わない",
    "description": "今日やることを1画面にまとめ、ワンタップで達成できます。",
    "payoff": "開くたびに「今日は勝てそう」と感じられます。",
    "acceptLabel": "これ欲しい",
    "rejectLabel": "今はいらない",
    "payload": {},
    "predictedReward": "最初の体験が強くなります",
    "noveltyScore": 0.7,
    "effortScore": 0.4,
    "dopamineScore": 0.9,
    "status": "pending"
  }
}
```

#### preview

生成アプリのプレビューURLを返す。

```json
{
  "type": "preview",
  "projectId": "project-1",
  "url": "http://localhost:5173"
}
```

#### pr

GitHub PRまたはローカル保存結果を返す。

```ts
type PRStatus = 'created' | 'localSaved';
```

PR成功時:

```json
{
  "type": "pr",
  "projectId": "project-1",
  "repositoryUrl": "https://github.com/example/ddd-demo",
  "branchName": "ddd/project-1",
  "url": "https://github.com/example/ddd-demo/pull/1",
  "status": "created"
}
```

GitHub失敗、ローカル保存成功時:

```json
{
  "type": "pr",
  "projectId": "project-1",
  "repositoryUrl": "",
  "branchName": "ddd/project-1",
  "url": "",
  "status": "localSaved"
}
```

#### error

復帰可能なエラーを返す。

```json
{
  "type": "error",
  "projectId": "project-1",
  "code": "AI_RUNTIME_UNAVAILABLE",
  "message": "AI runtime is unavailable. Falling back to mock cards.",
  "recoverable": true
}
```

想定する `code`:

```text
INVALID_EVENT
PROJECT_NOT_FOUND
CARD_NOT_FOUND
AI_RUNTIME_UNAVAILABLE
AI_RESPONSE_INVALID
GITHUB_UNAVAILABLE
PREVIEW_FAILED
UNKNOWN_ERROR
```

## イベント型まとめ

```ts
type ErrorCode =
  | 'INVALID_EVENT'
  | 'PROJECT_NOT_FOUND'
  | 'CARD_NOT_FOUND'
  | 'AI_RUNTIME_UNAVAILABLE'
  | 'AI_RESPONSE_INVALID'
  | 'GITHUB_UNAVAILABLE'
  | 'PREVIEW_FAILED'
  | 'UNKNOWN_ERROR';

interface StartSessionEvent {
  type: 'startSession';
  project: Project;
}

interface SwipeEvent {
  type: 'swipe';
  projectId: string;
  cardId: string;
  action: DecisionAction;
  createdAt: string;
}

interface CardEvent {
  type: 'card';
  card: DecisionCard;
}

interface PreviewEvent {
  type: 'preview';
  projectId: string;
  url: string;
}

interface PREvent {
  type: 'pr';
  projectId: string;
  repositoryUrl: string;
  branchName: string;
  url: string;
  status: PRStatus;
}

interface ErrorEvent {
  type: 'error';
  projectId?: string;
  code: ErrorCode;
  message: string;
  recoverable: boolean;
}

type IncomingEvent =
  | StartSessionEvent
  | SwipeEvent;

type OutgoingEvent =
  | CardEvent
  | PreviewEvent
  | PREvent
  | ErrorEvent;
```

## 通信フロー

### 基本フロー

```text
Flutter -> VS Code: startSession
VS Code -> Flutter: card
Flutter -> VS Code: swipe
VS Code -> Flutter: card
Flutter -> VS Code: swipe
VS Code -> Flutter: card
```

カードが尽きた場合の専用イベントはMVPでは追加しない。
MVPではVS Code拡張側が十分なBaselineカードを返すか、生成フェーズへ進めるUI操作で対応する。

### 生成・公開フロー

```text
VS Code command: DDD: Generate App
VS Code: ddd-spec.json / ddd-decisions.json生成
VS Code -> Flutter: preview
VS Code command: DDD: Publish to GitHub
VS Code -> Flutter: pr
```

## バリデーション方針

### 受信イベント

VS Code拡張側で最低限以下を検証する。

- JSONとしてparseできる
- `type` が既知である
- 必須フィールドがある
- `projectId` が空ではない
- `cardId` が空ではない
- `action` が `accepted` または `rejected`

不正イベントで拡張を落とさない。Output Channelに理由を出し、必要に応じて `error` イベントを返す。

### 生成カード

AI Runtime AdapterまたはBaselineが返す `DecisionCard` は、VS Code拡張側で最低限以下を正規化する。

- 必須フィールドが欠けている場合はカード生成失敗として扱う
- `noveltyScore` / `effortScore` / `dopamineScore` は0〜1に丸める
- `DecisionCard.type` が未知の場合は `feature` にフォールバックする
- `payload` がobjectでない場合は `{}` にフォールバックする

## 実装対象ファイル

Flutter:

```text
mobile/lib/models/project.dart
mobile/lib/models/decision_card.dart
mobile/lib/models/decision.dart
mobile/lib/services/websocket_service.dart
```

VS Code拡張:

```text
vscode-extension/src/models/types.ts
vscode-extension/src/services/websocketServer.ts
vscode-extension/src/services/builderCortex.ts
vscode-extension/src/services/decisionStore.ts
```

## 完了条件

- Project / DecisionCard / Decision / GeneratedApp のDTOが確定している
- Flutter -> VS Code拡張 のIncoming Eventが確定している
- VS Code拡張 -> Flutter のOutgoing Eventが確定している
- エラーイベントの最小仕様が確定している
- `startSession -> card -> swipe -> card` の基本フローが明文化されている
- 後続のFlutter実装Issue、VS Code拡張実装Issue、AI Runtime実装Issueがこの仕様を参照できる
- `docs/MVP_IMPLEMENTATION_PLAN.md` と矛盾していない

## 担当

主担当:

```text
担当B: VS Code Extension / Builder Cortex
```

レビュー:

```text
担当A: Flutter / Cue Deck
担当C: AI Runtime / Generation / GitHub
```

## 後続Issue

- [#11 VS Code拡張: 共通DTOとWebSocketイベント型を仕様に合わせる](https://github.com/nicest414/DDD_Hackathon/issues/11)
- [#12 Flutter: Project / DecisionCard / Decision モデルを仕様に合わせる](https://github.com/nicest414/DDD_Hackathon/issues/12)
- [#13 VS Code拡張: PGlite保存スキーマを新DTOに対応させる](https://github.com/nicest414/DDD_Hackathon/issues/13)
- [#14 VS Code拡張: Baseline Dopamineのモックカードを新DTOに対応させる](https://github.com/nicest414/DDD_Hackathon/issues/14)
- [#15 VS Code拡張: WebSocket受信イベントの最低限バリデーションとerror送信を実装する](https://github.com/nicest414/DDD_Hackathon/issues/15)
- [#16 VS Code拡張: startSession受信後に最初のcardイベントを返す](https://github.com/nicest414/DDD_Hackathon/issues/16)
- [#17 VS Code拡張: swipe受信後にDecision保存と次card送信を行う](https://github.com/nicest414/DDD_Hackathon/issues/17)
- [#18 Flutter: WebSocketServiceをイベント仕様に合わせて整理する](https://github.com/nicest414/DDD_Hackathon/issues/18)
- [#22 AI Runtime: AIRuntimeAdapterインターフェースと設定コマンドを整理する](https://github.com/nicest414/DDD_Hackathon/issues/22)
