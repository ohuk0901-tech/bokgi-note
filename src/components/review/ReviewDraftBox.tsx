"use client";

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
    <section className="my-4 rounded-[22px] border border-bokgi-border bg-bokgi-surface p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-[17px] font-semibold">복기 메모</h2>
      </div>
      <RichTextEditor
        contentJson={contentJson}
        minHeight="12rem"
        placeholder="이번 주 메모를 읽고 반복된 판단, 감정, 다음 행동을 적어보세요"
        stickyToolbar
        onChange={onChange}
      />
    </section>
  );
}
