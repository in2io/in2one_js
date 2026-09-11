# 埋め込みプロトコル v1

`one.js` とアプリ側の埋め込みページの間の取り決め。
**アプリ側（`in2one/web`）にこの仕様のページを実装しないと SDK は動かない。**

バックエンド（Go）はインターネットに出さない構成なので、埋め込みページは
Next.js の route として置き、必要な API はそこからバックエンドへ中継する。

---

## 1. 埋め込みページ

SDK は次の URL を iframe で開く。

```
GET {appOrigin}/embed/v1/{feature}
```

| クエリ | 必須 | 内容 |
| --- | --- | --- |
| `token` | ○ | テナントが発行した公開トークン。テナントと機能の権限を解決する |
| `id` | ○ | この埋め込みの識別子。**postMessage の封筒にそのまま返す** |
| `sdk` | ○ | SDK のバージョン（例 `1.0.0`） |
| `theme` | ○ | `light` / `dark` / `auto` |
| `parent` | | 埋め込み先ページの origin。詐称できるので信用の根拠にはしない |
| `locale` | | BCP 47 |
| `p.{key}` | | 機能ごとの絞り込み（例 `p.hako=9f2c...`） |

`feature` は `[a-z][a-z0-9_-]*` のみ。SDK 側でも弾いている。

個人情報は URL に載らない。フォームの初期値は後述の `prefill` で届く
（URL は Referer・アクセスログ・ブラウザ履歴に残るため）。

### レスポンスの要件

- `X-Frame-Options` を**付けない**（付けると埋め込めない）。
- 代わりに `Content-Security-Policy: frame-ancestors <トークンの許可ドメイン>` を返す。
  許可ドメインはトークンに紐づけてテナントが管理画面で登録する。
  ここが埋め込み先を縛る唯一の実効的な手段で、`parent` クエリではない。
- トークンが無効・許可外のドメインなら、埋め込みページとしてエラーを表示し、
  かつ `error` メッセージを送る（真っ白な iframe にしない）。
- 認証 Cookie を使うなら `SameSite=None; Secure`。サードパーティ Cookie が
  ブロックされる前提で、Cookie 無しでも予約が完了する経路を用意する。

---

## 2. postMessage の封筒

双方向とも同じ形。

```ts
{
  protocol: "in2one.embed",
  v: 1,
  id: "<URL の id をそのまま>",
  kind: "<種別>",
  payload: { ... }
}
```

SDK は `protocol` / `v` / `id` / 送信元 origin / 送信元 window の 5 つが揃った
ものだけ受け取る。1 つのページに複数の埋め込みが載るので、`id` を返さないと
隣の埋め込みのイベントとして扱われるか、単に捨てられる。

**`targetOrigin` に `*` を使わない。** アプリ側は `parent` クエリの origin を
許可ドメインと突き合わせ、一致したものを宛先に指定する。`*` にすると、
埋め込み先のページが別サイトへ遷移した後にも中身が届きうる。

---

## 3. アプリ → SDK

| `kind` | `payload` | いつ送るか |
| --- | --- | --- |
| `ready` | `{ appVersion?: string }` | 描画が終わり、受信の準備ができたとき。**必須** |
| `resize` | `{ height: number }` | 中身の高さが変わるたび。`ResizeObserver` で送る |
| `submit` | `{ uuid?: string, data?: object }` | 予約などが確定したとき |
| `event` | `{ name: string, data?: object }` | 任意の通知（ステップ移動など） |
| `error` | `{ code?: string, message?: string }` | 継続できないエラー |
| `close` | `{}` | 利用者が閉じたとき |

`ready` を送らないと、SDK は `loadTimeout`（既定 20 秒）で `load_timeout`
エラーを出し、`prefill` などの送信も溜まったままになる。

`resize` の `height` は中身の実寸（px）。SDK が iframe の高さに反映する。

---

## 4. SDK → アプリ

`ready` を受け取ってから送る。それ以前のぶんは SDK が溜めて後でまとめて送る。

| `kind` | `payload` | 期待する動き |
| --- | --- | --- |
| `prefill` | `{ prefill: Record<string, string\|number\|boolean> }` | フォームの初期値を入れる |
| `locale` | `{ locale: string }` | 表示言語を切り替える |
| `theme` | `{ theme: "light"\|"dark"\|"auto" }` | 外観を切り替える |
| `params` | `{ params: Record<string, string\|number\|boolean> }` | 絞り込みを差し替える |
| `refresh` | `{}` | 初期状態へ戻す |

アプリ側も受信時に `protocol` / `v` / `id` と `event.origin` を検証すること。
`prefill` は利用者が上書きできる初期値として扱い、そのまま確定値にしない
（埋め込み先のページから任意の値を入れられるため）。

---

## 5. iframe に掛かる制限

SDK は次の属性を付ける。埋め込みページはこの範囲で動く必要がある。

```
sandbox="allow-scripts allow-same-origin allow-forms allow-popups
         allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation"
allow="payment; clipboard-write; geolocation"
referrerpolicy="strict-origin"
```

- トップの遷移はユーザー操作があるときだけ。決済などへ飛ばすなら
  `target="_blank"` の別窓か、`ready` 後の `event` で親へ知らせて親に遷移させる。
- `allow-downloads` は付けていない。控えの PDF などは別窓で開く。

---

## 6. バージョン

`v` は封筒の形の版で、SDK のバージョンとは別。形を壊す変更のときだけ上げ、
アプリ側はしばらく両方を受け付ける。SDK のバージョンは `sdk` クエリで分かるので、
古い SDK に合わせた分岐が要るならそちらを見る。
