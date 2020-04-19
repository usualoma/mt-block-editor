import React, { RefObject } from "react";
import createDOMPurify from "dompurify";
import Block from "./Block";
import BlockFactory from "./BlockFactory";
import Text from "./Block/Text";
import Column from "./Block/Column";

export const mediaBreakPoint = 991.5;

export function getElementById(id: string): HTMLElement {
  const e = document.getElementById(id);
  if (!e) {
    throw Error(`${id} is not found`);
  }
  return e;
}

export function getNodeValue(e: Element): string {
  return (e && e.childNodes[0] ? e.childNodes[0].nodeValue : "") || "";
}

export function getNodeValueByTagName(e: Element, name: string): string {
  return [...e.getElementsByTagName(name)].map((e) => getNodeValue(e)).join("");
}

const _entityMap = {
  "\t": "&#x08;",
  "\n": "&#x0A;",
  "\r": "&#x0D;",
  "&": "&amp;",
  "'": "&#x27;",
  "`": "&#x60;",
  '"': "&quot;",
  "<": "&lt;",
  ">": "&gt;",
} as { [key: string]: string };
export function escapeSingleQuoteAttribute(string: string): string {
  if (typeof string !== "string") {
    return string;
  }
  return string.replace(/[&'\t\n\r]/g, (match) => _entityMap[match]);
}

export function preParseContent(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/&lt;!--\s+(\/?mt-beb.*?)--&gt;/g, (all, tag) => {
      return `<${tag
        .replace(/&gt;/g, ">")
        .replace(/&lt;/g, "<")
        .replace(/&amp;/g, "&")}>`;
    });
}

export async function parseContent(
  value: string,
  factory: BlockFactory
): Promise<Block[]> {
  if (!value) {
    return [];
  }

  const domparser = new DOMParser();
  const doc = domparser.parseFromString(
    `<xml>${value.replace(
      // eslint-disable-next-line no-control-regex
      /[^\x09\x0A\x0D\x20-\xFF\x85\xA0-\uD7FF\uE000-\uFDCF\uFDE0-\uFFFD]/gm,
      ""
    )}</xml>`,
    "application/xml"
  );

  if (!doc.children[0]) {
    return [];
  }

  const children = doc.children[0].children;

  // TODO: verify
  const blocks = [];
  for (let i = 0; i < children.length; i++) {
    const node = children[i];
    const typeId = node.getAttribute("t") || "core-text";
    const meta = JSON.parse(node.getAttribute("m") || "{}");

    let html = node.getAttribute("h") || "";
    if (!html && node.textContent) {
      let c = node.textContent;
      if (meta.className) {
        c = c.replace(
          /^(<[^>]+)( class=")([^"]+)"/,
          (m, tag, prefix, classNames) => {
            const filtered = classNames
              .split(/\s+/)
              .filter((c: string) => c !== meta.className)
              .join(" ");

            if (filtered) {
              return `${tag}${prefix}${filtered}"`;
            } else {
              return tag;
            }
          }
        );
      }
      html = c;
    }

    const param = {
      html,
      node,
      factory,
      meta,
    };

    const t =
      factory.types().find((t: typeof Block) => t.typeId === typeId) || Column;
    const block = await t
      .newFromHtml(param)
      .catch(() => Text.newFromHtml(param));
    blocks.push(block);
  }

  return blocks;
}

export const nl2br = (() => {
  const regex = /(\r\n|\r|\n)/g;

  return function nl2br(str: string): Array<string | JSX.Element> {
    if (typeof str !== "string") {
      return str;
    }

    return str.split(regex).map((line, index) => {
      if (line.match(regex)) {
        return React.createElement("br", { key: index });
      }
      return line;
    });
  };
})();

export function findDescendantBlock(
  block: Block,
  id: string | null
): Block | null {
  if (!id) {
    return null;
  }

  const childBlocks = block.childBlocks();
  for (let i = 0; i < childBlocks.length; i++) {
    const b = childBlocks[i];
    if (b.id === id) {
      return b;
    }

    const cb = findDescendantBlock(b, id);
    if (cb) {
      return cb;
    }
  }

  return null;
}

const DOMPurify = createDOMPurify(window);
export function sanitize(str: string): string {
  return DOMPurify.sanitize(str);
}

const _isIos = /ip(hone|(o|a)d)/i.test(navigator.userAgent);
export function isIos(): boolean {
  return _isIos;
}

// FIXME
let _isTouchDevice = /ip(hone|(o|a)d)|android/i.test(navigator.userAgent);
document.addEventListener("touchstart", () => {
  _isTouchDevice = true;
});
export function isTouchDevice(): boolean {
  return _isTouchDevice;
}

export function focusIfIos(ref: RefObject<HTMLElement>): void {
  if (!isIos()) {
    return;
  }

  if (ref.current === null) {
    return;
  }

  ref.current.focus();
}
