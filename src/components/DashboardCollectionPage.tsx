"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, ChevronLeft } from "lucide-react";
import { AppChrome } from "@/components/AppChrome";
import { LoadingState } from "@/components/LoadingState";
import { SetupNotice } from "@/components/SetupNotice";
import { useRequireAuth } from "@/components/useRequireAuth";
import { getDueReviews, getPinnedNotes, getRecentItems } from "@/lib/data";
import { formatKoreanDate } from "@/lib/date";
import type { DashboardReviewItem, Note, UnifiedItem } from "@/lib/types";

type CollectionKind = "due-reviews" | "pinned-notes" | "recent-items";

const REVIEW_LABEL: Record<DashboardReviewItem["review_type"], string> = {
  "1w": "1주",
  "3m": "3개월",
  "1y": "1년",
};

const WEEKDAYS = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];

function formatDateWithWeekday(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  const day = WEEKDAYS[date.getDay()] ?? "";
  return `${formatKoreanDate(value)} ${day}`;
}

export function DashboardCollectionPage({ kind }: { kind: CollectionKind }) {
  const { supabase, configured, user, loading } = useRequireAuth();
  const [dueReviews, setDueReviews] = useState<DashboardReviewItem[]>([]);
  const [pinnedNotes, setPinnedNotes] = useState<Note[]>([]);
  const [recentItems, setRecentItems] = useState<UnifiedItem[]>([]);
  const [loadError, setLoadError] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!supabase || !user) return;

    const load = async () => {
      if (kind === "due-reviews") {
        setDueReviews(await getDueReviews(supabase, user.id, 100));
      } else if (kind === "pinned-notes") {
        setPinnedNotes(await getPinnedNotes(supabase, user.id, 100));
      } else {
        setRecentItems(await getRecentItems(supabase, user.id, 100));
      }
      setLoaded(true);
    };

    load().catch((error) => {
      console.error(error);
      setLoadError("목록을 불러오지 못했습니다.");
      setLoaded(true);
    });
  }, [kind, supabase, user]);

  if (!configured) return <SetupNotice />;
  if (loading || !supabase || !user || !loaded) return <LoadingState />;

  const page = {
    "due-reviews": {
      title: "다시 볼 기록",
      description: "오늘까지 복기할 차례가 된 기록입니다.",
      empty: "다시 볼 기록이 없습니다.",
    },
    "pinned-notes": {
      title: "대표 메모",
      description: "투자 원칙과 행동 기준으로 고정한 메모입니다.",
      empty: "대표 메모가 없습니다.",
    },
    "recent-items": {
      title: "최근 기록",
      description: "최근에 작성하거나 수정한 메모와 복기입니다.",
      empty: "최근 기록이 없습니다.",
    },
  }[kind];

  return (
    <AppChrome>
      <div className="pb-8">
        <div className="mb-5">
          <Link
            href="/dashboard"
            className="mb-4 flex items-center gap-1 text-sm font-medium text-bokgi-accent"
          >
            <ChevronLeft size={18} />
            대시보드
          </Link>
          <h1 className="text-[34px] font-semibold leading-tight tracking-[-0.03em]">
            {page.title}
          </h1>
          <p className="mt-2 text-sm leading-6 text-bokgi-muted">{page.description}</p>
        </div>

        {loadError ? (
          <p className="rounded-[18px] border border-red-200 bg-red-50 px-4 py-5 text-sm text-red-700">
            {loadError}
          </p>
        ) : null}

        <div className="overflow-hidden rounded-[22px] border border-bokgi-border bg-bokgi-surface px-4 py-1">
          {kind === "due-reviews"
            ? dueReviews.map((item) => <DueReviewRow key={item.id} item={item} />)
            : null}
          {kind === "pinned-notes"
            ? pinnedNotes.map((note) => <NoteRow key={note.id} note={note} />)
            : null}
          {kind === "recent-items"
            ? recentItems.map((item) => <UnifiedRow key={`${item.item_type}:${item.id}`} item={item} />)
            : null}
          {isEmpty(kind, dueReviews, pinnedNotes, recentItems) && !loadError ? (
            <p className="py-10 text-center text-sm text-bokgi-muted">{page.empty}</p>
          ) : null}
        </div>
      </div>
    </AppChrome>
  );
}

function DueReviewRow({ item }: { item: DashboardReviewItem }) {
  return (
    <Link
      href={`/notes/${item.note_id}?reviewScheduleId=${item.id}&from=dashboard`}
      className="flex min-h-[64px] items-center gap-3 border-t border-bokgi-border-soft py-3 first:border-t-0"
    >
      <span className="shrink-0 rounded-full bg-bokgi-surface-muted px-2.5 py-1 text-[11px] font-semibold text-bokgi-muted">
        {REVIEW_LABEL[item.review_type]}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium leading-5">{item.note.title}</span>
        <span className="mt-0.5 block truncate text-xs text-bokgi-muted">
          {formatDateWithWeekday(item.note.note_date)}
        </span>
      </span>
      <ArrowRight className="ml-auto shrink-0 text-bokgi-muted" size={17} />
    </Link>
  );
}

function NoteRow({ note }: { note: Note }) {
  return (
    <Link
      href={`/notes/${note.id}?from=dashboard`}
      className="flex min-h-[64px] items-center gap-3 border-t border-bokgi-border-soft py-3 first:border-t-0"
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium leading-5">{note.title}</span>
        <span className="mt-0.5 block truncate text-xs text-bokgi-muted">
          {formatDateWithWeekday(note.note_date)}
        </span>
      </span>
      <ArrowRight className="ml-auto shrink-0 text-bokgi-muted" size={17} />
    </Link>
  );
}

function UnifiedRow({ item }: { item: UnifiedItem }) {
  return (
    <Link
      href={
        item.item_type === "note"
          ? `/notes/${item.id}?from=dashboard`
          : `/reviews/${item.id}?from=dashboard`
      }
      className="flex min-h-[64px] items-center gap-3 border-t border-bokgi-border-soft py-3 first:border-t-0"
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium leading-5">{item.title}</span>
        <span className="mt-0.5 block truncate text-xs text-bokgi-muted">
          {item.item_type === "review_session" ? "복기" : "메모"} ·{" "}
          {formatDateWithWeekday(item.display_date)}
        </span>
      </span>
      <ArrowRight className="ml-auto shrink-0 text-bokgi-muted" size={17} />
    </Link>
  );
}

function isEmpty(
  kind: CollectionKind,
  dueReviews: DashboardReviewItem[],
  pinnedNotes: Note[],
  recentItems: UnifiedItem[],
) {
  if (kind === "due-reviews") return dueReviews.length === 0;
  if (kind === "pinned-notes") return pinnedNotes.length === 0;
  return recentItems.length === 0;
}
