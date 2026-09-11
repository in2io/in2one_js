# in2 One JS SDK (`one.js`)

外部サイトへ in2 One の機能（予約フォームなど）を埋め込むための JavaScript SDK。

- `<script>` タグ 1 行で貼れる（`window.In2One`）
- npm パッケージとしても使える（React / Vue のコンポーネント付き）
- Firebase Hosting からバージョン付き URL で配信する

中身は必ず **iframe** に閉じ込める。埋め込み先は自社の管理外のページなので、
CSS もスクリプトも互いに触れない境界が要る。入力された個人情報が埋め込み先の
DOM を通らないことも、この形でしか保証できない。

> **前提**: アプリ側（`web`）に埋め込みページ `/embed/v1/{feature}` が必要。
> やりとりの取り決めは [PROTOCOL.md](./PROTOCOL.md) を参照。

---

## 使い方

### 1. script タグ

```html
<div
  data-in2one="booking"
  data-token="pk_live_xxxxxxxx"
  data-locale="ja"
  data-param-hako="9f2c1f7e-..."
></div>

<script src="https://<配信ホスト>/v1/one.js" async></script>
```

`data-in2one` が付いた要素は読み込み後に自動でマウントされる。
SPA で後から要素が増えたときは `In2One.autoMount()` をもう一度呼ぶ。

手で組み立てる場合：

```html
<script src="https://<配信ホスト>/v1/one.js"></script>
<script>
  const embed = In2One.mount("#booking", {
    feature: "booking",
    token: "pk_live_xxxxxxxx",
    locale: "ja",
    params: { hako: "9f2c1f7e-..." },
    onSubmit: (payload) => console.log("予約されました", payload.uuid),
  });
</script>
```

#### 使える `data-*` 属性

| 属性 | 対応するオプション |
| --- | --- |
| `data-in2one` | `feature`（必須） |
| `data-token` | `token`（必須） |
| `data-origin` | `appOrigin` |
| `data-locale` | `locale` |
| `data-theme` | `theme` |
| `data-height` | `height` |
| `data-class` | `className` |
| `data-title` | `title` |
| `data-auto-resize` | `autoResize`（`"false"` のときだけ無効） |
| `data-param-*` | `params.*`（`data-param-start-at` → `params.startAt`） |

### 2. npm パッケージ

```bash
npm install @in2one/one-js
```

```ts
import { mount } from "@in2one/one-js";

const embed = mount("#booking", {
  feature: "booking",
  token: "pk_live_xxxxxxxx",
});

embed.setPrefill({ email: "guest@example.com" }); // 個人情報は URL に載せない
embed.destroy();
```

### 3. React

```tsx
import { In2OneEmbed } from "@in2one/one-js/react";

export function BookingSection({ hako }: { hako: string }) {
  return (
    <In2OneEmbed
      feature="booking"
      token={process.env.NEXT_PUBLIC_IN2ONE_TOKEN!}
      params={{ hako }}
      locale="ja"
      onSubmit={(payload) => router.push(`/thanks/${payload.uuid}`)}
    />
  );
}
```

自分で描画先を持ちたいときは `useIn2OneEmbed` を使う。

```tsx
const { containerRef, embed } = useIn2OneEmbed({ feature: "booking", token });
```

### 4. Vue 3

```vue
<script setup lang="ts">
import { In2OneEmbed } from "@in2one/one-js/vue";

const onSubmit = (payload) => console.log(payload.uuid);
</script>

<template>
  <In2OneEmbed
    feature="booking"
    token="pk_live_xxxxxxxx"
    :params="{ hako }"
    locale="ja"
    @submit="onSubmit"
  />
</template>
```

---

## オプション

| 名前 | 既定値 | 説明 |
| --- | --- | --- |
| `feature` | — | 埋め込む機能。例: `"booking"` |
| `token` | — | テナント管理画面で発行する公開トークン |
| `appOrigin` | ビルド時の既定値 | 接続先のアプリ origin |
| `locale` | アプリ側の既定 | 表示言語（BCP 47） |
| `theme` | `"auto"` | `"light"` / `"dark"` / `"auto"` |
| `params` | — | 機能ごとの絞り込み。URL に載る |
| `prefill` | — | フォームの初期値。**URL に載せず** postMessage で渡す |
| `autoResize` | `true` | 中身の高さに合わせて iframe を伸縮させる |
| `height` | `640` | 初期の高さ（px） |
| `className` | — | iframe に付ける class |
| `title` | `"in2 One"` | iframe の `title` |
| `loadTimeout` | `20000` | `ready` を待つ上限（ms）。`0` で無効 |

### コールバック

`onReady` / `onResize` / `onSubmit` / `onEvent` / `onError` をオプションで渡すか、
`embed.on("submit", handler)` で購読する（戻り値を呼ぶと解除）。

`onError` も `on("error")` も無いエラーは `console.error` に出す。握り潰すと、
埋め込み先の開発者が気付けないまま白い枠だけが残る。

### インスタンスのメソッド

| メソッド | 説明 |
| --- | --- |
| `mount(target)` | セレクタか要素へ iframe を作る |
| `setPrefill(prefill)` | フォームの初期値を渡す |
| `setLocale(locale)` / `setTheme(theme)` / `setParams(params)` | 作り直さずに反映する |
| `refresh()` | 埋め込みページを初期状態へ戻す |
| `on(kind, handler)` | イベントを購読する |
| `destroy()` | iframe と listener を片付ける |

`ready` の前に呼んだ送信は溜めておき、`ready` の後にまとめて送る。

---

## バージョン運用

Firebase Hosting には次の形で並ぶ。

| URL | キャッシュ | 用途 |
| --- | --- | --- |
| `/v1.2.3/one.js` | 1 年・`immutable` | 固定したいとき。中身は未来永劫変わらない |
| `/v1/one.js` | 5 分 | メジャー内の最新へ追従する。**推奨** |
| `/latest/one.js` | 5 分 | 常に最新。破壊的変更も入るので検証用 |
| `/one.js` | — | `/v1/one.js` へ 302 |
| `/versions.json` | 1 分 | 配信中の一覧 |

Hosting のデプロイはサイト全体の置き換えなので、過去のバージョンも毎回並べ直す
必要がある。そのため配信済みの成果物は `releases/` に**コミットして残す** ──
「`/v1.2.3/one.js` は未来永劫同じ中身」を git で担保でき、過去の依存関係を
引っ張って再ビルドする必要も無くなる。

`scripts/hosting.mjs` は、同じバージョンで中身の違うビルドを焼き付けようとすると
止まる。すでに配ったページとこれから配るページで別の SDK が動くのを防ぐため。

### リリース手順

```bash
npm version patch          # または minor / major
npm run build
npm run hosting            # releases/ へ焼き付け、public/ を組み立てる
git add releases package.json package-lock.json
git commit -m "release: v1.0.1"
git push && git push --tags
```

タグを push すると `.github/workflows/release.yaml` が Firebase Hosting へ配信する。
手元から配信するときは `npm run deploy`（`firebase` CLI が要る）。

#### 必要な設定（GitHub）

| 種類 | 名前 | 中身 |
| --- | --- | --- |
| Variables | `FIREBASE_PROJECT_ID` | Firebase プロジェクト ID |
| Variables | `IN2ONE_APP_ORIGIN` | 既定の接続先（例: `https://app.example.com`） |
| Secrets | `FIREBASE_SERVICE_ACCOUNT` | Hosting へデプロイできるサービスアカウントの JSON |

`.firebaserc` の `default` も同じプロジェクト ID に合わせる。

---

## 開発

```bash
npm install
npm run typecheck   # tsc --noEmit
npm test            # node --test（型ストリップでそのまま .ts を実行）
npm run build       # tsdown（ESM / CJS / IIFE + .d.ts）
npm run verify      # 上の 3 つをまとめて
```

`examples/` に素の HTML・React・Vue の最小例がある。

---

## 構成

```
src/
  core/      機能に依らない土台（iframe・postMessage・URL 組み立て・検証）
  react/     React 向けコンポーネントとフック
  vue/       Vue 3 向けコンポーネント
  index.ts   npm パッケージの入口
  embed.ts   <script> タグ版の入口（window.In2One と自動マウント）
scripts/
  hosting.mjs  releases/ から public/ を組み立てる
releases/    配信済みの成果物（コミットする）
```
