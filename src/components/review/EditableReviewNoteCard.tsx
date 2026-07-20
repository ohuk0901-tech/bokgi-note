"use client";

import { useCallback, useMemo, useState } from "react";
import { Check } from "lucide-react";
import { RichTextEditor } from "@/components/RichTextEditor";
import { useAutoSave } from "@/components/useAutoSave";
import { editorJsonOrText, toEditorPayload } from "@/lib/editor";
import type { Json, Note } from "@/lib/types";

type EditableNoteValues = Pick<
  Note,
  "title" | "content" | "content_json" | "content_text" | "note_date"
>;

export function EditableReviewNoteCard({
  note,
  onChange,
  onComplete,
}: {
  note: Note;
  onChange: (values: EditableNoteValues) => Promise<void> | void;
  onComplete: () => Promise<void> | void;
}) {
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [contentJson, setContentJson] = useState<Json>(
    editorJsonOrText(note.content_json, note.content),
  );
  const [contentText, setContentText] = useState(note.content_text || note.content);
  const [noteDate, setNoteDate] = useState(note.note_date);
  const [completing, setCompleting] = useState(false);

  const value = useMemo(
    () => ({
      content,
      content_json: contentJson,
      content_text: contentText,
      note_date: noteDate,
      title,
    }),
    [content, contentJson, contentText, noteDate, title],
  );
  const save = useCallback(
    async (nextValue: typeof value) => {
      await onChange(nextValue);
    },
    [onChange],
  );

  const saveStatus = useAutoSave({
    enabled: true,
    save,
    skipInitial: true,
    value,
  });

  async function completeEditing() {
    setCompleting(true);
    try {
      await onChange(value);
      await onComplete();
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : "수정 완료 처리에 실패했습니다.");
      setCompleting(false);
    }
  }

  return (
    <div className="rounded-[22px] border border-bokgi-border bg-bokgi-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            autoCapitalize="none"
            autoComplete="off"
            autoCorrect="off"
            className="w-full bg-transparent font-semibold outline-none"
            spellCheck={false}
            tabIndex={-1}
          />
          <input
            type="date"
            value={noteDate}
            onChange={(event) => setNoteDate(event.target.value)}
            className="mt-3 h-8 rounded-full border border-bokgi-border bg-transparent px-3 text-xs font-medium text-bokgi-ink-soft"
            tabIndex={-1}
          />
        </div>
        <button
          type="button"
          onClick={completeEditing}
          disabled={completing}
          className="inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-full bg-bokgi-primary px-3 text-xs font-semibold text-bokgi-primary-on transition active:scale-[0.98] disabled:opacity-50"
        >
          <Check size={14} />
          수정 완료
        </button>
      </div>
      {saveStatus === "error" ? (
        <p className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          저장하지 못했습니다. 인터넷 연결을 확인해주세요.
        </p>
      ) : null}
      <div className="mt-3">
        <RichTextEditor
          key={note.id}
          contentJson={contentJson}
          minHeight="8rem"
          onChange={(nextValue) => {
            const payload = toEditorPayload(
              nextValue.contentJson,
              nextValue.contentText,
            );
            setContent(payload.content);
            setContentJson(payload.content_json);
            setContentText(payload.content_text);
          }}
        />
      </div>
    </div>
  );
}
