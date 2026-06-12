"use client";

import { BookOpenCheck } from "lucide-react";

export function ReviewDraftBox({
  content,
  onChange,
}: {
  content: string;
  onChange: (content: string) => void;
}) {
  return (
    <section className="my-4 rounded border border-[#dfd3bf] bg-white p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-medium text-[#2f6b4f]">
        <BookOpenCheck size={17} />
        복기 입력
      </div>
      <textarea
        value={content}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-48 w-full resize-none bg-transparent text-base leading-7 outline-none"
        placeholder="읽으면서 복기 내용을 적어보세요"
      />
    </section>
  );
}
