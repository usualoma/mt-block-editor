import Editor from "../src/Editor";
import Text from "../src/Block/Text";
import UndoManager from "../src/UndoManager";

const editorContextProps = {
  editor: {} as Editor,
  setFocusedId: (id, opts) => {},
  getFocusedId: () => null,
};

test("constructor", () => {
  const manager = new UndoManager();
  expect(manager).toBeInstanceOf(UndoManager);
});

describe("add/canUndo/canRedo", () => {
  describe("simple case", () => {
    const manager = new UndoManager();

    let count = 0;
    const history = {
      block: new Text(),
      data: {},
      handlers: {
        id: Symbol("test"),
        undo() {
          count++;
        },
        redo() {
          count--;
        },
      },
    };

    expect(manager.canUndo()).toBe(false);
    expect(manager.canRedo()).toBe(false);

    manager.add(history);
    manager.add(history);
    expect(manager.canUndo()).toBe(true);
    expect(manager.canRedo()).toBe(false);

    manager.undo(editorContextProps);
    expect(manager.canUndo()).toBe(true);
    expect(manager.canRedo()).toBe(true);
    expect(count).toBe(1);

    manager.undo(editorContextProps);
    expect(manager.canUndo()).toBe(false);
    expect(manager.canRedo()).toBe(true);
    expect(count).toBe(2);

    manager.redo(editorContextProps);
    expect(manager.canUndo()).toBe(true);
    expect(manager.canRedo()).toBe(true);
    expect(count).toBe(1);

    manager.redo(editorContextProps);
    expect(manager.canUndo()).toBe(true);
    expect(manager.canRedo()).toBe(false);
    expect(count).toBe(0);
  });

  describe("merge", () => {
    const manager = new UndoManager();

    let count = 0;
    const history = {
      block: new Text(),
      handlers: {
        id: Symbol("test"),
        merge(a, b) {
          a.data.c *= b.data.c;
          return a;
        },
        undo(hist) {
          count += hist.data.c;
        },
        redo() {
          count += hist.data.c;
        },
      },
    };

    manager.add(Object.assign({}, history, { data: { c: 2 } }));
    manager.undo(editorContextProps);
    expect(count).toBe(2);

    count = 0;

    manager.add(Object.assign({}, history, { data: { c: 2 } }));
    manager.add(Object.assign({}, history, { data: { c: 2 } })); // merged
    manager.add(Object.assign({}, history, { data: { c: 2 } })); // merged
    manager.undo(editorContextProps);
    expect(count).toBe(8);
  });

  describe("dedup (by merge)", () => {
    const manager = new UndoManager();

    let count = 0;
    const history = {
      block: new Text(),
      handlers: {
        id: Symbol("test"),
        merge(a, b) {
          return a.data.c === b.data.c ? a : null;
        },
        undo(hist) {
          count += hist.data.c;
        },
        redo() {
          count += hist.data.c;
        },
      },
    };

    manager.add(Object.assign({}, history, { data: { c: 1 } }));
    manager.add(Object.assign({}, history, { data: { c: 2 } }));
    manager.add(Object.assign({}, history, { data: { c: 2 } })); // dedupped
    manager.add(Object.assign({}, history, { data: { c: 3 } }));

    manager.undo(editorContextProps);
    expect(count).toBe(3);

    manager.undo(editorContextProps);
    expect(count).toBe(5);

    manager.undo(editorContextProps);
    expect(count).toBe(6);
  });

  describe("limit option", () => {
    test.each([50, 100])("limit: %i", (limit) => {
      const manager = new UndoManager({ limit });

      let count = 0;
      const history = {
        block: new Text(),
        data: {},
        handlers: {
          id: Symbol("test"),
          undo() {
            count++;
          },
          redo() {
            count--;
          },
        },
      };
      for (let i = 0; i < 200; i++) {
        manager.add(history);
      }
      for (let i = 0; i < 200; i++) {
        manager.undo(editorContextProps);
      }

      expect(count).toBe(limit);
    });
  });
});

describe("undo/redo", () => {
  test("simple case", () => {
    const manager = new UndoManager();

    let count = 0;
    const history = {
      block: new Text(),
      data: {},
      handlers: {
        id: Symbol("test"),
        undo() {
          count++;
        },
        redo() {
          count--;
        },
      },
    };

    for (let i = 0; i < 10; i++) {
      manager.add(history);
    }

    manager.undo(editorContextProps);
    expect(count).toBe(1);

    manager.undo(editorContextProps);
    expect(count).toBe(2);

    manager.redo(editorContextProps);
    expect(count).toBe(1);

    manager.redo(editorContextProps);
    expect(count).toBe(0);
  });

  test("add method is ignored while undo/redo", () => {
    const manager = new UndoManager();

    let count = 0;
    const errorHistory = {
      block: new Text(),
      data: {},
      handlers: {
        id: Symbol("test"),
        undo() {
          throw "Error";
        },
        redo() {
          throw "Error";
        },
      },
    };
    const history = {
      block: new Text(),
      data: {},
      handlers: {
        id: Symbol("test"),
        undo() {
          manager.add(errorHistory);
          count++;
        },
        redo() {
          manager.add(errorHistory);
          count--;
        },
      },
    };

    for (let i = 0; i < 10; i++) {
      manager.add(history);
    }

    manager.undo(editorContextProps);
    expect(count).toBe(1);

    manager.undo(editorContextProps);
    expect(count).toBe(2);

    manager.redo(editorContextProps);
    expect(count).toBe(1);

    manager.redo(editorContextProps);
    expect(count).toBe(0);
  });
});

test("generateGroup", () => {
  const manager = new UndoManager();
  expect(typeof manager.generateGroup()).toBe("number");
});

describe("group", () => {
  let manager;
  let group;
  let count;

  const history = {
    block: new Text(),
    data: {},
    handlers: {
      id: Symbol("test"),
      undo() {
        count++;
      },
      redo() {
        count--;
      },
    },
  };

  beforeEach(() => {
    manager = new UndoManager();
    group = manager.generateGroup();
    count = 0;
  });

  describe("by generateGroup", () => {
    test("grouped", () => {
      manager.add(Object.assign({}, history, { group }));
      manager.add(Object.assign({}, history, { group }));

      manager.undo(editorContextProps);
      expect(count).toBe(2);

      manager.redo(editorContextProps);
      expect(count).toBe(0);
    });

    test("interrupted", () => {
      manager.add(Object.assign({}, history, { group }));
      manager.add(Object.assign({}, history, { group }));
      manager.add(Object.assign({}, history));
      manager.add(Object.assign({}, history, { group }));
      manager.add(Object.assign({}, history, { group }));
      manager.add(Object.assign({}, history, { group }));

      manager.undo(editorContextProps);
      expect(count).toBe(3);

      manager.undo(editorContextProps);
      expect(count).toBe(4);

      manager.undo(editorContextProps);
      expect(count).toBe(6);
    });
  });

  describe("by beginGrouping/endGrouping", () => {
    test("grouped", () => {
      manager.beginGrouping();
      manager.add(Object.assign({}, history));
      manager.add(Object.assign({}, history));
      manager.endGrouping();

      manager.undo(editorContextProps);
      expect(count).toBe(2);

      manager.redo(editorContextProps);
      expect(count).toBe(0);
    });

    test("interrupted", () => {
      manager.beginGrouping();
      manager.add(Object.assign({}, history));
      manager.add(Object.assign({}, history));
      manager.endGrouping();
      manager.add(Object.assign({}, history));
      manager.beginGrouping();
      manager.add(Object.assign({}, history));
      manager.add(Object.assign({}, history));
      manager.add(Object.assign({}, history));
      manager.endGrouping();
      manager.add(Object.assign({}, history));

      manager.undo(editorContextProps);
      expect(count).toBe(1);

      manager.undo(editorContextProps);
      expect(count).toBe(4);

      manager.undo(editorContextProps);
      expect(count).toBe(5);

      manager.undo(editorContextProps);
      expect(count).toBe(7);
    });
  });
});
