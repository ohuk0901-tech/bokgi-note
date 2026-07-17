import type { SupabaseClient } from "@supabase/supabase-js";
import { previewText } from "@/lib/date";
import type { Database, Note, ReviewSession, UnifiedItem } from "@/lib/types";

export type Client = SupabaseClient<Database>;

export const DEFAULT_FOLDER = "기본";
export const DEFAULT_NOTE_TITLE = "제목 없음";

export function buildTextSearchFilter(query: string) {
  const term = query
    .trim()
    .replace(/[%_,()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!term) return null;
  return `title.ilike.%${term}%,content.ilike.%${term}%,content_text.ilike.%${term}%`;
}

export function noteToUnified(note: Note): UnifiedItem {
  const content = note.content_text || note.content;
  return {
    id: note.id,
    item_type: "note",
    title: note.title,
    content,
    content_json: note.content_json,
    preview: previewText(content),
    display_date: note.note_date,
    created_at: note.created_at,
    updated_at: note.updated_at,
    folder_id: note.folder_id,
  };
}

export function reviewToUnified(review: ReviewSession): UnifiedItem {
  const content = review.content_text || review.content;
  return {
    id: review.id,
    item_type: "review_session",
    title: review.title,
    content,
    content_json: review.content_json,
    preview: previewText(content),
    display_date: review.review_date,
    created_at: review.created_at,
    updated_at: review.updated_at,
    folder_id: review.folder_id,
  };
}
