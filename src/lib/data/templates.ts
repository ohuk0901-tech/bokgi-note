import {
  addDaysISO,
  addMonthsISO,
  addYearsISO,
  todayISO,
  weekday,
  weekStartISO,
} from "@/lib/date";
import {
  DEFAULT_TEMPLATE_NAMES,
  DEFAULT_TEMPLATE_SPECS,
  toEditorPayload,
} from "@/lib/editor";
import type { Client } from "@/lib/data/shared";
import type { Note, Template } from "@/lib/types";

const WEEKLY_ROUTINE_NAMES = new Set<string>([
  DEFAULT_TEMPLATE_NAMES.weeklyReview,
  DEFAULT_TEMPLATE_NAMES.nextWeekPlan,
]);

export async function ensureFolderByName(
  supabase: Client,
  userId: string,
  name: string,
  sortOrder = 0,
) {
  const { data: existing, error: readError } = await supabase
    .from("folders")
    .select("*")
    .eq("user_id", userId)
    .eq("name", name)
    .is("deleted_at", null)
    .maybeSingle();

  if (readError) throw readError;
  if (existing) return existing;

  const { data, error } = await supabase
    .from("folders")
    .insert({ user_id: userId, name, sort_order: sortOrder })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function ensureDefaultTemplates(supabase: Client, userId: string) {
  const { data: primary } = await supabase
    .from("templates")
    .select("id")
    .eq("user_id", userId)
    .eq("is_primary", true)
    .is("deleted_at", null)
    .maybeSingle();

  for (const [index, spec] of DEFAULT_TEMPLATE_SPECS.entries()) {
    const folder = await ensureFolderByName(supabase, userId, spec.name, index + 1);
    const { data: existing, error: readError } = await supabase
      .from("templates")
      .select("*")
      .eq("user_id", userId)
      .eq("name", spec.name)
      .is("deleted_at", null)
      .maybeSingle();

    if (readError) throw readError;

    const payload = toEditorPayload(spec.contentJson);
    if (existing) {
      if (!existing.default_folder_id) {
        const { error } = await supabase
          .from("templates")
          .update({ default_folder_id: folder.id })
          .eq("id", existing.id);
        if (error) throw error;
      }
      continue;
    }

    const { error } = await supabase.from("templates").insert({
      user_id: userId,
      name: spec.name,
      content: payload.content,
      content_json: payload.content_json,
      content_text: payload.content_text,
      default_folder_id: folder.id,
      is_primary: spec.isPrimary && !primary,
      allow_multiple_per_day: spec.allowMultiplePerDay,
      review_schedule_preset: spec.reviewSchedulePreset,
    });
    if (error) throw error;
  }

  const { data: hasPrimary, error: primaryError } = await supabase
    .from("templates")
    .select("id")
    .eq("user_id", userId)
    .eq("is_primary", true)
    .is("deleted_at", null)
    .maybeSingle();

  if (primaryError) throw primaryError;
  if (hasPrimary) return;

  const { data: investment, error: investmentError } = await supabase
    .from("templates")
    .select("id")
    .eq("user_id", userId)
    .eq("name", DEFAULT_TEMPLATE_NAMES.investment)
    .is("deleted_at", null)
    .maybeSingle();

  if (investmentError) throw investmentError;
  if (!investment) return;

  const { error } = await supabase
    .from("templates")
    .update({ is_primary: true })
    .eq("id", investment.id);
  if (error) throw error;
}

export async function getTemplates(supabase: Client) {
  const { data, error } = await supabase
    .from("templates")
    .select("*")
    .is("deleted_at", null)
    .order("usage_count", { ascending: false })
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function setPrimaryTemplate(
  supabase: Client,
  userId: string,
  templateId: string,
) {
  const { error: clearError } = await supabase
    .from("templates")
    .update({ is_primary: false })
    .eq("user_id", userId)
    .is("deleted_at", null);
  if (clearError) throw clearError;

  const { error } = await supabase
    .from("templates")
    .update({ is_primary: true })
    .eq("id", templateId)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function updateTemplateContent(
  supabase: Client,
  templateId: string,
  values: Pick<Template, "content" | "content_json" | "content_text">,
) {
  const { error } = await supabase
    .from("templates")
    .update(values)
    .eq("id", templateId);
  if (error) throw error;
}

export function shouldShowWeeklyRoutines(date = todayISO()) {
  return [0, 1, 5, 6].includes(weekday(date));
}

export function routineKeyForTemplate(template: Template, date = todayISO()) {
  if (template.allow_multiple_per_day) return null;
  if (template.name === DEFAULT_TEMPLATE_NAMES.weeklyReview) {
    const day = weekday(date);
    const targetDate = day === 1 ? addDaysISO(date, -7) : date;
    return `template:${template.id}:week-review:${weekStartISO(targetDate)}`;
  }
  if (template.name === DEFAULT_TEMPLATE_NAMES.nextWeekPlan) {
    const day = weekday(date);
    const targetDate = day === 5 || day === 6 || day === 0 ? addDaysISO(date, 7) : date;
    return `template:${template.id}:week-plan:${weekStartISO(targetDate)}`;
  }
  if (WEEKLY_ROUTINE_NAMES.has(template.name)) {
    return `template:${template.id}:week:${weekStartISO(date)}`;
  }
  return `template:${template.id}:day:${date}`;
}

export async function findRoutineNote(
  supabase: Client,
  userId: string,
  template: Template,
  date = todayISO(),
) {
  const routineKey = routineKeyForTemplate(template, date);
  if (!routineKey) return null;

  const { data, error } = await supabase
    .from("notes")
    .select("*")
    .eq("user_id", userId)
    .eq("routine_key", routineKey)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function createOrOpenTemplateNote(
  supabase: Client,
  userId: string,
  templateId: string,
) {
  const { data: template, error: templateError } = await supabase
    .from("templates")
    .select("*")
    .eq("id", templateId)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .single();

  if (templateError) throw templateError;

  const today = todayISO();
  const routineKey = routineKeyForTemplate(template, today);
  if (routineKey) {
    const existing = await findNoteByRoutineKey(supabase, userId, routineKey);
    if (existing) return existing;
  }

  const folder =
    template.default_folder_id ??
    (await ensureFolderByName(supabase, userId, template.name)).id;
  if (!template.default_folder_id) {
    const { error } = await supabase
      .from("templates")
      .update({ default_folder_id: folder })
      .eq("id", template.id);
    if (error) throw error;
  }

  const { data: note, error } = await supabase
    .from("notes")
    .insert({
      user_id: userId,
      folder_id: folder,
      template_id: template.id,
      title: template.name,
      content: template.content,
      content_json: template.content_json,
      content_text: template.content_text,
      note_date: today,
      is_draft: false,
      routine_key: routineKey,
    })
    .select()
    .single();

  if (error) {
    if (routineKey) {
      const existing = await findNoteByRoutineKey(supabase, userId, routineKey);
      if (existing) return existing;
    }
    throw error;
  }

  await Promise.all([
    incrementTemplateUsage(supabase, template),
    createReviewSchedulesForNote(supabase, userId, note, template),
  ]);

  return note;
}

async function findNoteByRoutineKey(
  supabase: Client,
  userId: string,
  routineKey: string,
) {
  const { data, error } = await supabase
    .from("notes")
    .select("*")
    .eq("user_id", userId)
    .eq("routine_key", routineKey)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function incrementTemplateUsage(supabase: Client, template: Template) {
  const { error } = await supabase
    .from("templates")
    .update({ usage_count: template.usage_count + 1 })
    .eq("id", template.id);
  if (error) throw error;
}

async function createReviewSchedulesForNote(
  supabase: Client,
  userId: string,
  note: Note,
  template: Template,
) {
  if (template.review_schedule_preset !== "1w_3m_1y") return;

  const rows = [
    { user_id: userId, note_id: note.id, review_type: "1w" as const, due_date: addDaysISO(note.note_date, 7) },
    { user_id: userId, note_id: note.id, review_type: "3m" as const, due_date: addMonthsISO(note.note_date, 3) },
    { user_id: userId, note_id: note.id, review_type: "1y" as const, due_date: addYearsISO(note.note_date, 1) },
  ];

  const { error } = await supabase
    .from("review_schedules")
    .upsert(rows, { onConflict: "note_id,review_type" });
  if (error) throw error;
}
