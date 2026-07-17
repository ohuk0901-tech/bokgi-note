import { Extension, type Editor } from "@tiptap/core";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import StarterKit from "@tiptap/starter-kit";

const ListTabGuard = Extension.create({
  name: "listTabGuard",

  addKeyboardShortcuts() {
    return {
      Tab: () => handleListTab(this.editor, "in"),
      "Shift-Tab": () => handleListTab(this.editor, "out"),
    };
  },
});

export function createRichTextExtensions(options: { listTabGuard?: boolean } = {}) {
  return [
    StarterKit.configure({
      bulletList: {
        HTMLAttributes: { class: "tiptap-bullet-list" },
      },
      orderedList: {
        HTMLAttributes: { class: "tiptap-ordered-list" },
      },
    }),
    TaskList.configure({
      HTMLAttributes: { class: "tiptap-task-list" },
    }),
    TaskItem.configure({
      nested: true,
      HTMLAttributes: { class: "tiptap-task-item" },
    }),
    ...(options.listTabGuard ? [ListTabGuard] : []),
  ];
}

function handleListTab(editor: Editor, direction: "in" | "out") {
  const isTaskItem = editor.isActive("taskItem");
  const isTextList =
    editor.isActive("listItem") ||
    editor.isActive("bulletList") ||
    editor.isActive("orderedList");

  if (!isTaskItem && !isTextList) return false;

  if (direction === "in") {
    if (isTaskItem) {
      editor.chain().focus().sinkListItem("taskItem").run();
    } else {
      editor.chain().focus().sinkListItem("listItem").run();
    }
    return true;
  }

  if (isTaskItem) {
    editor.chain().focus().liftListItem("taskItem").run();
  } else {
    editor.chain().focus().liftListItem("listItem").run();
  }
  return true;
}
