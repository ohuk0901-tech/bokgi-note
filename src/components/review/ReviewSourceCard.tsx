"use client";

import { formatKoreanDate } from "@/lib/date";
import type { ReviewSourceItem } from "@/lib/types";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

function weekdayLabel(value: string) {
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  return WEEKDAYS[date.getDay()] ?? "";
}

export function ReviewSourceCard({
  onMoveInput,
  source,
}: {
  onMoveInput: () => void;
  source: ReviewSourceItem;
}) {
  return (
    <article className="border-t border-bokgi-border-soft py-5 first:border-t-0">
      <div className="mb-3 flex items-start gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-bokgi-surface-muted text-xs font-semibold text-bokgi-muted">
          {weekdayLabel(source.display_date)}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[17px] font-semibold leading-6">{source.title}</h2>
          <p className="mt-0.5 text-xs text-bokgi-muted">
            {formatKoreanDate(source.display_date)}
          </p>
        </div>
      </div>
      <p className="whitespace-pre-wrap text-[15px] leading-7 text-bokgi-ink-soft">
        {source.content || "내용 없음"}
      </p>
      <button
        onClick={onMoveInput}
        className="mt-4 h-9 rounded-full border border-bokgi-border bg-bokgi-surface px-3 text-xs font-medium text-bokgi-accent"
      >
        여기에 복기 메모 쓰기
      </button>
    </article>
  );
}
