# MD Reader

パソコンの中の Markdown（`.md`）を、Chrome で開いた瞬間に、和紙と木の見た目で読みやすく表示する Chrome 拡張機能です（Manifest V3）。

- 見出しの目次（和紙のしおり）
- コードの色分け
- 保存すると自動で表示を更新
- 「元の文字」ボタンで、Markdown の文字そのものに戻せる

このリポジトリにあるのは、Chrome ウェブストアの審査に出している版（v0.8.1）のソースコードです。

## 使い方

### ソースコードから入れる

1. このリポジトリを手元に置く（Code → Download ZIP を展開、または `git clone`）
2. Chrome で `chrome://extensions` を開き、右上の「デベロッパー モード」を ON にする
3. 「パッケージ化されていない拡張機能を読み込む」を押し、`extension` フォルダを選ぶ
4. MD Reader の「詳細」を開き、「ファイルの URL へのアクセスを許可する」を ON にする
   （これが OFF だと、パソコンの中のファイルでは動きません）
5. `.md` ファイルを Chrome のウィンドウにドラッグする

## 中身

| ファイル | 役割 |
|---|---|
| `extension/manifest.json` | 拡張機能の設定。動く場所は `file://` の `.md`・`.MD`・`.markdown` だけ |
| `extension/content.js` | Markdown を HTML にし、安全にしてから表示する |
| `extension/toc.js`・`toc.css` | 目次 |
| `extension/background.js` | 開いている `.md` を読み直す（自動更新）。入れた直後に詳細ページを開く |
| `extension/reader.css`・`images/` | 和紙と木の見た目 |
| `extension/vendor/` | 同梱のライブラリ（下の表） |

外部への通信はしません。読むのは、今開いている `.md` だけです。

## プライバシーポリシー

https://ssoranaoki.github.io/md-reader/privacy-policy.html

（このリポジトリの `privacy-policy.html`・`index.html` を GitHub Pages で公開しています）

## ライセンス

MD Reader のコードは [MIT License](LICENSE) です。

同梱のライブラリは、それぞれのライセンスに従います（ライセンス文は `extension/vendor/` にあります）。

| ライブラリ | 版 | ライセンス |
|---|---|---|
| [marked](https://github.com/markedjs/marked) | 18.1.1 | MIT |
| [DOMPurify](https://github.com/cure53/DOMPurify) | 3.4.17 | Apache-2.0 または MPL-2.0 |
| [highlight.js](https://github.com/highlightjs/highlight.js) | 11.12.0 | BSD-3-Clause |
