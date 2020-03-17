import EventEmitter from "eventemitter3";
import React from "react";
import { render } from "react-dom";
import { InitOptions as InitOptionsI18n } from "i18next";

import { getElementById, preParseContent, parseContent } from "./util";
import Block from "./Block";
import App from "./Component/App";
import BlockFactory from "./BlockFactory";

import "./import-default-blocks";

interface Map {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export interface EditorOptions {
  id: string;
  mode: string;
  stylesheets: Array<string>;
  panelBlockTypes?: string[];
  shortcutBlockTypes?: string[];
  addButtons: Map;
  block: Map;
  i18n: InitOptionsI18n;
}

class Editor extends EventEmitter {
  public id: string;
  public opts: EditorOptions;
  public factory: BlockFactory;
  public blocks: Block[];
  public editorElement: HTMLElement;

  private inputElement: HTMLInputElement;

  public constructor(opts: EditorOptions) {
    super();

    this.id = opts.id;
    this.opts = opts;
    opts.block = opts.block || {};
    opts.i18n = opts.i18n || {};
    opts.addButtons = opts.addButtons || { bottom: true };

    this.factory = new BlockFactory();

    this.inputElement = getElementById(this.id) as HTMLInputElement;
    this.inputElement.style.display = "none";
    if (!this.inputElement.parentNode) {
      throw "error";
    }

    this.editorElement = document.createElement("DIV");
    this.editorElement.classList.add("mt-block-editor");

    this.inputElement.parentNode.insertBefore(
      this.editorElement,
      this.inputElement
    );

    this.blocks = [];

    setTimeout(() => {
      parseContent(preParseContent(this.inputElement.value), this.factory).then(
        blocks => {
          this.blocks = blocks;
          this.emit("onInitializeBlocks", { editor: this, blocks });

          render(
            React.createElement(App, { editor: this }),
            this.editorElement
          );
        }
      );
    }, 0);
  }

  public selectableTypes(): Array<typeof Block> {
    return [...new Set(this.shortcutTypes().concat(this.panelTypes()))];
  }

  public panelTypes(): Array<typeof Block> {
    const types = this.factory.selectableTypes();
    if (!this.opts.panelBlockTypes) {
      return types;
    }
    return this.opts.panelBlockTypes
      .map(typeId => types.find(t => t.typeId === typeId))
      .filter(t => t) as Array<typeof Block>;
  }

  public shortcutTypes(): Array<typeof Block> {
    const types = this.factory.selectableTypes();
    if (!this.opts.shortcutBlockTypes) {
      return [];
    }
    return this.opts.shortcutBlockTypes
      .map(typeId => types.find(t => t.typeId === typeId))
      .filter(t => t) as Array<typeof Block>;
  }

  public addBlock(blocks: Block[], b: Block, index: number): void {
    blocks.splice(index, 0, b);

    this.emit("onChangeBlocks", {
      editor: this,
      blocks,
    });
  }

  public removeBlock(blocks: Block[], block: Block): void {
    this.emit("onRemoveBlock", {
      editor: this,
      blocks,
      block,
    });

    const index = blocks.indexOf(block);
    if (index === -1) {
      return;
    }
    blocks.splice(index, 1);

    this.emit("onChangeBlocks", {
      editor: this,
      blocks,
    });
  }

  public swapBlocks(blocks: Block[], a: number, b: number): void {
    [blocks[a], blocks[b]] = [blocks[b], blocks[a]];

    this.emit("onChangeBlocks", {
      editor: this,
      blocks,
    });
  }

  public async serialize(): Promise<void> {
    const blocks = this.blocks.concat();
    this.emit("onSerialize", {
      editor: this,
      blocks,
    });

    const values = await Promise.all(
      blocks.map(b => b.serialize({ editor: this }))
    );
    this.inputElement.value = values.join("");
  }

  public unload(): void {
    this.emit("onBeforeUnload", {
      editor: this,
    });
    this.editorElement.remove();
    this.inputElement.style.display = "";
    this.emit("onUnload", {
      editor: this,
    });
  }
}

export default Editor;
