import type { Folder, Json, Note, ReviewSession } from "@/lib/types";

type MarkdownFile = {
  content: string;
  path: string;
};

type MarkdownDocumentValues = {
  contentJson: Json;
  contentText: string;
  createdAt: string;
  date: string;
  folderName?: string;
  id: string;
  title: string;
  typeLabel: string;
  updatedAt: string;
};

export function markdownFileForNote(
  note: Note,
  options: { folderName?: string; pathPrefix?: string } = {},
) {
  const filename = `${note.note_date}_${sanitizePathSegment(note.title)}.md`;
  return {
    content: buildMarkdownDocument({
      contentJson: note.content_json,
      contentText: note.content_text || note.content,
      createdAt: note.created_at,
      date: note.note_date,
      folderName: options.folderName,
      id: note.id,
      title: note.title,
      typeLabel: note.is_pinned ? "대표 메모" : "메모",
      updatedAt: note.updated_at,
    }),
    path: joinPath(options.pathPrefix, filename),
  };
}

export function markdownFileForReview(
  review: ReviewSession,
  options: { folderName?: string; pathPrefix?: string } = {},
) {
  const filename = `${review.review_date}_복기_${sanitizePathSegment(review.title)}.md`;
  return {
    content: buildMarkdownDocument({
      contentJson: review.content_json,
      contentText: review.content_text || review.content,
      createdAt: review.created_at,
      date: review.review_date,
      folderName: options.folderName,
      id: review.id,
      title: review.title,
      typeLabel: "복기 기록",
      updatedAt: review.updated_at,
    }),
    path: joinPath(options.pathPrefix, filename),
  };
}

export function downloadMarkdownFile(file: MarkdownFile) {
  downloadBlob(
    new Blob([file.content], { type: "text/markdown;charset=utf-8" }),
    file.path.split("/").at(-1) ?? "bokgi-note.md",
  );
}

export function buildMarkdownBackupZip({
  folders,
  notes,
  reviews,
}: {
  folders: Folder[];
  notes: Note[];
  reviews: ReviewSession[];
}) {
  const folderNames = new Map(folders.map((folder) => [folder.id, folder.name]));
  const usedPaths = new Set<string>();
  const files: MarkdownFile[] = [
    {
      path: "README.md",
      content: [
        "# 복기노트 백업",
        "",
        `- 백업일: ${new Date().toISOString()}`,
        `- 메모: ${notes.length}개`,
        `- 복기 기록: ${reviews.length}개`,
        "",
        "이 ZIP 파일은 복기노트의 메모와 복기 기록을 Markdown 파일로 저장한 백업입니다.",
        "앱 안의 원본 데이터는 이 파일을 내려받아도 삭제되지 않습니다.",
      ].join("\n"),
    },
  ];

  for (const note of notes) {
    const folderName = folderNames.get(note.folder_id) ?? "폴더 없음";
    files.push(
      uniqueMarkdownFile(
        markdownFileForNote(note, {
          folderName,
          pathPrefix: sanitizePathSegment(folderName),
        }),
        usedPaths,
      ),
    );
  }

  for (const review of reviews) {
    const folderName = folderNames.get(review.folder_id) ?? "폴더 없음";
    files.push(
      uniqueMarkdownFile(
        markdownFileForReview(review, {
          folderName,
          pathPrefix: sanitizePathSegment(folderName),
        }),
        usedPaths,
      ),
    );
  }

  const exportedDate = new Date().toISOString().slice(0, 10);
  return {
    blob: createZipBlob(files),
    filename: `bokgi-note-backup-${exportedDate}.zip`,
    itemCount: notes.length + reviews.length,
  };
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => window.URL.revokeObjectURL(url), 1000);
}

function buildMarkdownDocument(values: MarkdownDocumentValues) {
  const body =
    markdownFromEditorJson(values.contentJson).trim() ||
    values.contentText.trim() ||
    "내용 없음";
  return [
    `# ${values.title || "제목 없음"}`,
    "",
    `- 유형: ${values.typeLabel}`,
    `- 날짜: ${values.date}`,
    values.folderName ? `- 폴더: ${values.folderName}` : null,
    `- 복기노트 ID: ${values.id}`,
    `- 생성일: ${values.createdAt}`,
    `- 수정일: ${values.updatedAt}`,
    `- 내보낸 날짜: ${new Date().toISOString()}`,
    "",
    "---",
    "",
    body,
    "",
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}

function markdownFromEditorJson(value: Json): string {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  return renderBlock(value as EditorNode, 0).replace(/\n{3,}/g, "\n\n");
}

type EditorNode = {
  attrs?: Record<string, unknown>;
  content?: EditorNode[];
  marks?: { attrs?: Record<string, unknown>; type?: string }[];
  text?: string;
  type?: string;
};

function renderBlock(node: EditorNode, depth: number): string {
  const children = Array.isArray(node.content) ? node.content : [];
  switch (node.type) {
    case "doc":
      return children.map((child) => renderBlock(child, depth)).join("\n\n");
    case "paragraph":
      return renderInlineChildren(children);
    case "heading":
      return `${"#".repeat(Number(node.attrs?.level) || 2)} ${renderInlineChildren(children)}`;
    case "blockquote":
      return renderChildrenAsBlocks(children, depth)
        .split("\n")
        .map((line) => `> ${line}`)
        .join("\n");
    case "bulletList":
      return renderList(children, depth, "bullet");
    case "orderedList":
      return renderList(children, depth, "ordered", Number(node.attrs?.start) || 1);
    case "taskList":
      return renderList(children, depth, "task");
    case "codeBlock":
      return ["```", renderTextChildren(children), "```"].join("\n");
    default:
      return renderInlineChildren(children) || renderTextChildren(children);
  }
}

function renderList(
  items: EditorNode[],
  depth: number,
  kind: "bullet" | "ordered" | "task",
  start = 1,
) {
  return items
    .map((item, index) => {
      if (kind === "ordered") return renderListItem(item, depth, `${start + index}.`);
      if (kind === "task") {
        const checked = item.attrs?.checked === true ? "x" : " ";
        return renderListItem(item, depth, `- [${checked}]`);
      }
      return renderListItem(item, depth, "-");
    })
    .join("\n");
}

function renderListItem(item: EditorNode, depth: number, marker: string) {
  const indent = "  ".repeat(depth);
  const childBlocks = Array.isArray(item.content) ? item.content : [];
  const regularBlocks: string[] = [];
  const nestedBlocks: string[] = [];

  for (const child of childBlocks) {
    if (isListNode(child)) nestedBlocks.push(renderBlock(child, depth + 1));
    else regularBlocks.push(renderBlock(child, depth).trim());
  }

  const firstLine = regularBlocks.shift() || "";
  const rest = regularBlocks
    .filter(Boolean)
    .map((block) =>
      block
        .split("\n")
        .map((line) => `${indent}  ${line}`)
        .join("\n"),
    );
  return [
    `${indent}${marker} ${firstLine}`.trimEnd(),
    ...rest,
    ...nestedBlocks,
  ]
    .filter(Boolean)
    .join("\n");
}

function renderChildrenAsBlocks(children: EditorNode[], depth: number) {
  return children.map((child) => renderBlock(child, depth)).join("\n\n");
}

function renderInlineChildren(children: EditorNode[]) {
  return children.map(renderInline).join("");
}

function renderInline(node: EditorNode): string {
  if (node.type === "hardBreak") return "\n";
  let text = node.text ?? renderInlineChildren(Array.isArray(node.content) ? node.content : []);
  for (const mark of node.marks ?? []) {
    if (mark.type === "bold") text = `**${text}**`;
    if (mark.type === "italic") text = `_${text}_`;
    if (mark.type === "strike") text = `~~${text}~~`;
    if (mark.type === "code") text = `\`${text}\``;
    if (mark.type === "link" && typeof mark.attrs?.href === "string") {
      text = `[${text}](${mark.attrs.href})`;
    }
  }
  return text;
}

function renderTextChildren(children: EditorNode[]): string {
  return children
    .map((child) => child.text ?? renderTextChildren(child.content ?? []))
    .join("");
}

function isListNode(node: EditorNode) {
  return node.type === "bulletList" || node.type === "orderedList" || node.type === "taskList";
}

function uniqueMarkdownFile(file: MarkdownFile, usedPaths: Set<string>): MarkdownFile {
  let nextPath = file.path;
  let index = 2;
  while (usedPaths.has(nextPath)) {
    nextPath = file.path.replace(/\.md$/, `-${index}.md`);
    index += 1;
  }
  usedPaths.add(nextPath);
  return { ...file, path: nextPath };
}

function joinPath(prefix: string | undefined, filename: string) {
  return prefix ? `${prefix}/${filename}` : filename;
}

function sanitizePathSegment(value: string) {
  const segment = value
    .trim()
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/[. ]+$/g, "")
    .slice(0, 80)
    .trim();
  return segment || "제목 없음";
}

function createZipBlob(files: MarkdownFile[]) {
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const centralDirectory: Uint8Array[] = [];
  let offset = 0;

  for (const file of files.sort((a, b) => a.path.localeCompare(b.path))) {
    const nameBytes = encoder.encode(file.path);
    const dataBytes = encoder.encode(file.content);
    const crc = crc32(dataBytes);
    const { date, time } = dosDateTime(new Date());
    const localHeader = zipLocalHeader(nameBytes, dataBytes, crc, time, date);
    const centralHeader = zipCentralHeader(
      nameBytes,
      dataBytes,
      crc,
      time,
      date,
      offset,
    );

    chunks.push(localHeader, nameBytes, dataBytes);
    centralDirectory.push(centralHeader, nameBytes);
    offset += localHeader.length + nameBytes.length + dataBytes.length;
  }

  const centralOffset = offset;
  for (const chunk of centralDirectory) {
    chunks.push(chunk);
    offset += chunk.length;
  }

  chunks.push(zipEndRecord(files.length, offset - centralOffset, centralOffset));
  return new Blob(chunks.map(toArrayBuffer), { type: "application/zip" });
}

function toArrayBuffer(bytes: Uint8Array) {
  const copy = new Uint8Array(bytes.length);
  copy.set(bytes);
  return copy.buffer;
}

function zipLocalHeader(
  nameBytes: Uint8Array,
  dataBytes: Uint8Array,
  crc: number,
  time: number,
  date: number,
) {
  const bytes = new Uint8Array(30);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, 0x04034b50, true);
  view.setUint16(4, 20, true);
  view.setUint16(6, 0x0800, true);
  view.setUint16(8, 0, true);
  view.setUint16(10, time, true);
  view.setUint16(12, date, true);
  view.setUint32(14, crc, true);
  view.setUint32(18, dataBytes.length, true);
  view.setUint32(22, dataBytes.length, true);
  view.setUint16(26, nameBytes.length, true);
  view.setUint16(28, 0, true);
  return bytes;
}

function zipCentralHeader(
  nameBytes: Uint8Array,
  dataBytes: Uint8Array,
  crc: number,
  time: number,
  date: number,
  offset: number,
) {
  const bytes = new Uint8Array(46);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, 0x02014b50, true);
  view.setUint16(4, 20, true);
  view.setUint16(6, 20, true);
  view.setUint16(8, 0x0800, true);
  view.setUint16(10, 0, true);
  view.setUint16(12, time, true);
  view.setUint16(14, date, true);
  view.setUint32(16, crc, true);
  view.setUint32(20, dataBytes.length, true);
  view.setUint32(24, dataBytes.length, true);
  view.setUint16(28, nameBytes.length, true);
  view.setUint16(30, 0, true);
  view.setUint16(32, 0, true);
  view.setUint16(34, 0, true);
  view.setUint16(36, 0, true);
  view.setUint32(38, 0, true);
  view.setUint32(42, offset, true);
  return bytes;
}

function zipEndRecord(fileCount: number, centralSize: number, centralOffset: number) {
  const bytes = new Uint8Array(22);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, 0x06054b50, true);
  view.setUint16(4, 0, true);
  view.setUint16(6, 0, true);
  view.setUint16(8, fileCount, true);
  view.setUint16(10, fileCount, true);
  view.setUint32(12, centralSize, true);
  view.setUint32(16, centralOffset, true);
  view.setUint16(20, 0, true);
  return bytes;
}

function dosDateTime(date: Date) {
  return {
    date:
      ((date.getFullYear() - 1980) << 9) |
      ((date.getMonth() + 1) << 5) |
      date.getDate(),
    time:
      (date.getHours() << 11) |
      (date.getMinutes() << 5) |
      Math.floor(date.getSeconds() / 2),
  };
}

let crcTable: Uint32Array | null = null;

function crc32(bytes: Uint8Array) {
  if (!crcTable) crcTable = buildCrcTable();
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function buildCrcTable() {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
}
