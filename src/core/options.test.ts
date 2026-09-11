import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { EmbedError } from "./errors.ts";
import { normalizeOrigin, resolveOptions } from "./options.ts";

describe("normalizeOrigin", () => {
  it("パスと末尾のスラッシュを落とす", () => {
    assert.equal(normalizeOrigin("https://app.example.com/"), "https://app.example.com");
    assert.equal(
      normalizeOrigin("https://app.example.com/embed/v1?a=1"),
      "https://app.example.com",
    );
  });

  it("ポートは残す", () => {
    assert.equal(
      normalizeOrigin("http://localhost:13080"),
      "http://localhost:13080",
    );
  });

  it("URL でなければ弾く", () => {
    assert.throws(() => normalizeOrigin("app.example.com"), EmbedError);
  });

  it("http(s) 以外は弾く", () => {
    assert.throws(() => normalizeOrigin("ftp://app.example.com"), EmbedError);
    assert.throws(() => normalizeOrigin("javascript:alert(1)"), EmbedError);
  });
});

describe("resolveOptions", () => {
  const base = { feature: "booking", token: "pk_test" };

  it("既定値を埋める", () => {
    const resolved = resolveOptions({ ...base, appOrigin: "https://a.example" });
    assert.equal(resolved.theme, "auto");
    assert.equal(resolved.autoResize, true);
    assert.equal(resolved.height, 640);
    assert.equal(resolved.loadTimeout, 20000);
    assert.equal(resolved.title, "in2 One");
    assert.equal(resolved.appOrigin, "https://a.example");
  });

  it("指定した値は上書きしない", () => {
    const resolved = resolveOptions({
      ...base,
      appOrigin: "https://a.example",
      theme: "dark",
      autoResize: false,
      height: 900,
      loadTimeout: 0,
      title: "予約",
    });
    assert.equal(resolved.theme, "dark");
    assert.equal(resolved.autoResize, false);
    assert.equal(resolved.height, 900);
    assert.equal(resolved.loadTimeout, 0);
    assert.equal(resolved.title, "予約");
  });

  it("feature と token は必須", () => {
    assert.throws(() => resolveOptions({ feature: "", token: "x" }), EmbedError);
    assert.throws(
      () => resolveOptions({ feature: "booking", token: "  " }),
      EmbedError,
    );
  });

  it("feature にパスを混ぜられない", () => {
    assert.throws(
      () => resolveOptions({ feature: "../admin", token: "x" }),
      EmbedError,
    );
    assert.throws(
      () => resolveOptions({ feature: "Booking", token: "x" }),
      EmbedError,
    );
  });

  it("theme と height と loadTimeout を検証する", () => {
    assert.throws(
      () => resolveOptions({ ...base, theme: "blue" as never }),
      EmbedError,
    );
    assert.throws(() => resolveOptions({ ...base, height: 0 }), EmbedError);
    assert.throws(
      () => resolveOptions({ ...base, height: Number.NaN }),
      EmbedError,
    );
    assert.throws(
      () => resolveOptions({ ...base, loadTimeout: -1 }),
      EmbedError,
    );
  });

  it("前後の空白は落とす", () => {
    const resolved = resolveOptions({ feature: " booking ", token: " pk_test " });
    assert.equal(resolved.feature, "booking");
    assert.equal(resolved.token, "pk_test");
  });
});
