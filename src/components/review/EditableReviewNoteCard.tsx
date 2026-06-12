"use client";

import { useCallback, useMemo, useState } from "react";
import { useAutoSave } from "@/components/useAutoSave";
import type { Note } from "@/lib/types";

type EditableNoteValues = Pick<Note, "title" | "content" | "note_date">;

export function EditableReviewNoteCard({
  note,
  onChange,
}: {
  note: Note;
  onChange: (values: EditableNoteValues) => void;
}) {
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [noteDate, setNoteDate] = useState(note.note_date);

  const value = useMemo(
    () => ({ content, note_date: noteDate, title }),
    [content, noteDate, title],
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
      <textarea
        value={content}
        onChange={(event) => setContent(event.target.value)}
        className="mt-3 min-h-32 w-full resize-none bg-transparent leading-7 outline-none"
      />
    </div>
  );
}
