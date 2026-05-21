export function todayISO() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  const local = new Date(now.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 10);
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
