import { deleteAfter30Days } from "@/lib/date";
import { DEFAULT_FOLDER } from "@/lib/data/shared";
import type { Client } from "@/lib/data/shared";

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

export async function createDefaultFolderIfMissing(
  supabase: Client,
  userId: string,
) {
  const { data: folders, error: folderReadError } = await supabase
    .from("folders")
    .select("id")
    .is("deleted_at", null)
    .limit(1);

  if (folderReadError) throw folderReadError;
  if (folders?.length) return;

  const { error } = await supabase.from("folders").insert({
    user_id: userId,
    name: DEFAULT_FOLDER,
    sort_order: 0,
  });
  if (error) throw error;
}

export async function createFolder(
  supabase: Client,
  userId: string,
  name: string,
) {
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
