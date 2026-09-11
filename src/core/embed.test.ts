import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";
import { installDom, type DomStub } from "./dom-stub.ts";
import { OneEmbed } from "./embed.ts";
import { EmbedError } from "./errors.ts";
import { PROTOCOL, PROTOCOL_VERSION } from "./messages.ts";

const APP_ORIGIN = "https://app.example.com";

let dom: DomStub | null = null;
const created: OneEmbed[] = [];

/**
 * 既定では読み込み待ちを切る（loadTimeout: 0）。本物の setTimeout が
 * 20 秒ぶら下がると、そのぶん test runner が終われないため。
 */
function setup(options: Record<string, unknown> = {}): {
  embed: OneEmbed;
  dom: DomStub;
} {
  dom = installDom();
  const embed = new OneEmbed({
    feature: "booking",
    token: "pk_test",
    appOrigin: APP_ORIGIN,
    loadTimeout: 0,
    ...options,
  });
  created.push(embed);
  return { embed, dom };
}

/** iframe から届いた体で親へ message を流す。 */
function fromApp(
  stub: DomStub,
  embed: OneEmbed,
  kind: string,
  payload: Record<string, unknown> = {},
  overrides: { origin?: string; id?: string; source?: unknown } = {},
): void {
  stub.dispatchMessage(
    {
      protocol: PROTOCOL,
      v: PROTOCOL_VERSION,
      id: overrides.id ?? embed.id,
      kind,
      payload,
    },
    overrides.origin ?? APP_ORIGIN,
    overrides.source,
  );
}

afterEach(() => {
  for (const embed of created.splice(0)) embed.destroy();
  dom?.restore();
  dom = null;
});

describe("OneEmbed.mount", () => {
  it("iframe を作って埋め込み先へ入れる", () => {
    const { embed, dom: stub } = setup({ className: "frame", height: 500 });
    embed.mount("#target");

    const frame = stub.lastFrame();
    assert.equal(stub.container.children.length, 1);
    assert.equal(frame.className, "frame");
    assert.equal(frame.style["height"], "500px");
    assert.equal(frame.style["width"], "100%");
    assert.equal(frame.referrerPolicy, "strict-origin");
    assert.ok(frame.attributes["sandbox"]?.includes("allow-scripts"));
    assert.ok(
      !frame.attributes["sandbox"]?.includes("allow-top-navigation "),
      "無条件のトップ遷移は許さない",
    );
    assert.ok(frame.src.startsWith(`${APP_ORIGIN}/embed/v1/booking?`));
    assert.ok(frame.src.includes(`id=${embed.id}`));
    assert.equal(embed.isMounted(), true);
  });

  it("要素そのものも受け取る", () => {
    const { embed, dom: stub } = setup();
    embed.mount(stub.container as unknown as Element);
    assert.equal(stub.container.children.length, 1);
  });

  it("見つからないセレクタは弾く", () => {
    const { embed } = setup();
    assert.throws(() => embed.mount("#missing"), EmbedError);
  });

  it("二重マウントは弾く", () => {
    const { embed } = setup();
    embed.mount("#target");
    assert.throws(() => embed.mount("#target"), EmbedError);
  });

  it("destroy 済みは再利用できない", () => {
    const { embed } = setup();
    embed.destroy();
    assert.throws(() => embed.mount("#target"), EmbedError);
  });
});

describe("送信のキュー", () => {
  it("ready の前は溜めて、ready の後にまとめて送る", () => {
    const { embed, dom: stub } = setup();
    embed.mount("#target");
    embed.setLocale("ja");
    embed.setPrefill({ email: "guest@example.com" });

    const posted = stub.lastFrame().contentWindow.posted;
    assert.equal(posted.length, 0, "ready 前は送らない");

    fromApp(stub, embed, "ready");
    assert.equal(posted.length, 2);
    assert.deepEqual(posted[0], {
      protocol: PROTOCOL,
      v: PROTOCOL_VERSION,
      id: embed.id,
      kind: "locale",
      payload: { locale: "ja" },
    });
  });

  it("ready の後は直接送る", () => {
    const { embed, dom: stub } = setup();
    embed.mount("#target");
    fromApp(stub, embed, "ready");
    embed.setTheme("dark");
    assert.equal(stub.lastFrame().contentWindow.posted.length, 1);
  });

  it("宛先を app の origin に固定する（* を使わない）", () => {
    const { embed, dom: stub } = setup();
    embed.mount("#target");
    fromApp(stub, embed, "ready");
    embed.setLocale("ja");
    assert.deepEqual(stub.lastFrame().contentWindow.targets, [APP_ORIGIN]);
  });

  it("prefill の undefined は落とす", () => {
    const { embed, dom: stub } = setup();
    embed.mount("#target");
    fromApp(stub, embed, "ready");
    embed.setPrefill({ email: "a@example.com", tel: undefined });
    const message = stub.lastFrame().contentWindow.posted[0] as {
      payload: { prefill: Record<string, unknown> };
    };
    assert.deepEqual(message.payload.prefill, { email: "a@example.com" });
  });

  it("destroy の後は送らない", () => {
    const { embed, dom: stub } = setup();
    embed.mount("#target");
    fromApp(stub, embed, "ready");
    const frame = stub.lastFrame();
    embed.destroy();
    embed.setLocale("ja");
    assert.equal(frame.contentWindow.posted.length, 0);
  });
});

describe("受信", () => {
  it("resize で iframe の高さを合わせる", () => {
    const { embed, dom: stub } = setup();
    const onResize = mock.fn();
    embed.on("resize", onResize);
    embed.mount("#target");
    fromApp(stub, embed, "resize", { height: 812.4 });

    assert.equal(stub.lastFrame().style["height"], "813px");
    assert.equal(onResize.mock.callCount(), 1);
  });

  it("autoResize が false なら高さを触らない", () => {
    const { embed, dom: stub } = setup({ autoResize: false, height: 400 });
    const onResize = mock.fn();
    embed.on("resize", onResize);
    embed.mount("#target");
    fromApp(stub, embed, "resize", { height: 900 });

    assert.equal(stub.lastFrame().style["height"], "400px");
    assert.equal(onResize.mock.callCount(), 1, "通知はする");
  });

  it("別 origin からの message は無視する", () => {
    const { embed, dom: stub } = setup();
    const onReady = mock.fn();
    embed.on("ready", onReady);
    embed.mount("#target");
    fromApp(stub, embed, "ready", {}, { origin: "https://evil.example.com" });
    assert.equal(onReady.mock.callCount(), 0);
  });

  it("別の window からの message は無視する", () => {
    const { embed, dom: stub } = setup();
    const onReady = mock.fn();
    embed.on("ready", onReady);
    embed.mount("#target");
    fromApp(stub, embed, "ready", {}, { source: { posted: [] } });
    assert.equal(onReady.mock.callCount(), 0);
  });

  it("別の埋め込みあての message は無視する", () => {
    const { embed, dom: stub } = setup();
    const onReady = mock.fn();
    embed.on("ready", onReady);
    embed.mount("#target");
    fromApp(stub, embed, "ready", {}, { id: "someone-else" });
    assert.equal(onReady.mock.callCount(), 0);
  });

  it("submit と event を配る", () => {
    const onSubmit = mock.fn();
    const onEvent = mock.fn();
    const { embed, dom: stub } = setup({ onSubmit, onEvent });
    embed.mount("#target");
    fromApp(stub, embed, "submit", { uuid: "bk_1" });
    fromApp(stub, embed, "event", { name: "step", data: { index: 2 } });

    assert.deepEqual(onSubmit.mock.calls[0]?.arguments[0], {
      feature: "booking",
      uuid: "bk_1",
    });
    assert.deepEqual(onEvent.mock.calls[0]?.arguments[0], {
      name: "step",
      data: { index: 2 },
    });
  });

  it("アプリ側のエラーを onError へ渡す", () => {
    const onError = mock.fn();
    const { embed, dom: stub } = setup({ onError });
    embed.mount("#target");
    fromApp(stub, embed, "error", { code: "sold_out", message: "満席です" });

    const error = onError.mock.calls[0]?.arguments[0] as EmbedError;
    assert.equal(error.code, "app_error");
    assert.equal(error.message, "満席です");
  });

  it("on() の解除が効く", () => {
    const { embed, dom: stub } = setup();
    const onResize = mock.fn();
    const off = embed.on("resize", onResize);
    embed.mount("#target");
    fromApp(stub, embed, "resize", { height: 100 });
    off();
    fromApp(stub, embed, "resize", { height: 200 });
    assert.equal(onResize.mock.callCount(), 1);
  });
});

describe("読み込みの失敗", () => {
  it("iframe の error を load_failed にする", () => {
    const onError = mock.fn();
    const { embed, dom: stub } = setup({ onError });
    embed.mount("#target");
    stub.lastFrame().fireError();

    const error = onError.mock.calls[0]?.arguments[0] as EmbedError;
    assert.equal(error.code, "load_failed");
  });

  it("ready が来なければ load_timeout", (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const onError = mock.fn();
    const { embed } = setup({ onError, loadTimeout: 5000 });
    embed.mount("#target");
    t.mock.timers.tick(5001);

    const error = onError.mock.calls[0]?.arguments[0] as EmbedError;
    assert.equal(error.code, "load_timeout");
  });

  it("ready が来ていれば timeout は起きない", (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const onError = mock.fn();
    const { embed, dom: stub } = setup({ onError, loadTimeout: 5000 });
    embed.mount("#target");
    fromApp(stub, embed, "ready");
    t.mock.timers.tick(5001);
    assert.equal(onError.mock.callCount(), 0);
  });

  it("loadTimeout が 0 なら待たない", (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const onError = mock.fn();
    const { embed } = setup({ onError, loadTimeout: 0 });
    embed.mount("#target");
    t.mock.timers.tick(60000);
    assert.equal(onError.mock.callCount(), 0);
  });
});

describe("destroy", () => {
  it("iframe と listener を片付ける", () => {
    const { embed, dom: stub } = setup();
    embed.mount("#target");
    assert.equal(stub.listenerCount(), 1);

    embed.destroy();
    assert.equal(stub.lastFrame().removed, true);
    assert.equal(stub.listenerCount(), 0);
    assert.equal(embed.isMounted(), false);
  });

  it("二重に呼んでも落ちない", () => {
    const { embed } = setup();
    embed.mount("#target");
    embed.destroy();
    embed.destroy();
  });
});
