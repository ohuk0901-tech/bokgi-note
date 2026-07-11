"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Check, ChevronLeft, Search, Trash2 } from "lucide-react";
import { AppChrome } from "@/components/AppChrome";
import { LoadingState } from "@/components/LoadingState";
import { SetupNotice } from "@/components/SetupNotice";
import { useRequireAuth } from "@/components/useRequireAuth";
import {
  createReviewDraft,
  getFolders,
  getUnifiedItems,
  trashNote,
  trashReview,
} from "@/lib/data";
import { formatKoreanDate } from "@/lib/date";
import type { Folder, UnifiedItem } from "@/lib/types";

const WEEKDAYS = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];

function formatDateWithWeekday(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  const day = WEEKDAYS[date.getDay()] ?? "";
  return `${formatKoreanDate(value)} ${day}`;
}

export function FolderDetailPage({ folderId }: { folderId: string }) {
  const router = useRouter();
  const { supabase, configured, user, loading } = useRequireAuth();
  const [folder, setFolder] = useState<Folder | null>(null);
  const [items, setItems] = useState<UnifiedItem[]>([]);
  const [selected, setSelected] = useState<Record<string, UnifiedItem>>({});
  const [selectionMode, setSelectionMode] = useState(false);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);

  const selectedItems = useMemo(() => Object.values(selected), [selected]);

  useEffect(() => {
    if (!supabase || !user) return;
    const client = supabase;
    async function load() {
      const [folders, list] = await Promise.all([
        getFolders(client),
        getUnifiedItems(client, folderId, query),
      ]);
      setFolder(folders.find((item) => item.id === folderId) ?? null);
      setItems(list);
    }
    load().catch(console.error);
  }, [folderId, query, supabase, user]);

  if (!configured) return <SetupNotice />;
  if (loading || !supabase || !user) return <LoadingState />;

  const client = supabase;
  const currentUser = user;

  async function refresh() {
    setItems(await getUnifiedItems(client, folderId, query));
  }

  function toggleSelectionMode() {
    setSelectionMode((value) => {
      if (value) setSelected({});
      return !value;
    });
  }

  function toggle(item: UnifiedItem) {
    const key = `${item.item_type}:${item.id}`;
    setSelected((current) => {
      if (current[key]) {
        const next = { ...current };
        delete next[key];
        return next;
      }
      if (Object.keys(current).length >= 6) {
        alert("복기 원본은 최대 6개까지 선택할 수 있습니다.");
        return current;
      }
      return { ...current, [key]: item };
    });
  }

  async function startReview() {
    if (!selectedItems.length) {
      alert("복기할 항목을 선택해주세요.");
      return;
    }
    setBusy(true);
    const review = await createReviewDraft(
      client,
      currentUser.id,
      folderId,
      selectedItems.map((item) => ({ type: item.item_type, id: item.id })),
    );
    router.push(`/reviews/${review.id}`);
  }

  async function handleTrash(item: UnifiedItem) {
    if (!window.confirm(`'${item.title}' 항목을 휴지통으로 이동할까요?`)) return;
    if (item.item_type === "note") await trashNote(client, item.id);
    else await trashReview(client, item.id);
    await refresh();
  }

  return (
    <AppChrome quickNoteDefaultFolderId={folderId}>
      <div className="pb-24">
        <div className="mb-5 flex items-center justify-between gap-3">
          <Link
            href="/folders"
            className="flex min-w-0 items-center gap-1 text-sm font-medium text-bokgi-accent"
          >
            <ChevronLeft size={18} />
            폴더
          </Link>
          <button
            type="button"
            onClick={toggleSelectionMode}
            className="rounded-full px-2 py-1 text-sm font-medium text-bokgi-accent"
          >
            {selectionMode ? "취소" : "선택"}
          </button>
        </div>

        <div className="mb-4 px-1">
          <h1 className="truncate text-[34px] font-semibold leading-tight tracking-[-0.03em]">
            {folder?.name ?? "폴더"}
          </h1>
          <p className="mt-2 text-sm text-bokgi-muted">{items.length}개 기록</p>
        </div>

        <label className="mb-4 flex h-11 items-center gap-2 rounded-[14px] bg-bokgi-surface-muted px-3">
          <Search size={17} className="text-bokgi-muted" />
          <input
            className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-bokgi-muted"
            placeholder="검색"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>

        <div className="overflow-hidden rounded-[22px] border border-bokgi-border bg-bokgi-surface px-4 py-1">
          {items.map((item) => {
            const key = `${item.item_type}:${item.id}`;
            const checked = Boolean(selected[key]);
            const href = item.item_type === "note" ? `/notes/${item.id}` : `/reviews/${item.id}`;
            const rowContent = (
              <>
                {selectionMode ? (
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
                      checked
                        ? "border-bokgi-primary bg-bokgi-primary text-bokgi-primary-on"
                        : "border-bokgi-border"
                    }`}
                    aria-hidden="true"
                  >
                    {checked ? <Check size={14} /> : null}
                  </span>
                ) : null}
                <span className="min-w-0 flex-1 text-left">
                  <span className="block truncate font-medium leading-5">{item.title}</span>
                  <span className="mt-0.5 block truncate text-xs text-bokgi-muted">
                    {formatDateWithWeekday(item.display_date)}
                  </span>
                </span>
                {selectionMode ? null : (
                  <ArrowRight className="ml-auto shrink-0 text-bokgi-muted" size={17} />
                )}
              </>
            );

            return selectionMode ? (
              <button
                key={key}
                type="button"
                onClick={() => toggle(item)}
                className="flex min-h-[60px] w-full items-center gap-3 border-t border-bokgi-border-soft py-3 first:border-t-0"
                aria-pressed={checked}
              >
                {rowContent}
              </button>
            ) : (
              <div
                key={key}
                className="flex min-h-[60px] items-center gap-2 border-t border-bokgi-border-soft first:border-t-0"
              >
                <Link
                  href={href}
                  className="flex min-w-0 flex-1 items-center gap-3 py-3"
                >
                  {rowContent}
                </Link>
                <button
                  type="button"
                  onClick={() => handleTrash(item)}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-bokgi-muted hover:bg-bokgi-surface-hover"
                  title="휴지통"
                  aria-label="휴지통"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            );
          })}
          {!items.length ? (
            <div className="px-4 py-10 text-center text-sm text-bokgi-muted">
              아직 항목이 없습니다. 상단의 메모로 시작하세요.
            </div>
          ) : null}
        </div>

        {selectionMode ? (
          <div className="fixed inset-x-0 bottom-0 z-30 border-t border-bokgi-border bg-bokgi-bg/95 px-4 py-3 backdrop-blur">
            <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
              <span className="text-sm font-medium text-bokgi-ink-soft">
                {selectedItems.length}개 선택됨
              </span>
              <button
                type="button"
                onClick={startReview}
                disabled={busy || !selectedItems.length}
                className="h-10 rounded-full bg-bokgi-primary px-5 text-sm font-semibold text-bokgi-primary-on disabled:opacity-40"
              >
                복기 시작
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </AppChrome>
  );
}
