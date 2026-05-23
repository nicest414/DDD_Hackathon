# Local Save / Generated App Flow

## 現在版の目的

GitHubリポジトリ作成やPull Request作成の方針を後で決められるように、まずはローカル成果物を確実に残す。

`DDD: Save Locally` は以下をワークスペース直下に生成する。

- `ddd-spec.json`
- `ddd-decisions.json`
- `generated-app/`

保存完了後、Flutterへ `pr` イベントを送る。PR URLはまだ無いが、既存の結果表示フローを再利用するためイベント種別は `pr` のままにする。

```json
{
  "type": "pr",
  "projectId": "project-1",
  "repositoryUrl": "",
  "branchName": "",
  "url": "",
  "status": "localSaved"
}
```

## 生成されるアプリ

`generated-app/` は `ddd-spec.json` の `name`、`summary`、`screens`、`features` を使って作るViteアプリである。

出力ファイル:

- `generated-app/package.json`
- `generated-app/index.html`
- `generated-app/src/main.js`
- `generated-app/src/styles.css`
- `generated-app/README.md`

現時点では、AIが返したspecをそのまま表示可能なアプリに変換する。業務ロジックや永続化を含む本格実装は後続のIssue対応版で扱う。

## Preview起動

`DDD: Open Preview` は `generated-app/package.json` が存在する場合だけ起動する。

起動時は `ddd.preview.packageManager` 設定を見る。

- `auto`: lockfileから自動判定し、見つからなければ `npm`
- `npm`
- `pnpm`
- `yarn`
- `bun`

`auto` の判定順:

1. `generated-app/pnpm-lock.yaml` -> `pnpm`
2. `generated-app/yarn.lock` -> `yarn`
3. `generated-app/bun.lockb` または `generated-app/bun.lock` -> `bun`
4. `generated-app/package-lock.json` -> `npm`
5. ワークスペース直下でも同じ順に判定
6. どれも無ければ `npm`

実行コマンド:

- npm: `npm install && npm run dev`
- pnpm: `pnpm install && pnpm dev`
- yarn: `yarn install && yarn dev`
- bun: `bun install && bun run dev`

起動後、Flutterへ `preview` イベントを送る。

```json
{
  "type": "preview",
  "projectId": "project-1",
  "url": "http://localhost:5173"
}
```

## 後続: GitHub Issue対応版

Issue対応版は、ローカル保存版を壊さずに追加する。

想定コマンド:

- `DDD: Save Locally`
- `DDD: Create GitHub Issue`
- `DDD: Create PR from Issue`

### Create GitHub Issue

入力:

- `ddd-spec.json`
- `ddd-decisions.json`
- `generated-app/`
- 現在のProject ID

処理:

1. `ddd-spec.json` と `ddd-decisions.json` が無ければ保存処理を先に実行する
2. Issue titleを `DDD: <spec.name>` にする
3. Issue bodyに以下を含める
   - summary
   - features
   - screens
   - accepted/rejected decision count
   - generated-appの実行方法
4. Issue URLを結果として返す

この段階ではPRを作らない。

### Create PR from Issue

入力:

- Issue URLまたはIssue number
- `generated-app/`
- `ddd-spec.json`
- `ddd-decisions.json`

処理:

1. `ddd/<projectId>` または `ddd/issue-<number>` ブランチを作る
2. `ddd-spec.json`、`ddd-decisions.json`、`generated-app/` をコミットする
3. remoteへpushする
4. Issueに紐づくPRを作る
5. Flutterへ `pr` イベントを送る

PR成功時:

```json
{
  "type": "pr",
  "projectId": "project-1",
  "repositoryUrl": "https://github.com/example/ddd-demo",
  "branchName": "ddd/issue-26",
  "url": "https://github.com/example/ddd-demo/pull/1",
  "status": "created"
}
```

### 失敗時の扱い

GitHub操作が失敗しても、ローカル保存が成功していれば `localSaved` を成功扱いにする。

GitHub認証、remote未設定、push失敗、PR作成失敗は `GITHUB_UNAVAILABLE` の `error` イベントで返せるが、`generated-app/` は残す。

### 実装上の注意

- GitHub連携はFlutter側にトークンを渡さず、VS Code拡張側で完結させる
- `execFile` を使い、`shell: false` を維持する
- 既存の作業ツリーを壊さないよう、ブランチ作成前に未コミット変更を確認する
- ローカル保存版の `saveLocal()` は共通基盤として残す
- Issue対応版は `GitHubPublisher` に直接詰め込みすぎず、Issue作成とPR作成の責務を分ける
