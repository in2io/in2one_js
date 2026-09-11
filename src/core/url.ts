import type { EmbedParams, ResolvedEmbedOptions } from "./types.ts";
import { VERSION } from "./version.ts";

/** アプリ側が実装する埋め込みページの接頭辞。 */
export const EMBED_PATH_PREFIX = "/embed/v1";

/**
 * iframe に読ませる URL を組み立てる。
 *
 * prefill はここに載せない ── URL は Referer・アクセスログ・ブラウザ履歴に
 * 残るので、個人情報は読み込み後の postMessage で渡す（core/embed.ts）。
 */
export function buildEmbedUrl(
  options: ResolvedEmbedOptions,
  id: string,
  parentOrigin: string,
): string {
  const url = new URL(
    `${EMBED_PATH_PREFIX}/${options.feature}`,
    options.appOrigin,
  );
  const q = url.searchParams;
  q.set("token", options.token);
  q.set("id", id);
  q.set("sdk", VERSION);
  q.set("theme", options.theme);
  // 埋め込み元を名乗る。アプリ側は許可ドメインの照合に使う（信用の根拠には
  // しない ── 詐称できるため。あくまで正しい利用者への案内用）。
  if (parentOrigin) q.set("parent", parentOrigin);
  if (options.locale) q.set("locale", options.locale);

  for (const [key, value] of entriesOf(options.params)) {
    q.set(`p.${key}`, value);
  }
  return url.toString();
}

/** undefined を落としつつ文字列化した [key, value] を返す。 */
function entriesOf(params: EmbedParams | undefined): [string, string][] {
  if (!params) return [];
  const out: [string, string][] = [];
  for (const key of Object.keys(params)) {
    const value = params[key];
    if (value === undefined || value === null) continue;
    out.push([key, String(value)]);
  }
  return out;
}
