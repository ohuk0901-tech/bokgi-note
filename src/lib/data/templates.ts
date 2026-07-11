import {
  addDaysISO,
  addMonthsISO,
  addYearsISO,
  deleteAfter30Days,
  todayISO,
  weekday,
  weekStartISO,
} from "@/lib/date";
import {
  DEFAULT_TEMPLATE_SPECS,
  toEditorPayload,
} from "@/lib/editor";
import type { Client } from "@/lib/data/shared";
import type { Json, Note, Template, TemplateKind } from "@/lib/types";

const WEEKLY_ROUTINE_KINDS = new Set<TemplateKind>([
  "weekly_review",
  "next_week_plan",
]);

const OBSOLETE_DEFAULT_TEMPLATE_KINDS: TemplateKind[] = [
  "next_week_plan",
  "free_note",
];

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

  await deleteObsoleteDefaultTemplates(supabase, userId);

  for (const [index, spec] of DEFAULT_TEMPLATE_SPECS.entries()) {
    const folder = await ensureFolderByName(supabase, userId, spec.name, index + 1);
    const { data: existingByKind, error: kindReadError } = await supabase
      .from("templates")
      .select("*")
      .eq("user_id", userId)
      .eq("template_kind", spec.kind)
      .is("deleted_at", null)
      .maybeSingle();
    if (kindReadError) throw kindReadError;

    const { data: existingByName, error: readError } = await supabase
      .from("templates")
      .select("*")
      .eq("user_id", userId)
      .eq("name", spec.name)
      .is("deleted_at", null)
      .maybeSingle();

    if (readError) throw readError;

    const existing = existingByKind ?? existingByName;
    const payload = toEditorPayload(spec.contentJson);
    if (existing) {
      const updates: Partial<Template> = {};
      if (!existing.default_folder_id || existing.default_folder_id !== folder.id) {
        updates.default_folder_id = folder.id;
      }
      if (existing.template_kind !== spec.kind) updates.template_kind = spec.kind;
      if (existing.name !== spec.name) {
        const canUseName = await canUseTemplateName(
          supabase,
          userId,
          spec.name,
          existing.id,
        );
        if (canUseName) updates.name = spec.name;
      }
      if (existing.allow_multiple_per_day !== spec.allowMultiplePerDay) {
        updates.allow_multiple_per_day = spec.allowMultiplePerDay;
      }
      if (existing.review_schedule_preset !== spec.reviewSchedulePreset) {
        updates.review_schedule_preset = spec.reviewSchedulePreset;
      }
      if (Object.keys(updates).length) {
        const { error } = await supabase
          .from("templates")
          .update(updates)
          .eq("id", existing.id);
        if (error) throw error;
      }
      continue;
    }

    const { error } = await supabase.from("templates").insert({
      user_id: userId,
      name: spec.name,
      template_kind: spec.kind,
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
    .eq("template_kind", "investment_journal")
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

async function canUseTemplateName(
  supabase: Client,
  userId: string,
  name: string,
  currentTemplateId: string,
) {
  const { data, error } = await supabase
    .from("templates")
    .select("id")
    .eq("user_id", userId)
    .eq("name", name)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) throw error;
  return !data || data.id === currentTemplateId;
}

async function deleteObsoleteDefaultTemplates(supabase: Client, userId: string) {
  const { error } = await supabase
    .from("templates")
    .delete()
    .eq("user_id", userId)
    .in("template_kind", OBSOLETE_DEFAULT_TEMPLATE_KINDS);

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

export async function createTemplate(
  supabase: Client,
  userId: string,
  values: { name: string; contentJson?: Json; contentText?: string },
) {
  const name = values.name.trim();
  if (!name) throw new Error("템플릿 이름을 입력해주세요.");

  const folder = await ensureFolderByName(supabase, userId, name);
  const payload = toEditorPayload(values.contentJson ?? { type: "doc", content: [] }, values.contentText ?? "");
  const { data, error } = await supabase
    .from("templates")
    .insert({
      user_id: userId,
      name,
      template_kind: "custom",
      content: payload.content,
      content_json: payload.content_json,
      content_text: payload.content_text,
      default_folder_id: folder.id,
      is_primary: false,
      allow_multiple_per_day: false,
      review_schedule_preset: "none",
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateTemplateDetails(
  supabase: Client,
  userId: string,
  template: Template,
  values: Pick<Template, "content" | "content_json" | "content_text"> & {
    name: string;
  },
) {
  const name = values.name.trim();
  if (!name) throw new Error("템플릿 이름을 입력해주세요.");

  const { error } = await supabase
    .from("templates")
    .update({
      name,
      content: values.content,
      content_json: values.content_json,
      content_text: values.content_text,
    })
    .eq("id", template.id)
    .eq("user_id", userId);
  if (error) throw error;

  if (template.default_folder_id && template.name !== name) {
    const { data: folder, error: folderReadError } = await supabase
      .from("folders")
      .select("*")
      .eq("id", template.default_folder_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (folderReadError) throw folderReadError;

    if (folder?.name === template.name) {
      const { error: folderUpdateError } = await supabase
        .from("folders")
        .update({ name })
        .eq("id", folder.id)
        .eq("user_id", userId);
      if (folderUpdateError) throw folderUpdateError;
    }
  }

  return { ...template, ...values, name };
}

export async function trashTemplate(
  supabase: Client,
  userId: string,
  template: Template,
) {
  if (template.template_kind !== "custom") {
    throw new Error("기본 템플릿은 삭제할 수 없습니다.");
  }
  if (template.is_primary) {
    throw new Error("대표 템플릿은 삭제할 수 없습니다. 다른 템플릿을 대표로 설정한 뒤 삭제해주세요.");
  }

  const deleted_at = new Date().toISOString();
  const delete_after = deleteAfter30Days();
  const { error } = await supabase
    .from("templates")
    .update({ deleted_at, delete_after })
    .eq("id", template.id)
    .eq("user_id", userId);
  if (error) throw error;
}

export function shouldShowWeeklyRoutines(date = todayISO()) {
  return [0, 1, 5, 6].includes(weekday(date));
}

export function routineKeyForTemplate(template: Template, date = todayISO()) {
  if (template.allow_multiple_per_day) return null;
  if (template.template_kind === "weekly_review") {
    const day = weekday(date);
    const targetDate = day === 1 ? addDaysISO(date, -7) : date;
    return `template:${template.id}:week-review:${weekStartISO(targetDate)}`;
  }
  if (template.template_kind === "next_week_plan") {
    const day = weekday(date);
    const targetDate = day === 5 || day === 6 || day === 0 ? addDaysISO(date, 7) : date;
    return `template:${template.id}:week-plan:${weekStartISO(targetDate)}`;
  }
  if (WEEKLY_ROUTINE_KINDS.has(template.template_kind)) {
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

export async function createNoteFromTemplateInFolder(
  supabase: Client,
  userId: string,
  templateId: string,
  folderId: string,
) {
  const { data: template, error: templateError } = await supabase
    .from("templates")
    .select("*")
    .eq("id", templateId)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .single();

  if (templateError) throw templateError;

  const { data: note, error } = await supabase
    .from("notes")
    .insert({
      user_id: userId,
      folder_id: folderId,
      template_id: template.id,
      title: template.name,
      content: template.content,
      content_json: template.content_json,
      content_text: template.content_text,
      note_date: todayISO(),
      is_draft: false,
      routine_key: null,
    })
    .select()
    .single();

  if (error) throw error;

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
