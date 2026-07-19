import { todayISO } from "@/lib/date";
import type { Client } from "@/lib/data/shared";
import type { AnalyticsEventName, Json } from "@/lib/types";

export const MEANINGFUL_TEXT_CHANGE_THRESHOLD = 20;

type AnalyticsProperties = Record<string, Json | undefined>;

type TrackAnalyticsEventOptions = {
  eventKey?: string;
  pagePath?: string;
  properties?: AnalyticsProperties;
};

export async function trackAnalyticsEvent(
  supabase: Client,
  userId: string,
  eventName: AnalyticsEventName,
  options: TrackAnalyticsEventOptions = {},
) {
  try {
    const { error } = await supabase.from("analytics_events").insert({
      user_id: userId,
      event_name: eventName,
      event_key: options.eventKey,
      page_path: options.pagePath ?? getCurrentPagePath(),
      properties: compactProperties({
        ...options.properties,
        device_type: getDeviceType(),
      }),
    });

    if (error && error.code !== "23505") {
      console.warn("Analytics event was not recorded.", error.message);
      return false;
    }
    return true;
  } catch (error) {
    console.warn("Analytics event was not recorded.", error);
    return false;
  }
}

export function changedTextLength(before: string, after: string) {
  const previous = normalizeText(before);
  const next = normalizeText(after);
  if (previous === next) return 0;

  let prefix = 0;
  while (
    prefix < previous.length &&
    prefix < next.length &&
    previous[prefix] === next[prefix]
  ) {
    prefix += 1;
  }

  let previousEnd = previous.length - 1;
  let nextEnd = next.length - 1;
  while (
    previousEnd >= prefix &&
    nextEnd >= prefix &&
    previous[previousEnd] === next[nextEnd]
  ) {
    previousEnd -= 1;
    nextEnd -= 1;
  }

  const removed = Math.max(previousEnd - prefix + 1, 0);
  const added = Math.max(nextEnd - prefix + 1, 0);
  return Math.max(removed, added);
}

export function isMeaningfulTextChange(before: string, after: string) {
  return changedTextLength(before, after) >= MEANINGFUL_TEXT_CHANGE_THRESHOLD;
}

export function textChangeBucket(changeLength: number) {
  if (changeLength >= 300) return "300_plus";
  if (changeLength >= 100) return "100_299";
  if (changeLength >= MEANINGFUL_TEXT_CHANGE_THRESHOLD) return "20_99";
  return "under_20";
}

export function daysFromToday(value: string) {
  const dueDate = new Date(`${value.slice(0, 10)}T00:00:00`);
  const currentDate = new Date(`${todayISO()}T00:00:00`);
  if (Number.isNaN(dueDate.getTime())) return 0;
  return Math.floor((currentDate.getTime() - dueDate.getTime()) / 86_400_000);
}

function compactProperties(properties: AnalyticsProperties): Json {
  const result: Record<string, Json> = {};
  for (const [key, value] of Object.entries(properties)) {
    if (value !== undefined) result[key] = value;
  }
  return result;
}

function getCurrentPagePath() {
  if (typeof window === "undefined") return null;
  return `${window.location.pathname}${window.location.search}`;
}

function getDeviceType() {
  if (typeof window === "undefined") return "unknown";
  const width = window.innerWidth;
  if (width < 768) return "mobile";
  if (width < 1024) return "tablet";
  return "desktop";
}

function normalizeText(value: string) {
  return value.replace(/\r\n/g, "\n").trim();
}
