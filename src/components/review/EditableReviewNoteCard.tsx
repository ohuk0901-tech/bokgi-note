"use client";

import { useCallback, useMemo, useState } from "react";
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
}: {
  note: Note;
  onChange: (values: EditableNoteValues) => void;
}) {
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [contentJson, setContentJson] = useState<Json>(
    editorJsonOrText(note.content_json, note.content),
  );
  const [contentText, setContentText] = useState(note.content_text || note.content);
  const [noteDate, setNoteDate] = useState(note.note_date);

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
      onChange(nextValue);
    },
    [onChange],
  );

  useAutoSave({
    enabled: true,
    save,
    skipInitial: true,
    value,
  });

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
