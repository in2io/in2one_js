import { OneEmbed } from "./core/embed.ts";
import type { EmbedOptions, EmbedTarget } from "./core/types.ts";

export { OneEmbed, type EmbedEventMap } from "./core/embed.ts";
export { EmbedError, type EmbedErrorCode } from "./core/errors.ts";
export {
  PROTOCOL,
  PROTOCOL_VERSION,
  type InboundKind,
  type OutboundKind,
} from "./core/messages.ts";
export { normalizeOrigin, resolveOptions } from "./core/options.ts";
export type {
  EmbedEvent,
  EmbedFeature,
  EmbedOptions,
  EmbedParams,
  EmbedPrefill,
  EmbedReadyPayload,
  EmbedSubmitPayload,
  EmbedTarget,
  EmbedTheme,
  ResolvedEmbedOptions,
} from "./core/types.ts";
export { buildEmbedUrl, EMBED_PATH_PREFIX } from "./core/url.ts";
export { DEFAULT_APP_ORIGIN, VERSION } from "./core/version.ts";

/**
 * 埋め込みを作る（マウントはしない）。
 * 表示のタイミングを自分で決めたいときに使う。
 */
export function createEmbed(options: EmbedOptions): OneEmbed {
  return new OneEmbed(options);
}

/** 作ってそのままマウントする。ほとんどの用途はこちらで足りる。 */
export function mount(target: EmbedTarget, options: EmbedOptions): OneEmbed {
  return new OneEmbed(options).mount(target);
}
