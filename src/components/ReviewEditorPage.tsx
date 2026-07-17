"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, CalendarDays, CheckCircle2, MoreHorizontal, Trash2 } from "lucide-react";
import { AppChrome } from "@/components/AppChrome";
import { LoadingState } from "@/components/LoadingState";
import { EditableReviewNoteCard } from "@/components/review/EditableReviewNoteCard";
import { ExistingNotePickerSheet } from "@/components/review/ExistingNotePickerSheet";
import { ReviewDraftBox } from "@/components/review/ReviewDraftBox";
import { ReviewSourceCard } from "@/components/review/ReviewSourceCard";
import { SetupNotice } from "@/components/SetupNotice";
import { useAutoSave } from "@/components/useAutoSave";
import { useRequireAuth } from "@/components/useRequireAuth";
import {
  attachEditableNote,
  deleteBlankDraftReview,
  getActiveNotes,
  getReviewWithSources,
  saveEditableNote,
  saveReview,
  trashReview,
} from "@/lib/data";
import { defaultReviewTitle, formatEditorDate } from "@/lib/date";
import { editorJsonOrText, toEditorPayload } from "@/lib/editor";
import type { Json, Note, ReviewSession, ReviewSourceItem } from "@/lib/types";

export function ReviewEditorPage({ reviewId }: { reviewId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { supabase, configured, user, loading } = useRequireAuth();
  const [review, setReview] = useState<ReviewSession | null>(null);
  const [sources, setSources] = useState<ReviewSourceItem[]>([]);
  const [editableNotes, setEditableNotes] = useState<Note[]>([]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [contentJson, setContentJson] = useState<Json>({ type: "doc", content: [] });
  const [contentText, setContentText] = useState("");
  const [reviewDate, setReviewDate] = useState("");
  const [editorPosition, setEditorPosition] = useState(0);
  const [noteSheetOpen, setNoteSheetOpen] = useState(false);
  const [noteSearch, setNoteSearch] = useState("");
  const [noteCandidates, setNoteCandidates] = useState<Note[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [noteSheetError, setNoteSheetError] = useState("");
  const [completing, setCompleting] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [isLoaded, setIsLoaded] = useState(false);
  const [actionMenuOpen, setActionMenuOpen] = useState(false);
  const backHref = searchParams.get("from") === "dashboard" ? "/dashboard" : null;
  const latest = useRef({
    review: null as ReviewSession | null,
    title: "",
    content: "",
    contentJson: { type: "doc", content: [] } as Json,
    contentText: "",
    reviewDate: "",
    editorPosition: 0,
  });

  useEffect(() => {
    if (!supabase || !user) return;
    const client = supabase;
    getReviewWithSources(client, reviewId)
      .then((data) => {
        setReview(data.review);
        setSources(data.sources);
        setEditableNotes(data.editableNotes);
        setTitle(data.review.title);
        setContent(data.review.content);
        setContentJson(editorJsonOrText(data.review.content_json, data.review.content));
        setContentText(data.review.content_text || data.review.content);
        setReviewDate(data.review.review_date);
        setEditorPosition(
          Math.min(
            Math.max(data.review.editor_position || 1, 1),
            Math.max(data.sources.length, 1),
          ),
        );
        setIsLoaded(true);
      })
      .catch((error) => {
        console.error(error);
        setLoadError("복기 세션을 찾지 못했습니다.");
    });
  }, [reviewId, supabase, user]);

  const autoSaveValue = useMemo(
    () => ({ content, contentJson, contentText, editorPosition, reviewDate, title }),
    [content, contentJson, contentText, editorPosition, reviewDate, title],
  );
  const currentReviewId = review?.id;

  const saveCurrentReview = useCallback(
    async (value: typeof autoSaveValue) => {
      if (!supabase || !currentReviewId) return;

      await saveReview(supabase, currentReviewId, {
        title: value.title,
        content: value.content,
        content_json: value.contentJson,
        content_text: value.contentText,
        review_date: value.reviewDate,
        editor_position: value.editorPosition,
      });
      setReview((current) =>
        current
          ? {
              ...current,
              title: value.title,
              content: value.content,
              content_json: value.contentJson,
              content_text: value.contentText,
              review_date: value.reviewDate,
              editor_position: value.editorPosition,
              is_draft:
                value.title.trim() === defaultReviewTitle(value.reviewDate) &&
                value.contentText.trim() === "",
            }
          : current,
      );
    },
    [currentReviewId, supabase],
  );

  const saveStatus = useAutoSave({
    enabled: Boolean(supabase && review && isLoaded),
    save: saveCurrentReview,
    skipInitial: true,
    value: autoSaveValue,
  });

  useEffect(() => {
    latest.current = {
      review,
      title,
      content,
      contentJson,
      contentText,
      reviewDate,
      editorPosition,
    };
  }, [content, contentJson, contentText, editorPosition, review, reviewDate, title]);

  useEffect(() => {
    if (!noteSheetOpen || !supabase) return;
    let ignore = false;

    getActiveNotes(supabase, noteSearch)
      .then((notes) => {
        if (ignore) return;
        setNoteCandidates(notes);
      })
      .catch((error) => {
        console.error(error);
        if (!ignore) setNoteSheetError("기존 메모를 불러오지 못했습니다.");
      })
      .finally(() => {
        if (!ignore) setNotesLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [noteSearch, noteSheetOpen, supabase]);

  useEffect(() => {
    return () => {
      const snapshot = latest.current;
      if (supabase && snapshot.review) {
        const savedDate = snapshot.reviewDate || snapshot.review.review_date;
        const savedTitle = snapshot.title || defaultReviewTitle(savedDate);
        const finalReview = {
          ...snapshot.review,
          title: savedTitle,
          content: snapshot.content,
          content_json: snapshot.contentJson,
          content_text: snapshot.contentText,
          review_date: savedDate,
          editor_position: snapshot.editorPosition,
        };

        if (
          savedTitle.trim() === defaultReviewTitle(savedDate) &&
          !snapshot.contentText.trim()
        ) {
          void deleteBlankDraftReview(supabase, finalReview);
        } else {
          void saveReview(supabase, snapshot.review.id, {
            title: savedTitle,
            content: snapshot.content,
            content_json: snapshot.contentJson,
            content_text: snapshot.contentText,
            review_date: savedDate,
            editor_position: snapshot.editorPosition,
          });
        }
      }
    };
  }, [supabase]);

  if (!configured) return <SetupNotice />;
  if (loadError) {
    return (
      <AppChrome>
        <div className="mx-auto max-w-3xl py-12 text-center">
          <p className="text-sm text-bokgi-ink-soft">{loadError}</p>
          <Link
            href="/folders"
            className="mt-5 inline-flex h-10 items-center rounded bg-bokgi-primary px-4 text-sm font-medium text-bokgi-primary-on"
          >
            폴더로 돌아가기
          </Link>
        </div>
      </AppChrome>
    );
  }
  if (loading || !supabase || !user || !review) return <LoadingState />;

  const client = supabase;
  const currentReview = review;

  function handleEditorChange(value: { contentJson: Json; contentText: string }) {
    const payload = toEditorPayload(value.contentJson, value.contentText);
    setContent(payload.content);
    setContentJson(payload.content_json);
    setContentText(payload.content_text);
  }

  function openExistingNotes() {
    setNoteSheetError("");
    setNoteCandidates([]);
    setNotesLoading(true);
    setNoteSheetOpen(true);
  }

  function handleNoteSearchChange(value: string) {
    setNoteSearch(value);
    setNoteSheetError("");
    setNotesLoading(true);
  }

  async function selectEditableNote(note: Note) {
    if (editableNotes.some((item) => item.id === note.id)) {
      setNoteSheetOpen(false);
      return;
    }
    if (editableNotes.length >= 3) {
      alert("기존 메모는 최대 3개까지 불러올 수 있습니다.");
      return;
    }
    try {
      await attachEditableNote(client, currentReview.id, note.id, editableNotes.length);
      setEditableNotes((current) => [...current, note]);
      setNoteSheetOpen(false);
    } catch (error) {
      alert(error instanceof Error ? error.message : "기존 메모를 불러오지 못했습니다.");
    }
  }

  async function handleEditableChange(
    note: Note,
    values: Pick<Note, "title" | "content" | "content_json" | "content_text" | "note_date">,
  ) {
    setEditableNotes((current) =>
      current.map((item) => (item.id === note.id ? { ...item, ...values } : item)),
    );
    await saveEditableNote(client, note.id, values);
  }

  async function handleTrash() {
    if (!window.confirm("이 복기 세션을 휴지통으로 이동할까요?")) return;
    await trashReview(client, currentReview.id);
    router.push(backHref ?? `/folders/${currentReview.folder_id}`);
  }

  async function completeReview() {
    setCompleting(true);
    try {
      const snapshot = latest.current;
      const savedDate = snapshot.reviewDate || currentReview.review_date;
      await saveCurrentReview({
        title: snapshot.title || defaultReviewTitle(savedDate),
        content: snapshot.content,
        contentJson: snapshot.contentJson,
        contentText: snapshot.contentText,
        editorPosition: snapshot.editorPosition,
        reviewDate: savedDate,
      });
      router.push(backHref ?? `/folders/${currentReview.folder_id}`);
    } catch (error) {
      alert(error instanceof Error ? error.message : "복기를 저장하지 못했습니다.");
      setCompleting(false);
    }
  }

  const toolbarLeading = (
    <Link
      href={backHref ?? `/folders/${review.folder_id}`}
      className="flex h-10 w-10 items-center justify-center rounded-full border border-bokgi-border bg-bokgi-surface text-bokgi-ink-soft shadow-[0_1px_2px_rgba(0,0,0,0.08)] hover:bg-bokgi-surface-hover hover:text-bokgi-ink"
      aria-label="뒤로"
      title="뒤로"
    >
      <ArrowLeft size={19} />
    </Link>
  );
  const toolbarTrailing = (
    <div className="relative">
      <button
        type="button"
        onClick={() => setActionMenuOpen((value) => !value)}
        className="flex h-10 w-10 items-center justify-center rounded-full border border-bokgi-border bg-bokgi-surface text-bokgi-ink-soft shadow-[0_1px_2px_rgba(0,0,0,0.08)] hover:bg-bokgi-surface-hover hover:text-bokgi-ink"
        aria-label="더보기"
        aria-expanded={actionMenuOpen}
        title="더보기"
      >
        <MoreHorizontal size={20} />
      </button>
      {actionMenuOpen ? (
        <div className="absolute right-0 top-12 z-[70] w-40 overflow-hidden rounded-[18px] border border-bokgi-border bg-bokgi-surface p-1 text-sm shadow-[0_18px_40px_rgba(0,0,0,0.16)]">
          <button
            type="button"
            onClick={() => {
              setActionMenuOpen(false);
              void completeReview();
            }}
            disabled={completing}
            className="flex w-full items-center gap-2 rounded-[13px] px-3 py-2.5 text-left text-bokgi-ink-soft hover:bg-bokgi-surface-hover hover:text-bokgi-ink disabled:opacity-50"
          >
            <CheckCircle2 size={16} />
            {completing ? "저장 중" : "완료"}
          </button>
          <button
            type="button"
            onClick={() => {
              setActionMenuOpen(false);
              void handleTrash();
            }}
            className="flex w-full items-center gap-2 rounded-[13px] px-3 py-2.5 text-left text-red-600 hover:bg-red-50"
          >
            <Trash2 size={16} />
            휴지통으로 이동
          </button>
        </div>
      ) : null}
    </div>
  );

  const editor = (
    <ReviewDraftBox
      key={review.id}
      contentJson={contentJson}
      toolbarLeading={toolbarLeading}
      toolbarTrailing={toolbarTrailing}
      onChange={handleEditorChange}
    />
  );
  const editableNoteIds = new Set(editableNotes.map((note) => note.id));

  return (
    <AppChrome>
      <div className="mx-auto max-w-3xl pb-8">
        {saveStatus === "error" ? (
          <p className="mb-4 rounded-[14px] border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            저장하지 못했습니다. 인터넷 연결을 확인해주세요.
          </p>
        ) : null}

        <section className="mb-6 space-y-3 px-1">
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            autoCapitalize="none"
            autoComplete="off"
            autoCorrect="off"
            className="w-full bg-transparent text-[30px] font-semibold leading-tight tracking-[-0.03em] outline-none"
            placeholder="복기 제목"
            spellCheck={false}
            tabIndex={-1}
          />
          <label className="relative inline-flex h-9 w-fit items-center gap-2 overflow-hidden rounded-full border border-bokgi-border bg-bokgi-surface px-3 text-sm font-medium text-bokgi-ink-soft shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            <CalendarDays size={15} />
            <span>{formatEditorDate(reviewDate)}</span>
            <input
              type="date"
              value={reviewDate}
              onChange={(event) => setReviewDate(event.target.value)}
              className="editor-date-input absolute inset-0 cursor-pointer opacity-0"
              aria-label="복기 날짜 선택"
              tabIndex={-1}
            />
          </label>
        </section>

        <section className="space-y-3">
          <div className="px-1">
            <h2 className="text-[28px] font-semibold leading-tight tracking-[-0.03em]">
              이번 주 기록
            </h2>
            <p className="mt-1 text-sm text-bokgi-muted">
              {sources.length ? `${sources.length}개 메모` : "복기할 메모가 없습니다."}
            </p>
          </div>

          <div className="rounded-[22px] border border-bokgi-border bg-bokgi-surface px-4 py-1">
            {sources.map((source, index) => (
              <div key={`${source.item_type}:${source.id}`}>
                <ReviewSourceCard
                  source={source}
                  onMoveInput={() => setEditorPosition(index + 1)}
                />
                {editorPosition === index + 1 ? editor : null}
              </div>
            ))}
            {!sources.length ? (
              <div className="py-4">
                {editor}
              </div>
            ) : null}
          </div>
        </section>

        <section className="mt-6 space-y-3">
          <div className="flex items-center justify-between gap-3 px-1">
            <div>
              <h2 className="text-[17px] font-semibold">수정할 기존 메모</h2>
              <p className="mt-1 text-xs text-bokgi-muted">
                복기 중 발견한 원칙을 원본 메모에 바로 반영합니다.
              </p>
            </div>
            <button
              type="button"
              onClick={openExistingNotes}
              className="h-8 shrink-0 rounded-full bg-bokgi-surface-muted px-3 text-xs font-semibold text-bokgi-accent"
            >
              불러오기
            </button>
          </div>
          <div className="space-y-3">
            {editableNotes.map((note) => (
              <EditableReviewNoteCard
                key={note.id}
                note={note}
                onChange={(values) => handleEditableChange(note, values)}
              />
            ))}
            {!editableNotes.length ? (
              <p className="rounded-[18px] border border-bokgi-border bg-bokgi-surface px-4 py-5 text-sm leading-6 text-bokgi-muted">
                투자 원칙이나 행동 기준 메모를 불러오면, 복기 화면에서 바로 수정할 수 있습니다.
              </p>
            ) : null}
          </div>
        </section>
      </div>

      {noteSheetOpen ? (
        <ExistingNotePickerSheet
          error={noteSheetError}
          loading={notesLoading}
          notes={noteCandidates}
          onClose={() => setNoteSheetOpen(false)}
          onSearchChange={handleNoteSearchChange}
          onSelect={selectEditableNote}
          search={noteSearch}
          selectedNoteIds={editableNoteIds}
        />
      ) : null}
    </AppChrome>
  );
}
