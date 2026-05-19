# MVP実装計画

この計画は、DDDを3人で分担してMVPまで作るための作業分解である。

MVPの目的は、完成度の高い本番アプリを作ることではなく、以下の体験を通すことである。

```text
スマホで作りたいアプリを入力する
-> AI/モックが欲しくなる提案カードを返す
-> ユーザーが採用/却下する
-> 判断履歴からミニアプリ仕様を生成する
-> プレビューまたは生成結果を確認する
-> GitHub PRまたはローカル成果物として残す
```

## 1. MVPスコープ

### 必ず作る

- Flutterで初期入力、カード表示、採用/却下、結果表示ができる
- VS Code拡張でWebSocketサーバーを起動できる
- FlutterとVS Code拡張が `startSession` / `card` / `swipe` / `pr` イベントで接続できる
- カード生成の正はVS Code拡張側にある
- AI未設定でもBaseline Dopamineでカードが返る
- Codex CLIなどのローカルAIランタイムを呼べるAdapterの最小実装がある
- 採用/却下履歴をPGliteへ保存できる
- 採用済みカードから `ddd-spec.json` と `ddd-decisions.json` を生成できる
- GitHub PR作成、またはGitHub失敗時のローカル保存完了まで進められる

### 後回しでよい

- 本格的なコード生成
- 複数プロジェクト履歴UI
- 高度なプレビュー自動検出
- 複数端末接続
- 完全なエラー復旧UI
- App Store品質のモバイルUI

## 2. 3人の担当分担

### 担当A: Flutter / Cue Deck

責務:

- ユーザーが気持ちよくカードを見て判断する体験を作る
- VS Code拡張から受け取った `DecisionCard` を表示する
- 本番フローではFlutter側でカード生成をしない

主な作業:

- `DecisionCard` モデルを新仕様に合わせる
  - `type`
  - `title`
  - `hook`
  - `description`
  - `payoff`
  - `acceptLabel`
  - `rejectLabel`
  - `dopamineScore`
- `WebSocketService` をイベント仕様に合わせる
  - `startSession` 送信
  - `card` 受信
  - `swipe` 送信
  - `preview` / `pr` 受信
- `SwipeScreen` をVS Code拡張から来たカード駆動に変更する
- `ProposalCard` を体験寄りの表示にする
  - hookを強く見せる
  - payoffを見せる
  - typeごとに見た目を少し変える
  - acceptLabel / rejectLabelをボタンに使う
- 接続中、カード待ち、接続失敗、モックモードの表示を作る
- UI確認用fixtureを用意する。ただし実セッションでは使わない

完了条件:

- VS Code拡張から送られたカードだけを表示できる
- 採用/却下すると `swipe` が送られる
- 次の `card` を受け取ると画面が更新される
- `pr` URLを結果画面で表示できる

### 担当B: VS Code Extension / Builder Cortex

責務:

- セッション、カード、判断履歴、WebSocket通信の中核を作る
- FlutterとAI/保存/GitHub処理の間をつなぐ

主な作業:

- WebSocketイベントを整理する
  - `startSession`
  - `swipe`
  - `card`
  - `preview`
  - `pr`
  - `error`
- `startSession` 受信後、最初の `DecisionCard` を生成して送る
- `swipe` 受信後、Decisionを保存して次の `DecisionCard` を生成して送る
- 不正なイベントを落とす最低限のバリデーションを入れる
- `DecisionStore` を新しい `DecisionCard` フィールドに対応させる
- `Decision` に `projectId` を持たせるか、保存/取得のJOINを安全にする
- `DDD: Configure AI Runtime` コマンドを作る
- `DDD: Start Session` で接続URLをわかりやすく表示する
- Output Channelに重要ログを出す

完了条件:

- Extension Development Hostで拡張が起動する
- `DDD: Start Session` でWebSocketサーバーが立つ
- Flutterから `startSession` を受けると最初のカードが返る
- `swipe` を受けるとPGliteに保存され、次カードが返る
- AIが失敗してもBaseline Dopamineで続行できる

### 担当C: AI Runtime / Generation / GitHub

責務:

- ローカルAIランタイムまたはモックから構造化JSONを返す
- 採用済みカードから成果物を作る
- GitHubまたはローカル保存までつなぐ

主な作業:

- `AIRuntimeAdapter` インターフェースを作る
  - `generateNextCard`
  - `generateApp`
- `MockAdapter` または `BaselineDopamineAdapter` を作る
- `CodexCliAdapter` の最小実装を作る
  - `codex exec` を非対話で呼ぶ
  - stdoutからJSONを抽出する
  - JSON Schemaまたは手動バリデーションを行う
  - timeoutする
- `ClaudeCliAdapter` は余裕があれば追加する
- AI出力用プロンプトを作る
  - DecisionCard用
  - GeneratedApp spec用
- 採用済みカードから `ddd-spec.json` を生成する
- `ddd-decisions.json` を生成する
- `GitHubPublisher` の安全確認を追加する
  - 未コミット変更
  - remote origin
  - gh login
  - 同名ブランチ
- GitHub失敗時はローカル保存成功として扱う

完了条件:

- MockAdapterで必ずカード生成が成功する
- Codex CLIが使える環境ではカードJSONを生成できる
- 採用済みカードから `ddd-spec.json` が作られる
- GitHub PR作成、またはローカル保存完了まで到達できる

## 3. 統合順

### Step 1: 共通DTOを固める

最初に `DecisionCard`、`Decision`、WebSocketイベントのJSON形を固定する。

詳細は [Issue 001: 共通DTOとWebSocketイベント仕様を確定する](issues/001-common-dto-websocket-events.md) を参照する。

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

このDTOが固まるまでは、各担当が勝手にフィールドを増減しない。

### Step 2: Mockだけで通信を通す

AIやGitHubを入れる前に、MockAdapterで以下を通す。

```text
Flutter startSession
-> VS Code拡張 card
-> Flutter swipe
-> VS Code拡張 next card
```

ここが通れば、UIと通信の土台はできている。

### Step 3: PGlite保存を入れる

`Project`、`DecisionCard`、`Decision` を保存する。  
アプリを再起動しても最低限、判断履歴が残る状態にする。

### Step 4: AI Runtimeを差し込む

MockAdapterの後ろに `CodexCliAdapter` を追加する。  
AI出力が壊れた場合は必ずMockへフォールバックする。

### Step 5: 生成結果を作る

採用済みカードから `ddd-spec.json` と `ddd-decisions.json` を生成する。  
この時点では、本格コード生成より「判断が成果物に反映された」と見えることを優先する。

### Step 6: PRまたはローカル保存

GitHub CLIが使える場合はPRを作る。  
失敗した場合も、ローカルファイル保存は成功扱いにする。

## 4. 主要ファイル

Flutter:

```text
mobile/lib/models/decision_card.dart
mobile/lib/models/decision.dart
mobile/lib/services/websocket_service.dart
mobile/lib/screens/swipe_screen.dart
mobile/lib/screens/result_screen.dart
mobile/lib/widgets/proposal_card.dart
```

VS Code拡張:

```text
vscode-extension/src/extension.ts
vscode-extension/src/models/types.ts
vscode-extension/src/services/websocketServer.ts
vscode-extension/src/services/builderCortex.ts
vscode-extension/src/services/decisionStore.ts
vscode-extension/src/services/baselineDopamine.ts
vscode-extension/src/services/aiAdapter.ts
vscode-extension/src/services/githubPublisher.ts
```

今後追加する候補:

```text
vscode-extension/src/services/aiRuntime/types.ts
vscode-extension/src/services/aiRuntime/mockAdapter.ts
vscode-extension/src/services/aiRuntime/codexCliAdapter.ts
vscode-extension/src/services/aiRuntime/claudeCliAdapter.ts
vscode-extension/src/services/aiRuntime/openAICompatibleAdapter.ts
vscode-extension/src/services/validation.ts
```

## 5. MVPデモの流れ

本番デモでは以下の順番で見せる。

```text
1. VS CodeでDDD: Start Session
2. Flutterアプリで作りたいアプリを入力
3. 体験寄りカードが表示される
4. 何枚か採用/却下する
5. VS Code側で判断履歴が保存される
6. DDD: Generate App
7. ddd-spec.json / ddd-decisions.json が生成される
8. DDD: Publish to GitHub
9. PR URLがFlutter側に表示される
```

GitHubが失敗した場合のデモ代替:

```text
PR作成は失敗
-> ローカルに ddd-spec.json / ddd-decisions.json は保存済み
-> Flutter側には「ローカル保存完了」と表示
```

## 6. リスクと対策

| リスク | 対策 |
| --- | --- |
| Flutterと拡張のカード状態がズレる | カード生成の正をVS Code拡張に一本化する |
| AI CLIの出力がJSONにならない | JSON抽出、Schema検証、Mockフォールバックを必須にする |
| Claude/Codex CLIが未ログイン | Configure時に検出し、Mockに切り替える |
| GitHub操作で作業ツリーを壊す | publish前に未コミット変更とbranchを確認する |
| 時間切れでコード生成まで届かない | `ddd-spec.json` とPR作成をMVP成果物にする |
| UIが地味になる | ProposalCardのhook/payoff表示と採用時アニメーションを優先する |

## 7. MVP完了条件

- 3人の担当範囲が統合されている
- FlutterとVS Code拡張がWebSocketで通信できる
- カードはVS Code拡張から送られる
- スワイプ判断がVS Code拡張側に保存される
- AIランタイム未設定でも最後までデモできる
- Codex CLIが使える環境ではAI生成カードを試せる
- 採用済み判断から成果物JSONが生成される
- PR URLまたはローカル保存完了がFlutter側で確認できる
