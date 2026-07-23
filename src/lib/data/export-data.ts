import type { Client } from "@/lib/data/shared";
import type {
  EditableReviewNote,
  Folder,
  Note,
  Profile,
  ReviewSchedule,
  ReviewSession,
  ReviewSource,
  Template,
} from "@/lib/types";

export type MarkdownBackupData = {
  editableReviewNotes: EditableReviewNote[];
  folders: Folder[];
  notes: Note[];
  profile: Profile | null;
  reviewSchedules: ReviewSchedule[];
  reviewSources: ReviewSource[];
  reviews: ReviewSession[];
  templates: Template[];
};

export async function getMarkdownBackupData(
  supabase: Client,
  userId: string,
): Promise<MarkdownBackupData> {
  const [
    profileResult,
    foldersResult,
    templatesResult,
    notesResult,
    reviewsResult,
    reviewSchedulesResult,
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
    supabase
      .from("folders")
      .select("*")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase
      .from("templates")
      .select("*")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .order("template_kind", { ascending: true })
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
    supabase
      .from("review_schedules")
      .select("*")
      .eq("user_id", userId)
      .order("due_date", { ascending: true })
      .order("created_at", { ascending: true }),
  ]);

  if (profileResult.error) throw profileResult.error;
  if (foldersResult.error) throw foldersResult.error;
  if (templatesResult.error) throw templatesResult.error;
  if (notesResult.error) throw notesResult.error;
  if (reviewsResult.error) throw reviewsResult.error;
  if (reviewSchedulesResult.error) throw reviewSchedulesResult.error;

  const reviewIds = (reviewsResult.data ?? []).map((review) => review.id);
  let reviewSources: ReviewSource[] = [];
  let editableReviewNotes: EditableReviewNote[] = [];

  if (reviewIds.length) {
    const [reviewSourcesResult, editableReviewNotesResult] = await Promise.all([
      supabase
        .from("review_sources")
        .select("*")
        .in("review_session_id", reviewIds)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true }),
      supabase
        .from("editable_review_notes")
        .select("*")
        .in("review_session_id", reviewIds)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true }),
    ]);

    if (reviewSourcesResult.error) throw reviewSourcesResult.error;
    if (editableReviewNotesResult.error) throw editableReviewNotesResult.error;

    reviewSources = reviewSourcesResult.data ?? [];
    editableReviewNotes = editableReviewNotesResult.data ?? [];
  }

  return {
    editableReviewNotes,
    folders: foldersResult.data ?? [],
    notes: notesResult.data ?? [],
    profile: profileResult.data ?? null,
    reviewSchedules: reviewSchedulesResult.data ?? [],
    reviewSources,
    reviews: reviewsResult.data ?? [],
    templates: templatesResult.data ?? [],
  };
}
