"use client";

import { ArrowDownToLine } from "lucide-react";
import { formatKoreanDate } from "@/lib/date";
import type { ReviewSourceItem } from "@/lib/types";

export function ReviewSourceCard({
  onMoveInput,
  source,
}: {
  onMoveInput: () => void;
  source: ReviewSourceItem;
}) {
  return (
    <>
      <article className="my-4 rounded border border-[#d9dcd6] bg-white p-4">
        <div className="mb-2 flex items-center gap-2">
          <h2 className="font-semibold">{source.title}</h2>
          {source.item_type === "review_session" ? (
            <span className="rounded bg-[#f5df92] px-2 py-0.5 text-xs text-[#69510f]">
              복기
            </span>
          ) : null}
        </div>
        <p className="mb-4 text-xs text-[#72786f]">
          {formatKoreanDate(source.display_date)}
        </p>
        <p className="whitespace-pre-wrap leading-7 text-[#2d2a25]">
          {source.content || "내용 없음"}
        </p>
      </article>
      <button
        onClick={onMoveInput}
        className="mx-auto flex h-9 items-center gap-2 rounded-full border border-[#c8cec4] bg-white px-3 text-xs text-[#63685f]"
      >
        <ArrowDownToLine size={15} />
        여기로 복기 입력창 이동
      </button>
    </>
  );
}
