import React, { useState, useEffect } from "react";
import Block from "../Block";
import { querySelector } from "../util";
import { useEditorContext } from "../Context";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function recursiveMap(children: any, fn: (child: JSX.Element) => void): any {
  return React.Children.map(children, (child: JSX.Element) => {
    // if (!React.isValidElement(child)) {
    //   return child;
    // }
    if (!child || !child.props) {
      return child;
    }

    if (child.props.children) {
      child = React.cloneElement(child, {
        children: recursiveMap(child.props.children, fn),
      });
    }

    return fn(child);
  });
}

interface EditorProps {
  block: Block;
}

interface MapObject {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export default function useEditorUtil(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  editor: React.FC<any>,
  props: EditorProps
): JSX.Element {
  const block: MapObject = props.block as MapObject;
  const [, setBlock] = useState(Object.assign({}, block));
  const children = editor(props);
  const { setFocusedId } = useEditorContext();

  useEffect(() => {
    const blockEl = querySelector(
      document,
      `[data-mt-block-editor-block-id="${block.id}"]`
    );
    const focusEl = querySelector(
      blockEl,
      `[data-mt-block-editor-focus-default]`
    );
    const activeEl = document.activeElement;
    if (
      activeEl &&
      activeEl.closest(`[data-mt-block-editor-block-id="${block.id}"]`)
    ) {
      return;
    }
    focusEl.focus();
  });

  return recursiveMap(children, (child: JSX.Element) => {
    if (
      (child.type === "input" ||
        child.type === "textarea" ||
        child.type === "select") &&
      !child.props.onChange
    ) {
      const n = child.props.name;
      const onKeyDown = (ev: KeyboardEvent): void => {
        const target = ev.target as HTMLElement;
        if (!(target instanceof HTMLInputElement)) {
          return;
        }
        if (ev.keyCode === 13) {
          ev.preventDefault();
          setFocusedId(null); // blur
        }
      };

      return React.cloneElement(child, {
        value: block[n],
        "data-default-rows": child.props.rows || 5,
        rows: child.props.rows || 5,
        onChange: (ev: InputEvent) => {
          if (!ev.target) {
            return;
          }
          const target = ev.target as HTMLElement;
          const value = (target as HTMLInputElement).value;
          block[n] = value;

          (target as HTMLTextAreaElement).rows = Math.max(
            parseInt(target.dataset.defaultRows || "0", 10),
            value.split(/\r|\n/).length
          );

          setBlock(Object.assign({}, block));
        },
        onKeyDown: child.props.onKeyDown || onKeyDown,
      });
    } else {
      return child;
    }
  });
}
