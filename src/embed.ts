// <script src=".../v1/one.js"> で読み込む版の入口。
// ビルドすると IIFE になり、window.In2One だけを生やす。
import { OneEmbed } from "./core/embed.ts";
import {
  EMBED_ATTRIBUTE,
  MOUNTED_ATTRIBUTE,
  optionsFromElement,
} from "./core/dataset.ts";
import type { EmbedOptions, EmbedTarget } from "./core/types.ts";
import { VERSION } from "./core/version.ts";

/** マウント済みの埋め込み。要素から辿れるようにしておく。 */
const mounted = new WeakMap<Element, OneEmbed>();

function createEmbed(options: EmbedOptions): OneEmbed {
  return new OneEmbed(options);
}

function mount(target: EmbedTarget, options: EmbedOptions): OneEmbed {
  return new OneEmbed(options).mount(target);
}

/**
 * data-in2one が付いた要素をすべてマウントする。
 * SPA で後から要素が増えたときは、もう一度呼べばよい（済みの要素は飛ばす）。
 */
function autoMount(root: ParentNode = document): OneEmbed[] {
  const created: OneEmbed[] = [];
  const elements = root.querySelectorAll(
    `[${EMBED_ATTRIBUTE}]:not([${MOUNTED_ATTRIBUTE}])`,
  );
  for (const element of Array.from(elements)) {
    try {
      const embed = new OneEmbed(optionsFromElement(element));
      // 先に印を付ける ── マウント中に走る MutationObserver などから
      // もう一度 autoMount が呼ばれても二重に作らない。
      element.setAttribute(MOUNTED_ATTRIBUTE, "");
      embed.mount(element);
      mounted.set(element, embed);
      created.push(embed);
    } catch (error) {
      element.removeAttribute(MOUNTED_ATTRIBUTE);
      console.error("[in2one]", error);
    }
  }
  return created;
}

/** 自動マウントで作られた埋め込みを要素から取り出す。 */
function getEmbed(target: EmbedTarget): OneEmbed | undefined {
  const element =
    typeof target === "string" ? document.querySelector(target) : target;
  return element ? mounted.get(element) : undefined;
}

/** 自動マウントを取り消す。要素は再び autoMount の対象に戻る。 */
function unmount(target: EmbedTarget): void {
  const element =
    typeof target === "string" ? document.querySelector(target) : target;
  if (!element) return;
  mounted.get(element)?.destroy();
  mounted.delete(element);
  element.removeAttribute(MOUNTED_ATTRIBUTE);
}

const In2One = {
  version: VERSION,
  createEmbed,
  mount,
  autoMount,
  getEmbed,
  unmount,
};

export type In2OneGlobal = typeof In2One;

declare global {
  interface Window {
    In2One: In2OneGlobal;
  }
}

// 2 回読み込まれても最初のものを残す（複数のタグが貼られた埋め込み先を想定）。
window.In2One = window.In2One ?? In2One;

// async / defer どちらで読まれても、DOM が揃ってから一度だけ走らせる。
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => autoMount(), {
    once: true,
  });
} else {
  autoMount();
}

export default In2One;
