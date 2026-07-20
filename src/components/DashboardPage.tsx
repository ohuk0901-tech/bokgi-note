"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Children, useEffect, useState } from "react";
import { ArrowRight, MessageCircle } from "lucide-react";
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

const WEEKDAYS = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];
const FEEDBACK_FORM_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLSfuD0y1L0whMtlgxLNjI29xZA-Sj_vHAmMM0bS3HYq-yt8k2w/viewform?usp=header";
const FEEDBACK_CARD_SNOOZE_KEY = "bokgi-feedback-card-snoozed-until";
const FEEDBACK_CARD_SNOOZE_DAYS = 3;

function formatDateWithWeekday(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  const day = WEEKDAYS[date.getDay()] ?? "";
  return `${formatKoreanDate(value)} ${day}`;
}

export function DashboardPage() {
  const router = useRouter();
  const { supabase, configured, user, loading } = useRequireAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loadError, setLoadError] = useState("");
  const [busyTemplateId, setBusyTemplateId] = useState<string | null>(null);
  const [busyWeeklyReview, setBusyWeeklyReview] = useState(false);
  const [feedbackCardVisible, setFeedbackCardVisible] = useState(false);

  useEffect(() => {
    if (!supabase || !user) return;
    getDashboardData(supabase, user.id)
      .then(setData)
      .catch((error) => {
        console.error(error);
        setLoadError("대시보드를 불러오지 못했습니다.");
      });
  }, [supabase, user]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      try {
        const snoozedUntil = Number(window.localStorage.getItem(FEEDBACK_CARD_SNOOZE_KEY));
        setFeedbackCardVisible(!snoozedUntil || snoozedUntil <= Date.now());
      } catch {
        setFeedbackCardVisible(true);
      }
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

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
      const note = await createOrOpenTemplateNote(client, currentUser.id, template.id, {
        source: "dashboard",
      });
      router.push(`/notes/${note.id}?from=dashboard`);
    } catch (error) {
      alert(error instanceof Error ? error.message : "메모를 만들지 못했습니다.");
      setBusyTemplateId(null);
    }
  }

  async function openWeeklyReview() {
    setBusyWeeklyReview(true);
    try {
      const review = await startWeeklyReview(client, currentUser.id, todayISO(), {
        source: "dashboard",
      });
      router.push(`/reviews/${review.id}?from=dashboard`);
    } catch (error) {
      alert(error instanceof Error ? error.message : "이번 주 복기를 시작하지 못했습니다.");
      setBusyWeeklyReview(false);
    }
  }

  function snoozeFeedbackCard() {
    const snoozedUntil = Date.now() + FEEDBACK_CARD_SNOOZE_DAYS * 24 * 60 * 60 * 1000;
    try {
      window.localStorage.setItem(FEEDBACK_CARD_SNOOZE_KEY, String(snoozedUntil));
    } catch {
      // localStorage가 막힌 환경에서도 사용자는 카드를 닫을 수 있어야 합니다.
    }
    setFeedbackCardVisible(false);
  }

  const primaryRoutine = data.primaryRoutine;
  const todayLabel = formatKoreanDate(todayISO());
  const weeklyReviewAction = data.weeklyReview ? "이어쓰기" : "시작";

  return (
    <AppChrome>
      <div className="space-y-5 pb-6">
        <section className="space-y-3">
          <p className="px-1 text-sm text-bokgi-muted">{todayLabel}</p>
          {primaryRoutine ? (
            <button
              onClick={() => openTemplate(primaryRoutine.template)}
              disabled={busyTemplateId === primaryRoutine.template.id}
              className="flex min-h-16 w-full items-center justify-between gap-4 rounded-[22px] bg-bokgi-primary px-5 text-left text-bokgi-primary-on transition active:scale-[0.99] disabled:opacity-50"
            >
              <span className="flex-1 text-[17px] font-semibold leading-none">
                {primaryRoutine.actionLabel}
              </span>
              <ArrowRight className="shrink-0" size={19} />
            </button>
          ) : (
            <Link
              href="/settings"
              className="flex h-[52px] items-center justify-center rounded-[22px] border border-bokgi-border bg-bokgi-surface text-sm font-medium"
            >
              대표 템플릿 설정하기
            </Link>
          )}
        </section>

        <DashboardSection
          title="이번 주 복기"
          aside={`기록 ${data.weeklyReviewNoteCount}개`}
          empty="이번 주 기록이 없습니다."
        >
          <button
            onClick={openWeeklyReview}
            disabled={
              busyWeeklyReview ||
              (!data.weeklyReview && data.weeklyReviewNoteCount === 0)
            }
            className="flex min-h-[52px] w-full items-center justify-between gap-3 py-3 text-left disabled:opacity-40"
          >
            <span className="font-medium">{weeklyReviewAction}</span>
            <ArrowRight className="shrink-0 text-bokgi-muted" size={17} />
          </button>
        </DashboardSection>

        {feedbackCardVisible ? (
          <FeedbackInviteCard onSnooze={snoozeFeedbackCard} />
        ) : null}

        <DashboardSection
          title="다시 볼 기록"
          aside={data.dueReviews.length ? `${Math.min(data.dueReviews.length, 5)}개` : undefined}
          actionHref="/dashboard/review-due"
          empty="대기 중인 기록이 없습니다."
        >
          {data.dueReviews.slice(0, 5).map((item) => (
            <Link
              key={item.id}
              href={`/notes/${item.note_id}?reviewScheduleId=${item.id}&from=dashboard`}
              className="group flex min-h-[60px] items-center gap-3 border-t border-bokgi-border-soft py-3 first:border-t-0"
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
          ))}
        </DashboardSection>

        <DashboardSection
          title="대표 메모"
          actionHref="/dashboard/pinned"
          empty="고정한 메모가 없습니다."
        >
          {data.pinnedNotes.slice(0, 5).map((note) => (
            <NoteLink key={note.id} note={note} />
          ))}
        </DashboardSection>

        <DashboardSection
          title="최근 기록"
          actionHref="/dashboard/recent"
          empty="아직 기록이 없습니다."
        >
          {data.recentItems.slice(0, 3).map((item) => (
            <UnifiedLink key={`${item.item_type}:${item.id}`} item={item} />
          ))}
        </DashboardSection>
      </div>
    </AppChrome>
  );
}

function FeedbackInviteCard({ onSnooze }: { onSnooze: () => void }) {
  return (
    <section className="rounded-[22px] border border-bokgi-border bg-bokgi-surface px-4 py-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <div className="flex gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-bokgi-accent-soft text-bokgi-accent">
          <MessageCircle size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold text-bokgi-ink">
            복기노트 써보니 어땠나요?
          </p>
          <p className="mt-1 text-sm leading-5 text-bokgi-muted">
            1분만 피드백 남겨주시면 다음 개선에 큰 도움이 됩니다.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <a
              href={FEEDBACK_FORM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-9 items-center justify-center rounded-full bg-bokgi-primary px-4 text-sm font-semibold text-bokgi-primary-on transition active:scale-[0.98]"
            >
              피드백 남기기
            </a>
            <button
              type="button"
              onClick={onSnooze}
              className="inline-flex h-9 items-center justify-center rounded-full px-3 text-sm font-medium text-bokgi-muted transition hover:bg-bokgi-surface-muted hover:text-bokgi-ink"
            >
              나중에
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function DashboardSection({
  title,
  aside,
  actionHref,
  empty,
  children,
}: {
  title: string;
  aside?: string;
  actionHref?: string;
  empty: string;
  children: React.ReactNode;
}) {
  const childList = Children.toArray(children).filter(Boolean);
  return (
    <section>
      <div className="mb-2 flex items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-2 text-[15px] font-semibold text-bokgi-ink">
          <span>{title}</span>
          {aside ? <span className="text-xs font-medium text-bokgi-muted">{aside}</span> : null}
        </div>
        {actionHref ? (
          <Link href={actionHref} className="text-sm font-medium text-bokgi-accent">
            전체
          </Link>
        ) : null}
      </div>
      <div className="overflow-hidden rounded-[22px] border border-bokgi-border bg-bokgi-surface px-4 py-1">
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
      className="flex min-h-[60px] items-center justify-between gap-3 border-t border-bokgi-border-soft py-3 first:border-t-0"
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

function UnifiedLink({ item }: { item: UnifiedItem }) {
  return (
    <Link
      href={
        item.item_type === "note"
          ? `/notes/${item.id}?from=dashboard`
          : `/reviews/${item.id}?from=dashboard`
      }
      className="flex min-h-[60px] items-center justify-between gap-3 border-t border-bokgi-border-soft py-3 first:border-t-0"
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium leading-5">{item.title}</span>
        <span className="mt-0.5 block truncate text-xs text-bokgi-muted">
          {formatDateWithWeekday(item.display_date)}
        </span>
      </span>
      <ArrowRight className="ml-auto shrink-0 text-bokgi-muted" size={17} />
    </Link>
  );
}
