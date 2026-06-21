"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { AppChrome } from "@/components/AppChrome";
import { LoadingState } from "@/components/LoadingState";
import { EditableReviewNoteCard } from "@/components/review/EditableReviewNoteCard";
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
import { defaultReviewTitle } from "@/lib/date";
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
  const [loadError, setLoadError] = useState("");
  const [isLoaded, setIsLoaded] = useState(false);
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
        setEditorPosition(data.review.editor_position);
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

  function handleEditorChange(value: { contentJson: Json; contentText: string }) {
    const payload = toEditorPayload(value.contentJson, value.contentText);
    setContent(payload.content);
    setContentJson(payload.content_json);
    setContentText(payload.content_text);
  }

  const editor = (
    <ReviewDraftBox
      key={review.id}
      contentJson={contentJson}
      onChange={handleEditorChange}
    />
  );

  return (
    <AppChrome>
      <div className="mb-4 flex items-center justify-between">
        <Link
          href={backHref ?? `/folders/${review.folder_id}`}
          className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-[#ebeee9]"
          aria-label="뒤로"
          title="뒤로"
        >
          <ArrowLeft size={19} />
        </Link>
        <div className="flex items-center gap-3">
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
        {saveStatus === "error" ? (
          <p className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            저장하지 못했습니다. 인터넷 연결을 확인해주세요.
          </p>
        ) : null}

        <div className="mt-6">
          {sources.map((source, index) => (
            <div key={`${source.item_type}:${source.id}`}>
              {editorPosition === index ? editor : null}
              <ReviewSourceCard
                source={source}
                onMoveInput={() => setEditorPosition(index + 1)}
              />
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
              <EditableReviewNoteCard
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
