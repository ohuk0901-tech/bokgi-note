import {
  buildTextSearchFilter,
  noteToUnified,
  reviewToUnified,
} from "@/lib/data/shared";
import type { Client } from "@/lib/data/shared";

export async function getUnifiedItems(
  supabase: Client,
  folderId: string,
  query = "",
) {
  const searchFilter = buildTextSearchFilter(query);

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

  if (searchFilter) {
    notesQuery = notesQuery.or(searchFilter);
    reviewsQuery = reviewsQuery.or(searchFilter);
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

  if (type === "folder") {
    const { data: folder, error: readError } = await supabase
      .from("folders")
      .select("deleted_at")
      .eq("id", id)
      .single();
    if (readError) throw readError;

    const { error: folderError } = await supabase
      .from("folders")
      .update(values)
      .eq("id", id);
    if (folderError) throw folderError;

    if (!folder.deleted_at) return;

    const { error: notesError } = await supabase
      .from("notes")
      .update(values)
      .eq("folder_id", id)
      .eq("deleted_at", folder.deleted_at);
    if (notesError) throw notesError;

    const { error: reviewsError } = await supabase
      .from("review_sessions")
      .update(values)
      .eq("folder_id", id)
      .eq("deleted_at", folder.deleted_at);
    if (reviewsError) throw reviewsError;
    return;
  }

  const { error } =
    type === "note"
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
