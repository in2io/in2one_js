import { EmbedError } from "./errors.ts";
import {
  outbound,
  parseInbound,
  readErrorMessage,
  readEvent,
  readHeight,
  readReady,
  readSubmit,
  type InboundKind,
  type OutboundKind,
  type OutboundMessage,
} from "./messages.ts";
import { resolveOptions } from "./options.ts";
import type {
  EmbedEvent,
  EmbedOptions,
  EmbedParams,
  EmbedPrefill,
  EmbedReadyPayload,
  EmbedSubmitPayload,
  EmbedTarget,
  EmbedTheme,
  ResolvedEmbedOptions,
} from "./types.ts";
import { buildEmbedUrl } from "./url.ts";

/** on() で購読できるイベント。options のコールバックと同じ粒度。 */
export interface EmbedEventMap {
  ready: EmbedReadyPayload;
  resize: number;
  submit: EmbedSubmitPayload;
  event: EmbedEvent;
  error: EmbedError;
  close: void;
}

type Listener = (value: never) => void;

/** iframe に読み込ませる機能に載せる権限。決済への遷移を許すため payment を通す。 */
const IFRAME_ALLOW = "payment; clipboard-write; geolocation";

/**
 * トップ遷移はユーザー操作があるときだけ許す。素通しにすると、埋め込み先の
 * ページごと別サイトへ飛ばせる経路を外部サイトに差し出すことになる。
 */
const IFRAME_SANDBOX =
  "allow-scripts allow-same-origin allow-forms allow-popups " +
  "allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation";

/**
 * 埋め込み 1 つ分。iframe の生成・postMessage の送受信・後片付けを持つ。
 *
 * 中身は必ず iframe に閉じ込める ── 埋め込み先は他社のページなので、
 * CSS もスクリプトも互いに触れない境界が要る。入力された個人情報が
 * 埋め込み先の DOM を経由しないことも、この形でしか保証できない。
 */
export class OneEmbed {
  /** この埋め込みの識別子。postMessage の宛先照合に使う。 */
  readonly id: string;

  private options: ResolvedEmbedOptions;
  private frame: HTMLIFrameElement | null = null;
  private ready = false;
  private destroyed = false;
  private queue: OutboundMessage[] = [];
  private listeners = new Map<InboundKind, Set<Listener>>();
  private timeoutId: ReturnType<typeof setTimeout> | null = null;
  private readonly onWindowMessage = (event: MessageEvent): void => {
    this.handleMessage(event);
  };

  constructor(options: EmbedOptions) {
    this.options = resolveOptions(options);
    this.id = createId();
  }

  /** 現在の設定（既定値を埋めた後）の読み取り用コピー。 */
  getOptions(): Readonly<ResolvedEmbedOptions> {
    return this.options;
  }

  /** マウント済みかどうか。 */
  isMounted(): boolean {
    return this.frame !== null;
  }

  /**
   * 指定した要素の中へ iframe を作る。
   * target はセレクタでも要素でもよい。
   */
  mount(target: EmbedTarget): this {
    if (this.destroyed) {
      throw new EmbedError(
        "not_mounted",
        "destroy 済みのインスタンスは再利用できません",
      );
    }
    if (this.frame) {
      throw new EmbedError("already_mounted", "すでにマウントされています");
    }
    const container = resolveTarget(target);
    const frame = document.createElement("iframe");
    frame.src = buildEmbedUrl(this.options, this.id, parentOrigin());
    frame.title = this.options.title;
    frame.allow = IFRAME_ALLOW;
    frame.setAttribute("sandbox", IFRAME_SANDBOX);
    frame.referrerPolicy = "strict-origin";
    if (this.options.className) frame.className = this.options.className;
    frame.style.display = "block";
    frame.style.width = "100%";
    frame.style.border = "0";
    frame.style.height = `${this.options.height}px`;
    frame.style.colorScheme = "normal";
    frame.addEventListener("error", () => {
      this.fail(new EmbedError("load_failed", "埋め込みページを読み込めませんでした"));
    });

    window.addEventListener("message", this.onWindowMessage);
    container.appendChild(frame);
    this.frame = frame;
    this.startLoadTimer();
    return this;
  }

  /** フォームの初期値を渡す。ready 前に呼んだぶんは ready 後に送られる。 */
  setPrefill(prefill: EmbedPrefill): this {
    this.options = { ...this.options, prefill };
    return this.send("prefill", { prefill: clean(prefill) });
  }

  /** 表示言語を切り替える。 */
  setLocale(locale: string): this {
    this.options = { ...this.options, locale };
    return this.send("locale", { locale });
  }

  /** 外観を切り替える。 */
  setTheme(theme: EmbedTheme): this {
    this.options = { ...this.options, theme };
    return this.send("theme", { theme });
  }

  /** 機能ごとの絞り込みを差し替える。 */
  setParams(params: EmbedParams): this {
    this.options = { ...this.options, params };
    return this.send("params", { params: clean(params) });
  }

  /** 埋め込みページを初期状態へ戻す。 */
  refresh(): this {
    return this.send("refresh", {});
  }

  /** イベントを購読する。戻り値を呼ぶと解除。 */
  on<K extends InboundKind>(
    kind: K,
    handler: (value: EmbedEventMap[K]) => void,
  ): () => void {
    let set = this.listeners.get(kind);
    if (!set) {
      set = new Set();
      this.listeners.set(kind, set);
    }
    set.add(handler as Listener);
    return () => {
      this.listeners.get(kind)?.delete(handler as Listener);
    };
  }

  /** iframe と listener を片付ける。以後このインスタンスは使えない。 */
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.clearLoadTimer();
    window.removeEventListener("message", this.onWindowMessage);
    this.frame?.remove();
    this.frame = null;
    this.queue = [];
    this.listeners.clear();
  }

  /**
   * iframe へ送る。ready 前は溜めておく ── 読み込み中の window へ送っても
   * 受け手がまだ listener を張っておらず、黙って捨てられる。
   */
  private send(kind: OutboundKind, payload: Record<string, unknown>): this {
    if (this.destroyed) return this;
    const message = outbound(this.id, kind, payload);
    if (!this.ready) {
      this.queue.push(message);
      return this;
    }
    this.post(message);
    return this;
  }

  private post(message: OutboundMessage): void {
    this.frame?.contentWindow?.postMessage(message, this.options.appOrigin);
  }

  private handleMessage(event: MessageEvent): void {
    if (this.destroyed || !this.frame) return;
    // 送信元の origin と window の両方を見る。origin だけだと、同じアプリを
    // 埋め込んだ別の iframe（別テナント・別機能）からの message も通ってしまう。
    if (event.origin !== this.options.appOrigin) return;
    if (event.source !== this.frame.contentWindow) return;

    const message = parseInbound(event.data, this.id);
    if (!message) return;

    switch (message.kind) {
      case "ready": {
        this.clearLoadTimer();
        this.ready = true;
        this.flush();
        const payload = readReady(message.payload, this.options.feature);
        this.options.onReady?.(payload);
        this.emit("ready", payload);
        return;
      }
      case "resize": {
        const height = readHeight(message.payload);
        if (height === null) return;
        if (this.options.autoResize && this.frame) {
          this.frame.style.height = `${height}px`;
        }
        this.options.onResize?.(height);
        this.emit("resize", height);
        return;
      }
      case "submit": {
        const payload = readSubmit(message.payload, this.options.feature);
        this.options.onSubmit?.(payload);
        this.emit("submit", payload);
        return;
      }
      case "event": {
        const payload = readEvent(message.payload);
        if (!payload) return;
        this.options.onEvent?.(payload);
        this.emit("event", payload);
        return;
      }
      case "error": {
        this.clearLoadTimer();
        this.fail(
          new EmbedError(
            "app_error",
            readErrorMessage(message.payload),
            message.payload,
          ),
        );
        return;
      }
      case "close": {
        this.emit("close", undefined);
        return;
      }
    }
  }

  private flush(): void {
    const queued = this.queue;
    this.queue = [];
    for (const message of queued) this.post(message);
  }

  private startLoadTimer(): void {
    if (this.options.loadTimeout <= 0) return;
    this.timeoutId = setTimeout(() => {
      this.timeoutId = null;
      if (this.ready || this.destroyed) return;
      this.fail(
        new EmbedError("load_timeout", "埋め込みページの応答がありません", {
          timeout: this.options.loadTimeout,
        }),
      );
    }, this.options.loadTimeout);
  }

  private clearLoadTimer(): void {
    if (this.timeoutId === null) return;
    clearTimeout(this.timeoutId);
    this.timeoutId = null;
  }

  /**
   * エラーを配る。onError も on("error") も無ければ握り潰さず console に出す
   * ── 埋め込み先の開発者が気付けないまま白い枠だけが残るのを避ける。
   */
  private fail(error: EmbedError): void {
    const handled = this.emit("error", error);
    if (this.options.onError) {
      this.options.onError(error);
      return;
    }
    if (!handled) console.error("[in2one]", error.code, error.message);
  }

  /** 購読者へ配る。1 人でも居れば true。 */
  private emit<K extends InboundKind>(
    kind: K,
    value: EmbedEventMap[K],
  ): boolean {
    const set = this.listeners.get(kind);
    if (!set || set.size === 0) return false;
    for (const handler of set) (handler as (v: EmbedEventMap[K]) => void)(value);
    return true;
  }
}

/** target を要素へ解決する。見つからなければエラー。 */
function resolveTarget(target: EmbedTarget): Element {
  if (typeof target === "string") {
    const found = document.querySelector(target);
    if (!found) {
      throw new EmbedError(
        "target_not_found",
        `マウント先が見つかりません: ${target}`,
      );
    }
    return found;
  }
  if (target && typeof (target as Element).appendChild === "function") {
    return target;
  }
  throw new EmbedError("target_not_found", "マウント先の要素が不正です");
}

/** 埋め込み先ページの origin。file:// などでは空文字。 */
function parentOrigin(): string {
  const origin = window.location.origin;
  return origin && origin !== "null" ? origin : "";
}

/** undefined を落とした素の値だけにする。postMessage の構造化複製に載せるため。 */
function clean(
  input: Record<string, string | number | boolean | undefined>,
): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  for (const key of Object.keys(input)) {
    const value = input[key];
    if (value === undefined || value === null) continue;
    out[key] = value;
  }
  return out;
}

/** 埋め込みごとの一意な id。crypto が無い古い環境でも動くようにする。 */
function createId(): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return uuid;
  return `e${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}
