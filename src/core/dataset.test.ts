import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { optionsFromElement } from "./dataset.ts";
import { EmbedError } from "./errors.ts";

/** getAttribute と attributes だけ持つ最小の要素。DOM 無しで属性の解釈を試す。 */
function element(attrs: Record<string, string>): Element {
  return {
    getAttribute: (name: string): string | null => attrs[name] ?? null,
    attributes: Object.keys(attrs).map((name) => ({
      name,
      value: attrs[name] as string,
    })),
  } as unknown as Element;
}

describe("optionsFromElement", () => {
  it("data-in2one を feature、data-token を token にする", () => {
    const options = optionsFromElement(
      element({ "data-in2one": "booking", "data-token": "pk_test" }),
    );
    assert.equal(options.feature, "booking");
    assert.equal(options.token, "pk_test");
  });

  it("任意の属性を読む", () => {
    const options = optionsFromElement(
      element({
        "data-in2one": "booking",
        "data-token": "pk_test",
        "data-origin": "https://app.example.com",
        "data-locale": "ja",
        "data-theme": "dark",
        "data-height": "720",
        "data-class": "frame",
        "data-title": "予約",
      }),
    );
    assert.equal(options.appOrigin, "https://app.example.com");
    assert.equal(options.locale, "ja");
    assert.equal(options.theme, "dark");
    assert.equal(options.height, 720);
    assert.equal(options.className, "frame");
    assert.equal(options.title, "予約");
  });

  it("data-param-* を params へ集め、ケバブをキャメルに戻す", () => {
    const options = optionsFromElement(
      element({
        "data-in2one": "booking",
        "data-token": "pk_test",
        "data-param-hako": "9f2c",
        "data-param-start-at": "2026-01-01",
      }),
    );
    assert.deepEqual(options.params, { hako: "9f2c", startAt: "2026-01-01" });
  });

  it("params が無ければキー自体を作らない", () => {
    const options = optionsFromElement(
      element({ "data-in2one": "booking", "data-token": "pk_test" }),
    );
    assert.equal("params" in options, false);
  });

  it("autoResize は false と書いたときだけ倒す", () => {
    const on = optionsFromElement(
      element({ "data-in2one": "booking", "data-token": "pk", "data-auto-resize": "true" }),
    );
    assert.equal("autoResize" in on, false);
    const off = optionsFromElement(
      element({ "data-in2one": "booking", "data-token": "pk", "data-auto-resize": "false" }),
    );
    assert.equal(off.autoResize, false);
  });

  it("token が無ければエラー", () => {
    assert.throws(
      () => optionsFromElement(element({ "data-in2one": "booking" })),
      EmbedError,
    );
  });

  it("feature が空ならエラー", () => {
    assert.throws(
      () => optionsFromElement(element({ "data-in2one": "", "data-token": "pk" })),
      EmbedError,
    );
  });
});
