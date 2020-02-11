/*
 * Got a lots of codes from examles of react-dnd.
 * http://react-dnd.github.io/react-dnd/examples
 */

import React, { useRef, createRef } from "react";
import root from "react-shadow";
import { useEditorContext, useBlocksContext } from "../Context";
import Block from "../Block";
import Text from "../Block/Text";
import Columns from "../Block/Columns";
import Column from "../Block/Column";
import AddButton from "./AddButton";
import RemoveButton from "./RemoveButton";
import { findDescendantBlock } from "../util";

import { useDrag, useDrop, DropTargetMonitor } from "react-dnd";
import { XYCoord } from "dnd-core";
import { DragObjectWithType } from "react-dnd/lib/interfaces";

interface DragObject extends DragObjectWithType {
  index: number;
}

interface Props {
  block: Block;
  focus: boolean;
  id: string;
  index: number;
  canRemove: boolean;
  showButton: boolean;
  showLeftButton?: boolean;
  parentBlock?: Block;
}

interface BlockInstance {
  getNode(): HTMLDivElement | null;
}

const BlockItem: React.FC<Props> = ({
  id,
  block,
  focus,
  index,
  canRemove,
  showButton,
  showLeftButton,
  parentBlock,
}: Props) => {
  const { swapBlocks } = useBlocksContext();
  const { editor, getFocusedId, setFocusedId } = useEditorContext();
  const b = block;
  const i = index;

  const ref = useRef<HTMLDivElement>(null);
  const [, drop] = useDrop({
    accept: parentBlock ? parentBlock.id : "block",
    hover(item: DragObject, monitor: DropTargetMonitor) {
      if (!ref.current) {
        return;
      }
      const dragIndex = item.index;
      const hoverIndex = index;

      // Don't replace items with themselves
      if (dragIndex === hoverIndex) {
        return;
      }

      // Determine rectangle on screen
      const hoverBoundingRect = ref.current.getBoundingClientRect();

      // Get vertical middle
      const hoverMiddleY =
        (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2;

      // Determine mouse position
      const clientOffset = monitor.getClientOffset();

      // Get pixels to the top
      const hoverClientY = (clientOffset as XYCoord).y - hoverBoundingRect.top;

      // Only perform the move when the mouse has crossed half of the items height
      // When dragging downwards, only move when the cursor is below 50%
      // When dragging upwards, only move when the cursor is above 50%

      // Dragging downwards
      if (dragIndex < hoverIndex && hoverClientY < hoverMiddleY) {
        return;
      }

      // Dragging upwards
      if (dragIndex > hoverIndex && hoverClientY > hoverMiddleY) {
        return;
      }

      // Time to actually perform the action
      if (dragIndex < hoverIndex) {
        for (let i = dragIndex; i < hoverIndex; i++) {
          swapBlocks(i, i + 1);
        }
      } else {
        for (let i = dragIndex; i > hoverIndex; i--) {
          swapBlocks(i, i - 1);
        }
      }

      // Note: we're mutating the monitor item here!
      // Generally it's better to avoid mutations,
      // but it's good here for the sake of performance
      // to avoid expensive index searches.
      item.index = hoverIndex;
    },
  });

  const [{ isDragging }, drag, preview] = useDrag({
    item: { type: parentBlock ? parentBlock.id : "block", id, index },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    collect: (monitor: any) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const opacity = isDragging ? 0 : 1;
  preview(drop(ref));
  const focusDescendant = !!findDescendantBlock(b, getFocusedId());
  const clickBlockTargetRef = createRef<HTMLElement>();

  const ed = b.editor({
    focus,
    focusDescendant,
    canRemove: canRemove === true,
    parentBlock,
    clickBlockTargetRef,
  });

  return (
    <div
      key={b.id}
      data-mt-block-editor-block-id={b.id}
      onClick={ev => {
        ev.preventDefault();
        ev.stopPropagation();
        ev.nativeEvent.stopImmediatePropagation();

        if (clickBlockTargetRef.current) {
          clickBlockTargetRef.current.click();
        } else {
          setFocusedId(b.id);
        }
      }}
      className={`block-wrapper ${focus ? "focus" : ""}`}
      style={{ opacity }}
      ref={ref}
    >
      {showButton && (
        <div className="btn-add-wrapper">
          <AddButton index={i} />
        </div>
      )}
      {showButton && (
        <div className="btn-move-wrapper">
          <button
            type="button"
            className="btn-up"
            onClick={() => swapBlocks(index, index - 1, true)}
          ></button>
          <button type="button" className="btn-move" ref={drag}></button>
          <button
            type="button"
            className="btn-down"
            onClick={() => swapBlocks(index, index + 1, true)}
          ></button>
        </div>
      )}
      {showLeftButton && (
        <div className="btn-add-left">
          <div style={{ position: "relative" }}>
            <AddButton index={i} className="block-list-wrapper--right" />
          </div>
        </div>
      )}
      <div className="block">
        {focus ||
        (b instanceof Text && b.isBlank()) ||
        focusDescendant ||
        b instanceof Column ||
        b instanceof Columns ? (
          ed
        ) : (
          <root.div>
            <div className="entry">
              {editor.opts.stylesheets.map(s => (
                <link rel="stylesheet" key={s} href={s} />
              ))}
              {ed}
            </div>
          </root.div>
        )}
      </div>
      {showButton && (
        <div className="btn-remove-wrapper">
          <RemoveButton block={b} />
        </div>
      )}
    </div>
  );
};

export default BlockItem;
