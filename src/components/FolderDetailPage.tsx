"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { BookOpenCheck, Check, Plus, Search, Trash2 } from "lucide-react";
import { AppChrome } from "@/components/AppChrome";
import { LoadingState } from "@/components/LoadingState";
import { SetupNotice } from "@/components/SetupNotice";
import { useRequireAuth } from "@/components/useRequireAuth";
import {
  createDraftNote,
  createReviewDraft,
  getFolders,
  getUnifiedItems,
  trashNote,
  trashReview,
} from "@/lib/data";
import { formatKoreanDate } from "@/lib/date";
import type { Folder, UnifiedItem } from "@/lib/types";

export function FolderDetailPage({ folderId }: { folderId: string }) {
  const { supabase, configured, user, loading } = useRequireAuth();
  const [folder, setFolder] = useState<Folder | null>(null);
  const [items, setItems] = useState<UnifiedItem[]>([]);
  const [selected, setSelected] = useState<Record<string, UnifiedItem>>({});
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

  async function handleNewNote() {
    setBusy(true);
    const note = await createDraftNote(client, currentUser.id, folderId);
    window.location.href = `/notes/${note.id}`;
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
    window.location.href = `/reviews/${review.id}`;
  }

  async function handleTrash(item: UnifiedItem) {
    if (!window.confirm(`'${item.title}' 항목을 휴지통으로 이동할까요?`)) return;
    if (item.item_type === "note") await trashNote(client, item.id);
    else await trashReview(client, item.id);
    await refresh();
  }

  return (
    <AppChrome>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold">{folder?.name ?? "폴더"}</h1>
          <p className="mt-1 text-sm text-[#63685f]">최신 등록순으로 정리됩니다.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={startReview}
            disabled={busy || !selectedItems.length}
            className="flex h-11 items-center gap-2 rounded-full border border-[#c8cec4] bg-white px-4 text-sm font-medium disabled:opacity-40"
          >
            <BookOpenCheck size={18} />
            복기
          </button>
          <button
            onClick={handleNewNote}
            disabled={busy}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-[#1f1f1f] text-white disabled:opacity-50"
            title="새 메모"
            aria-label="새 메모"
          >
            <Plus size={22} />
          </button>
        </div>
      </div>

      <label className="mb-4 flex h-11 items-center gap-2 rounded border border-[#d4d8d1] bg-white px-3">
        <Search size={18} className="text-[#72786f]" />
        <input
          className="min-w-0 flex-1 bg-transparent text-sm outline-none"
          placeholder="제목 또는 본문 검색"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>

      <div className="divide-y divide-[#e1e3de] overflow-hidden rounded border border-[#d9dcd6] bg-white">
        {items.map((item) => {
          const key = `${item.item_type}:${item.id}`;
          const checked = Boolean(selected[key]);
          return (
            <div key={key} className="flex items-start gap-3 px-4 py-4">
              <button
                onClick={() => toggle(item)}
                className={`mt-1 flex h-6 w-6 items-center justify-center rounded border ${
                  checked ? "border-[#1f1f1f] bg-[#1f1f1f] text-white" : "border-[#bac2b5]"
                }`}
                title="복기 원본 선택"
                aria-label="복기 원본 선택"
              >
                {checked ? <Check size={15} /> : null}
              </button>
              <Link
                href={item.item_type === "note" ? `/notes/${item.id}` : `/reviews/${item.id}`}
                className="min-w-0 flex-1"
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
                <p className="mt-2 text-xs text-[#838a80]">{formatKoreanDate(item.display_date)}</p>
              </Link>
              <button
                onClick={() => handleTrash(item)}
                className="flex h-9 w-9 items-center justify-center rounded-full text-[#63685f] hover:bg-[#eef1ec]"
                title="휴지통"
                aria-label="휴지통"
              >
                <Trash2 size={17} />
              </button>
            </div>
          );
        })}
        {!items.length ? (
          <div className="px-4 py-10 text-center text-sm text-[#72786f]">
            아직 항목이 없습니다. + 버튼으로 메모를 시작하세요.
          </div>
        ) : null}
      </div>
    </AppChrome>
  );
}
