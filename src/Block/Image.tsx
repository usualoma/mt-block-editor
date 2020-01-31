import { t } from "../i18n";
import React, { useState } from "react";
import Block, { NewFromHtmlOptions, EditorOptions } from "../Block";
import icon from "../img/icon/image.svg";
import BlockSetupCommon from "../Component/BlockSetupCommon";
import BlockLabel from "../Component/BlockLabel";

interface EditorProps {
  block: Image;
}

const Editor: React.FC<EditorProps> = ({ block }: EditorProps) => {
  const [url, setUrl] = useState(block.url);

  return (
    <div>
      <BlockSetupCommon block={block} />
      <BlockLabel block={block}>
        {url && <img src={url} style={{ maxWidth: "100%" }} />}
        <input
          type="url"
          onChange={ev => {
            block.url = ev.target.value;
            setUrl(ev.target.value);
          }}
          value={url}
        />
      </BlockLabel>
    </div>
  );
};

class Image extends Block {
  public static typeId = "core-image";
  public static selectable = true;
  public static icon = icon;
  public static get label(): string {
    return t("Image");
  }

  public url = "";

  public constructor(init?: Partial<Image>) {
    super();
    if (init) {
      Object.assign(this, init);
    }
  }

  public editor({ focus }: EditorOptions): JSX.Element {
    return focus ? <Editor key={this.id} block={this} /> : this.html();
  }

  public html(): JSX.Element {
    return <img src={this.url} style={{ maxWidth: "100%" }} />;
  }

  public static canNewFromFile(): boolean {
    return true;
  }

  public static async newFromFile(file: File): Promise<Block> {
    return new Image({
      url: URL.createObjectURL(file),
    });
  }

  public static async newFromHtml({
    html,
  }: NewFromHtmlOptions): Promise<Block> {
    const domparser = new DOMParser();
    const doc = domparser.parseFromString(html, "text/html");

    return new Image({
      url: (doc.querySelector("IMG") as HTMLImageElement).src || "",
    });
  }
}

export default Image;
