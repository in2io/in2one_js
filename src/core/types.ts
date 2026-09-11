import type { EmbedError } from "./errors.ts";

/**
 * 埋め込む機能の識別子。アプリ側の /embed/v1/{feature} に対応する。
 * 既知の値を補完に出しつつ、新しい機能を SDK 更新なしで使えるようにする。
 */
export type EmbedFeature = "booking" | (string & {});

/** 外観。auto は埋め込み先ページの prefers-color-scheme に従う。 */
export type EmbedTheme = "light" | "dark" | "auto";

/** 機能ごとの絞り込み（例: 予約なら hako / slot の uuid）。URL に載る。 */
export type EmbedParams = Record<string, string | number | boolean | undefined>;

/**
 * フォームの初期値。個人情報を含みうるので URL には載せず、
 * iframe の読み込み後に postMessage で渡す。
 */
export type EmbedPrefill = Record<string, string | number | boolean | undefined>;

/** ready の中身。アプリ側が自分のバージョンを名乗る。 */
export interface EmbedReadyPayload {
  feature: string;
  appVersion?: string;
}

/** submit の中身。予約なら確定した予約の uuid などが入る。 */
export interface EmbedSubmitPayload {
  feature: string;
  uuid?: string;
  data?: Record<string, unknown>;
}

/** アプリ側から届いた任意のイベント。将来の機能追加を SDK 更新なしで通す。 */
export interface EmbedEvent {
  name: string;
  data?: Record<string, unknown>;
}

/** createEmbed / mount に渡す設定。 */
export interface EmbedOptions {
  /** 埋め込む機能。例: "booking" */
  feature: EmbedFeature;
  /** テナント管理画面で発行する公開トークン。 */
  token: string;
  /** 接続先のアプリ origin。省略時は DEFAULT_APP_ORIGIN。 */
  appOrigin?: string;
  /** 表示言語（BCP 47）。省略時はアプリ側の既定。 */
  locale?: string;
  /** 外観。既定は "auto"。 */
  theme?: EmbedTheme;
  /** 機能ごとの絞り込み。 */
  params?: EmbedParams;
  /** フォームの初期値。 */
  prefill?: EmbedPrefill;
  /** 中身の高さに合わせて iframe を伸縮させる。既定は true。 */
  autoResize?: boolean;
  /** 初期の高さ（px）。既定は 640。 */
  height?: number;
  /** iframe に付ける class。 */
  className?: string;
  /** iframe の title（スクリーンリーダー向け）。 */
  title?: string;
  /** ready が来るまでの上限（ms）。0 で無効。既定は 20000。 */
  loadTimeout?: number;

  onReady?: (payload: EmbedReadyPayload) => void;
  onResize?: (height: number) => void;
  onSubmit?: (payload: EmbedSubmitPayload) => void;
  onEvent?: (event: EmbedEvent) => void;
  onError?: (error: EmbedError) => void;
}

/** 既定値を埋めた後の設定。内部で使う。 */
export interface ResolvedEmbedOptions extends EmbedOptions {
  appOrigin: string;
  theme: EmbedTheme;
  autoResize: boolean;
  height: number;
  title: string;
  loadTimeout: number;
}

/** マウント先。CSS セレクタか要素そのもの。 */
export type EmbedTarget = string | Element;
