"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, CheckCircle2, Pin, PinOff, Trash2 } from "lucide-react";
import { AppChrome } from "@/components/AppChrome";
import { LoadingState } from "@/components/LoadingState";
import { RichTextEditor } from "@/components/RichTextEditor";
import { SetupNotice } from "@/components/SetupNotice";
import { useAutoSave } from "@/components/useAutoSave";
import { useRequireAuth } from "@/components/useRequireAuth";
import {
  completeReviewSchedule,
  deleteBlankDraftNote,
  getNote,
  saveNote,
  setNotePinned,
  trashNote,
} from "@/lib/data";
import { editorJsonOrText, toEditorPayload } from "@/lib/editor";
import type { Json, Note } from "@/lib/types";

const DEFAULT_NOTE_TITLE = "제목 없음";

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
  const reviewScheduleId = searchParams.get("reviewScheduleId");
  const backHref = searchParams.get("from") === "dashboard" ? "/dashboard" : null;
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
      .then((data) => {
        setNote(data);
        setTitle(data.title);
        setContent(data.content);
        setContentJson(editorJsonOrText(data.content_json, data.content));
        setContentText(data.content_text || data.content);
        setNoteDate(data.note_date);
        setIsLoaded(true);
      })
      .catch((error) => {
        console.error(error);
        setLoadError("메모를 찾지 못했습니다.");
    });
  }, [noteId, supabase, user]);

  const autoSaveValue = useMemo(
    () => ({ content, contentJson, contentText, noteDate, title }),
    [content, contentJson, contentText, noteDate, title],
  );
  const currentNoteId = note?.id;

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
    },
    [currentNoteId, supabase],
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

  return (
    <AppChrome>
      <div className="mb-4 flex items-center justify-between">
        <Link
          href={backHref ?? `/folders/${note.folder_id}`}
          className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-bokgi-surface-hover"
          aria-label="뒤로"
          title="뒤로"
        >
          <ArrowLeft size={19} />
        </Link>
        <div className="flex items-center gap-3">
          {reviewScheduleId ? (
            <button
              onClick={handleCompleteReview}
              disabled={completeBusy}
              className="flex h-10 items-center gap-2 rounded-full bg-bokgi-accent px-3 text-xs font-medium text-bokgi-primary-on disabled:opacity-50"
            >
              <CheckCircle2 size={16} />
              복기 완료
            </button>
          ) : null}
          <button
            onClick={handlePin}
            className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-bokgi-surface-hover"
            title={currentNote.is_pinned ? "대표 메모 해제" : "대표 메모 고정"}
            aria-label={currentNote.is_pinned ? "대표 메모 해제" : "대표 메모 고정"}
          >
            {currentNote.is_pinned ? <PinOff size={18} /> : <Pin size={18} />}
          </button>
          <button
            onClick={handleTrash}
            className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-bokgi-surface-hover"
            title="휴지통"
            aria-label="휴지통"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>

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
        <input
          type="date"
          value={noteDate}
          onChange={(event) => setNoteDate(event.target.value)}
          className="mt-3 rounded border border-bokgi-border bg-bokgi-surface px-3 py-2 text-sm text-bokgi-ink-soft outline-none"
          tabIndex={-1}
        />
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
            onChange={handleEditorChange}
          />
        </div>
      </div>
    </AppChrome>
  );
}
