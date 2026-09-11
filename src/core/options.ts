import { EmbedError } from "./errors.ts";
import type { EmbedOptions, EmbedTheme, ResolvedEmbedOptions } from "./types.ts";
import { DEFAULT_APP_ORIGIN } from "./version.ts";

const DEFAULT_HEIGHT = 640;
const DEFAULT_LOAD_TIMEOUT = 20000;
const THEMES: readonly EmbedTheme[] = ["light", "dark", "auto"];

/**
 * origin を "scheme://host[:port]" の形へ正規化する。
 * postMessage の targetOrigin にそのまま使うので、パスや末尾の / は落とす
 * （targetOrigin にパスが混ざると、ブラウザ側の一致判定に落ちて無言で届かない）。
 */
export function normalizeOrigin(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new EmbedError(
      "invalid_options",
      `appOrigin が URL として読めません: ${raw}`,
    );
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new EmbedError(
      "invalid_options",
      `appOrigin は http(s) である必要があります: ${raw}`,
    );
  }
  return url.origin;
}

/** 設定を検証し、既定値を埋める。ここを通った後は内部で存在チェックをしない。 */
export function resolveOptions(options: EmbedOptions): ResolvedEmbedOptions {
  if (!options || typeof options !== "object") {
    throw new EmbedError("invalid_options", "設定オブジェクトが必要です");
  }
  const feature = String(options.feature ?? "").trim();
  if (!feature) {
    throw new EmbedError("invalid_options", "feature は必須です");
  }
  // パスセグメントに入るので、素性の分かる文字だけ通す。
  if (!/^[a-z][a-z0-9_-]*$/.test(feature)) {
    throw new EmbedError(
      "invalid_options",
      `feature に使えない文字が含まれます: ${feature}`,
    );
  }
  const token = String(options.token ?? "").trim();
  if (!token) {
    throw new EmbedError("invalid_options", "token は必須です");
  }

  const theme = options.theme ?? "auto";
  if (!THEMES.includes(theme)) {
    throw new EmbedError("invalid_options", `theme が不正です: ${theme}`);
  }

  const height = options.height ?? DEFAULT_HEIGHT;
  if (!Number.isFinite(height) || height <= 0) {
    throw new EmbedError("invalid_options", `height が不正です: ${height}`);
  }

  const loadTimeout = options.loadTimeout ?? DEFAULT_LOAD_TIMEOUT;
  if (!Number.isFinite(loadTimeout) || loadTimeout < 0) {
    throw new EmbedError(
      "invalid_options",
      `loadTimeout が不正です: ${loadTimeout}`,
    );
  }

  return {
    ...options,
    feature,
    token,
    appOrigin: normalizeOrigin(options.appOrigin ?? DEFAULT_APP_ORIGIN),
    theme,
    autoResize: options.autoResize ?? true,
    height,
    title: options.title ?? "in2 One",
    loadTimeout,
  };
}
