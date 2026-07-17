"use client";

import { Extension, type Editor, type JSONContent } from "@tiptap/core";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  CheckSquare,
  IndentDecrease,
  IndentIncrease,
  List,
  ListOrdered,
  Redo2,
  Undo2,
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

type ToolbarState = {
  canRedo: boolean;
  canUndo: boolean;
  isBulletList: boolean;
  isOrderedList: boolean;
  isTaskList: boolean;
};

const initialToolbarState: ToolbarState = {
  canRedo: false,
  canUndo: false,
  isBulletList: false,
  isOrderedList: false,
  isTaskList: false,
};

export function RichTextEditor({
  contentJson,
  minHeight = "60vh",
  placeholder = "내용을 입력하세요",
  toolbarLeading,
  toolbarTrailing,
  stickyToolbar = false,
  onChange,
}: {
  contentJson: Json;
  minHeight?: string;
  placeholder?: string;
  toolbarLeading?: React.ReactNode;
  toolbarTrailing?: React.ReactNode;
  stickyToolbar?: boolean;
  onChange: (value: RichTextValue) => void;
}) {
  const isNormalizing = useRef(false);
  const blurTimer = useRef<number | undefined>(undefined);
  const toolbarScrollRef = useRef<HTMLDivElement | null>(null);
  const [toolbarState, setToolbarState] = useState<ToolbarState>(initialToolbarState);
  const [toolbarOverflow, setToolbarOverflow] = useState({
    left: false,
    right: false,
  });
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
        autocapitalize: "none",
        autocomplete: "off",
        autocorrect: "off",
        "data-placeholder": placeholder,
        enterkeyhint: "default",
        spellcheck: "false",
        style: `min-height: ${minHeight}`,
        tabindex: "-1",
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

  const updateToolbarState = useCallback((currentEditor: Editor | null) => {
    if (!currentEditor) {
      setToolbarState(initialToolbarState);
      return;
    }

    setToolbarState({
      canRedo: currentEditor.can().redo(),
      canUndo: currentEditor.can().undo(),
      isBulletList: currentEditor.isActive("bulletList"),
      isOrderedList: currentEditor.isActive("orderedList"),
      isTaskList: currentEditor.isActive("taskList"),
    });
  }, []);

  const updateToolbarOverflow = useCallback(() => {
    const node = toolbarScrollRef.current;
    if (!node) return;

    const maxScrollLeft = node.scrollWidth - node.clientWidth;
    setToolbarOverflow({
      left: node.scrollLeft > 2,
      right: maxScrollLeft - node.scrollLeft > 2,
    });
  }, []);

  useEffect(() => {
    if (!editor) return;

    const handleFocus = () => {
      if (blurTimer.current) window.clearTimeout(blurTimer.current);
      updateToolbarState(editor);
    };
    const handleBlur = () => {
      blurTimer.current = window.setTimeout(() => {
        updateToolbarState(editor);
      }, 120);
    };
    const handleChange = () => updateToolbarState(editor);

    handleChange();
    editor.on("focus", handleFocus);
    editor.on("blur", handleBlur);
    editor.on("selectionUpdate", handleChange);
    editor.on("transaction", handleChange);
    editor.on("update", handleChange);

    return () => {
      if (blurTimer.current) window.clearTimeout(blurTimer.current);
      editor.off("focus", handleFocus);
      editor.off("blur", handleBlur);
      editor.off("selectionUpdate", handleChange);
      editor.off("transaction", handleChange);
      editor.off("update", handleChange);
    };
  }, [editor, updateToolbarState]);

  useEffect(() => {
    updateToolbarOverflow();
    window.addEventListener("resize", updateToolbarOverflow);
    return () => window.removeEventListener("resize", updateToolbarOverflow);
  }, [updateToolbarOverflow]);

  function run(command: () => boolean) {
    command();
    window.setTimeout(() => updateToolbarState(editor), 0);
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

  const toolbar = (
    <div
      className={
        stickyToolbar
          ? "relative min-w-0 flex-1 overflow-hidden rounded-full border border-bokgi-border bg-bokgi-surface/95 p-1 shadow-[0_8px_24px_rgba(0,0,0,0.08)]"
          : "relative max-w-full overflow-hidden rounded-[18px] border border-bokgi-border bg-bokgi-surface/95 p-1 shadow-[0_8px_24px_rgba(0,0,0,0.08)] backdrop-blur"
      }
    >
      {toolbarOverflow.left ? (
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-6 bg-gradient-to-r from-bokgi-surface via-bokgi-surface/85 to-transparent" />
      ) : null}
      <div
        ref={toolbarScrollRef}
        onScroll={updateToolbarOverflow}
        className="editor-toolbar-scroll flex min-w-0 items-center gap-1 overflow-x-auto scroll-smooth"
      >
        <ToolbarButton
          disabled={!toolbarState.canUndo}
          label="실행 취소"
          onClick={() => run(() => editor?.chain().focus().undo().run() ?? false)}
        >
          <Undo2 size={17} />
        </ToolbarButton>
        <ToolbarButton
          disabled={!toolbarState.canRedo}
          label="다시 실행"
          onClick={() => run(() => editor?.chain().focus().redo().run() ?? false)}
        >
          <Redo2 size={17} />
        </ToolbarButton>
        <ToolbarButton
          label="불릿 목록"
          active={toolbarState.isBulletList}
          onClick={() => run(() => editor?.chain().focus().toggleBulletList().run() ?? false)}
        >
          <List size={17} />
        </ToolbarButton>
        <ToolbarButton
          label="번호 목록"
          active={toolbarState.isOrderedList}
          onClick={() => run(() => editor?.chain().focus().toggleOrderedList().run() ?? false)}
        >
          <ListOrdered size={17} />
        </ToolbarButton>
        <ToolbarButton
          label="체크박스"
          active={toolbarState.isTaskList}
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
      {toolbarOverflow.right ? (
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-gradient-to-l from-bokgi-surface via-bokgi-surface/85 to-transparent" />
      ) : null}
    </div>
  );

  return (
    <div className="rich-text-editor">
      <div
        className={`${
          stickyToolbar
            ? "fixed inset-x-0 top-0 z-50 border-b border-bokgi-border bg-bokgi-bg/95 px-3 pb-2 pt-[calc(0.5rem+env(safe-area-inset-top,0px))] backdrop-blur"
            : "mb-3"
        }`}
      >
        <div
          className={
            stickyToolbar
              ? "mx-auto flex max-w-2xl items-center gap-2"
              : ""
          }
        >
          {stickyToolbar && toolbarLeading ? (
            <div className="shrink-0">{toolbarLeading}</div>
          ) : null}
          {toolbar}
          {stickyToolbar && toolbarTrailing ? (
            <div className="shrink-0">{toolbarTrailing}</div>
          ) : null}
        </div>
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
  disabled = false,
  label,
  children,
  onClick,
}: {
  active?: boolean;
  disabled?: boolean;
  label: string;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-disabled={disabled}
      disabled={disabled}
      onClick={disabled ? undefined : onClick}
      onMouseDown={(event) => event.preventDefault()}
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded text-bokgi-ink-soft hover:bg-bokgi-surface-hover disabled:cursor-not-allowed disabled:opacity-35 ${
        active && !disabled ? "bg-bokgi-primary text-bokgi-primary-on hover:bg-bokgi-primary" : ""
      }`}
      aria-label={label}
      title={label}
    >
      {children}
    </button>
  );
}
