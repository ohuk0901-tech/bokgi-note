import { deleteAfter30Days, todayISO } from "@/lib/date";
import { buildTextSearchFilter, DEFAULT_NOTE_TITLE } from "@/lib/data/shared";
import type { Client } from "@/lib/data/shared";
import { EMPTY_EDITOR_DOC } from "@/lib/editor";
import type { Note } from "@/lib/types";

export type NoteSaveValues = Pick<Note, "title" | "content" | "note_date"> &
  Partial<Pick<Note, "content_json" | "content_text">>;

export async function createDraftNote(
  supabase: Client,
  userId: string,
  folderId: string,
) {
  const { data, error } = await supabase
    .from("notes")
    .insert({
      user_id: userId,
      folder_id: folderId,
      title: DEFAULT_NOTE_TITLE,
      content: "",
      content_json: EMPTY_EDITOR_DOC,
      content_text: "",
      note_date: todayISO(),
      is_draft: true,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getNote(supabase: Client, id: string) {
  const { data, error } = await supabase
    .from("notes")
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw error;
  return data;
}

export async function saveNote(
  supabase: Client,
  id: string,
  values: NoteSaveValues,
) {
  const contentText = values.content_text ?? values.content;
  const is_draft =
    values.title.trim() === DEFAULT_NOTE_TITLE && contentText.trim() === "";
  const { data, error } = await supabase
    .from("notes")
    .update({
      ...values,
      content_text: contentText,
      is_draft,
    })
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("메모를 찾을 수 없습니다.");
}

export async function deleteBlankDraftNote(supabase: Client, note: Note) {
  const content = note.content_text || note.content;
  if (note.is_draft && note.title === DEFAULT_NOTE_TITLE && !content.trim()) {
    const { error } = await supabase.from("notes").delete().eq("id", note.id);
    if (error) throw error;
  }
}

export async function trashNote(supabase: Client, id: string) {
  const { error } = await supabase
    .from("notes")
    .update({ deleted_at: new Date().toISOString(), delete_after: deleteAfter30Days() })
    .eq("id", id);
  if (error) throw error;
}

export async function getActiveNotes(supabase: Client, query = "") {
  let request = supabase
    .from("notes")
    .select("*")
    .is("deleted_at", null)
    .eq("is_draft", false)
    .order("created_at", { ascending: false })
    .limit(30);

  const searchFilter = buildTextSearchFilter(query);
  if (searchFilter) request = request.or(searchFilter);

  const { data, error } = await request;
  if (error) throw error;
  return data ?? [];
}

export async function saveEditableNote(
  supabase: Client,
  noteId: string,
  values: NoteSaveValues,
) {
  await saveNote(supabase, noteId, values);
}
