import { EmbedError } from "./errors.ts";
import type { EmbedOptions, EmbedParams, EmbedTheme } from "./types.ts";

/** 自動マウントの目印。値が feature になる。 */
export const EMBED_ATTRIBUTE = "data-in2one";
/** 二重マウント防止の印。 */
export const MOUNTED_ATTRIBUTE = "data-in2one-mounted";

const PARAM_PREFIX = "data-param-";

/**
 * data-* 属性から設定を組み立てる。素の HTML だけで埋め込めるようにするための経路。
 *
 *   <div data-in2one="booking"
 *        data-token="pk_live_xxx"
 *        data-locale="ja"
 *        data-theme="light"
 *        data-height="720"
 *        data-param-hako="9f2c..."></div>
 */
export function optionsFromElement(element: Element): EmbedOptions {
  const feature = attr(element, EMBED_ATTRIBUTE);
  if (!feature) {
    throw new EmbedError("invalid_options", `${EMBED_ATTRIBUTE} が空です`);
  }
  const token = attr(element, "data-token");
  if (!token) {
    throw new EmbedError(
      "invalid_options",
      `data-token が指定されていません (${EMBED_ATTRIBUTE}="${feature}")`,
    );
  }

  const params = collectParams(element);
  const appOrigin = attr(element, "data-origin");
  const locale = attr(element, "data-locale");
  const theme = attr(element, "data-theme");
  const height = attr(element, "data-height");
  const className = attr(element, "data-class");
  const title = attr(element, "data-title");
  const autoResize = attr(element, "data-auto-resize");

  return {
    feature,
    token,
    ...(appOrigin ? { appOrigin } : {}),
    ...(locale ? { locale } : {}),
    ...(theme ? { theme: theme as EmbedTheme } : {}),
    ...(height ? { height: Number(height) } : {}),
    ...(className ? { className } : {}),
    ...(title ? { title } : {}),
    // 既定が true なので、明示的に "false" と書かれたときだけ倒す。
    ...(autoResize === "false" ? { autoResize: false } : {}),
    ...(Object.keys(params).length > 0 ? { params } : {}),
  };
}

/** data-param-* を params へ集める。data-param-hako → params.hako。 */
function collectParams(element: Element): EmbedParams {
  const params: EmbedParams = {};
  for (const item of Array.from(element.attributes)) {
    if (!item.name.startsWith(PARAM_PREFIX)) continue;
    const key = camelize(item.name.slice(PARAM_PREFIX.length));
    if (key) params[key] = item.value;
  }
  return params;
}

/** data-param-start-at → startAt。属性名は小文字しか持てないため戻す。 */
function camelize(name: string): string {
  return name.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase());
}

function attr(element: Element, name: string): string {
  return (element.getAttribute(name) ?? "").trim();
}
