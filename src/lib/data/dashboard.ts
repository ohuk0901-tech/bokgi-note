import { todayISO } from "@/lib/date";
import { noteToUnified, reviewToUnified } from "@/lib/data/shared";
import {
  findRoutineNote,
  getTemplates,
  routineKeyForTemplate,
  shouldShowWeeklyRoutines,
} from "@/lib/data/templates";
import type { Client } from "@/lib/data/shared";
import type {
  DashboardReviewItem,
  Note,
  ReviewSession,
  Template,
} from "@/lib/types";

export type DashboardRoutineItem = {
  template: Template;
  existingNote: Note | null;
  href: string;
  actionLabel: string;
};

export async function getDashboardData(supabase: Client, userId: string) {
  const templates = await getTemplates(supabase);
  const primaryTemplate =
    templates.find((template) => template.is_primary) ?? templates[0] ?? null;
  const primaryNote = primaryTemplate
    ? await findRoutineNote(supabase, userId, primaryTemplate)
    : null;

  const weeklyTemplates = shouldShowWeeklyRoutines()
    ? templates.filter((template) =>
        ["한 주 마무리", "다음 주 계획"].includes(template.name),
      )
    : [];

  const weeklyRoutines = await Promise.all(
    weeklyTemplates.map(async (template) => {
      const existingNote = await findRoutineNote(supabase, userId, template);
      return toRoutineItem(template, existingNote);
    }),
  );

  const [dueReviews, pinnedNotes, recentItems] = await Promise.all([
    getDueReviews(supabase, userId),
    getPinnedNotes(supabase, userId),
    getRecentItems(supabase, userId),
  ]);

  return {
    templates,
    primaryTemplate,
    primaryNote,
    primaryRoutine: primaryTemplate ? toRoutineItem(primaryTemplate, primaryNote) : null,
    weeklyRoutines,
    dueReviews,
    pinnedNotes,
    recentItems,
    frequentTemplates: templates.slice(0, 4),
  };
}

export async function getPinnedNotes(supabase: Client, userId: string) {
  const { data, error } = await supabase
    .from("notes")
    .select("*")
    .eq("user_id", userId)
    .eq("is_pinned", true)
    .is("deleted_at", null)
    .order("pinned_at", { ascending: false })
    .limit(5);

  if (error) throw error;
  return data ?? [];
}

export async function setNotePinned(
  supabase: Client,
  userId: string,
  noteId: string,
  pinned: boolean,
) {
  if (pinned) {
    const pinnedNotes = await getPinnedNotes(supabase, userId);
    if (!pinnedNotes.some((note) => note.id === noteId) && pinnedNotes.length >= 5) {
      throw new Error("대표 메모는 최대 5개까지 고정할 수 있습니다.");
    }
  }

  const { error } = await supabase
    .from("notes")
    .update({
      is_pinned: pinned,
      pinned_at: pinned ? new Date().toISOString() : null,
    })
    .eq("id", noteId)
    .eq("user_id", userId);

  if (error) throw error;
}

export async function completeReviewSchedule(
  supabase: Client,
  userId: string,
  reviewScheduleId: string,
) {
  const { error } = await supabase
    .from("review_schedules")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", reviewScheduleId)
    .eq("user_id", userId);

  if (error) throw error;
}

async function getDueReviews(supabase: Client, userId: string) {
  const { data: schedules, error } = await supabase
    .from("review_schedules")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "pending")
    .lte("due_date", todayISO())
    .order("due_date", { ascending: true })
    .limit(20);

  if (error) throw error;
  if (!schedules?.length) return [];

  const noteIds = schedules.map((schedule) => schedule.note_id);
  const { data: notes, error: noteError } = await supabase
    .from("notes")
    .select("*")
    .in("id", noteIds)
    .is("deleted_at", null);

  if (noteError) throw noteError;

  const noteMap = new Map((notes ?? []).map((note) => [note.id, note]));
  return schedules
    .map((schedule) => {
      const note = noteMap.get(schedule.note_id);
      return note ? ({ ...schedule, note } as DashboardReviewItem) : null;
    })
    .filter((item): item is DashboardReviewItem => Boolean(item));
}

async function getRecentItems(supabase: Client, userId: string) {
  const [notesResult, reviewsResult] = await Promise.all([
    supabase
      .from("notes")
      .select("*")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .eq("is_draft", false)
      .order("updated_at", { ascending: false })
      .limit(6),
    supabase
      .from("review_sessions")
      .select("*")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .eq("is_draft", false)
      .order("updated_at", { ascending: false })
      .limit(6),
  ]);

  if (notesResult.error) throw notesResult.error;
  if (reviewsResult.error) throw reviewsResult.error;

  return [
    ...((notesResult.data ?? []) as Note[]).map(noteToUnified),
    ...((reviewsResult.data ?? []) as ReviewSession[]).map(reviewToUnified),
  ]
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    .slice(0, 8);
}

function toRoutineItem(template: Template, existingNote: Note | null) {
  const action = existingNote ? "이어쓰기" : "작성하기";
  return {
    template,
    existingNote,
    href: existingNote ? `/notes/${existingNote.id}` : "",
    actionLabel: `${template.name} ${action}`,
    routineKey: routineKeyForTemplate(template),
  };
}
