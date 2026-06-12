"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Trash2 } from "lucide-react";
import { AppChrome } from "@/components/AppChrome";
import { LoadingState } from "@/components/LoadingState";
import { SaveStatus } from "@/components/SaveStatus";
import { SetupNotice } from "@/components/SetupNotice";
import { useAutoSave } from "@/components/useAutoSave";
import { useRequireAuth } from "@/components/useRequireAuth";
import { deleteBlankDraftNote, getNote, saveNote, trashNote } from "@/lib/data";
import type { Note } from "@/lib/types";

const DEFAULT_NOTE_TITLE = "제목 없음";

export function NoteEditorPage({ noteId }: { noteId: string }) {
  const router = useRouter();
  const { supabase, configured, user, loading } = useRequireAuth();
  const [note, setNote] = useState<Note | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [noteDate, setNoteDate] = useState("");
  const [loadError, setLoadError] = useState("");
  const [isLoaded, setIsLoaded] = useState(false);
  const latest = useRef({
    note: null as Note | null,
    title: "",
    content: "",
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
        setNoteDate(data.note_date);
        setIsLoaded(true);
      })
      .catch((error) => {
        console.error(error);
        setLoadError("메모를 찾지 못했습니다.");
    });
  }, [noteId, supabase, user]);

  const autoSaveValue = useMemo(
    () => ({ content, noteDate, title }),
    [content, noteDate, title],
  );
  const currentNoteId = note?.id;

  const saveCurrentNote = useCallback(
    async (value: typeof autoSaveValue) => {
      if (!supabase || !currentNoteId) return;

      const savedTitle = value.title || DEFAULT_NOTE_TITLE;
      await saveNote(supabase, currentNoteId, {
        title: savedTitle,
        content: value.content,
        note_date: value.noteDate,
      });
      setNote((current) =>
        current
          ? {
              ...current,
              title: savedTitle,
              content: value.content,
              note_date: value.noteDate,
              is_draft:
                savedTitle.trim() === DEFAULT_NOTE_TITLE &&
                value.content.trim() === "",
            }
          : current,
      );
    },
    [currentNoteId, supabase],
  );

  const status = useAutoSave({
    enabled: Boolean(supabase && note && isLoaded),
    save: saveCurrentNote,
    skipInitial: true,
    value: autoSaveValue,
  });

  useEffect(() => {
    latest.current = { note, title, content, noteDate };
  }, [content, note, noteDate, title]);

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
          note_date: savedDate,
        };

        if (
          savedTitle.trim() === DEFAULT_NOTE_TITLE &&
          !snapshot.content.trim()
        ) {
          void deleteBlankDraftNote(supabase, finalNote);
        } else {
          void saveNote(supabase, snapshot.note.id, {
            title: savedTitle,
            content: snapshot.content,
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
          <p className="text-sm text-[#63685f]">{loadError}</p>
          <Link
            href="/folders"
            className="mt-5 inline-flex h-10 items-center rounded bg-[#1f1f1f] px-4 text-sm font-medium text-white"
          >
            폴더로 돌아가기
          </Link>
        </div>
      </AppChrome>
    );
  }
  if (loading || !supabase || !user || !note) return <LoadingState />;

  const client = supabase;
  const currentNote = note;

  async function handleTrash() {
    if (!window.confirm("이 메모를 휴지통으로 이동할까요?")) return;
    await trashNote(client, currentNote.id);
    router.push(`/folders/${currentNote.folder_id}`);
  }

  return (
    <AppChrome>
      <div className="mb-4 flex items-center justify-between">
        <Link
          href={`/folders/${note.folder_id}`}
          className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-[#ebeee9]"
          aria-label="뒤로"
          title="뒤로"
        >
          <ArrowLeft size={19} />
        </Link>
        <div className="flex items-center gap-3">
          <SaveStatus state={status} />
          <button
            onClick={handleTrash}
            className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-[#ebeee9]"
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
          className="w-full bg-transparent text-3xl font-semibold outline-none"
          placeholder={DEFAULT_NOTE_TITLE}
        />
        <input
          type="date"
          value={noteDate}
          onChange={(event) => setNoteDate(event.target.value)}
          className="mt-3 rounded border border-[#d4d8d1] bg-white px-3 py-2 text-sm text-[#53584f] outline-none"
        />
        <textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          className="mt-6 min-h-[60vh] w-full resize-none bg-transparent text-lg leading-8 outline-none"
          placeholder="내용을 입력하세요"
        />
      </div>
    </AppChrome>
  );
}
