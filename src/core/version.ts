// ビルド時に tsdown の define で実値へ置き換える。型ストリップだけで動かす
// 単体テストでは置き換えが起きないので、typeof で見てから既定値へ倒す
// （未宣言の識別子でも typeof は例外にならない）。
declare const __IN2ONE_VERSION__: string;
declare const __IN2ONE_APP_ORIGIN__: string;

/** この SDK のバージョン。埋め込み URL に載せてアプリ側の互換判定に使う。 */
export const VERSION: string =
  typeof __IN2ONE_VERSION__ === "string" ? __IN2ONE_VERSION__ : "0.0.0-dev";

/**
 * appOrigin を省いたときの既定の接続先。
 * ビルド時に環境変数 IN2ONE_APP_ORIGIN で差し替える。
 */
export const DEFAULT_APP_ORIGIN: string =
  typeof __IN2ONE_APP_ORIGIN__ === "string"
    ? __IN2ONE_APP_ORIGIN__
    : "https://app.in2one.io";
