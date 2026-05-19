# DDD_Hackathon
DDDハッカソンで作成

## 起動方法

### 1. VS Code Extension（Builder Cortex）

##　環境構築
1. Docker Desktopをインストール
2. VSCodeにて拡張機能 "[Dev Containers](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers)" "[Docker](https://marketplace.visualstudio.com/items?itemName=ms-azuretools.vscode-docker)"を導入
3. 下記コマンドを実行
```bash
cd vscode-extension
code .
```
4. 新しくできたWindowにてCtrl+Shift+P → "Dev Containers: Rebuild and Reopen in Containeor" もしくは "Dev Containers: Reopen in Container" を実行、少し待つ
5. 下記コマンドを実行
```bash
npm install
npm run compile   # TypeScript → JS ビルド
```
F5 → Extension Development Host 起動
Ctrl+Shift+P → "DDD: Start Session"  ← WebSocket サーバーが port 3000 で起動

## 通常時
```bash
cd vscode-extension
code .            # VS Code で開く
# Ctrl+Shift+P → "Dev Containers: Rebuild and Reopen in Containeor" or "Dev Containers: Reopen in Container"
# F5 → Extension Development Host 起動
# Ctrl+Shift+P → "DDD: Start Session"  ← WebSocket サーバーが port 3000 で起動
```

AI を使う場合は先に `Ctrl+Shift+P → "DDD: Configure AI Provider"` で設定。
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

- [企画書](CONCEPT_PROPOSAL.md)
- [技術計画書](TECHNICAL_PLAN.md)
- [アーキテクチャ設計書](ARCHITECTURE_DESIGN.md)
