"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Children, useEffect, useState } from "react";
import { ArrowRight, BookOpenCheck, CalendarClock, Pin } from "lucide-react";
import { AppChrome } from "@/components/AppChrome";
import { LoadingState } from "@/components/LoadingState";
import { SetupNotice } from "@/components/SetupNotice";
import { useRequireAuth } from "@/components/useRequireAuth";
import {
  createOrOpenTemplateNote,
  getDashboardData,
  startWeeklyReview,
} from "@/lib/data";
import { formatKoreanDate, todayISO } from "@/lib/date";
import type { DashboardReviewItem, Note, Template, UnifiedItem } from "@/lib/types";

type DashboardData = Awaited<ReturnType<typeof getDashboardData>>;

const REVIEW_LABEL: Record<DashboardReviewItem["review_type"], string> = {
  "1w": "1주",
  "3m": "3개월",
  "1y": "1년",
};

export function DashboardPage() {
  const router = useRouter();
  const { supabase, configured, user, loading } = useRequireAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loadError, setLoadError] = useState("");
  const [busyTemplateId, setBusyTemplateId] = useState<string | null>(null);
  const [busyWeeklyReview, setBusyWeeklyReview] = useState(false);

  useEffect(() => {
    if (!supabase || !user) return;
    getDashboardData(supabase, user.id)
      .then(setData)
      .catch((error) => {
        console.error(error);
        setLoadError("대시보드를 불러오지 못했습니다.");
      });
  }, [supabase, user]);

  if (!configured) return <SetupNotice />;
  if (loadError) {
    return (
      <AppChrome>
        <p className="py-10 text-center text-sm text-bokgi-muted">{loadError}</p>
      </AppChrome>
    );
  }
  if (loading || !supabase || !user || !data) return <LoadingState />;

  const client = supabase;
  const currentUser = user;

  async function openTemplate(template: Template) {
    setBusyTemplateId(template.id);
    try {
      const note = await createOrOpenTemplateNote(client, currentUser.id, template.id);
      router.push(`/notes/${note.id}?from=dashboard`);
    } catch (error) {
      alert(error instanceof Error ? error.message : "메모를 만들지 못했습니다.");
      setBusyTemplateId(null);
    }
  }

  async function openWeeklyReview() {
    setBusyWeeklyReview(true);
    try {
      const review = await startWeeklyReview(client, currentUser.id);
      router.push(`/reviews/${review.id}?from=dashboard`);
    } catch (error) {
      alert(error instanceof Error ? error.message : "이번 주 복기를 시작하지 못했습니다.");
      setBusyWeeklyReview(false);
    }
  }

  const primaryRoutine = data.primaryRoutine;
  const todayLabel = formatKoreanDate(todayISO());

  return (
    <AppChrome>
      <div className="space-y-5">
        <section className="space-y-3">
          <p className="text-sm text-bokgi-muted">{todayLabel}</p>
          {primaryRoutine ? (
            <button
              onClick={() => openTemplate(primaryRoutine.template)}
              disabled={busyTemplateId === primaryRoutine.template.id}
              className="flex min-h-20 w-full items-center justify-between rounded-[var(--radius-panel)] bg-bokgi-primary px-4 text-left text-bokgi-primary-on disabled:opacity-50"
            >
              <span className="text-lg font-semibold">{primaryRoutine.actionLabel}</span>
              <ArrowRight size={19} />
            </button>
          ) : (
            <Link
              href="/settings"
              className="flex h-12 items-center justify-center rounded-[var(--radius-control)] border border-bokgi-border bg-bokgi-surface text-sm font-medium"
            >
              대표 템플릿 설정하기
            </Link>
          )}
        </section>

        <DashboardSection
          icon={<BookOpenCheck size={18} />}
          title="이번 주 복기"
          aside={`기록 ${data.weeklyReviewNoteCount}개`}
          empty="이번 주 기록이 없습니다."
        >
          <button
            onClick={openWeeklyReview}
            disabled={busyWeeklyReview || data.weeklyReviewNoteCount === 0}
            className="flex w-full items-center justify-between gap-3 py-3 text-left disabled:opacity-40"
          >
            <span className="font-medium">시작</span>
            <ArrowRight className="shrink-0 text-bokgi-muted" size={17} />
          </button>
        </DashboardSection>

        <DashboardSection
          icon={<CalendarClock size={18} />}
          title="복기 대기"
          aside={data.dueReviews.length > 3 ? `외 ${data.dueReviews.length - 3}개` : undefined}
          empty="대기 중인 기록이 없습니다."
        >
          {data.dueReviews.slice(0, 3).map((item) => (
            <Link
              key={item.id}
              href={`/notes/${item.note_id}?reviewScheduleId=${item.id}&from=dashboard`}
              className="flex items-center justify-between gap-3 border-t border-bokgi-border-soft py-3 first:border-t-0"
            >
              <span className="shrink-0 rounded-full bg-bokgi-surface-muted px-2 py-1 text-xs font-semibold text-bokgi-muted">
                {REVIEW_LABEL[item.review_type]}
              </span>
              <p className="min-w-0 flex-1 truncate font-medium">{item.note.title}</p>
              <ArrowRight className="shrink-0 text-bokgi-muted" size={17} />
            </Link>
          ))}
        </DashboardSection>

        <DashboardSection icon={<Pin size={18} />} title="대표 메모" empty="고정한 메모가 없습니다.">
          {data.pinnedNotes.slice(0, 3).map((note) => (
            <NoteLink key={note.id} note={note} />
          ))}
        </DashboardSection>

        <DashboardSection
          icon={<BookOpenCheck size={18} />}
          title="최근 기록"
          empty="아직 기록이 없습니다."
        >
          {data.recentItems.slice(0, 4).map((item) => (
            <UnifiedLink key={`${item.item_type}:${item.id}`} item={item} />
          ))}
        </DashboardSection>
      </div>
    </AppChrome>
  );
}

function DashboardSection({
  icon,
  title,
  aside,
  empty,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  aside?: string;
  empty: string;
  children: React.ReactNode;
}) {
  const childList = Children.toArray(children).filter(Boolean);
  return (
    <section>
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-bokgi-accent">
          {icon}
          {title}
        </div>
        {aside ? <span className="text-xs font-medium text-bokgi-muted">{aside}</span> : null}
      </div>
      <div className="rounded-[var(--radius-panel)] border border-bokgi-border bg-bokgi-surface px-4 py-2">
        {childList.length ? (
          childList
        ) : (
          <p className="py-5 text-center text-sm text-bokgi-muted">{empty}</p>
        )}
      </div>
    </section>
  );
}

function NoteLink({ note }: { note: Note }) {
  return (
    <Link
      href={`/notes/${note.id}?from=dashboard`}
      className="flex items-center justify-between gap-3 border-t border-bokgi-border-soft py-3 first:border-t-0"
    >
      <p className="truncate font-medium">{note.title}</p>
      <ArrowRight className="shrink-0 text-bokgi-muted" size={17} />
    </Link>
  );
}

function UnifiedLink({ item }: { item: UnifiedItem }) {
  return (
    <Link
      href={
        item.item_type === "note"
          ? `/notes/${item.id}?from=dashboard`
          : `/reviews/${item.id}?from=dashboard`
      }
      className="flex items-center justify-between gap-3 border-t border-bokgi-border-soft py-3 first:border-t-0"
    >
      <p className="truncate font-medium">{item.title}</p>
      <ArrowRight className="shrink-0 text-bokgi-muted" size={17} />
    </Link>
  );
}
