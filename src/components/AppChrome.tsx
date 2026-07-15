"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Folder as FolderIcon, Home, SquarePen, Settings, Trash2, UserCircle } from "lucide-react";
import { TemplatePickerSheet } from "@/components/TemplatePickerSheet";
import {
  createDraftNote,
  createNoteFromTemplateInFolder,
  getFolders,
  getTemplates,
} from "@/lib/data";
import { createSupabaseBrowserClient, hasSupabaseEnv } from "@/lib/supabase/browser";
import type { Folder, Template } from "@/lib/types";

export function AppChrome({
  children,
  quickNoteDefaultFolderId,
}: {
  children: React.ReactNode;
  quickNoteDefaultFolderId?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const configured = hasSupabaseEnv();
  const supabase = useMemo(
    () => (configured ? createSupabaseBrowserClient() : null),
    [configured],
  );
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [quickSheetOpen, setQuickSheetOpen] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [quickUserId, setQuickUserId] = useState<string | null>(null);
  const [quickLoading, setQuickLoading] = useState(false);
  const [quickBusy, setQuickBusy] = useState(false);
  const [quickError, setQuickError] = useState("");

  const homeActive = pathname === "/dashboard" || pathname.startsWith("/dashboard/");
  const foldersActive = pathname === "/folders" || pathname.startsWith("/folders/");
  const isEditorRoute = pathname.startsWith("/notes/") || pathname.startsWith("/reviews/");

  async function openQuickNoteSheet() {
    setAccountMenuOpen(false);
    if (!supabase) {
      alert("앱 설정이 필요합니다.");
      return;
    }

    setQuickSheetOpen(true);
    setQuickError("");
    setQuickLoading(true);
    setQuickBusy(false);

    try {
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      if (!data.user) {
        setQuickSheetOpen(false);
        router.push("/login");
        return;
      }

      setQuickUserId(data.user.id);
      const [templateList, folderList] = await Promise.all([
        getTemplates(supabase),
        getFolders(supabase),
      ]);
      setTemplates(
        templateList.filter((template) => template.template_kind !== "weekly_review"),
      );
      setFolders(folderList);
    } catch (error) {
      console.error(error);
      setQuickError("새 메모 정보를 불러오지 못했습니다.");
    } finally {
      setQuickLoading(false);
    }
  }

  async function createBlankNote(folder: Folder) {
    if (!supabase || !quickUserId) return;
    setQuickBusy(true);
    try {
      const note = await createDraftNote(supabase, quickUserId, folder.id);
      router.push(`/notes/${note.id}`);
    } catch (error) {
      alert(error instanceof Error ? error.message : "메모를 만들지 못했습니다.");
      setQuickBusy(false);
    }
  }

  async function createTemplateNote(template: Template, folder: Folder) {
    if (!supabase || !quickUserId) return;
    setQuickBusy(true);
    try {
      const note = await createNoteFromTemplateInFolder(
        supabase,
        quickUserId,
        template.id,
        folder.id,
      );
      router.push(`/notes/${note.id}`);
    } catch (error) {
      alert(error instanceof Error ? error.message : "템플릿 메모를 만들지 못했습니다.");
      setQuickBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-bokgi-bg text-bokgi-ink">
      {!isEditorRoute ? (
        <header className="sticky top-0 z-20 border-b border-bokgi-border bg-bokgi-bg/95 backdrop-blur">
          <div className="relative mx-auto flex max-w-2xl items-center gap-2 px-3 py-3">
            <Link
              href="/dashboard"
              className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-[14px] bg-bokgi-surface shadow-[0_1px_2px_rgba(0,0,0,0.08)]"
              aria-label="홈"
            >
              <Image
                src="/apple-touch-icon.png"
                alt=""
                width={32}
                height={32}
                className="rounded-[10px]"
              />
            </Link>

            <nav
              aria-label="주요 이동"
              className="flex min-w-0 flex-1 items-center gap-2"
            >
              <TopNavLink href="/dashboard" label="홈" active={homeActive} emphasis>
                <Home size={15} />
              </TopNavLink>
              <TopNavLink href="/folders" label="폴더" active={foldersActive}>
                <FolderIcon size={15} />
              </TopNavLink>
              <button
                type="button"
                onClick={openQuickNoteSheet}
                className="flex h-10 min-w-[76px] flex-1 items-center justify-center gap-1.5 rounded-[17px] border border-bokgi-border bg-bokgi-surface px-3 text-sm font-semibold text-bokgi-ink-soft shadow-[0_1px_2px_rgba(0,0,0,0.06)] transition hover:bg-bokgi-surface-hover hover:text-bokgi-ink"
                aria-label="새 메모"
              >
                <SquarePen size={16} />
                메모
              </button>
            </nav>

            <button
              type="button"
              onClick={() => setAccountMenuOpen((value) => !value)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-bokgi-surface text-bokgi-ink-soft shadow-[0_1px_2px_rgba(0,0,0,0.08)] hover:text-bokgi-ink"
              aria-label="개인 메뉴"
              aria-expanded={accountMenuOpen}
            >
              <UserCircle size={22} />
            </button>

            {accountMenuOpen ? (
              <nav className="absolute right-3 top-[54px] z-30 w-32 overflow-hidden rounded-[18px] border border-bokgi-border bg-bokgi-surface p-1 text-sm shadow-[0_18px_40px_rgba(0,0,0,0.16)]">
                <MenuLink href="/settings" label="설정" onClick={() => setAccountMenuOpen(false)}>
                  <Settings size={16} />
                </MenuLink>
                <MenuLink href="/trash" label="휴지통" onClick={() => setAccountMenuOpen(false)}>
                  <Trash2 size={16} />
                </MenuLink>
              </nav>
            ) : null}
          </div>
        </header>
      ) : null}

      <div className={`mx-auto max-w-2xl px-4 ${isEditorRoute ? "py-3" : "py-5"}`}>
        {children}
      </div>

      {quickSheetOpen ? (
        <TemplatePickerSheet
          templates={templates}
          folders={folders}
          defaultFolderId={quickNoteDefaultFolderId}
          loading={quickLoading}
          error={quickError}
          busy={quickBusy}
          onClose={() => setQuickSheetOpen(false)}
          onBlankNote={createBlankNote}
          onTemplate={createTemplateNote}
        />
      ) : null}
    </div>
  );
}

function TopNavLink({
  href,
  label,
  active,
  emphasis,
  children,
}: {
  href: string;
  label: string;
  active: boolean;
  emphasis?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`flex h-10 min-w-0 items-center justify-center gap-1.5 rounded-[17px] border border-bokgi-border px-3 text-sm font-semibold shadow-[0_1px_2px_rgba(0,0,0,0.06)] transition ${
        emphasis ? "flex-[1.35]" : "flex-1"
      } ${
        active
          ? "bg-bokgi-surface-hover text-bokgi-ink"
          : "bg-bokgi-surface text-bokgi-ink-soft hover:bg-bokgi-surface-hover hover:text-bokgi-ink"
      }`}
    >
      {children}
      <span className="truncate">{label}</span>
    </Link>
  );
}

function MenuLink({
  href,
  label,
  children,
  onClick,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="flex items-center gap-2 rounded-[13px] px-3 py-2.5 text-bokgi-ink-soft hover:bg-bokgi-surface-hover hover:text-bokgi-ink"
    >
      {children}
      <span>{label}</span>
    </Link>
  );
}
