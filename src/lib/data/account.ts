import { deleteAfter30Days } from "@/lib/date";
import type { Client } from "@/lib/data/shared";

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
