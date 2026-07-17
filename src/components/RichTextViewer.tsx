"use client";

import type { JSONContent } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import { editorJsonOrText } from "@/lib/editor";
import { createRichTextExtensions } from "@/lib/tiptapExtensions";
import type { Json } from "@/lib/types";

export function RichTextViewer({
  className = "",
  content,
  contentJson,
}: {
  className?: string;
  content: string;
  contentJson: Json | null | undefined;
}) {
  const hasText = content.trim().length > 0;
  const editor = useEditor({
    immediatelyRender: false,
    editable: false,
    extensions: createRichTextExtensions(),
    content: editorJsonOrText(contentJson, content) as JSONContent,
    editorProps: {
      attributes: {
        class:
          "tiptap-editor tiptap-viewer w-full max-w-none bg-transparent text-[15px] leading-7 text-bokgi-ink-soft outline-none",
        tabindex: "-1",
      },
    },
  });

  if (!hasText) {
    return <p className={className || "text-[15px] leading-7 text-bokgi-ink-soft"}>내용 없음</p>;
  }

  return (
    <div className={className}>
      <EditorContent editor={editor} />
    </div>
  );
}
