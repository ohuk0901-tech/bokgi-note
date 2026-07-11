"use client";

import { Extension, type Editor, type JSONContent } from "@tiptap/core";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useRef } from "react";
import {
  CheckSquare,
  IndentDecrease,
  IndentIncrease,
  List,
  ListOrdered,
} from "lucide-react";
import { normalizeEditorDoc } from "@/lib/editor";
import type { Json } from "@/lib/types";

const ListTabGuard = Extension.create({
  name: "listTabGuard",

  addKeyboardShortcuts() {
    return {
      Tab: () => handleListTab(this.editor, "in"),
      "Shift-Tab": () => handleListTab(this.editor, "out"),
    };
  },
});

export type RichTextValue = {
  contentJson: Json;
  contentText: string;
};

export function RichTextEditor({
  contentJson,
  minHeight = "60vh",
  placeholder = "내용을 입력하세요",
  onChange,
}: {
  contentJson: Json;
  minHeight?: string;
  placeholder?: string;
  onChange: (value: RichTextValue) => void;
}) {
  const isNormalizing = useRef(false);
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
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
      ListTabGuard,
    ],
    content: contentJson as JSONContent,
    editorProps: {
      attributes: {
        class:
          "tiptap-editor w-full max-w-none bg-transparent text-lg leading-8 outline-none",
        "data-placeholder": placeholder,
        style: `min-height: ${minHeight}`,
      },
    },
    onUpdate: ({ editor: currentEditor }) => {
      const rawJson = currentEditor.getJSON() as Json;
      const normalizedJson = normalizeEditorDoc(rawJson);
      const changed = JSON.stringify(rawJson) !== JSON.stringify(normalizedJson);

      if (changed && !isNormalizing.current) {
        isNormalizing.current = true;
        window.setTimeout(() => {
          currentEditor.commands.setContent(normalizedJson as JSONContent, {
            emitUpdate: false,
          });
          isNormalizing.current = false;
        }, 0);
      }

      onChange({
        contentJson: normalizedJson,
        contentText: currentEditor.getText({ blockSeparator: "\n" }),
      });
    },
  });

  function run(command: () => boolean) {
    command();
  }

  function indent() {
    if (!editor) return;
    if (editor.isActive("taskItem")) {
      run(() => editor.chain().focus().sinkListItem("taskItem").run());
      return;
    }
    run(() => editor.chain().focus().sinkListItem("listItem").run());
  }

  function outdent() {
    if (!editor) return;
    if (editor.isActive("taskItem")) {
      run(() => editor.chain().focus().liftListItem("taskItem").run());
      return;
    }
    run(() => editor.chain().focus().liftListItem("listItem").run());
  }

  return (
    <div className="rich-text-editor">
      <div className="mb-3 flex flex-wrap gap-1 rounded border border-bokgi-border bg-bokgi-surface p-1">
        <ToolbarButton
          label="불릿 목록"
          active={Boolean(editor?.isActive("bulletList"))}
          onClick={() => run(() => editor?.chain().focus().toggleBulletList().run() ?? false)}
        >
          <List size={17} />
        </ToolbarButton>
        <ToolbarButton
          label="번호 목록"
          active={Boolean(editor?.isActive("orderedList"))}
          onClick={() => run(() => editor?.chain().focus().toggleOrderedList().run() ?? false)}
        >
          <ListOrdered size={17} />
        </ToolbarButton>
        <ToolbarButton
          label="체크박스"
          active={Boolean(editor?.isActive("taskList"))}
          onClick={() => run(() => editor?.chain().focus().toggleTaskList().run() ?? false)}
        >
          <CheckSquare size={17} />
        </ToolbarButton>
        <ToolbarButton label="내어쓰기" onClick={outdent}>
          <IndentDecrease size={17} />
        </ToolbarButton>
        <ToolbarButton label="들여쓰기" onClick={indent}>
          <IndentIncrease size={17} />
        </ToolbarButton>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
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

function ToolbarButton({
  active = false,
  label,
  children,
  onClick,
}: {
  active?: boolean;
  label: string;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-9 w-9 items-center justify-center rounded text-bokgi-ink-soft hover:bg-bokgi-surface-hover ${
        active ? "bg-bokgi-primary text-bokgi-primary-on hover:bg-bokgi-primary" : ""
      }`}
      aria-label={label}
      title={label}
    >
      {children}
    </button>
  );
}
