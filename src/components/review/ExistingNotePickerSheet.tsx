"use client";

import { Search, X } from "lucide-react";
import { formatKoreanDate } from "@/lib/date";
import type { Note } from "@/lib/types";

export function ExistingNotePickerSheet({
  error,
  loading,
  notes,
  onClose,
  onSearchChange,
  onSelect,
  search,
  selectedNoteIds,
}: {
  error: string;
  loading: boolean;
  notes: Note[];
  onClose: () => void;
  onSearchChange: (value: string) => void;
  onSelect: (note: Note) => void;
  search: string;
  selectedNoteIds: Set<string>;
}) {
  const pinnedNotes = notes.filter((note) => note.is_pinned);
  const recentNotes = notes.filter((note) => !note.is_pinned);

  return (
    <div className="fixed inset-0 z-40">
      <button
        type="button"
        className="absolute inset-0 bg-black/20"
        aria-label="기존 메모 닫기"
        onClick={onClose}
      />
      <section className="absolute inset-x-0 bottom-0 mx-auto max-h-[78vh] max-w-2xl overflow-hidden rounded-t-[28px] bg-bokgi-surface shadow-[0_-18px_45px_rgba(0,0,0,0.18)]">
        <div className="flex items-center justify-between border-b border-bokgi-border px-5 py-4">
          <div>
            <h2 className="text-[17px] font-semibold">기존 메모 불러오기</h2>
            <p className="mt-1 text-xs text-bokgi-muted">
              복기 중 수정할 메모를 최대 3개까지 고릅니다.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-bokgi-surface-muted text-bokgi-muted"
            aria-label="닫기"
          >
            <X size={17} />
          </button>
        </div>

        <div className="max-h-[calc(78vh-77px)] overflow-y-auto px-5 pb-6 pt-4">
          <label className="mb-4 flex h-11 items-center gap-2 rounded-[14px] bg-bokgi-surface-muted px-3">
            <Search size={17} className="text-bokgi-muted" />
            <input
              className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-bokgi-muted"
              placeholder="메모 검색"
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
            />
          </label>

          {error ? (
            <p className="mb-4 rounded-[14px] border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}
          {loading ? (
            <p className="py-8 text-center text-sm text-bokgi-muted">불러오는 중...</p>
          ) : null}
          {!loading && !notes.length ? (
            <p className="py-8 text-center text-sm text-bokgi-muted">
              불러올 메모가 없습니다.
            </p>
          ) : null}

          {pinnedNotes.length ? (
            <ExistingNoteGroup
              title="대표 메모"
              notes={pinnedNotes}
              onSelect={onSelect}
              selectedNoteIds={selectedNoteIds}
            />
          ) : null}
          {recentNotes.length ? (
            <ExistingNoteGroup
              title="최근 메모"
              notes={recentNotes}
              onSelect={onSelect}
              selectedNoteIds={selectedNoteIds}
            />
          ) : null}
        </div>
      </section>
    </div>
  );
}

function ExistingNoteGroup({
  notes,
  onSelect,
  selectedNoteIds,
  title,
}: {
  notes: Note[];
  onSelect: (note: Note) => void;
  selectedNoteIds: Set<string>;
  title: string;
}) {
  return (
    <section className="mt-5 first:mt-0">
      <h3 className="mb-2 px-1 text-xs font-semibold text-bokgi-muted">{title}</h3>
      <div className="overflow-hidden rounded-[18px] border border-bokgi-border bg-bokgi-surface">
        {notes.map((note) => {
          const selected = selectedNoteIds.has(note.id);
          return (
            <button
              key={note.id}
              type="button"
              onClick={() => onSelect(note)}
              disabled={selected}
              className="block w-full border-t border-bokgi-border-soft px-4 py-3 text-left first:border-t-0 disabled:opacity-50"
            >
              <span className="flex items-center justify-between gap-3">
                <span className="min-w-0 truncate text-sm font-semibold">{note.title}</span>
                {selected ? (
                  <span className="shrink-0 text-xs font-semibold text-bokgi-accent">
                    불러옴
                  </span>
                ) : null}
              </span>
              <span className="mt-1 block text-xs text-bokgi-muted">
                {formatKoreanDate(note.note_date)}
              </span>
              <span className="mt-2 block line-clamp-2 text-sm leading-6 text-bokgi-ink-soft">
                {note.content_text || note.content || "내용 없음"}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
