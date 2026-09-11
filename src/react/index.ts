import {
  createElement,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactElement,
  type RefObject,
} from "react";
import { OneEmbed } from "../core/embed.ts";
import type { EmbedError } from "../core/errors.ts";
import type {
  EmbedEvent,
  EmbedOptions,
  EmbedReadyPayload,
  EmbedSubmitPayload,
} from "../core/types.ts";

export interface UseIn2OneEmbedResult {
  /** iframe を入れる要素へ渡す ref。 */
  containerRef: RefObject<HTMLDivElement | null>;
  /** 生成された埋め込み。マウント前・エラー時は null。 */
  embed: OneEmbed | null;
}

/**
 * 埋め込みを React のライフサイクルに合わせて作り直す。
 *
 * コールバックは ref に逃がす ── props で毎回新しい関数が来ても
 * iframe を作り直さないため（作り直すと入力中のフォームが消える）。
 */
export function useIn2OneEmbed(options: EmbedOptions): UseIn2OneEmbedResult {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [embed, setEmbed] = useState<OneEmbed | null>(null);
  const callbacks = useRef(options);
  callbacks.current = options;

  const {
    feature,
    token,
    appOrigin,
    height,
    autoResize,
    className,
    title,
    loadTimeout,
    locale,
    theme,
  } = options;
  // オブジェクトは毎回別参照で来るので、中身で比較する。
  const paramsKey = stableKey(options.params);
  const prefillKey = stableKey(options.prefill);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const instance = new OneEmbed({
      ...callbacks.current,
      onReady: (payload: EmbedReadyPayload) =>
        callbacks.current.onReady?.(payload),
      onResize: (value: number) => callbacks.current.onResize?.(value),
      onSubmit: (payload: EmbedSubmitPayload) =>
        callbacks.current.onSubmit?.(payload),
      onEvent: (payload: EmbedEvent) => callbacks.current.onEvent?.(payload),
      onError: callbacks.current.onError
        ? (error: EmbedError) => callbacks.current.onError?.(error)
        : undefined,
    });
    instance.mount(container);
    setEmbed(instance);
    return () => {
      instance.destroy();
      setEmbed(null);
    };
    // 見た目と接続先が変わったときだけ作り直す。
  }, [
    feature,
    token,
    appOrigin,
    height,
    autoResize,
    className,
    title,
    loadTimeout,
    paramsKey,
  ]);

  // 以下は作り直さずに反映できるもの。
  useEffect(() => {
    if (embed && locale) embed.setLocale(locale);
  }, [embed, locale]);

  useEffect(() => {
    if (embed && theme) embed.setTheme(theme);
  }, [embed, theme]);

  useEffect(() => {
    const prefill = callbacks.current.prefill;
    if (embed && prefill) embed.setPrefill(prefill);
  }, [embed, prefillKey]);

  return { containerRef, embed };
}

export interface In2OneEmbedProps extends EmbedOptions {
  /** iframe を包む div の class。iframe 自体は className で指定する。 */
  wrapperClassName?: string;
  /** iframe を包む div の style。 */
  style?: CSSProperties;
}

/**
 * 予約フォームなどの埋め込みを 1 つ描画する。
 *
 *   <In2OneEmbed feature="booking" token="pk_live_xxx" params={{ hako }} />
 */
export function In2OneEmbed(props: In2OneEmbedProps): ReactElement {
  const { wrapperClassName, style, ...options } = props;
  const { containerRef } = useIn2OneEmbed(options);
  return createElement("div", {
    ref: containerRef,
    className: wrapperClassName,
    style,
  });
}

/** 順序に依らないキーを作る。参照だけ変わった同じ中身で再生成しないため。 */
function stableKey(value: Record<string, unknown> | undefined): string {
  if (!value) return "";
  const keys = Object.keys(value).sort();
  return keys.map((key) => `${key}=${String(value[key])}`).join("&");
}

export { OneEmbed } from "../core/embed.ts";
export { EmbedError } from "../core/errors.ts";
export type * from "../core/types.ts";
