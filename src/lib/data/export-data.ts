import type { Client } from "@/lib/data/shared";

export async function getMarkdownBackupData(supabase: Client, userId: string) {
  const [foldersResult, notesResult, reviewsResult] = await Promise.all([
    supabase
      .from("folders")
      .select("*")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase
      .from("notes")
      .select("*")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .eq("is_draft", false)
      .order("note_date", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase
      .from("review_sessions")
      .select("*")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .eq("is_draft", false)
      .order("review_date", { ascending: true })
      .order("created_at", { ascending: true }),
  ]);

  if (foldersResult.error) throw foldersResult.error;
  if (notesResult.error) throw notesResult.error;
  if (reviewsResult.error) throw reviewsResult.error;

  return {
    folders: foldersResult.data ?? [],
    notes: notesResult.data ?? [],
    reviews: reviewsResult.data ?? [],
  };
}
