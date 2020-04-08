import { createContext, useContext, ReactNode } from "react";
import Editor from "./Editor";
import Block from "./Block";

interface EditorContextProps {
  editor: Editor;
  setFocusedId: (id: string | null) => void;
  getFocusedId: () => string | null;
}
export const EditorContext = createContext<EditorContextProps | null>(null);
export function useEditorContext(): EditorContextProps {
  const c = useContext(EditorContext);
  if (!c) {
    throw Error("EditorContext is not initialized");
  }
  return c;
}

interface BlocksContextProps {
  addableBlockTypes: string[] | null;
  addBlock: (b: Block, index: number | Block) => void;
  removeBlock: (b: Block) => void;
  swapBlocks: (a: number, b: number, scroll?: boolean) => void;
}
export const BlocksContext = createContext<BlocksContextProps | null>(null);
export function useBlocksContext(): BlocksContextProps {
  const c = useContext(BlocksContext);
  if (!c) {
    throw Error("BlocksContext is not initialized");
  }
  return c;
}

export interface ToolbarProps {
  id: string;
  className: string;
  children: ReactNode;
}
interface BlockContextProps {
  setToolbarProps: (props: ToolbarProps) => void;
}
export const BlockContext = createContext<BlockContextProps | null>(null);
export function useBlockContext(): BlockContextProps {
  const c = useContext(BlockContext);
  if (!c) {
    throw Error("BlocksContext is not initialized");
  }
  return c;
}
