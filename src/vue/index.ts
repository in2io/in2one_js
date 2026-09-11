import {
  defineComponent,
  h,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
  type PropType,
  type ShallowRef,
} from "vue";
import { OneEmbed } from "../core/embed.ts";
import type { EmbedError } from "../core/errors.ts";
import type {
  EmbedEvent,
  EmbedParams,
  EmbedPrefill,
  EmbedReadyPayload,
  EmbedSubmitPayload,
  EmbedTheme,
} from "../core/types.ts";

/**
 * 予約フォームなどの埋め込みを 1 つ描画する。
 *
 *   <In2OneEmbed feature="booking" token="pk_live_xxx" :params="{ hako }"
 *                @submit="onSubmit" />
 *
 * コールバックは emit で受ける。emit は毎回同じ関数なので、
 * React 版のような ref への退避は要らない。
 */
export const In2OneEmbed = defineComponent({
  name: "In2OneEmbed",
  props: {
    feature: { type: String, required: true },
    token: { type: String, required: true },
    appOrigin: { type: String, default: undefined },
    locale: { type: String, default: undefined },
    theme: { type: String as PropType<EmbedTheme>, default: undefined },
    params: { type: Object as PropType<EmbedParams>, default: undefined },
    prefill: { type: Object as PropType<EmbedPrefill>, default: undefined },
    autoResize: { type: Boolean, default: true },
    height: { type: Number, default: undefined },
    className: { type: String, default: undefined },
    title: { type: String, default: undefined },
    loadTimeout: { type: Number, default: undefined },
    /** iframe を包む要素の class。iframe 自体は className で指定する。 */
    wrapperClass: { type: String, default: undefined },
  },
  emits: {
    ready: (_payload: EmbedReadyPayload) => true,
    resize: (_height: number) => true,
    submit: (_payload: EmbedSubmitPayload) => true,
    event: (_payload: EmbedEvent) => true,
    error: (_error: EmbedError) => true,
    close: () => true,
  },
  setup(props, { emit, expose }) {
    const container = ref<HTMLDivElement | null>(null);
    const embed: ShallowRef<OneEmbed | null> = ref(null);

    const create = (): void => {
      if (!container.value) return;
      const instance = new OneEmbed({
        feature: props.feature,
        token: props.token,
        appOrigin: props.appOrigin,
        locale: props.locale,
        theme: props.theme,
        params: props.params,
        prefill: props.prefill,
        autoResize: props.autoResize,
        height: props.height,
        className: props.className,
        title: props.title,
        loadTimeout: props.loadTimeout,
        onReady: (payload) => emit("ready", payload),
        onResize: (value) => emit("resize", value),
        onSubmit: (payload) => emit("submit", payload),
        onEvent: (payload) => emit("event", payload),
        onError: (error) => emit("error", error),
      });
      instance.on("close", () => emit("close"));
      instance.mount(container.value);
      embed.value = instance;
    };

    const destroy = (): void => {
      embed.value?.destroy();
      embed.value = null;
    };

    onMounted(create);
    onBeforeUnmount(destroy);

    // 接続先・見た目が変わったら作り直す。params はオブジェクトなので
    // 中身で比べる（毎回の再代入で iframe を作り直すと入力中の内容が消える）。
    watch(
      () => [
        props.feature,
        props.token,
        props.appOrigin,
        props.height,
        props.autoResize,
        props.className,
        props.title,
        props.loadTimeout,
        stableKey(props.params),
      ],
      () => {
        destroy();
        create();
      },
    );

    // 以下は作り直さずに反映できるもの。
    watch(
      () => props.locale,
      (locale) => {
        if (locale) embed.value?.setLocale(locale);
      },
    );
    watch(
      () => props.theme,
      (theme) => {
        if (theme) embed.value?.setTheme(theme);
      },
    );
    watch(
      () => stableKey(props.prefill),
      () => {
        if (props.prefill) embed.value?.setPrefill(props.prefill);
      },
    );

    expose({ embed });

    return () => h("div", { ref: container, class: props.wrapperClass });
  },
});

/** 順序に依らないキーを作る。参照だけ変わった同じ中身で再生成しないため。 */
function stableKey(value: Record<string, unknown> | undefined): string {
  if (!value) return "";
  const keys = Object.keys(value).sort();
  return keys.map((key) => `${key}=${String(value[key])}`).join("&");
}

export { OneEmbed } from "../core/embed.ts";
export { EmbedError } from "../core/errors.ts";
export type * from "../core/types.ts";
