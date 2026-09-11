import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveOptions } from "./options.ts";
import type { EmbedOptions } from "./types.ts";
import { buildEmbedUrl, EMBED_PATH_PREFIX } from "./url.ts";

function urlFor(
  overrides: Partial<EmbedOptions> = {},
  id = "abc",
  parent = "https://shop.example.com",
): URL {
  const options = resolveOptions({
    feature: "booking",
    token: "pk_test",
    appOrigin: "https://app.example.com",
    ...overrides,
  });
  return new URL(buildEmbedUrl(options, id, parent));
}

describe("buildEmbedUrl", () => {
  it("機能ごとのパスへ向ける", () => {
    const url = urlFor();
    assert.equal(url.origin, "https://app.example.com");
    assert.equal(url.pathname, `${EMBED_PATH_PREFIX}/booking`);
  });

  it("token・id・sdk・theme・parent を載せる", () => {
    const url = urlFor();
    assert.equal(url.searchParams.get("token"), "pk_test");
    assert.equal(url.searchParams.get("id"), "abc");
    assert.equal(url.searchParams.get("theme"), "auto");
    assert.equal(url.searchParams.get("parent"), "https://shop.example.com");
    assert.ok(url.searchParams.get("sdk"));
  });

  it("locale は指定したときだけ載せる", () => {
    assert.equal(urlFor().searchParams.get("locale"), null);
    assert.equal(urlFor({ locale: "ja" }).searchParams.get("locale"), "ja");
  });

  it("params は p. 接頭辞を付けて載せる", () => {
    const url = urlFor({ params: { hako: "9f2c", seats: 2, vip: true } });
    assert.equal(url.searchParams.get("p.hako"), "9f2c");
    assert.equal(url.searchParams.get("p.seats"), "2");
    assert.equal(url.searchParams.get("p.vip"), "true");
  });

  it("params の undefined は載せない", () => {
    const url = urlFor({ params: { hako: undefined, seats: 1 } });
    assert.equal(url.searchParams.has("p.hako"), false);
    assert.equal(url.searchParams.get("p.seats"), "1");
  });

  it("prefill は URL に出さない（個人情報が履歴とログに残るため）", () => {
    const url = urlFor({ prefill: { email: "a@example.com" } });
    assert.equal(url.search.includes("a@example.com"), false);
    assert.equal(url.search.includes("email"), false);
  });

  it("parent が空なら載せない", () => {
    const url = urlFor({}, "abc", "");
    assert.equal(url.searchParams.has("parent"), false);
  });

  it("値はエスケープされる", () => {
    const url = urlFor({ params: { q: "a b&c=d" } });
    assert.equal(url.searchParams.get("p.q"), "a b&c=d");
  });
});
