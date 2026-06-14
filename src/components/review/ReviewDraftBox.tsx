"use client";

import { BookOpenCheck } from "lucide-react";
import { RichTextEditor, type RichTextValue } from "@/components/RichTextEditor";
import type { Json } from "@/lib/types";

export function ReviewDraftBox({
  contentJson,
  onChange,
}: {
  contentJson: Json;
  onChange: (value: RichTextValue) => void;
}) {
  return (
    <section className="my-4 rounded border border-[#dfd3bf] bg-white p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-medium text-[#2f6b4f]">
        <BookOpenCheck size={17} />
        복기 입력
      </div>
      <RichTextEditor
        contentJson={contentJson}
        minHeight="12rem"
        placeholder="읽으면서 복기 내용을 적어보세요"
        onChange={onChange}
      />
    </section>
  );
}
