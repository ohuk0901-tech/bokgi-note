"use client";

import { useEffect, useState } from "react";
import { LogOut, Pencil, Plus, Smartphone, Star, Trash2, UserX } from "lucide-react";
import { useRouter } from "next/navigation";
import { AppChrome } from "@/components/AppChrome";
import { LoadingState } from "@/components/LoadingState";
import { RichTextEditor } from "@/components/RichTextEditor";
import { SetupNotice } from "@/components/SetupNotice";
import { useRequireAuth } from "@/components/useRequireAuth";
import {
  createTemplate,
  getTemplates,
  requestAccountDeletion,
  trashTemplate,
  updateTemplateDetails,
} from "@/lib/data";
import type { Client } from "@/lib/data/shared";
import { editorJsonOrText, toEditorPayload } from "@/lib/editor";
import type { Json, Template } from "@/lib/types";

export function SettingsPage() {
  const router = useRouter();
  const { supabase, configured, user, loading } = useRequireAuth();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [templateMessage, setTemplateMessage] = useState("");
  const [newTemplateName, setNewTemplateName] = useState("");
  const [creatingTemplate, setCreatingTemplate] = useState(false);

  useEffect(() => {
    if (!supabase || !user) return;
    getTemplates(supabase).then(setTemplates).catch(console.error);
  }, [supabase, user]);

  if (!configured) return <SetupNotice />;
  if (loading || !supabase || !user) return <LoadingState />;

  const client = supabase;
  const currentUser = user;

  async function logout() {
    await client.auth.signOut();
    router.replace("/login");
  }

  async function deleteAccount() {
    const ok = window.confirm(
      "계정을 삭제하면 모든 데이터가 휴지통 처리되고 30일 후 완전 삭제됩니다. 계속할까요?",
    );
    if (!ok) return;
    await requestAccountDeletion(client, currentUser.id);
    router.replace("/login");
  }

  async function addTemplate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = newTemplateName.trim();
    if (!name) return;
    setCreatingTemplate(true);
    try {
      const template = await createTemplate(client, currentUser.id, { name });
      setTemplates((current) => [...current, template]);
      setEditingTemplateId(template.id);
      setNewTemplateName("");
      setTemplateMessage("템플릿을 추가했습니다.");
    } catch (error) {
      alert(error instanceof Error ? error.message : "템플릿을 추가하지 못했습니다.");
    } finally {
      setCreatingTemplate(false);
    }
  }

  async function deleteTemplate(template: Template) {
    const ok = window.confirm(
      `'${template.name}' 템플릿을 삭제할까요? 기존 메모와 폴더는 유지됩니다.`,
    );
    if (!ok) return;
    try {
      await trashTemplate(client, currentUser.id, template);
      setTemplates((current) => current.filter((item) => item.id !== template.id));
      setTemplateMessage("템플릿을 삭제했습니다.");
    } catch (error) {
      alert(error instanceof Error ? error.message : "템플릿을 삭제하지 못했습니다.");
    }
  }

  return (
    <AppChrome>
      <h1 className="text-2xl font-semibold">설정</h1>
      <div className="mt-5 divide-y divide-bokgi-border-soft overflow-hidden rounded border border-bokgi-border bg-bokgi-surface">
        <section className="px-4 py-4">
          <p className="text-sm text-bokgi-muted">로그인 계정</p>
          <p className="mt-1 font-medium">{user.email}</p>
        </section>
        <section className="px-4 py-4">
          <div className="flex items-start gap-3">
            <Smartphone className="mt-1 text-bokgi-accent" size={20} />
            <div>
              <p className="font-medium">홈 화면에 추가</p>
              <p className="mt-1 text-sm leading-6 text-bokgi-ink-soft">
                앱처럼 빠르게 열 수 있습니다. iPhone은 Safari 공유 버튼,
                Android는 Chrome 메뉴에서 추가하세요.
              </p>
            </div>
          </div>
        </section>
        <section className="px-4 py-4">
          <div className="mb-3 flex items-center gap-2">
            <Star className="text-bokgi-accent" size={19} />
            <h2 className="font-semibold">템플릿</h2>
          </div>
          <form onSubmit={addTemplate} className="mb-4 flex gap-2">
            <input
              value={newTemplateName}
              onChange={(event) => setNewTemplateName(event.target.value)}
              className="min-w-0 flex-1 rounded border border-bokgi-border bg-bokgi-surface px-3 text-sm outline-none"
              placeholder="새 템플릿 이름"
            />
            <button
              disabled={creatingTemplate || !newTemplateName.trim()}
              className="flex h-10 items-center gap-2 rounded bg-bokgi-primary px-3 text-sm font-medium text-bokgi-primary-on disabled:opacity-50"
            >
              <Plus size={16} />
              추가
            </button>
          </form>
          <div className="space-y-3">
            {templates.map((template) => (
              <div
                key={template.id}
                className="rounded border border-bokgi-border bg-bokgi-surface-muted p-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{template.name}</p>
                    <p className="mt-1 text-xs text-bokgi-muted">
                      {templateLabel(template)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() =>
                        setEditingTemplateId((current) =>
                          current === template.id ? null : template.id,
                        )
                      }
                      className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-bokgi-surface-hover"
                      title="템플릿 수정"
                      aria-label="템플릿 수정"
                    >
                      <Pencil size={17} />
                    </button>
                    {template.template_kind === "custom" ? (
                      <button
                        onClick={() => deleteTemplate(template)}
                        className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-bokgi-surface-hover"
                        title="템플릿 삭제"
                        aria-label="템플릿 삭제"
                      >
                        <Trash2 size={17} />
                      </button>
                    ) : null}
                  </div>
                </div>
                {editingTemplateId === template.id ? (
                  <TemplateEditor
                    supabase={client}
                    userId={currentUser.id}
                    template={template}
                    onSaved={(updated) => {
                      setTemplates((current) =>
                        current.map((item) =>
                          item.id === updated.id ? updated : item,
                        ),
                      );
                      setTemplateMessage("템플릿을 저장했습니다.");
                    }}
                  />
                ) : null}
              </div>
            ))}
          </div>
          {templateMessage ? (
            <p className="mt-3 text-sm text-bokgi-accent">{templateMessage}</p>
          ) : null}
        </section>
        <button
          onClick={logout}
          className="flex w-full items-center gap-3 px-4 py-4 text-left hover:bg-bokgi-surface-hover"
        >
          <LogOut size={19} />
          로그아웃
        </button>
        <button
          onClick={deleteAccount}
          className="flex w-full items-center gap-3 px-4 py-4 text-left text-red-700 hover:bg-red-50"
        >
          <UserX size={19} />
          계정 삭제
        </button>
      </div>
    </AppChrome>
  );
}

function templateLabel(template: Template) {
  if (template.template_kind === "investment_journal") return "오늘 기록";
  if (template.template_kind === "weekly_review") return "이번 주 복기";
  if (template.template_kind === "custom") return "사용자 템플릿";
  return "기본 템플릿";
}

function TemplateEditor({
  supabase,
  userId,
  template,
  onSaved,
}: {
  supabase: Client;
  userId: string;
  template: Template;
  onSaved: (template: Template) => void;
}) {
  const [name, setName] = useState(template.name);
  const [contentJson, setContentJson] = useState<Json>(
    editorJsonOrText(template.content_json, template.content),
  );
  const [contentText, setContentText] = useState(
    template.content_text || template.content,
  );
  const [saving, setSaving] = useState(false);

  async function saveTemplate() {
    setSaving(true);
    try {
      const payload = toEditorPayload(contentJson, contentText);
      const updated = await updateTemplateDetails(supabase, userId, template, {
        name,
        content: payload.content,
        content_json: payload.content_json,
        content_text: payload.content_text,
      });
      onSaved(updated);
    } catch (error) {
      alert(error instanceof Error ? error.message : "템플릿을 저장하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-3">
      <input
        value={name}
        onChange={(event) => setName(event.target.value)}
        className="mb-3 h-10 w-full rounded border border-bokgi-border bg-bokgi-surface px-3 text-sm font-medium outline-none"
        placeholder="템플릿 이름"
      />
      <RichTextEditor
        key={template.id}
        contentJson={contentJson}
        minHeight="12rem"
        onChange={(value) => {
          setContentJson(value.contentJson);
          setContentText(value.contentText);
        }}
      />
      <button
        onClick={saveTemplate}
        disabled={saving || !name.trim()}
        className="mt-3 h-10 rounded bg-bokgi-primary px-4 text-sm font-medium text-bokgi-primary-on disabled:opacity-50"
      >
        저장
      </button>
    </div>
  );
}
