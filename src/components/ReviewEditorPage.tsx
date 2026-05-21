"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowDownToLine, ArrowLeft, BookOpenCheck, Plus, Trash2 } from "lucide-react";
import { AppChrome } from "@/components/AppChrome";
import { LoadingState } from "@/components/LoadingState";
import { SaveState, SaveStatus } from "@/components/SaveStatus";
import { SetupNotice } from "@/components/SetupNotice";
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
import { defaultReviewTitle, formatKoreanDate } from "@/lib/date";
import type { Note, ReviewSession, ReviewSourceItem } from "@/lib/types";

export function ReviewEditorPage({ reviewId }: { reviewId: string }) {
  const { supabase, configured, user, loading } = useRequireAuth();
  const [review, setReview] = useState<ReviewSession | null>(null);
  const [sources, setSources] = useState<ReviewSourceItem[]>([]);
  const [editableNotes, setEditableNotes] = useState<Note[]>([]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [reviewDate, setReviewDate] = useState("");
  const [editorPosition, setEditorPosition] = useState(0);
  const [status, setStatus] = useState<SaveState>("idle");
  const [loadError, setLoadError] = useState("");
  const loaded = useRef(false);
  const latest = useRef({
    review: null as ReviewSession | null,
    title: "",
    content: "",
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
        setReviewDate(data.review.review_date);
        setEditorPosition(data.review.editor_position);
        loaded.current = true;
      })
      .catch((error) => {
        console.error(error);
        setLoadError("복기 세션을 찾지 못했습니다.");
      });
  }, [reviewId, supabase, user]);

  useEffect(() => {
    if (!supabase || !review || !loaded.current) return;
    setStatus("saving");
    const timeout = window.setTimeout(async () => {
      try {
        await saveReview(supabase, review.id, {
          title,
          content,
          review_date: reviewDate,
          editor_position: editorPosition,
        });
        setReview((current) =>
          current
            ? {
                ...current,
                title,
                content,
                review_date: reviewDate,
                editor_position: editorPosition,
                is_draft:
                  title.trim() === defaultReviewTitle(reviewDate) &&
                  content.trim() === "",
              }
            : current,
        );
        setStatus("saved");
      } catch (error) {
        console.error(error);
        setStatus("error");
      }
    }, 500);
    return () => window.clearTimeout(timeout);
  }, [content, editorPosition, review, reviewDate, supabase, title]);

  useEffect(() => {
    latest.current = { review, title, content, reviewDate, editorPosition };
  }, [content, editorPosition, review, reviewDate, title]);

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
          review_date: savedDate,
          editor_position: snapshot.editorPosition,
        };

        if (
          savedTitle.trim() === defaultReviewTitle(savedDate) &&
          !snapshot.content.trim()
        ) {
          void deleteBlankDraftReview(supabase, finalReview);
        } else {
          void saveReview(supabase, snapshot.review.id, {
            title: savedTitle,
            content: snapshot.content,
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
  if (loading || !supabase || !user || !review) return <LoadingState />;

  const client = supabase;
  const currentReview = review;

  async function addEditableNote() {
    const keyword = window.prompt("불러올 메모 검색어를 입력하세요", "");
    if (keyword === null) return;
    const candidates = await getActiveNotes(client, keyword);
    const filtered = candidates.filter(
      (note) => !editableNotes.some((item) => item.id === note.id),
    );
    const chosen = filtered[0];
    if (!chosen) {
      alert("불러올 메모를 찾지 못했습니다.");
      return;
    }
    if (editableNotes.length >= 3) {
      alert("기존 메모는 최대 3개까지 불러올 수 있습니다.");
      return;
    }
    await attachEditableNote(client, currentReview.id, chosen.id, editableNotes.length);
    setEditableNotes((current) => [...current, chosen]);
  }

  async function handleEditableChange(
    note: Note,
    values: Pick<Note, "title" | "content" | "note_date">,
  ) {
    setEditableNotes((current) =>
      current.map((item) => (item.id === note.id ? { ...item, ...values } : item)),
    );
    await saveEditableNote(client, note.id, values);
  }

  async function handleTrash() {
    if (!window.confirm("이 복기 세션을 휴지통으로 이동할까요?")) return;
    await trashReview(client, currentReview.id);
    window.location.href = `/folders/${currentReview.folder_id}`;
  }

  const editor = (
    <section className="my-4 rounded border border-[#dfd3bf] bg-white p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-medium text-[#2f6b4f]">
        <BookOpenCheck size={17} />
        복기 입력
      </div>
      <textarea
        value={content}
        onChange={(event) => setContent(event.target.value)}
        className="min-h-48 w-full resize-none bg-transparent text-base leading-7 outline-none"
        placeholder="읽으면서 복기 내용을 적어보세요"
      />
    </section>
  );

  return (
    <AppChrome>
      <div className="mb-4 flex items-center justify-between">
        <Link
          href={`/folders/${review.folder_id}`}
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
        />
        <input
          type="date"
          value={reviewDate}
          onChange={(event) => setReviewDate(event.target.value)}
          className="mt-3 rounded border border-[#d4d8d1] bg-white px-3 py-2 text-sm text-[#53584f] outline-none"
        />

        <div className="mt-6">
          {sources.map((source, index) => (
            <div key={`${source.item_type}:${source.id}`}>
              {editorPosition === index ? editor : null}
              <article className="my-4 rounded border border-[#d9dcd6] bg-white p-4">
                <div className="mb-2 flex items-center gap-2">
                  <h2 className="font-semibold">{source.title}</h2>
                  {source.item_type === "review_session" ? (
                    <span className="rounded bg-[#f5df92] px-2 py-0.5 text-xs text-[#69510f]">
                      복기
                    </span>
                  ) : null}
                </div>
                <p className="mb-4 text-xs text-[#72786f]">
                  {formatKoreanDate(source.display_date)}
                </p>
                <p className="whitespace-pre-wrap leading-7 text-[#2d2a25]">
                  {source.content || "내용 없음"}
                </p>
              </article>
              <button
                onClick={() => setEditorPosition(index + 1)}
                className="mx-auto flex h-9 items-center gap-2 rounded-full border border-[#c8cec4] bg-white px-3 text-xs text-[#63685f]"
              >
                <ArrowDownToLine size={15} />
                여기로 복기 입력창 이동
              </button>
            </div>
          ))}
          {editorPosition >= sources.length ? editor : null}
        </div>

        <section className="mt-8 border-t border-[#d4d8d1] pt-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">불러온 기존 메모</h2>
            <button
              onClick={addEditableNote}
              className="flex h-9 items-center gap-2 rounded-full bg-[#1f1f1f] px-3 text-xs font-medium text-white"
            >
              <Plus size={15} />
              불러오기
            </button>
          </div>
          <div className="space-y-4">
            {editableNotes.map((note) => (
              <EditableNote
                key={note.id}
                note={note}
                onChange={(values) => handleEditableChange(note, values)}
              />
            ))}
            {!editableNotes.length ? (
              <p className="text-sm text-[#72786f]">
                복기하면서 고칠 원칙 메모를 최대 3개까지 불러올 수 있습니다.
              </p>
            ) : null}
          </div>
        </section>
      </div>
    </AppChrome>
  );
}

function EditableNote({
  note,
  onChange,
}: {
  note: Note;
  onChange: (values: Pick<Note, "title" | "content" | "note_date">) => void;
}) {
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [noteDate, setNoteDate] = useState(note.note_date);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const timeout = window.setTimeout(() => {
      onChange({ title, content, note_date: noteDate });
    }, 500);
    return () => window.clearTimeout(timeout);
  }, [content, noteDate, onChange, title]);

  return (
    <div className="rounded border border-[#d9dcd6] bg-white p-4">
      <input
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        className="w-full bg-transparent font-semibold outline-none"
      />
      <input
        type="date"
        value={noteDate}
        onChange={(event) => setNoteDate(event.target.value)}
        className="mt-3 rounded border border-[#d4d8d1] px-3 py-2 text-sm"
      />
      <textarea
        value={content}
        onChange={(event) => setContent(event.target.value)}
        className="mt-3 min-h-32 w-full resize-none bg-transparent leading-7 outline-none"
      />
    </div>
  );
}
