"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  FileDown,
  MoreHorizontal,
  Pin,
  PinOff,
  Trash2,
} from "lucide-react";
import { AppChrome } from "@/components/AppChrome";
import { LoadingState } from "@/components/LoadingState";
import { RichTextEditor } from "@/components/RichTextEditor";
import { SetupNotice } from "@/components/SetupNotice";
import { useAutoSave } from "@/components/useAutoSave";
import { useRequireAuth } from "@/components/useRequireAuth";
import {
  changedTextLength,
  completeReviewSchedule,
  daysFromToday,
  deleteBlankDraftNote,
  getNote,
  isMeaningfulTextChange,
  saveNote,
  setNotePinned,
  textChangeBucket,
  trackAnalyticsEvent,
  trashNote,
} from "@/lib/data";
import { formatEditorDate } from "@/lib/date";
import { editorJsonOrText, toEditorPayload } from "@/lib/editor";
import { downloadMarkdownFile, markdownFileForNote } from "@/lib/markdown-export";
import type { Json, Note, ReviewSchedule, TemplateKind } from "@/lib/types";

const DEFAULT_NOTE_TITLE = "제목 없음";

type NoteAnalyticsContext = {
  baselineContentText: string;
  dueReviewNoteEdited: boolean;
  dueReviewSchedule: Pick<
    ReviewSchedule,
    "due_date" | "id" | "note_id" | "review_type"
  > | null;
  investmentJournalEdited: boolean;
  templateKind: TemplateKind | null;
};

export function NoteEditorPage({ noteId }: { noteId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { supabase, configured, user, loading } = useRequireAuth();
  const [note, setNote] = useState<Note | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [contentJson, setContentJson] = useState<Json>({ type: "doc", content: [] });
  const [contentText, setContentText] = useState("");
  const [noteDate, setNoteDate] = useState("");
  const [loadError, setLoadError] = useState("");
  const [isLoaded, setIsLoaded] = useState(false);
  const [completeBusy, setCompleteBusy] = useState(false);
  const [actionMenuOpen, setActionMenuOpen] = useState(false);
  const reviewScheduleId = searchParams.get("reviewScheduleId");
  const backHref = searchParams.get("from") === "dashboard" ? "/dashboard" : null;
  const analyticsUserId = user?.id ?? null;
  const analyticsContext = useRef<NoteAnalyticsContext>({
    baselineContentText: "",
    dueReviewNoteEdited: false,
    dueReviewSchedule: null,
    investmentJournalEdited: false,
    templateKind: null,
  });
  const latest = useRef({
    note: null as Note | null,
    title: "",
    content: "",
    contentJson: { type: "doc", content: [] } as Json,
    contentText: "",
    noteDate: "",
  });

  useEffect(() => {
    if (!supabase || !user) return;
    const client = supabase;
    getNote(client, noteId)
      .then(async (data) => {
        setNote(data);
        setTitle(data.title);
        setContent(data.content);
        setContentJson(editorJsonOrText(data.content_json, data.content));
        setContentText(data.content_text || data.content);
        setNoteDate(data.note_date);
        setIsLoaded(true);

        analyticsContext.current = {
          baselineContentText: data.content_text || data.content,
          dueReviewNoteEdited: false,
          dueReviewSchedule: null,
          investmentJournalEdited: false,
          templateKind: null,
        };

        if (data.template_id) {
          const { data: template, error: templateError } = await client
            .from("templates")
            .select("template_kind")
            .eq("id", data.template_id)
            .eq("user_id", user.id)
            .maybeSingle();
          if (templateError) throw templateError;
          analyticsContext.current.templateKind = template?.template_kind ?? null;
        }

        if (reviewScheduleId) {
          const { data: schedule, error: scheduleError } = await client
            .from("review_schedules")
            .select("id, note_id, review_type, due_date")
            .eq("id", reviewScheduleId)
            .eq("note_id", data.id)
            .eq("user_id", user.id)
            .maybeSingle();
          if (scheduleError) throw scheduleError;

          if (schedule) {
            analyticsContext.current.dueReviewSchedule = schedule;
            await trackAnalyticsEvent(client, user.id, "due_review_note_opened", {
              eventKey: `review_schedule:${schedule.id}`,
              properties: {
                days_overdue: daysFromToday(schedule.due_date),
                due_date: schedule.due_date,
                note_id: schedule.note_id,
                review_schedule_id: schedule.id,
                review_type: schedule.review_type,
                source: getRouteSource(reviewScheduleId, searchParams.get("from")),
              },
            });
          }
        }
      })
      .catch((error) => {
        console.error(error);
        setLoadError("메모를 찾지 못했습니다.");
    });
  }, [noteId, reviewScheduleId, searchParams, supabase, user]);

  const autoSaveValue = useMemo(
    () => ({ content, contentJson, contentText, noteDate, title }),
    [content, contentJson, contentText, noteDate, title],
  );
  const currentNoteId = note?.id;

  const trackNoteEditEvents = useCallback(
    async (nextContentText: string) => {
      if (!supabase || !analyticsUserId || !currentNoteId) return;

      const analytics = analyticsContext.current;
      if (
        analytics.templateKind === "investment_journal" &&
        !analytics.investmentJournalEdited &&
        isMeaningfulTextChange(analytics.baselineContentText, nextContentText)
      ) {
        const changeLength = changedTextLength(analytics.baselineContentText, nextContentText);
        const recorded = await trackAnalyticsEvent(
          supabase,
          analyticsUserId,
          "investment_journal_edited",
          {
            eventKey: `note:${currentNoteId}`,
            properties: {
              delta_text_length_bucket: textChangeBucket(changeLength),
              journal_date: noteDate,
              note_id: currentNoteId,
              source: getRouteSource(reviewScheduleId, searchParams.get("from")),
            },
          },
        );
        if (recorded) analytics.investmentJournalEdited = true;
      }

      const schedule = analytics.dueReviewSchedule;
      if (
        schedule &&
        !analytics.dueReviewNoteEdited &&
        isMeaningfulTextChange(analytics.baselineContentText, nextContentText)
      ) {
        const changeLength = changedTextLength(analytics.baselineContentText, nextContentText);
        const recorded = await trackAnalyticsEvent(
          supabase,
          analyticsUserId,
          "due_review_note_edited",
          {
            eventKey: `review_schedule:${schedule.id}`,
            properties: {
              delta_text_length_bucket: textChangeBucket(changeLength),
              note_id: schedule.note_id,
              review_schedule_id: schedule.id,
              review_type: schedule.review_type,
              source: getRouteSource(reviewScheduleId, searchParams.get("from")),
            },
          },
        );
        if (recorded) analytics.dueReviewNoteEdited = true;
      }
    },
    [analyticsUserId, currentNoteId, noteDate, reviewScheduleId, searchParams, supabase],
  );

  const saveCurrentNote = useCallback(
    async (value: typeof autoSaveValue) => {
      if (!supabase || !currentNoteId) return;

      const savedTitle = value.title || DEFAULT_NOTE_TITLE;
      await saveNote(supabase, currentNoteId, {
        title: savedTitle,
        content: value.content,
        content_json: value.contentJson,
        content_text: value.contentText,
        note_date: value.noteDate,
      });
      setNote((current) =>
        current
          ? {
              ...current,
              title: savedTitle,
              content: value.content,
              content_json: value.contentJson,
              content_text: value.contentText,
              note_date: value.noteDate,
              is_draft:
                savedTitle.trim() === DEFAULT_NOTE_TITLE &&
                value.contentText.trim() === "",
            }
          : current,
      );
      await trackNoteEditEvents(value.contentText);
    },
    [currentNoteId, supabase, trackNoteEditEvents],
  );

  const saveStatus = useAutoSave({
    enabled: Boolean(supabase && note && isLoaded),
    save: saveCurrentNote,
    skipInitial: true,
    value: autoSaveValue,
  });

  useEffect(() => {
    latest.current = { note, title, content, contentJson, contentText, noteDate };
  }, [content, contentJson, contentText, note, noteDate, title]);

  useEffect(() => {
    return () => {
      const snapshot = latest.current;
      if (supabase && snapshot.note) {
        const savedTitle = snapshot.title || DEFAULT_NOTE_TITLE;
        const savedDate = snapshot.noteDate || snapshot.note.note_date;
        const finalNote = {
          ...snapshot.note,
          title: savedTitle,
          content: snapshot.content,
          content_json: snapshot.contentJson,
          content_text: snapshot.contentText,
          note_date: savedDate,
        };

        if (
          savedTitle.trim() === DEFAULT_NOTE_TITLE &&
          !snapshot.contentText.trim()
        ) {
          void deleteBlankDraftNote(supabase, finalNote);
        } else {
          void saveNote(supabase, snapshot.note.id, {
            title: savedTitle,
            content: snapshot.content,
            content_json: snapshot.contentJson,
            content_text: snapshot.contentText,
            note_date: savedDate,
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
  if (loading || !supabase || !user || !note) return <LoadingState />;

  const client = supabase;
  const currentUser = user;
  const currentNote = note;

  async function handleTrash() {
    if (!window.confirm("이 메모를 휴지통으로 이동할까요?")) return;
    await trashNote(client, currentNote.id);
    router.push(backHref ?? `/folders/${currentNote.folder_id}`);
  }

  async function handlePin() {
    try {
      await setNotePinned(client, currentUser.id, currentNote.id, !currentNote.is_pinned);
      setNote((value) =>
        value
          ? {
              ...value,
              is_pinned: !value.is_pinned,
              pinned_at: !value.is_pinned ? new Date().toISOString() : null,
            }
          : value,
      );
    } catch (error) {
      alert(error instanceof Error ? error.message : "대표 메모를 변경하지 못했습니다.");
    }
  }

  async function handleExportMarkdown() {
    try {
      const savedTitle = autoSaveValue.title || DEFAULT_NOTE_TITLE;
      await saveCurrentNote({ ...autoSaveValue, title: savedTitle });
      downloadMarkdownFile(
        markdownFileForNote({
          ...currentNote,
          title: savedTitle,
          content: autoSaveValue.content,
          content_json: autoSaveValue.contentJson,
          content_text: autoSaveValue.contentText,
          note_date: autoSaveValue.noteDate,
          updated_at: new Date().toISOString(),
        }),
      );
    } catch (error) {
      alert(error instanceof Error ? error.message : "파일로 저장하지 못했습니다.");
    }
  }

  async function handleCompleteReview() {
    if (!reviewScheduleId) return;
    setCompleteBusy(true);
    try {
      await completeReviewSchedule(client, currentUser.id, reviewScheduleId);
      router.replace(`/notes/${currentNote.id}`);
    } catch (error) {
      alert(error instanceof Error ? error.message : "복기를 완료하지 못했습니다.");
      setCompleteBusy(false);
    }
  }

  function handleEditorChange(value: { contentJson: Json; contentText: string }) {
    const payload = toEditorPayload(value.contentJson, value.contentText);
    setContent(payload.content);
    setContentJson(payload.content_json);
    setContentText(payload.content_text);
  }

  const toolbarLeading = (
    <Link
      href={backHref ?? `/folders/${note.folder_id}`}
      className="flex h-10 w-10 items-center justify-center rounded-full border border-bokgi-border bg-bokgi-surface text-bokgi-ink-soft shadow-[0_1px_2px_rgba(0,0,0,0.08)] hover:bg-bokgi-surface-hover hover:text-bokgi-ink"
      aria-label="뒤로"
      title="뒤로"
    >
      <ArrowLeft size={19} />
    </Link>
  );
  const toolbarTrailing = (
    <div className="flex items-center gap-2">
      {reviewScheduleId ? (
        <button
          type="button"
          onClick={() => {
            void handleCompleteReview();
          }}
          disabled={completeBusy}
          className="flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-bokgi-primary bg-bokgi-primary px-3 text-sm font-semibold text-bokgi-primary-on shadow-[0_1px_2px_rgba(0,0,0,0.08)] hover:bg-bokgi-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
          aria-label="복기 완료"
          title="복기 완료"
        >
          <CheckCircle2 size={16} />
          <span className="hidden min-[390px]:inline">
            {completeBusy ? "처리 중" : "복기 완료"}
          </span>
          <span className="min-[390px]:hidden">
            {completeBusy ? "중" : "완료"}
          </span>
        </button>
      ) : null}
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
          <div className="absolute right-0 top-12 z-[70] w-44 overflow-hidden rounded-[18px] border border-bokgi-border bg-bokgi-surface p-1 text-sm shadow-[0_18px_40px_rgba(0,0,0,0.16)]">
            <button
              type="button"
              onClick={() => {
                setActionMenuOpen(false);
                void handleExportMarkdown();
              }}
              className="flex w-full items-center gap-2 rounded-[13px] px-3 py-2.5 text-left text-bokgi-ink-soft hover:bg-bokgi-surface-hover hover:text-bokgi-ink"
            >
              <FileDown size={16} />
              파일로 저장
            </button>
            <button
              type="button"
              onClick={() => {
                setActionMenuOpen(false);
                void handlePin();
              }}
              className="flex w-full items-center gap-2 rounded-[13px] px-3 py-2.5 text-left text-bokgi-ink-soft hover:bg-bokgi-surface-hover hover:text-bokgi-ink"
            >
              {currentNote.is_pinned ? <PinOff size={16} /> : <Pin size={16} />}
              {currentNote.is_pinned ? "대표 메모 해제" : "대표 메모 고정"}
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
    </div>
  );

  return (
    <AppChrome>
      <div className="mx-auto max-w-3xl">
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          autoCapitalize="none"
          autoComplete="off"
          autoCorrect="off"
          className="w-full bg-transparent text-3xl font-semibold outline-none"
          placeholder={DEFAULT_NOTE_TITLE}
          spellCheck={false}
          tabIndex={-1}
        />
        <label className="relative mt-3 inline-flex h-9 items-center gap-2 overflow-hidden rounded-full border border-bokgi-border bg-bokgi-surface px-3 text-sm font-medium text-bokgi-ink-soft shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <CalendarDays size={15} />
          <span>{formatEditorDate(noteDate)}</span>
          <input
            type="date"
            value={noteDate}
            onChange={(event) => setNoteDate(event.target.value)}
            className="editor-date-input absolute inset-0 cursor-pointer opacity-0"
            aria-label="메모 날짜 선택"
            tabIndex={-1}
          />
        </label>
        {saveStatus === "error" ? (
          <p className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            저장하지 못했습니다. 인터넷 연결을 확인해주세요.
          </p>
        ) : null}
        <div className="mt-6">
          <RichTextEditor
            key={note.id}
            contentJson={contentJson}
            stickyToolbar
            toolbarLeading={toolbarLeading}
            toolbarTrailing={toolbarTrailing}
            onChange={handleEditorChange}
          />
        </div>
      </div>
    </AppChrome>
  );
}

function getRouteSource(reviewScheduleId: string | null, from: string | null) {
  if (reviewScheduleId) return from === "dashboard" ? "dashboard" : "review_due";
  return from ?? "direct";
}
