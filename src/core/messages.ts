import type {
  EmbedEvent,
  EmbedReadyPayload,
  EmbedSubmitPayload,
} from "./types.ts";

/** 埋め込みページとのやりとりを他の postMessage と区別する印。 */
export const PROTOCOL = "in2one.embed";
/** 封筒の形の版。互換を壊すときだけ上げる。 */
export const PROTOCOL_VERSION = 1;

/** iframe → 親。 */
export type InboundKind =
  | "ready"
  | "resize"
  | "event"
  | "submit"
  | "error"
  | "close";

/** 親 → iframe。 */
export type OutboundKind =
  | "prefill"
  | "locale"
  | "theme"
  | "params"
  | "refresh";

const INBOUND_KINDS: readonly string[] = [
  "ready",
  "resize",
  "event",
  "submit",
  "error",
  "close",
];

export interface InboundMessage {
  kind: InboundKind;
  payload: Record<string, unknown>;
}

export interface OutboundMessage {
  protocol: typeof PROTOCOL;
  v: number;
  id: string;
  kind: OutboundKind;
  payload: Record<string, unknown>;
}

/** 親 → iframe の封筒を作る。 */
export function outbound(
  id: string,
  kind: OutboundKind,
  payload: Record<string, unknown>,
): OutboundMessage {
  return { protocol: PROTOCOL, v: PROTOCOL_VERSION, id, kind, payload };
}

/**
 * 受け取った message が「自分の iframe からの、この版の封筒」かを判定して取り出す。
 * 違えば null ── 同じページに別の埋め込みや無関係な postMessage が同居するので、
 * id まで一致させないと隣の埋め込みのイベントを拾う。
 */
export function parseInbound(data: unknown, id: string): InboundMessage | null {
  if (typeof data !== "object" || data === null) return null;
  const msg = data as Record<string, unknown>;
  if (msg["protocol"] !== PROTOCOL) return null;
  if (msg["v"] !== PROTOCOL_VERSION) return null;
  if (msg["id"] !== id) return null;
  const kind = msg["kind"];
  if (typeof kind !== "string" || !INBOUND_KINDS.includes(kind)) return null;
  const payload = msg["payload"];
  return {
    kind: kind as InboundKind,
    payload:
      typeof payload === "object" && payload !== null
        ? (payload as Record<string, unknown>)
        : {},
  };
}

/** resize の高さを取り出す。数値でなければ null。 */
export function readHeight(payload: Record<string, unknown>): number | null {
  const height = payload["height"];
  if (typeof height !== "number" || !Number.isFinite(height) || height <= 0) {
    return null;
  }
  return Math.ceil(height);
}

export function readReady(
  payload: Record<string, unknown>,
  feature: string,
): EmbedReadyPayload {
  const appVersion = payload["appVersion"];
  return {
    feature,
    ...(typeof appVersion === "string" ? { appVersion } : {}),
  };
}

export function readSubmit(
  payload: Record<string, unknown>,
  feature: string,
): EmbedSubmitPayload {
  const uuid = payload["uuid"];
  const data = payload["data"];
  return {
    feature,
    ...(typeof uuid === "string" ? { uuid } : {}),
    ...(typeof data === "object" && data !== null
      ? { data: data as Record<string, unknown> }
      : {}),
  };
}

export function readEvent(payload: Record<string, unknown>): EmbedEvent | null {
  const name = payload["name"];
  if (typeof name !== "string" || !name) return null;
  const data = payload["data"];
  return {
    name,
    ...(typeof data === "object" && data !== null
      ? { data: data as Record<string, unknown> }
      : {}),
  };
}

/** error の中身を人が読める文字列にする。 */
export function readErrorMessage(payload: Record<string, unknown>): string {
  const message = payload["message"];
  if (typeof message === "string" && message) return message;
  const code = payload["code"];
  if (typeof code === "string" && code) return code;
  return "埋め込みページでエラーが発生しました";
}
