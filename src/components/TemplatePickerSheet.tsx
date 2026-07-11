"use client";

import { Check, FileText, X } from "lucide-react";
import { useState } from "react";
import type { Folder, Template } from "@/lib/types";

type TemplateSelection =
  | { type: "blank" }
  | { type: "template"; template: Template };

export function TemplatePickerSheet({
  templates,
  folders,
  defaultFolderId,
  loading,
  error,
  busy,
  onClose,
  onBlankNote,
  onTemplate,
}: {
  templates: Template[];
  folders: Folder[];
  defaultFolderId?: string;
  loading: boolean;
  error: string;
  busy: boolean;
  onClose: () => void;
  onBlankNote: (folder: Folder) => void;
  onTemplate: (template: Template, folder: Folder) => void;
}) {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);

  const selectedTemplate = selectedTemplateId
    ? templates.find((template) => template.id === selectedTemplateId) ?? null
    : null;
  const selectedFolder =
    folders.find((folder) => folder.id === selectedFolderId) ??
    folders.find((folder) => folder.id === defaultFolderId) ??
    folders[0] ??
    null;
  const selection: TemplateSelection = selectedTemplate
    ? { type: "template", template: selectedTemplate }
    : { type: "blank" };

  function submit() {
    if (!selectedFolder) return;
    if (selection.type === "blank") {
      onBlankNote(selectedFolder);
      return;
    }
    onTemplate(selection.template, selectedFolder);
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end bg-black/20 px-3 pb-3">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="닫기"
        onClick={onClose}
      />
      <section className="relative mx-auto w-full max-w-2xl rounded-[26px] border border-bokgi-border bg-bokgi-bg p-4 shadow-[0_20px_70px_rgba(0,0,0,0.24)]">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-[17px] font-semibold">새 메모 만들기</h2>
            <p className="mt-1 text-xs text-bokgi-muted">
              템플릿을 고르고 저장할 폴더를 선택합니다.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-bokgi-surface-muted text-bokgi-muted"
            aria-label="닫기"
          >
            <X size={17} />
          </button>
        </div>

        {loading ? (
          <p className="rounded-[18px] border border-bokgi-border bg-bokgi-surface py-8 text-center text-sm text-bokgi-muted">
            불러오는 중...
          </p>
        ) : error ? (
          <p className="rounded-[18px] border border-bokgi-border bg-bokgi-surface py-8 text-center text-sm text-red-600">
            {error}
          </p>
        ) : (
          <div className="space-y-4">
            <section>
              <h3 className="mb-2 px-1 text-[13px] font-semibold text-bokgi-muted">
                템플릿
              </h3>
              <div className="overflow-hidden rounded-[18px] border border-bokgi-border bg-bokgi-surface px-3 py-1">
                <button
                  type="button"
                  onClick={() => setSelectedTemplateId(null)}
                  disabled={busy}
                  className="flex min-h-[58px] w-full items-center gap-3 border-b border-bokgi-border-soft py-3 text-left disabled:opacity-50"
                >
                  <SelectionMark checked={!selectedTemplate} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">
                      템플릿 없이 시작
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-bokgi-muted">
                      빈 메모로 바로 작성합니다.
                    </span>
                  </span>
                </button>

                {templates.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => setSelectedTemplateId(template.id)}
                    disabled={busy}
                    className="flex min-h-[54px] w-full items-center gap-3 border-t border-bokgi-border-soft py-3 text-left first:border-t-0 disabled:opacity-50"
                  >
                    <SelectionMark checked={selectedTemplate?.id === template.id} />
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                      {template.name}
                    </span>
                  </button>
                ))}

                {!templates.length ? (
                  <p className="py-5 text-center text-sm text-bokgi-muted">
                    사용할 수 있는 템플릿이 없습니다.
                  </p>
                ) : null}
              </div>
            </section>

            <section>
              <h3 className="mb-2 px-1 text-[13px] font-semibold text-bokgi-muted">
                저장할 폴더
              </h3>
              <div className="overflow-hidden rounded-[18px] border border-bokgi-border bg-bokgi-surface px-3 py-1">
                {folders.map((folder) => (
                  <button
                    key={folder.id}
                    type="button"
                    onClick={() => setSelectedFolderId(folder.id)}
                    disabled={busy}
                    className="flex min-h-[54px] w-full items-center gap-3 border-t border-bokgi-border-soft py-3 text-left first:border-t-0 disabled:opacity-50"
                  >
                    <SelectionMark checked={selectedFolder?.id === folder.id} />
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                      {folder.name}
                    </span>
                  </button>
                ))}

                {!folders.length ? (
                  <p className="py-5 text-center text-sm text-bokgi-muted">
                    저장할 폴더가 없습니다.
                  </p>
                ) : null}
              </div>
            </section>

            <button
              type="button"
              onClick={submit}
              disabled={busy || !selectedFolder}
              className="h-12 w-full rounded-full bg-bokgi-primary text-[15px] font-semibold text-bokgi-primary-on disabled:opacity-40"
            >
              {selection.type === "blank" ? "빈 메모 작성" : "템플릿으로 작성"}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

function SelectionMark({ checked }: { checked: boolean }) {
  return (
    <span
      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${
        checked
          ? "border-bokgi-primary bg-bokgi-primary text-bokgi-primary-on"
          : "border-bokgi-border bg-bokgi-surface"
      }`}
      aria-hidden="true"
    >
      {checked ? <Check size={14} /> : <FileText size={14} className="text-bokgi-muted" />}
    </span>
  );
}
