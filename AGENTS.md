# Codex向け作業メモ

## プロジェクト概要

このプロジェクトは、Python/Tkinter製のRandom Line Selectorを、スマホで使える静的PWAとして新規実装したものです。

サーバー、Python、Streamlit、Tkinterは使いません。GitHub Pagesで公開し、iPhone Safariからホーム画面に追加して使う想定です。

## ファイル構成

- `index.html`：画面構造。外部ファイルは相対パスで読み込む。
- `style.css`：スマホ縦画面を優先したUI。
- `app.js`：アプリ本体。保存処理、リスト操作、抽選、インポート、エクスポートを含む。
- `manifest.webmanifest`：PWA設定。
- `service-worker.js`：主要ファイルのキャッシュ処理。
- `icons/icon-192.png`：192pxアイコン。
- `icons/icon-512.png`：512pxアイコン。
- `README.md`：利用者向け説明。
- `randomSelect7_元ネタ/`：旧Python/Tkinter版の参考資料。PWA本体では使わない。

## コーディング方針

- HTML / CSS / JavaScript の静的ファイルだけで実装する。
- React、Vue、Vite、npmなどのビルド環境は追加しない。
- 新しい外部ライブラリは追加しない。
- 既存のUIや保存形式を大きく変える場合は、先に理由を説明する。
- 初心者が読んでも意図が分かるよう、日本語コメントを詳しく書く。
- GitHub Pages配下で動くように、画像、CSS、JS、Service Worker、manifestは相対パスで参照する。

## 重複項目の基本ルール

- 保存データ内では、同じ `text` の項目が複数存在してよい。
- 各項目は必ず `{ id, text }` の形で持つ。
- 削除判定では `item.text` ではなく、必ず `item.id` を使う。
- 1回のランダム結果内では、同じ `text` は最大1回だけ表示する。
- ランダム結果には `id` と `text` の両方を保持する。
- txtインポートでは、同じ文字列の行が複数あっても別idの別項目として読み込む。
- txtエクスポートでは、`item.text` のみを1行ずつ出力する。

## localStorageのデータ構造

保存キー：

```text
random-line-selector-pwa-v1
```

保存形式：

```json
{
  "version": 1,
  "currentListId": "list-id",
  "lists": [
    {
      "id": "list-id",
      "name": "Input",
      "items": [
        { "id": "item_xxx1", "text": "掃除" },
        { "id": "item_xxx2", "text": "掃除" },
        { "id": "item_xxx3", "text": "買い物" }
      ]
    }
  ]
}
```

古い形式では `items` が文字列配列になっている場合がある。

```json
{
  "items": ["掃除", "掃除", "買い物"]
}
```

`app.js` の `normalizeAppData()` と `normalizeItems()` で、古い形式を新しいid付き形式へ自動変換する。

## 保存処理

保存処理は `app.js` の `loadAppData()` と `saveAppData()` に分離している。将来IndexedDBへ移行する場合は、まずこの2つの関数を差し替える。

## テスト時に確認すべき項目

- 新しいリストを作成できる。
- リスト名を変更できる。
- リストを削除できる。
- 現在のリストを切り替えられる。
- 複数行貼り付けで、1行ずつ項目追加される。
- 空行が無視される。
- 重複文字列を保存できる。
- 表示数1〜10でランダム選択できる。
- 抽選対象は全項目だが、結果内で同じ `text` が重複しない。
- 項目数ではなく、重複しない `text` の種類数が表示数より少ない場合、その件数だけ表示される。
- 結果から外しても保存データは変わらない。
- 保存データから削除すると確認が出る。
- 保存データ削除では、選択された `item.id` の項目だけが削除される。
- 同じ `text` の別項目が勝手に削除されない。
- 個別削除と全削除ができる。
- `.txt` を1行1項目としてインポートでき、重複行にも別idが付く。
- 現在のリストを `.txt` としてエクスポートでき、重複項目は複数行で出力される。
- 全リストをJSONバックアップできる。
- JSONバックアップから復元できる。
- 旧形式のJSONやlocalStorageが新形式へ自動変換される。
- 再読み込み後もlocalStorageのデータが残る。
- GitHub Pagesのサブディレクトリでも相対パスで動く。
- オフラインでも基本画面が開ける。
