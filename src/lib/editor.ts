import type { Json, TemplateKind } from "@/lib/types";

export type EditorPayload = {
  content: string;
  content_json: Json;
  content_text: string;
};

export const EMPTY_EDITOR_DOC: Json = { type: "doc", content: [] };

function textNode(text: string): Json {
  return { type: "text", text };
}

function paragraph(text = ""): Json {
  return text
    ? { type: "paragraph", content: [textNode(text)] }
    : { type: "paragraph" };
}

function bulletList(items = 1): Json {
  return {
    type: "bulletList",
    content: Array.from({ length: items }, () => ({
      type: "listItem",
      content: [paragraph()],
    })),
  };
}

function orderedList(items = 1): Json {
  return {
    type: "orderedList",
    attrs: { start: 1, type: null },
    content: Array.from({ length: items }, () => ({
      type: "listItem",
      content: [paragraph()],
    })),
  };
}

function taskList(items = 1): Json {
  return {
    type: "taskList",
    content: Array.from({ length: items }, () => ({
      type: "taskItem",
      attrs: { checked: false },
      content: [paragraph()],
    })),
  };
}

function doc(content: Json[]): Json {
  return { type: "doc", content };
}

export function textToEditorDoc(text: string): Json {
  const lines = text.split("\n");
  if (!text.trim()) return EMPTY_EDITOR_DOC;
  return doc(lines.map((line) => paragraph(line)));
}

export function editorJsonOrText(
  contentJson: Json | null | undefined,
  text: string,
): Json {
  if (hasEditorContent(contentJson)) return contentJson as Json;
  return textToEditorDoc(text);
}

export function normalizeEditorDoc(contentJson: Json): Json {
  return normalizeNode(contentJson);
}

export function toEditorPayload(contentJson: Json, fallbackText = ""): EditorPayload {
  const contentText = extractEditorText(contentJson).trim() || fallbackText.trim();
  return {
    content: contentText,
    content_json: contentJson,
    content_text: contentText,
  };
}

export function extractEditorText(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  const node = value as Record<string, unknown>;
  if (typeof node.text === "string") return node.text;
  const content = Array.isArray(node.content) ? node.content : [];
  return content
    .map((child) => extractEditorText(child))
    .filter(Boolean)
    .join("\n");
}

function hasEditorContent(value: Json | null | undefined) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const content = (value as { content?: unknown }).content;
  return Array.isArray(content) && content.length > 0;
}

function normalizeNode(value: Json): Json {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const node = value as Record<string, Json | undefined>;
  const content = Array.isArray(node.content)
    ? normalizeContent(node.content as Json[])
    : undefined;

  if (!content) return value;
  return { ...node, content };
}

function normalizeContent(content: Json[]) {
  const normalized = content.map(normalizeNode);
  const result: Json[] = [];

  for (let index = 0; index < normalized.length; index += 1) {
    const node = normalized[index];
    const last = result[result.length - 1];

    if (isSameListType(last, node)) {
      mergeListNodes(last, node);
      continue;
    }

    result.push(node);
  }

  return result;
}

function isSameListType(left: Json | undefined, right: Json | undefined) {
  return Boolean(
    left &&
      right &&
      isListNode(left) &&
      isListNode(right) &&
      listType(left) === listType(right),
  );
}

function isListNode(value: Json) {
  const type = listType(value);
  return type === "orderedList" || type === "bulletList" || type === "taskList";
}

function listType(value: Json | undefined) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  return (value as { type?: unknown }).type;
}

function mergeListNodes(target: Json, source: Json) {
  if (
    !target ||
    !source ||
    typeof target !== "object" ||
    typeof source !== "object" ||
    Array.isArray(target) ||
    Array.isArray(source)
  ) {
    return;
  }

  const targetNode = target as { content?: Json[] };
  const sourceNode = source as { content?: Json[] };
  targetNode.content = [
    ...(Array.isArray(targetNode.content) ? targetNode.content : []),
    ...(Array.isArray(sourceNode.content) ? sourceNode.content : []),
  ];
}

export const DEFAULT_TEMPLATE_NAMES = {
  investment: "투자 일기",
  weeklyReview: "한 주 마무리",
  nextWeekPlan: "다음 주 계획",
  freeMemo: "자유 메모",
} as const;

export const DEFAULT_TEMPLATE_SPECS = [
  {
    name: DEFAULT_TEMPLATE_NAMES.investment,
    kind: "investment_journal" as TemplateKind,
    isPrimary: true,
    allowMultiplePerDay: false,
    reviewSchedulePreset: "1w_3m_1y" as const,
    contentJson: doc([
      paragraph("News: 시장을 움직일만한 뉴스"),
      orderedList(2),
      paragraph("Market: 시장 반응"),
      bulletList(),
      paragraph("Portfolio: 내 포트폴리오 상태(시장대비)"),
      bulletList(),
      paragraph("Watch: 관심종목"),
      bulletList(),
      paragraph("심리: 시장 심리(신남, 무서움, 무관심)"),
      bulletList(),
      paragraph("Me - 차이: 시장 심리와 내 심리 비교"),
      bulletList(),
      paragraph("자신감: 포트폴리오에 대한 확신"),
      bulletList(),
      paragraph("Action: 행동, 이유(무엇을 했고, 왜 하지 않았는가)"),
      bulletList(),
      paragraph("해야할일:"),
      taskList(2),
      paragraph("1w 복기:"),
      bulletList(),
      paragraph("3m 복기:"),
      bulletList(),
      paragraph("1y 복기:"),
      bulletList(),
    ]),
  },
  {
    name: DEFAULT_TEMPLATE_NAMES.weeklyReview,
    kind: "weekly_review" as TemplateKind,
    isPrimary: false,
    allowMultiplePerDay: false,
    reviewSchedulePreset: "none" as const,
    contentJson: doc([
      paragraph("이번 주 한줄평"),
      bulletList(),
      paragraph("시장은 어땠나?"),
      bulletList(),
      paragraph("나는 어떻게 반응했나?"),
      bulletList(),
      paragraph("잘한 점"),
      orderedList(),
      paragraph("아쉬운 점"),
      orderedList(),
      paragraph("다음 주 교훈"),
      bulletList(),
    ]),
  },
  {
    name: DEFAULT_TEMPLATE_NAMES.nextWeekPlan,
    kind: "next_week_plan" as TemplateKind,
    isPrimary: false,
    allowMultiplePerDay: false,
    reviewSchedulePreset: "none" as const,
    contentJson: doc([
      paragraph("다음 주 한줄 목표"),
      bulletList(),
      paragraph("확인할 것"),
      bulletList(),
      paragraph("하지 않을 것"),
      bulletList(),
      paragraph("할 것"),
      bulletList(),
    ]),
  },
  {
    name: DEFAULT_TEMPLATE_NAMES.freeMemo,
    kind: "free_note" as TemplateKind,
    isPrimary: false,
    allowMultiplePerDay: true,
    reviewSchedulePreset: "none" as const,
    contentJson: EMPTY_EDITOR_DOC,
  },
];
