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

AI を使う場合は先に `Ctrl+Shift+P → "DDD: Configure AI Runtime"` で、Codex CLI、Claude Code CLI、Ollama、OpenAI互換APIなどを選択。
未設定でもモックカードでデモ継続可。

### 2. Flutter アプリ（Cue Deck）

```bash
cd mobile
flutter pub get
flutter emulators --launch <id>   # エミュレーターがない場合
flutter run
```

起動したら「AIに提案してもらう」からセッション開始。Extension が起動していれば自動で WebSocket 接続。

### 実機スマートフォンで起動する場合

実機では `localhost` がスマートフォン自身を指すため、そのままではPC上のVS Code拡張が起動するWebSocketサーバー（port 3000）へ接続できません。
PCのローカルIPアドレスを `DDD_SERVER_URL` で指定して起動してください。

```bash
cd mobile
flutter run --dart-define=DDD_SERVER_URL=ws://192.168.x.x:3000
```

`192.168.x.x` はPCのローカルIPアドレスに置き換えます。

Windowsでは以下で確認できます。

```powershell
ipconfig
# Wi-Fi アダプターの IPv4 アドレスを使う
```

実機接続時は以下も確認してください。

- スマートフォンとPCが同じWi-Fiネットワークに接続されている
- VS Code拡張のExtension Development Hostで `DDD: Start Session` を実行済み
- WindowsファイアウォールやセキュリティソフトでTCP port 3000の受信が許可されている

Windowsファイアウォールで明示的に許可する場合:

```powershell
netsh advfirewall firewall add rule name="DDD WebSocket" dir=in action=allow protocol=TCP localport=3000
```

「waiting for the next card from vscode extension」から進まない場合は、`DDD_SERVER_URL` のIPアドレス、同一Wi-Fi、port 3000の受信許可を確認してください。

## デモ時
拡張機能を実行するとddd-test-workspace/privateが開く
普通はそのまま
アプリをチーム内で共有したかったらddd-test-workspace/publicに入れてください

---

## Documents

- [企画書](docs/CONCEPT_PROPOSAL.md)
- [技術計画書](docs/TECHNICAL_PLAN.md)
- [アーキテクチャ設計書](docs/ARCHITECTURE_DESIGN.md)
- [MVP実装計画](docs/MVP_IMPLEMENTATION_PLAN.md)
