import { defineConfig } from "tsdown";
import pkg from "./package.json" with { type: "json" };

// 既定の接続先はビルド時に決める。本番の origin は環境変数で渡す
// （リリース用の GitHub Actions で設定する）。
const appOrigin = process.env["IN2ONE_APP_ORIGIN"] ?? "https://app.in2one.io";

const define = {
  __IN2ONE_VERSION__: JSON.stringify(pkg.version),
  __IN2ONE_APP_ORIGIN__: JSON.stringify(appOrigin),
};

export default defineConfig([
  // npm パッケージとして使う版。react / vue は埋め込まず peer のまま残す。
  {
    entry: {
      index: "src/index.ts",
      react: "src/react/index.ts",
      vue: "src/vue/index.ts",
    },
    format: ["esm", "cjs"],
    platform: "browser",
    target: "es2022",
    dts: true,
    clean: true,
    sourcemap: true,
    deps: { neverBundle: ["react", "vue"] },
    define,
  },
  // <script> タグで読み込む版。Firebase Hosting に置くのはこれ。
  {
    entry: { one: "src/embed.ts" },
    format: ["iife"],
    platform: "browser",
    target: "es2020",
    minify: true,
    sourcemap: true,
    dts: false,
    clean: false,
    define,
    // name を渡さないと rolldown が IIFE の戻り値を捨てる旨を警告する。
    // 実際の入口は embed.ts が自分で生やす window.In2One のほう。
    outputOptions: { name: "In2One", entryFileNames: "one.js" },
  },
]);
