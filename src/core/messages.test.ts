import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  outbound,
  parseInbound,
  PROTOCOL,
  PROTOCOL_VERSION,
  readErrorMessage,
  readEvent,
  readHeight,
  readReady,
  readSubmit,
} from "./messages.ts";

function envelope(overrides: Record<string, unknown> = {}): unknown {
  return {
    protocol: PROTOCOL,
    v: PROTOCOL_VERSION,
    id: "abc",
    kind: "ready",
    payload: {},
    ...overrides,
  };
}

describe("outbound", () => {
  it("封筒に protocol と版と id を入れる", () => {
    const message = outbound("abc", "locale", { locale: "ja" });
    assert.equal(message.protocol, PROTOCOL);
    assert.equal(message.v, PROTOCOL_VERSION);
    assert.equal(message.id, "abc");
    assert.equal(message.kind, "locale");
    assert.deepEqual(message.payload, { locale: "ja" });
  });
});

describe("parseInbound", () => {
  it("自分あての封筒を取り出す", () => {
    const parsed = parseInbound(envelope({ payload: { height: 10 } }), "abc");
    assert.deepEqual(parsed, { kind: "ready", payload: { height: 10 } });
  });

  it("payload が無ければ空オブジェクトにする", () => {
    const parsed = parseInbound(envelope({ payload: undefined }), "abc");
    assert.deepEqual(parsed?.payload, {});
  });

  it("別の埋め込みあての封筒は無視する", () => {
    assert.equal(parseInbound(envelope({ id: "other" }), "abc"), null);
  });

  it("protocol と版が違えば無視する", () => {
    assert.equal(parseInbound(envelope({ protocol: "other" }), "abc"), null);
    assert.equal(parseInbound(envelope({ v: 99 }), "abc"), null);
  });

  it("知らない kind は無視する", () => {
    assert.equal(parseInbound(envelope({ kind: "eval" }), "abc"), null);
    assert.equal(parseInbound(envelope({ kind: 1 }), "abc"), null);
  });

  it("オブジェクトでなければ無視する", () => {
    assert.equal(parseInbound(null, "abc"), null);
    assert.equal(parseInbound("ready", "abc"), null);
    assert.equal(parseInbound(undefined, "abc"), null);
  });
});

describe("readHeight", () => {
  it("正の数を切り上げて返す", () => {
    assert.equal(readHeight({ height: 320.2 }), 321);
  });

  it("数でない・0 以下・無限大は null", () => {
    assert.equal(readHeight({ height: "320" }), null);
    assert.equal(readHeight({ height: 0 }), null);
    assert.equal(readHeight({ height: -1 }), null);
    assert.equal(readHeight({ height: Number.POSITIVE_INFINITY }), null);
    assert.equal(readHeight({}), null);
  });
});

describe("readReady / readSubmit / readEvent", () => {
  it("feature を補い、appVersion は文字列のときだけ入れる", () => {
    assert.deepEqual(readReady({ appVersion: "1.2.3" }, "booking"), {
      feature: "booking",
      appVersion: "1.2.3",
    });
    assert.deepEqual(readReady({ appVersion: 3 }, "booking"), {
      feature: "booking",
    });
  });

  it("submit は uuid と data を拾う", () => {
    assert.deepEqual(readSubmit({ uuid: "u1", data: { n: 1 } }, "booking"), {
      feature: "booking",
      uuid: "u1",
      data: { n: 1 },
    });
    assert.deepEqual(readSubmit({ uuid: 1, data: "x" }, "booking"), {
      feature: "booking",
    });
  });

  it("event は name が無ければ null", () => {
    assert.deepEqual(readEvent({ name: "step", data: { i: 2 } }), {
      name: "step",
      data: { i: 2 },
    });
    assert.equal(readEvent({ name: "" }), null);
    assert.equal(readEvent({}), null);
  });
});

describe("readErrorMessage", () => {
  it("message、無ければ code、どちらも無ければ既定文", () => {
    assert.equal(readErrorMessage({ message: "満席です" }), "満席です");
    assert.equal(readErrorMessage({ code: "sold_out" }), "sold_out");
    assert.ok(readErrorMessage({}).length > 0);
  });
});
