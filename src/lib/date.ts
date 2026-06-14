export function todayISO() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  const local = new Date(now.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 10);
}

export function toLocalISO(date: Date) {
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 10);
}

export function addDaysISO(value: string, days: number) {
  const date = new Date(`${value}T00:00:00`);
  date.setDate(date.getDate() + days);
  return toLocalISO(date);
}

export function addMonthsISO(value: string, months: number) {
  const date = new Date(`${value}T00:00:00`);
  date.setMonth(date.getMonth() + months);
  return toLocalISO(date);
}

export function addYearsISO(value: string, years: number) {
  const date = new Date(`${value}T00:00:00`);
  date.setFullYear(date.getFullYear() + years);
  return toLocalISO(date);
}

export function weekStartISO(value: string) {
  const date = new Date(`${value}T00:00:00`);
  const day = date.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + mondayOffset);
  return toLocalISO(date);
}

export function weekday(value: string) {
  return new Date(`${value}T00:00:00`).getDay();
}

export function formatKoreanDate(value: string | null | undefined) {
  if (!value) return "";
  const [year, month, day] = value.slice(0, 10).split("-");
  if (!year || !month || !day) return value;
  return `${year}.${month}.${day}`;
}

export function defaultReviewTitle(date = todayISO()) {
  return `${formatKoreanDate(date)} 복기`;
}

export function deleteAfter30Days() {
  const date = new Date();
  date.setDate(date.getDate() + 30);
  return date.toISOString();
}

export function previewText(content: string, length = 80) {
  const compact = content.replace(/\s+/g, " ").trim();
  if (!compact) return "내용 없음";
  return compact.length > length ? `${compact.slice(0, length)}...` : compact;
}
