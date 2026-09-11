/** エラーの種別。文字列で固定し、呼び出し側が分岐できるようにする。 */
export type EmbedErrorCode =
  | "invalid_options" // 引数が足りない・形式が不正
  | "target_not_found" // マウント先の要素が見つからない
  | "already_mounted" // 同じインスタンスを二重にマウントした
  | "not_mounted" // マウント前に操作した
  | "load_failed" // iframe が読み込めなかった
  | "load_timeout" // 一定時間 ready が来なかった
  | "app_error"; // アプリ側（iframe の中）が報告したエラー

/** SDK が投げる・コールバックへ渡す唯一のエラー型。 */
export class EmbedError extends Error {
  readonly code: EmbedErrorCode;
  readonly detail: Record<string, unknown> | undefined;

  constructor(
    code: EmbedErrorCode,
    message: string,
    detail?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "EmbedError";
    this.code = code;
    this.detail = detail;
  }
}
