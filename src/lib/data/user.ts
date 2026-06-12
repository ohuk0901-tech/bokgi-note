import type { User } from "@supabase/supabase-js";
import { createDefaultFolderIfMissing } from "@/lib/data/folders";
import type { Client } from "@/lib/data/shared";

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

  await createDefaultFolderIfMissing(supabase, user.id);
}
