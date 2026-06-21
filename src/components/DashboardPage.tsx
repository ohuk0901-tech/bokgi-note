"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Children, useEffect, useState } from "react";
import {
  ArrowRight,
  BookOpenCheck,
  CalendarClock,
  ClipboardList,
  Pin,
  Plus,
  Star,
} from "lucide-react";
import { AppChrome } from "@/components/AppChrome";
import { LoadingState } from "@/components/LoadingState";
import { SetupNotice } from "@/components/SetupNotice";
import { useRequireAuth } from "@/components/useRequireAuth";
import {
  createOrOpenTemplateNote,
  getDashboardData,
  startWeeklyReview,
  type DashboardRoutineItem,
} from "@/lib/data";
import { formatKoreanDate } from "@/lib/date";
import type { DashboardReviewItem, Note, Template, UnifiedItem } from "@/lib/types";

type DashboardData = Awaited<ReturnType<typeof getDashboardData>>;

const REVIEW_LABEL: Record<DashboardReviewItem["review_type"], string> = {
  "1w": "1주 복기",
  "3m": "3개월 복기",
  "1y": "1년 복기",
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
        <p className="py-10 text-center text-sm text-[#63685f]">{loadError}</p>
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

  return (
    <AppChrome>
      <div className="space-y-7">
        <section>
          <p className="text-sm font-medium text-[#2f6b4f]">오늘</p>
          <h1 className="mt-1 text-2xl font-semibold">오늘 기록</h1>
          <p className="mt-1 text-sm leading-6 text-[#63685f]">
            오늘의 시장과 내 판단을 짧게 남깁니다.
          </p>
          {primaryRoutine ? (
            <button
              onClick={() => openTemplate(primaryRoutine.template)}
              disabled={busyTemplateId === primaryRoutine.template.id}
              className="mt-4 flex h-13 w-full items-center justify-between rounded bg-[#1f1f1f] px-4 text-left font-medium text-white disabled:opacity-50"
            >
              <span>{primaryRoutine.actionLabel}</span>
              <ArrowRight size={19} />
            </button>
          ) : (
            <Link
              href="/settings"
              className="mt-4 flex h-12 items-center justify-center rounded border border-[#d4d8d1] bg-white text-sm font-medium"
            >
              대표 템플릿 설정하기
            </Link>
          )}
        </section>

        <DashboardSection
          icon={<BookOpenCheck size={18} />}
          title="이번 주 복기"
          description="이번 주 투자 일기를 모아 읽고 생각을 정리합니다."
          empty=""
        >
          <button
            onClick={openWeeklyReview}
            disabled={busyWeeklyReview}
            className="flex w-full items-center justify-between gap-3 py-3 text-left disabled:opacity-50"
          >
            <div>
              <p className="font-medium">이번 주 복기 시작</p>
              <p className="mt-1 text-sm leading-6 text-[#63685f]">
                이번 주 투자 일기를 자동으로 불러와 복기 세션을 만듭니다.
              </p>
            </div>
            <ArrowRight className="shrink-0 text-[#72786f]" size={17} />
          </button>
        </DashboardSection>

        <DashboardSection
          icon={<CalendarClock size={18} />}
          title="다시 볼 기록"
          description="1주, 3개월, 1년 뒤 다시 보기로 한 기록입니다."
          empty="다시 볼 기록이 없습니다."
        >
          {data.dueReviews.map((item) => (
            <Link
              key={item.id}
              href={`/notes/${item.note_id}?reviewScheduleId=${item.id}&from=dashboard`}
              className="flex items-start justify-between gap-3 border-t border-[#e3e5e0] py-3 first:border-t-0"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{item.note.title}</p>
                <p className="mt-1 text-sm text-[#63685f]">
                  {REVIEW_LABEL[item.review_type]} · {formatKoreanDate(item.due_date)}
                </p>
              </div>
              <ArrowRight className="mt-1 shrink-0 text-[#72786f]" size={17} />
            </Link>
          ))}
        </DashboardSection>

        <DashboardSection
          icon={<ClipboardList size={18} />}
          title="주간 기록"
          description="금요일부터 월요일까지 한 주 마무리와 다음 주 계획을 작성합니다."
          empty="금요일부터 월요일까지 표시됩니다."
        >
          {data.weeklyRoutines.map((item) => (
            <RoutineButton
              key={item.template.id}
              item={item}
              busy={busyTemplateId === item.template.id}
              onClick={() => openTemplate(item.template)}
            />
          ))}
        </DashboardSection>

        <DashboardSection
          icon={<Pin size={18} />}
          title="대표 메모"
          description="자주 확인할 투자 원칙과 행동 기준을 고정해둡니다."
          empty="메모 화면에서 핀 버튼을 눌러 고정할 수 있습니다."
        >
          {data.pinnedNotes.map((note) => (
            <NoteLink key={note.id} note={note} />
          ))}
        </DashboardSection>

        <DashboardSection
          icon={<BookOpenCheck size={18} />}
          title="최근 기록"
          description="최근 작성하거나 수정한 메모와 복기입니다."
          empty="아직 기록이 없습니다."
        >
          {data.recentItems.map((item) => (
            <UnifiedLink key={`${item.item_type}:${item.id}`} item={item} />
          ))}
        </DashboardSection>

        <DashboardSection
          icon={<Star size={18} />}
          title="자주 쓰는 템플릿"
          description="반복해서 쓰는 기록 양식을 바로 시작합니다."
          empty="템플릿이 없습니다."
        >
          {data.frequentTemplates.length ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {data.frequentTemplates.map((template) => (
                <button
                  key={template.id}
                  onClick={() => openTemplate(template)}
                  disabled={busyTemplateId === template.id}
                  className="flex h-11 items-center justify-between rounded border border-[#d7dbd3] px-3 text-left text-sm font-medium disabled:opacity-50"
                >
                  <span>{template.name}</span>
                  <Plus size={16} />
                </button>
              ))}
            </div>
          ) : null}
        </DashboardSection>
      </div>
    </AppChrome>
  );
}

function DashboardSection({
  icon,
  title,
  description,
  empty,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description?: string;
  empty: string;
  children: React.ReactNode;
}) {
  const childList = Children.toArray(children).filter(Boolean);
  return (
    <section>
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#2f6b4f]">
        {icon}
        {title}
      </div>
      {description ? (
        <p className="mb-2 text-sm leading-6 text-[#63685f]">{description}</p>
      ) : null}
      <div className="rounded border border-[#d9dcd6] bg-white px-4 py-2">
        {childList.length ? (
          childList
        ) : (
          <p className="py-5 text-center text-sm text-[#72786f]">{empty}</p>
        )}
      </div>
    </section>
  );
}

function RoutineButton({
  item,
  busy,
  onClick,
}: {
  item: DashboardRoutineItem;
  busy: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className="flex w-full items-center justify-between gap-3 border-t border-[#e3e5e0] py-3 text-left first:border-t-0 disabled:opacity-50"
    >
      <div>
        <p className="font-medium">{item.actionLabel}</p>
        <p className="mt-1 text-sm text-[#63685f]">
          {item.existingNote ? "이미 만든 루틴을 이어 씁니다." : "전용 폴더에 새 기록을 만듭니다."}
        </p>
      </div>
      <ArrowRight className="shrink-0 text-[#72786f]" size={17} />
    </button>
  );
}

function NoteLink({ note }: { note: Note }) {
  return (
    <Link
      href={`/notes/${note.id}?from=dashboard`}
      className="block border-t border-[#e3e5e0] py-3 first:border-t-0"
    >
      <p className="truncate font-medium">{note.title}</p>
      <p className="mt-1 line-clamp-2 text-sm leading-6 text-[#63685f]">
        {note.content_text || note.content || "내용 없음"}
      </p>
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
      className="block border-t border-[#e3e5e0] py-3 first:border-t-0"
    >
      <div className="flex items-center gap-2">
        <p className="truncate font-medium">{item.title}</p>
        {item.item_type === "review_session" ? (
          <span className="rounded bg-[#f5df92] px-2 py-0.5 text-xs text-[#69510f]">
            복기
          </span>
        ) : null}
      </div>
      <p className="mt-1 line-clamp-2 text-sm leading-6 text-[#63685f]">
        {item.preview}
      </p>
    </Link>
  );
}
