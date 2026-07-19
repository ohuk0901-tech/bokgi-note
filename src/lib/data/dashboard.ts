import { addDaysISO, formatKoreanDate, todayISO, weekday, weekStartISO } from "@/lib/date";
import { daysFromToday, trackAnalyticsEvent } from "@/lib/data/analytics";
import { noteToUnified, reviewToUnified } from "@/lib/data/shared";
import { createReviewDraft } from "@/lib/data/reviews";
import {
  ensureFolderByName,
  findRoutineNote,
  getTemplates,
} from "@/lib/data/templates";
import type { Client } from "@/lib/data/shared";
import type {
  DashboardReviewItem,
  Note,
  ReviewSession,
  Template,
} from "@/lib/types";

export async function getDashboardData(supabase: Client, userId: string) {
  const templates = await getTemplates(supabase);
  const primaryTemplate =
    templates.find((template) => template.template_kind === "investment_journal") ??
    templates.find((template) => template.is_primary) ??
    templates[0] ??
    null;
  const primaryNote = primaryTemplate
    ? await findRoutineNote(supabase, userId, primaryTemplate)
    : null;

  const [dueReviews, pinnedNotes, recentItems, weeklyReviewNoteCount] = await Promise.all([
    getDueReviews(supabase, userId),
    getPinnedNotes(supabase, userId),
    getRecentItems(supabase, userId),
    getWeeklyReviewNoteCount(supabase, userId),
  ]);
  const weeklyReview = await getExistingWeeklyReview(supabase, userId);

  return {
    primaryRoutine: primaryTemplate ? toRoutineItem(primaryTemplate, primaryNote) : null,
    dueReviews,
    pinnedNotes,
    recentItems,
    weeklyReviewNoteCount,
    weeklyReview,
  };
}

export async function getPinnedNotes(supabase: Client, userId: string, limit = 5) {
  const { data, error } = await supabase
    .from("notes")
    .select("*")
    .eq("user_id", userId)
    .eq("is_pinned", true)
    .is("deleted_at", null)
    .order("pinned_at", { ascending: false })
    .limit(limit);

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
  const { data, error } = await supabase
    .from("review_schedules")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", reviewScheduleId)
    .eq("user_id", userId)
    .select("id, note_id, review_type, due_date")
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("복기 일정을 찾을 수 없습니다.");

  await trackAnalyticsEvent(supabase, userId, "due_review_completed", {
    eventKey: `review_schedule:${data.id}`,
    properties: {
      days_overdue: daysFromToday(data.due_date),
      due_date: data.due_date,
      note_id: data.note_id,
      review_schedule_id: data.id,
      review_type: data.review_type,
    },
  });
}

export async function startWeeklyReview(
  supabase: Client,
  userId: string,
  date = todayISO(),
  options: { source?: string } = {},
) {
  const weekStart = weekStartISO(date);
  const weekEnd = addDaysISO(weekStart, 6);
  const { data: templates, error: templateError } = await supabase
    .from("templates")
    .select("*")
    .eq("user_id", userId)
    .eq("template_kind", "investment_journal")
    .is("deleted_at", null);
  if (templateError) throw templateError;

  const templateIds = (templates ?? []).map((template) => template.id);
  if (!templateIds.length) {
    throw new Error("투자 일기 템플릿을 찾지 못했습니다.");
  }

  const { data: notes, error: notesError } = await supabase
    .from("notes")
    .select("*")
    .eq("user_id", userId)
    .in("template_id", templateIds)
    .gte("note_date", weekStart)
    .lte("note_date", weekEnd)
    .eq("is_draft", false)
    .is("deleted_at", null)
    .order("note_date", { ascending: true })
    .order("created_at", { ascending: true });
  if (notesError) throw notesError;
  if (!notes?.length) {
    throw new Error("이번 주에 작성한 투자 일기가 없습니다.");
  }

  const { data: weeklyTemplate, error: weeklyTemplateError } = await supabase
    .from("templates")
    .select("*")
    .eq("user_id", userId)
    .eq("template_kind", "weekly_review")
    .is("deleted_at", null)
    .maybeSingle();
  if (weeklyTemplateError) throw weeklyTemplateError;

  const weeklyReviewFolderId = weeklyTemplate
    ? (await ensureFolderByName(supabase, userId, weeklyTemplate.name)).id
    : notes[0].folder_id;

  if (weeklyTemplate && weeklyTemplate.default_folder_id !== weeklyReviewFolderId) {
    const { error: templateFolderError } = await supabase
      .from("templates")
      .update({ default_folder_id: weeklyReviewFolderId })
      .eq("id", weeklyTemplate.id)
      .eq("user_id", userId);
    if (templateFolderError) throw templateFolderError;
  }

  const title = `${formatKoreanDate(weekStart)}-${formatKoreanDate(weekEnd)} 주간 복기`;
  const { data: existingReview, error: existingError } = await supabase
    .from("review_sessions")
    .select("*")
    .eq("user_id", userId)
    .eq("title", title)
    .is("deleted_at", null)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existingReview) {
    let review = existingReview;

    if (existingReview.folder_id !== weeklyReviewFolderId) {
      const { data: movedReview, error: moveError } = await supabase
        .from("review_sessions")
        .update({ folder_id: weeklyReviewFolderId })
        .eq("id", existingReview.id)
        .eq("user_id", userId)
        .select("*")
        .single();

      if (moveError) throw moveError;
      review = movedReview;
    }

    await syncWeeklyReviewSources(supabase, review.id, notes);
    await trackWeeklyReviewOpened(supabase, userId, review, {
      date,
      entryMode: "resume",
      source: options.source,
      sourceNoteCount: notes.length,
      weekEnd,
      weekStart,
    });
    return review;
  }

  const review = await createReviewDraft(
    supabase,
    userId,
    weeklyReviewFolderId,
    notes.map((note) => ({ type: "note" as const, id: note.id })),
    {
      title,
      reviewDate: date,
      content: weeklyTemplate?.content ?? "",
      contentJson: weeklyTemplate?.content_json,
      contentText: weeklyTemplate?.content_text ?? "",
      editorPosition: 1,
    },
  );
  await trackWeeklyReviewOpened(supabase, userId, review, {
    date,
    entryMode: "start",
    source: options.source,
    sourceNoteCount: notes.length,
    weekEnd,
    weekStart,
  });
  return review;
}

async function trackWeeklyReviewOpened(
  supabase: Client,
  userId: string,
  review: ReviewSession,
  values: {
    date: string;
    entryMode: "start" | "resume";
    source?: string;
    sourceNoteCount: number;
    weekEnd: string;
    weekStart: string;
  },
) {
  const dayOfWeek = weekday(values.date);
  await trackAnalyticsEvent(supabase, userId, "weekly_review_opened", {
    properties: {
      day_of_week: dayOfWeek,
      entry_mode: values.entryMode,
      is_weekend: dayOfWeek === 0 || dayOfWeek === 6,
      review_id: review.id,
      source: values.source ?? "dashboard",
      source_note_count: values.sourceNoteCount,
      week_end: values.weekEnd,
      week_start: values.weekStart,
    },
  });
}

async function getExistingWeeklyReview(supabase: Client, userId: string, date = todayISO()) {
  const weekStart = weekStartISO(date);
  const weekEnd = addDaysISO(weekStart, 6);
  const title = `${formatKoreanDate(weekStart)}-${formatKoreanDate(weekEnd)} 주간 복기`;
  const { data, error } = await supabase
    .from("review_sessions")
    .select("*")
    .eq("user_id", userId)
    .eq("title", title)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function syncWeeklyReviewSources(
  supabase: Client,
  reviewId: string,
  notes: Note[],
) {
  const { data: sources, error } = await supabase
    .from("review_sources")
    .select("source_note_id, sort_order")
    .eq("review_session_id", reviewId)
    .order("sort_order", { ascending: true });

  if (error) throw error;

  const existingNoteIds = new Set(
    (sources ?? [])
      .map((source) => source.source_note_id)
      .filter((id): id is string => Boolean(id)),
  );
  const missingNotes = notes.filter((note) => !existingNoteIds.has(note.id));
  if (!missingNotes.length) return;

  const nextSortOrder =
    (sources ?? []).reduce(
      (max, source) => Math.max(max, source.sort_order ?? 0),
      -1,
    ) + 1;

  const { error: insertError } = await supabase.from("review_sources").insert(
    missingNotes.map((note, index) => ({
      review_session_id: reviewId,
      source_note_id: note.id,
      source_review_session_id: null,
      sort_order: nextSortOrder + index,
    })),
  );

  if (insertError) throw insertError;
}

async function getWeeklyReviewNoteCount(supabase: Client, userId: string, date = todayISO()) {
  const weekStart = weekStartISO(date);
  const weekEnd = addDaysISO(weekStart, 6);
  const { data: templates, error: templateError } = await supabase
    .from("templates")
    .select("id")
    .eq("user_id", userId)
    .eq("template_kind", "investment_journal")
    .is("deleted_at", null);
  if (templateError) throw templateError;

  const templateIds = (templates ?? []).map((template) => template.id);
  if (!templateIds.length) return 0;

  const { count, error } = await supabase
    .from("notes")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .in("template_id", templateIds)
    .gte("note_date", weekStart)
    .lte("note_date", weekEnd)
    .eq("is_draft", false)
    .is("deleted_at", null);
  if (error) throw error;
  return count ?? 0;
}

export async function getDueReviews(supabase: Client, userId: string, limit = 20) {
  const { data: schedules, error } = await supabase
    .from("review_schedules")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "pending")
    .lte("due_date", todayISO())
    .order("due_date", { ascending: true })
    .limit(limit);

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

export async function getRecentItems(supabase: Client, userId: string, limit = 8) {
  const [notesResult, reviewsResult] = await Promise.all([
    supabase
      .from("notes")
      .select("*")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .eq("is_draft", false)
      .order("updated_at", { ascending: false })
      .limit(limit),
    supabase
      .from("review_sessions")
      .select("*")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .eq("is_draft", false)
      .order("updated_at", { ascending: false })
      .limit(limit),
  ]);

  if (notesResult.error) throw notesResult.error;
  if (reviewsResult.error) throw reviewsResult.error;

  return [
    ...((notesResult.data ?? []) as Note[]).map(noteToUnified),
    ...((reviewsResult.data ?? []) as ReviewSession[]).map(reviewToUnified),
  ]
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    .slice(0, limit);
}

function toRoutineItem(template: Template, existingNote: Note | null) {
  const action = existingNote ? "이어쓰기" : "작성하기";
  return {
    template,
    existingNote,
    href: existingNote ? `/notes/${existingNote.id}` : "",
    actionLabel: `${template.name} ${action}`,
  };
}
