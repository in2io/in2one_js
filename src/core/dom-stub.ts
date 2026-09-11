// 単体テスト用の最小 DOM。OneEmbed が触る API だけを持つ。
//
// jsdom を入れない ── 実際に使うのは iframe 1 つと message の受け渡しだけで、
// 依存を増やすより、何が呼ばれたかがそのまま見えるほうが試験として読みやすい。

export interface StubFrame {
  tagName: "IFRAME";
  src: string;
  title: string;
  allow: string;
  className: string;
  referrerPolicy: string;
  style: Record<string, string>;
  attributes: Record<string, string>;
  removed: boolean;
  contentWindow: {
    /** postMessage で届いた本体。 */
    posted: unknown[];
    /** 同じ順で記録した targetOrigin。* を使っていないか確かめる。 */
    targets: string[];
    postMessage(data: unknown, targetOrigin: string): void;
  };
  setAttribute(name: string, value: string): void;
  addEventListener(type: string, handler: () => void): void;
  remove(): void;
  /** frame の error イベントを起こす。 */
  fireError(): void;
}

export interface StubElement {
  children: StubFrame[];
  appendChild(child: StubFrame): void;
}

export interface DomStub {
  /** 親 window に届いた message を流し込む。 */
  dispatchMessage(data: unknown, origin: string, source?: unknown): void;
  /** window に張られている message listener の数。 */
  listenerCount(): number;
  container: StubElement;
  lastFrame(): StubFrame;
  restore(): void;
}

/** window / document を差し替える。restore() で元に戻す。 */
export function installDom(origin = "https://shop.example.com"): DomStub {
  const frames: StubFrame[] = [];
  const messageListeners = new Set<(event: unknown) => void>();

  const createFrame = (): StubFrame => {
    const errorHandlers: (() => void)[] = [];
    const frame: StubFrame = {
      tagName: "IFRAME",
      src: "",
      title: "",
      allow: "",
      className: "",
      referrerPolicy: "",
      style: {},
      attributes: {},
      removed: false,
      contentWindow: {
        posted: [],
        targets: [],
        postMessage(data: unknown, targetOrigin: string) {
          frame.contentWindow.posted.push(data);
          frame.contentWindow.targets.push(targetOrigin);
        },
      },
      setAttribute(name, value) {
        frame.attributes[name] = value;
      },
      addEventListener(type, handler) {
        if (type === "error") errorHandlers.push(handler);
      },
      remove() {
        frame.removed = true;
      },
      fireError() {
        for (const handler of errorHandlers) handler();
      },
    };
    frames.push(frame);
    return frame;
  };

  const container: StubElement = {
    children: [],
    appendChild(child) {
      container.children.push(child);
    },
  };

  const previous = {
    window: (globalThis as Record<string, unknown>)["window"],
    document: (globalThis as Record<string, unknown>)["document"],
  };

  (globalThis as Record<string, unknown>)["window"] = {
    location: { origin },
    addEventListener(type: string, handler: (event: unknown) => void) {
      if (type === "message") messageListeners.add(handler);
    },
    removeEventListener(type: string, handler: (event: unknown) => void) {
      if (type === "message") messageListeners.delete(handler);
    },
  };

  (globalThis as Record<string, unknown>)["document"] = {
    readyState: "complete",
    createElement: (tag: string) => {
      if (tag !== "iframe") throw new Error(`未対応のタグ: ${tag}`);
      return createFrame();
    },
    querySelector: (selector: string) =>
      selector === "#target" ? container : null,
    addEventListener() {},
  };

  return {
    dispatchMessage(data, messageOrigin, source) {
      const frame = frames[frames.length - 1];
      const event = {
        data,
        origin: messageOrigin,
        source: source === undefined ? frame?.contentWindow : source,
      };
      for (const handler of Array.from(messageListeners)) handler(event);
    },
    listenerCount: () => messageListeners.size,
    container,
    lastFrame: () => {
      const frame = frames[frames.length - 1];
      if (!frame) throw new Error("iframe がまだ作られていません");
      return frame;
    },
    restore() {
      (globalThis as Record<string, unknown>)["window"] = previous.window;
      (globalThis as Record<string, unknown>)["document"] = previous.document;
    },
  };
}
