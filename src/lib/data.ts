"use client";

import type { SupabaseClient, User } from "@supabase/supabase-js";
import { defaultReviewTitle, deleteAfter30Days, previewText, todayISO } from "@/lib/date";
import type {
  Database,
  Note,
  ReviewSession,
  ReviewSourceItem,
  UnifiedItem,
} from "@/lib/types";

type Client = SupabaseClient<Database>;

const DEFAULT_FOLDER = "기본";
const DEFAULT_NOTE_TITLE = "제목 없음";

export async function ensureUserReady(supabase: Client, user: User) {
  const { error: profileError } = await supabase.from("profiles").upsert({
    id: user.id,
    email: user.email ?? null,
    display_name: user.user_metadata?.name ?? user.email ?? null,
  });

  if (profileError) throw profileError;

  const { data: profile, error: profileReadError } = await supabase
    .from("profiles")
    .select("deletion_requested_at")
    .eq("id", user.id)
    .single();

  if (profileReadError) throw profileReadError;
  if (profile?.deletion_requested_at) {
    throw new Error("삭제 요청된 계정입니다.");
  }

  const { data: folders, error: folderReadError } = await supabase
    .from("folders")
    .select("id")
    .is("deleted_at", null)
    .limit(1);

  if (folderReadError) throw folderReadError;

  if (!folders?.length) {
    const { error } = await supabase.from("folders").insert({
      user_id: user.id,
      name: DEFAULT_FOLDER,
      sort_order: 0,
    });
    if (error) throw error;
  }
}

export async function getFolders(supabase: Client) {
  const { data, error } = await supabase
    .from("folders")
    .select("*")
    .is("deleted_at", null)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function createFolder(supabase: Client, userId: string, name: string) {
  const { data, error } = await supabase
    .from("folders")
    .insert({ user_id: userId, name })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateFolder(supabase: Client, id: string, name: string) {
  const { error } = await supabase.from("folders").update({ name }).eq("id", id);
  if (error) throw error;
}

export async function trashFolder(supabase: Client, folderId: string) {
  const deleted_at = new Date().toISOString();
  const delete_after = deleteAfter30Days();

  const { error: notesError } = await supabase
    .from("notes")
    .update({ deleted_at, delete_after })
    .eq("folder_id", folderId)
    .is("deleted_at", null);
  if (notesError) throw notesError;

  const { error: reviewsError } = await supabase
    .from("review_sessions")
    .update({ deleted_at, delete_after })
    .eq("folder_id", folderId)
    .is("deleted_at", null);
  if (reviewsError) throw reviewsError;

  const { error } = await supabase
    .from("folders")
    .update({ deleted_at, delete_after })
    .eq("id", folderId);
  if (error) throw error;
}

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
  values: Pick<Note, "title" | "content" | "note_date">,
) {
  const is_draft =
    values.title.trim() === DEFAULT_NOTE_TITLE && values.content.trim() === "";
  const { data, error } = await supabase
    .from("notes")
    .update({ ...values, is_draft })
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("메모를 찾을 수 없습니다.");
}

export async function deleteBlankDraftNote(supabase: Client, note: Note) {
  if (note.is_draft && note.title === DEFAULT_NOTE_TITLE && !note.content.trim()) {
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

export async function getUnifiedItems(
  supabase: Client,
  folderId: string,
  query = "",
) {
  const term = query.trim();

  let notesQuery = supabase
    .from("notes")
    .select("*")
    .eq("folder_id", folderId)
    .is("deleted_at", null);

  let reviewsQuery = supabase
    .from("review_sessions")
    .select("*")
    .eq("folder_id", folderId)
    .is("deleted_at", null);

  if (term) {
    notesQuery = notesQuery.or(`title.ilike.%${term}%,content.ilike.%${term}%`);
    reviewsQuery = reviewsQuery.or(`title.ilike.%${term}%,content.ilike.%${term}%`);
  }

  const [notesResult, reviewsResult] = await Promise.all([
    notesQuery,
    reviewsQuery,
  ]);

  if (notesResult.error) throw notesResult.error;
  if (reviewsResult.error) throw reviewsResult.error;

  return [
    ...(notesResult.data ?? []).map(noteToUnified),
    ...(reviewsResult.data ?? []).map(reviewToUnified),
  ].sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function createReviewDraft(
  supabase: Client,
  userId: string,
  folderId: string,
  sources: { type: "note" | "review_session"; id: string }[],
) {
  const reviewDate = todayISO();
  const { data: review, error } = await supabase
    .from("review_sessions")
    .insert({
      user_id: userId,
      folder_id: folderId,
      title: defaultReviewTitle(reviewDate),
      content: "",
      review_date: reviewDate,
      editor_position: 0,
      is_draft: true,
    })
    .select()
    .single();

  if (error) throw error;

  const sourceRows = sources.map((source, index) => ({
    review_session_id: review.id,
    source_note_id: source.type === "note" ? source.id : null,
    source_review_session_id: source.type === "review_session" ? source.id : null,
    sort_order: index,
  }));

  if (sourceRows.length) {
    const { error: sourceError } = await supabase
      .from("review_sources")
      .insert(sourceRows);
    if (sourceError) throw sourceError;
  }

  return review;
}

export async function getReviewWithSources(supabase: Client, id: string) {
  const { data: review, error } = await supabase
    .from("review_sessions")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;

  const { data: sources, error: sourcesError } = await supabase
    .from("review_sources")
    .select("*")
    .eq("review_session_id", id)
    .order("sort_order", { ascending: true });
  if (sourcesError) throw sourcesError;

  const noteIds = (sources ?? [])
    .map((source) => source.source_note_id)
    .filter(Boolean) as string[];
  const reviewIds = (sources ?? [])
    .map((source) => source.source_review_session_id)
    .filter(Boolean) as string[];

  let noteRows: Note[] = [];
  if (noteIds.length) {
    const { data, error: noteError } = await supabase
      .from("notes")
      .select("*")
      .in("id", noteIds);
    if (noteError) throw noteError;
    noteRows = data ?? [];
  }

  let reviewRows: ReviewSession[] = [];
  if (reviewIds.length) {
    const { data, error: reviewError } = await supabase
      .from("review_sessions")
      .select("*")
      .in("id", reviewIds);
    if (reviewError) throw reviewError;
    reviewRows = data ?? [];
  }

  const { data: editableRows, error: editableError } = await supabase
    .from("editable_review_notes")
    .select("*, notes(*)")
    .eq("review_session_id", id)
    .order("sort_order", { ascending: true });

  if (editableError) throw editableError;

  const notes = new Map(noteRows.map((note) => [note.id, note]));
  const reviews = new Map(reviewRows.map((item) => [item.id, item]));

  const sourceItems: ReviewSourceItem[] = (sources ?? [])
    .map((source) => {
      if (source.source_note_id) {
        const note = notes.get(source.source_note_id);
        return note
          ? { ...noteToUnified(note), sort_order: source.sort_order }
          : null;
      }
      if (source.source_review_session_id) {
        const sourceReview = reviews.get(source.source_review_session_id);
        return sourceReview
          ? { ...reviewToUnified(sourceReview), sort_order: source.sort_order }
          : null;
      }
      return null;
    })
    .filter((item): item is ReviewSourceItem => Boolean(item))
    .sort((a, b) => a.display_date.localeCompare(b.display_date));

  return {
    review,
    sources: sourceItems,
    editableNotes: ((editableRows ?? []) as unknown as { notes: Note | Note[] | null }[])
      .map((row) => (Array.isArray(row.notes) ? row.notes[0] : row.notes))
      .filter((note): note is Note => Boolean(note)),
  };
}

export async function saveReview(
  supabase: Client,
  id: string,
  values: Pick<ReviewSession, "title" | "content" | "review_date" | "editor_position">,
) {
  const defaultTitle = defaultReviewTitle(values.review_date);
  const is_draft =
    values.title.trim() === defaultTitle && values.content.trim() === "";
  const { data, error } = await supabase
    .from("review_sessions")
    .update({ ...values, is_draft })
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("복기 세션을 찾을 수 없습니다.");
}

export async function deleteBlankDraftReview(
  supabase: Client,
  review: ReviewSession,
) {
  const defaultTitle = defaultReviewTitle(review.review_date);
  if (review.is_draft && review.title === defaultTitle && !review.content.trim()) {
    const { error } = await supabase
      .from("review_sessions")
      .delete()
      .eq("id", review.id);
    if (error) throw error;
  }
}

export async function trashReview(supabase: Client, id: string) {
  const { error } = await supabase
    .from("review_sessions")
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

  const term = query.trim();
  if (term) request = request.or(`title.ilike.%${term}%,content.ilike.%${term}%`);

  const { data, error } = await request;
  if (error) throw error;
  return data ?? [];
}

export async function attachEditableNote(
  supabase: Client,
  reviewId: string,
  noteId: string,
  sortOrder: number,
) {
  const { error } = await supabase.from("editable_review_notes").upsert({
    review_session_id: reviewId,
    note_id: noteId,
    sort_order: sortOrder,
  });
  if (error) throw error;
}

export async function saveEditableNote(
  supabase: Client,
  noteId: string,
  values: Pick<Note, "title" | "content" | "note_date">,
) {
  await saveNote(supabase, noteId, values);
}

export async function getTrash(supabase: Client) {
  const [folders, notes, reviews] = await Promise.all([
    supabase.from("folders").select("*").not("deleted_at", "is", null),
    supabase.from("notes").select("*").not("deleted_at", "is", null),
    supabase.from("review_sessions").select("*").not("deleted_at", "is", null),
  ]);

  if (folders.error) throw folders.error;
  if (notes.error) throw notes.error;
  if (reviews.error) throw reviews.error;

  return {
    folders: folders.data ?? [],
    notes: notes.data ?? [],
    reviews: reviews.data ?? [],
  };
}

export async function restoreItem(
  supabase: Client,
  type: "folder" | "note" | "review_session",
  id: string,
) {
  const values = { deleted_at: null, delete_after: null };
  const { error } =
    type === "folder"
      ? await supabase.from("folders").update(values).eq("id", id)
      : type === "note"
        ? await supabase.from("notes").update(values).eq("id", id)
        : await supabase.from("review_sessions").update(values).eq("id", id);
  if (error) throw error;
}

export async function deleteForever(
  supabase: Client,
  type: "folder" | "note" | "review_session",
  id: string,
) {
  const { error } =
    type === "folder"
      ? await supabase.from("folders").delete().eq("id", id)
      : type === "note"
        ? await supabase.from("notes").delete().eq("id", id)
        : await supabase.from("review_sessions").delete().eq("id", id);
  if (error) throw error;
}

export async function requestAccountDeletion(supabase: Client, userId: string) {
  const deletedAt = new Date().toISOString();
  const deleteAfter = deleteAfter30Days();

  const results = await Promise.all([
    supabase
      .from("profiles")
      .update({ deletion_requested_at: deletedAt, delete_after: deleteAfter })
      .eq("id", userId),
    supabase
      .from("folders")
      .update({ deleted_at: deletedAt, delete_after: deleteAfter })
      .eq("user_id", userId),
    supabase
      .from("notes")
      .update({ deleted_at: deletedAt, delete_after: deleteAfter })
      .eq("user_id", userId),
    supabase
      .from("review_sessions")
      .update({ deleted_at: deletedAt, delete_after: deleteAfter })
      .eq("user_id", userId),
  ]);

  const error = results.find((result) => result.error)?.error;
  if (error) throw error;

  await supabase.auth.signOut();
}

function noteToUnified(note: Note): UnifiedItem {
  return {
    id: note.id,
    item_type: "note",
    title: note.title,
    content: note.content,
    preview: previewText(note.content),
    display_date: note.note_date,
    created_at: note.created_at,
    updated_at: note.updated_at,
    folder_id: note.folder_id,
  };
}

function reviewToUnified(review: ReviewSession): UnifiedItem {
  return {
    id: review.id,
    item_type: "review_session",
    title: review.title,
    content: review.content,
    preview: previewText(review.content),
    display_date: review.review_date,
    created_at: review.created_at,
    updated_at: review.updated_at,
    folder_id: review.folder_id,
  };
}
