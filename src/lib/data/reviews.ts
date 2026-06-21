import { defaultReviewTitle, deleteAfter30Days, todayISO } from "@/lib/date";
import { noteToUnified, reviewToUnified } from "@/lib/data/shared";
import type { Client } from "@/lib/data/shared";
import { EMPTY_EDITOR_DOC } from "@/lib/editor";
import type { Note, ReviewSession, ReviewSourceItem } from "@/lib/types";

export type ReviewSaveValues = Pick<
  ReviewSession,
  "title" | "content" | "review_date" | "editor_position"
> &
  Partial<Pick<ReviewSession, "content_json" | "content_text">>;

export async function createReviewDraft(
  supabase: Client,
  userId: string,
  folderId: string,
  sources: { type: "note" | "review_session"; id: string }[],
  options: { title?: string; reviewDate?: string } = {},
) {
  const reviewDate = options.reviewDate ?? todayISO();
  const { data: review, error } = await supabase
    .from("review_sessions")
    .insert({
      user_id: userId,
      folder_id: folderId,
      title: options.title ?? defaultReviewTitle(reviewDate),
      content: "",
      content_json: EMPTY_EDITOR_DOC,
      content_text: "",
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
  values: ReviewSaveValues,
) {
  const defaultTitle = defaultReviewTitle(values.review_date);
  const contentText = values.content_text ?? values.content;
  const is_draft =
    values.title.trim() === defaultTitle && contentText.trim() === "";
  const { data, error } = await supabase
    .from("review_sessions")
    .update({ ...values, content_text: contentText, is_draft })
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
  const content = review.content_text || review.content;
  if (review.is_draft && review.title === defaultTitle && !content.trim()) {
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
