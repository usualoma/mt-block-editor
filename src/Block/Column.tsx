import { t } from "../i18n";
import React, { Fragment, useEffect, CSSProperties } from "react";
import { render, unmountComponentAtNode } from "react-dom";
import { EditorContext, useEditorContext, BlocksContext } from "../Context";
import Block, {
  NewFromHtmlOptions,
  EditorOptions,
  SerializeOptions,
  HasBlocks,
} from "../Block";
import AddButton from "../Component/AddButton";
import BlockItem from "../Component/BlockItem";
import BlockIframePreview from "../Component/BlockIframePreview";
import BlockSetupCommon from "../Component/BlockSetupCommon";
import {
  parseContent,
  preParseContent,
  escapeSingleQuoteAttribute,
  ParserContext,
} from "../util";

interface EditorProps extends EditorOptions {
  block: Column;
}

const COMPILE_TIMEOUT = 2000;

const STYLE_HIDDEN: CSSProperties = {
  position: "absolute",
  overflow: "hidden",
  height: "0px",
  border: "none",
};

const Editor: React.FC<EditorProps> = ({
  block,
  focus,
  focusBlock,
  focusDescendant,
  canRemove,
}: EditorProps) => {
  if (
    (block.constructor as typeof Block).typeId !== "core-column" ||
    typeof canRemove === "undefined"
  ) {
    canRemove = block.canRemoveBlock;
  }

  const { editor, setFocusedId, getFocusedId } = useEditorContext();

  const blocksContext = {
    panelBlockTypes: block.panelBlockTypes,
    shortcutBlockTypes: block.shortcutBlockTypes,
    addBlock: (b: Block, index: number | Block) => {
      if (index instanceof Block) {
        index = block.blocks.indexOf(index) + 1;
      }
      editor.addBlock(block, b, index);
      setFocusedId(b.id);
    },
    mergeBlock: (b: Block) => {
      const index = block.blocks.indexOf(b);
      if (editor.mergeBlock(block, b)) {
        setFocusedId(block.blocks[index - 1].id);
      }
    },
    removeBlock: (b: Block) => {
      const index = block.blocks.indexOf(b);
      editor.removeBlock(block, b);
      if (index > 0) {
        setFocusedId(block.blocks[index - 1].id);
      }
    },
    swapBlocks: (dragIndex: number, hoverIndex: number, scroll?: boolean) => {
      if (
        dragIndex === undefined ||
        hoverIndex === undefined ||
        !block.blocks[dragIndex] ||
        !block.blocks[hoverIndex]
      ) {
        return;
      }

      if (scroll) {
        const destEl = document.querySelector(
          `[data-mt-block-editor-block-id="${block.blocks[dragIndex].id}"]`
        );
        if (!destEl) {
          return;
        }

        const rect = destEl.getBoundingClientRect();
        const scrollTop =
          window.pageYOffset || document.documentElement.scrollTop;
        const offsetTop = rect.height + 22;

        window.scrollTo({
          top: scrollTop + (dragIndex > hoverIndex ? -offsetTop : offsetTop),
          behavior: "smooth",
        });
      }

      editor.swapBlocks(block, dragIndex, hoverIndex);
    },
  };

  useEffect(() => {
    block.resetCompiledHtml();

    if (block._html === "") {
      return;
    }

    parseContent(
      preParseContent(block._html),
      editor.factory,
      new ParserContext()
    ).then((blocks) => {
      block._html = "";
      block.blocks = blocks;
      if (blocks[0]) {
        setFocusedId(blocks[0].id);
      }
    });
  });

  const res = (
    <BlocksContext.Provider value={blocksContext}>
      <BlockSetupCommon block={block} keys={["className"]} />
      {block.blocks.map((b, i) => {
        const focusFirstBlock = canRemove !== true && block.blocks.length === 1;
        const focusItem = (focus && focusFirstBlock) || getFocusedId() === b.id;
        return (
          <BlockItem
            key={b.id}
            id={b.id}
            block={b}
            focus={focusItem}
            skipFocusDefault={!(block.showPreview || block.isNewlyAdded)}
            focusBlock={
              !block.showPreview || focus || focusBlock || focusDescendant
            }
            ignoreClickEvent={focusItem && focusFirstBlock}
            index={i}
            parentBlock={block}
            canRemove={canRemove === true}
            showButton={canRemove === true}
          />
        );
      })}
      {canRemove && (
        <div className="mt-be-btn-add-bottom">
          <AddButton
            index={block.blocks.length}
            showShortcuts={block.showShortcuts}
            label={t("+ add new block")}
            labelDirect={t("+ add new {{label}} block", {
              label: "{{label}}",
            })}
          />
        </div>
      )}
    </BlocksContext.Provider>
  );

  if (block.rootBlock) {
    return React.createElement(
      block.rootBlock,
      {
        className: "mt-be-column",
        style: {
          width: "100%",
        },
      },
      res
    );
  } else {
    return res;
  }
};

class Column extends Block implements HasBlocks {
  public static typeId = "core-column";
  public static className = "mt-be-column";
  public static rootBlock: string | null = "div";
  public static selectable = false;
  public static showPreview = true;
  public static get label(): string {
    return t("Column");
  }

  public _html = "";
  public previewHeader = "";
  public showShortcuts = true;
  public blocks: Block[] = [];
  public cancelOngoingCompilationHandlers: (() => void)[] = [];

  public canRemoveBlock = true;
  public panelBlockTypes: string[] | null = null;
  public shortcutBlockTypes: string[] | null = null;

  private isInEditMode = false;

  public constructor(init?: Partial<Column>) {
    super();
    if (init) {
      Object.assign(this, init);
    }
  }

  public childBlocks(): Block[] {
    return this.blocks;
  }

  public get rootBlock(): string | null {
    return (this.constructor as typeof Column).rootBlock;
  }

  public get showPreview(): boolean {
    return (this.constructor as typeof Column).showPreview;
  }

  public resetCompiledHtml(): void {
    this.compiledHtml = "";

    this.cancelOngoingCompilationHandlers.map((h) => {
      h();
    });
    this.cancelOngoingCompilationHandlers = [];
  }

  public editor({
    focus,
    focusBlock,
    focusDescendant,
    canRemove,
  }: EditorOptions): JSX.Element {
    let preview: null | JSX.Element = null;

    if (
      (this.constructor as typeof Column).typeId !== "core-column" &&
      ((this._html === "" &&
        this.blocks.length === 0 &&
        this.effectiveAddableBlockTypes().length === 0) ||
        (!focus && !focusDescendant && !focusBlock))
    ) {
      const iframePreview = (
        <BlockIframePreview
          key={this.id}
          block={this}
          header={this.previewHeader}
          border="none"
        />
      );

      if (this.rootBlock) {
        preview = React.createElement(
          this.rootBlock,
          {
            key: this.id,
            className: "mt-be-column",
            style: {
              width: "100%",
            },
          },
          iframePreview
        );
      } else {
        preview = iframePreview;
      }

      if (this.showPreview) {
        // Reset only when edit mode -> preview mode, once.
        // On before unload "Editor" and before start BlockIframePreview.
        if (this.isInEditMode) {
          this.isInEditMode = false;
          this.resetCompiledHtml();
        }

        return preview;
      }
    }

    this.isInEditMode = true;
    return (
      <Fragment key={this.id}>
        <Editor
          key={this.id}
          block={this}
          focus={focus}
          focusBlock={focusBlock}
          focusDescendant={focusDescendant}
          canRemove={canRemove}
        />
        {preview && <div style={STYLE_HIDDEN}>{preview}</div>}
      </Fragment>
    );
  }

  public isBlank(): boolean {
    return this.blocks.length === 0;
  }

  public async serializedString(opts: SerializeOptions): Promise<string> {
    const classNames = [
      (this.constructor as typeof Column).className,
      this.className,
    ].filter((c) => c);
    const serializedBlocks = await Promise.all(
      this.blocks.map((c) => c.serialize(opts))
    );

    return [
      this.rootBlock
        ? `<${this.rootBlock}${
            classNames.length
              ? ` class='${escapeSingleQuoteAttribute(classNames.join(" "))}'`
              : ""
          }>`
        : "",
      serializedBlocks.join(""),
      this.rootBlock ? `</${this.rootBlock}>` : "",
    ].join("");
  }

  public async compile({ editor }: SerializeOptions): Promise<void> {
    let canceled = false;
    this.cancelOngoingCompilationHandlers.push(() => {
      canceled = true;
    });
    const onBeforeSetCompiledHtml = (): boolean => !canceled;

    const sourceHtml = await this.serializedString({ editor });
    return new Promise((resolve, reject) => {
      let timeoutId: ReturnType<typeof setTimeout> | null = null;

      const div = document.createElement("DIV");
      Object.assign(div.style, STYLE_HIDDEN);
      document.body.appendChild(div);

      const onSetCompiledHtml = (error: Error | null): void => {
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }

        unmountComponentAtNode(div);
        div.remove();
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      };

      const editorContext = {
        editor,
        setFocusedId: () => null,
        getFocusedId: () => null,
      };

      render(
        <EditorContext.Provider value={editorContext}>
          <BlockIframePreview
            key={this.id}
            block={this}
            html={sourceHtml}
            header={this.previewHeader}
            onBeforeSetCompiledHtml={onBeforeSetCompiledHtml}
            onSetCompiledHtml={onSetCompiledHtml}
          />
        </EditorContext.Provider>,
        div
      );

      const opts = editor.opts.block["core-column"] || {};
      timeoutId = setTimeout(async () => {
        if (!canceled) {
          this.compiledHtml ||= sourceHtml;
        }
        onSetCompiledHtml(null);
      }, opts["compile-timeout"] || COMPILE_TIMEOUT);
    });
  }

  public async serialize(opts: SerializeOptions): Promise<string> {
    if (
      (this.constructor as typeof Block).shouldBeCompiled ||
      this.compiledHtml
    ) {
      return super.serialize(opts);
    }

    const m = opts.editor.serializeMeta(this);
    const typeId = (this.constructor as typeof Column).typeId;
    return [
      `<!-- mt-beb t="${typeId}"${
        m ? ` m='${escapeSingleQuoteAttribute(m)}'` : ""
      } -->`,
      await this.serializedString(opts),
      `<!-- /mt-beb -->`,
    ].join("");
  }

  public static async newFromHtml({
    node,
    factory,
    meta,
    context,
  }: NewFromHtmlOptions): Promise<Block> {
    const html = node.hasAttribute("h")
      ? preParseContent(node.getAttribute("h") || "")
      : node.innerHTML
          .replace(/^&lt;div.*?&gt;(<!--\s+mt-beb\s+)/, "$1")
          .replace(/&lt;\/div&gt;(<!--\s+\/mt-beb\s+--)>$/, "$1")
          .replace(
            new RegExp(
              `^&lt;div\\s+class=["']${this.className}[^"']*["']&gt;&lt;/div&gt;$`
            ),
            ""
          );
    const blocks = await parseContent(html, factory, context);
    const compiledHtml = node.hasAttribute("h") ? node.textContent : "";

    if (html && blocks.length === 0) {
      throw Error("This content is not for this block");
    }

    return new this(
      Object.assign(
        { blocks, compiledHtml, _html: "" },
        meta as Partial<Column>
      )
    );
  }

  private effectiveAddableBlockTypes(): string[] {
    if (!this.canRemoveBlock) {
      return [];
    }
    return (this.panelBlockTypes || []).concat(this.shortcutBlockTypes || []);
  }
}

export default Column;
