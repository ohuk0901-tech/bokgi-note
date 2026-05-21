"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Archive, FolderPlus, Pencil, Trash2 } from "lucide-react";
import { AppChrome } from "@/components/AppChrome";
import { LoadingState } from "@/components/LoadingState";
import { SetupNotice } from "@/components/SetupNotice";
import { useRequireAuth } from "@/components/useRequireAuth";
import { createFolder, getFolders, trashFolder, updateFolder } from "@/lib/data";
import type { Folder } from "@/lib/types";

export function FoldersPage() {
  const { supabase, configured, user, loading } = useRequireAuth();
  const [folders, setFolders] = useState<Folder[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!supabase || !user) return;
    getFolders(supabase).then(setFolders).catch(console.error);
  }, [supabase, user]);

  if (!configured) return <SetupNotice />;
  if (loading || !supabase || !user) return <LoadingState />;

  const client = supabase;
  const currentUser = user;

  async function refresh() {
    setFolders(await getFolders(client));
  }

  async function handleCreate() {
    const name = window.prompt("새 폴더 이름", "새 폴더");
    if (!name?.trim()) return;
    setBusy(true);
    await createFolder(client, currentUser.id, name.trim());
    await refresh();
    setBusy(false);
  }

  async function handleRename(folder: Folder) {
    const name = window.prompt("폴더 이름", folder.name);
    if (!name?.trim() || name === folder.name) return;
    await updateFolder(client, folder.id, name.trim());
    await refresh();
  }

  async function handleTrash(folder: Folder) {
    if (!window.confirm(`'${folder.name}' 폴더와 안의 항목을 휴지통으로 이동할까요?`)) {
      return;
    }
    await trashFolder(client, folder.id);
    await refresh();
  }

  return (
    <AppChrome>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">폴더</h1>
          <p className="mt-1 text-sm text-[#63685f]">메모와 복기 세션을 모아둡니다.</p>
        </div>
        <button
          onClick={handleCreate}
          disabled={busy}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-[#1f1f1f] text-white disabled:opacity-50"
          title="새 폴더"
          aria-label="새 폴더"
        >
          <FolderPlus size={20} />
        </button>
      </div>

      <div className="divide-y divide-[#e1e3de] overflow-hidden rounded border border-[#d9dcd6] bg-white">
        {folders.map((folder) => (
          <div key={folder.id} className="flex items-center gap-3 px-4 py-4">
            <Link href={`/folders/${folder.id}`} className="min-w-0 flex-1">
              <p className="truncate font-medium">{folder.name}</p>
              <p className="mt-1 text-xs text-[#72786f]">
                최근 수정 {new Date(folder.updated_at).toLocaleDateString("ko-KR")}
              </p>
            </Link>
            <button
              onClick={() => handleRename(folder)}
              className="flex h-9 w-9 items-center justify-center rounded-full text-[#63685f] hover:bg-[#eef1ec]"
              title="이름 수정"
              aria-label="이름 수정"
            >
              <Pencil size={17} />
            </button>
            <button
              onClick={() => handleTrash(folder)}
              className="flex h-9 w-9 items-center justify-center rounded-full text-[#63685f] hover:bg-[#eef1ec]"
              title="휴지통"
              aria-label="휴지통"
            >
              <Trash2 size={17} />
            </button>
          </div>
        ))}
        {!folders.length ? (
          <div className="px-4 py-10 text-center text-sm text-[#72786f]">
            <Archive className="mx-auto mb-3" size={24} />
            아직 폴더가 없습니다.
          </div>
        ) : null}
      </div>
    </AppChrome>
  );
}
