# VS Code拡張 開発フロー

この資料は、`DDD - Builder Cortex` のVS Code拡張をExtension Development Hostで動かしながら開発するための手順をまとめたものです。

## 1. 開発前の準備

拡張ディレクトリに移動します。

```bash
cd /Users/nice414/project/DDD_Hackathon/vscode-extension
```

依存関係を入れます。

```bash
npm install
```

TypeScriptをビルドします。

```bash
npm run compile
```

継続的に開発する場合は、代わりにwatchを起動しておくと保存時に自動コンパイルされます。

```bash
npm run watch
```

## 2. Extension Development Hostを起動する

VS Codeで `vscode-extension` フォルダを開き、`F5` を押します。

新しいVS Codeウィンドウが開きます。これがExtension Development Hostです。

以降、拡張を実際に操作して確認するのは、この新しく開いたウィンドウ側です。コードを編集するのは元の開発元ウィンドウ側です。

## 3. テスト対象フォルダを開く

Extension Development Host側で、拡張を試す対象のフォルダを開きます。

```text
File > Open Folder...
```

通常はリポジトリルートを開きます。

```text
/Users/nice414/project/DDD_Hackathon
```

拡張が別の作業フォルダを前提にしている場合は、そのフォルダを開いてください。

## 4. 拡張コマンドを実行する

Extension Development Host側でコマンドパレットを開きます。

```text
Cmd + Shift + P
```

`DDD` と入力すると、拡張が提供しているコマンドが表示されます。

現在登録されている主なコマンドは以下です。

```text
DDD: Configure AI Runtime
DDD: Start Session
DDD: Generate App
DDD: Open Preview
DDD: Publish to GitHub
```

基本的な確認順は以下です。

```text
DDD: Configure AI Runtime
DDD: Start Session
DDD: Generate App
DDD: Open Preview
```

GitHub連携まで確認する場合だけ、最後に以下を実行します。

```text
DDD: Publish to GitHub
```

## 5. ログとエラーを見る

拡張の起動エラーや実行時エラーは、主に元の開発元VS Codeウィンドウで確認します。

まず見る場所はDebug Consoleです。

```text
View > Debug Console
```

次にOutputを確認します。

```text
View > Output
```

Output右上のドロップダウンで、関連しそうなチャンネルを選びます。

```text
Log (Extension Host)
```

拡張専用のOutputチャンネルが実装されている場合は、そのチャンネルも確認します。

## 6. コードを修正して反映する

元の開発元ウィンドウでコードを修正します。

`npm run watch` を動かしていない場合は、修正後にコンパイルします。

```bash
npm run compile
```

その後、Extension Development Host側でウィンドウをリロードします。

```text
Cmd + Shift + P
Developer: Reload Window
```

これで拡張が読み直され、修正内容が反映されます。

普段の開発サイクルは以下です。

```text
コードを修正
-> npm run compile または npm run watchで自動コンパイル
-> Extension Development Host側で Developer: Reload Window
-> DDDコマンドを再実行
-> Debug Console / Outputを確認
```

## 7. 開発時の役割分担

元のVS Codeウィンドウで行うこと:

```text
コード編集
npm run compile
npm run watch
Debug Consoleの確認
```

Extension Development Host側で行うこと:

```text
テスト対象フォルダを開く
DDDコマンドを実行する
Developer: Reload Windowで拡張を再読み込みする
実際のUIやコマンド挙動を確認する
```

この2つのウィンドウを分けて考えると、拡張開発の流れが追いやすくなります。
