"use client";

import { RotateCcw, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { AppChrome } from "@/components/AppChrome";
import { LoadingState } from "@/components/LoadingState";
import { SetupNotice } from "@/components/SetupNotice";
import { useRequireAuth } from "@/components/useRequireAuth";
import { deleteForever, getTrash, restoreItem } from "@/lib/data";
import { formatKoreanDate } from "@/lib/date";
import type { Folder, Note, ReviewSession } from "@/lib/types";

export function TrashPage() {
  const { supabase, configured, user, loading } = useRequireAuth();
  const [folders, setFolders] = useState<Folder[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [reviews, setReviews] = useState<ReviewSession[]>([]);

  useEffect(() => {
    if (!supabase || !user) return;
    const client = supabase;
    getTrash(client)
      .then((data) => {
        setFolders(data.folders);
        setNotes(data.notes);
        setReviews(data.reviews);
      })
      .catch(console.error);
  }, [supabase, user]);

  if (!configured) return <SetupNotice />;
  if (loading || !supabase || !user) return <LoadingState />;

  const client = supabase;

  async function refresh() {
    const data = await getTrash(client);
    setFolders(data.folders);
    setNotes(data.notes);
    setReviews(data.reviews);
  }

  async function handleRestore(type: "folder" | "note" | "review_session", id: string) {
    await restoreItem(client, type, id);
    await refresh();
  }

  async function handleDelete(type: "folder" | "note" | "review_session", id: string) {
    if (!window.confirm("완전히 삭제하면 되돌릴 수 없습니다. 삭제할까요?")) return;
    await deleteForever(client, type, id);
    await refresh();
  }

  return (
    <AppChrome>
      <h1 className="text-2xl font-semibold">휴지통</h1>
      <p className="mt-1 text-sm text-bokgi-ink-soft">30일 후 완전 삭제 대상입니다.</p>

      <div className="mt-5 divide-y divide-bokgi-border-soft overflow-hidden rounded border border-bokgi-border bg-bokgi-surface">
        {folders.map((folder) => (
          <TrashRow
            key={`folder:${folder.id}`}
            title={folder.name}
            typeLabel="폴더"
            deleteAfter={folder.delete_after}
            onRestore={() => handleRestore("folder", folder.id)}
            onDelete={() => handleDelete("folder", folder.id)}
          />
        ))}
        {notes.map((note) => (
          <TrashRow
            key={`note:${note.id}`}
            title={note.title}
            typeLabel="메모"
            deleteAfter={note.delete_after}
            onRestore={() => handleRestore("note", note.id)}
            onDelete={() => handleDelete("note", note.id)}
          />
        ))}
        {reviews.map((review) => (
          <TrashRow
            key={`review:${review.id}`}
            title={review.title}
            typeLabel="복기"
            deleteAfter={review.delete_after}
            onRestore={() => handleRestore("review_session", review.id)}
            onDelete={() => handleDelete("review_session", review.id)}
          />
        ))}
        {!folders.length && !notes.length && !reviews.length ? (
          <div className="px-4 py-10 text-center text-sm text-bokgi-muted">
            휴지통이 비어 있습니다.
          </div>
        ) : null}
      </div>
    </AppChrome>
  );
}

function TrashRow({
  title,
  typeLabel,
  deleteAfter,
  onRestore,
  onDelete,
}: {
  title: string;
  typeLabel: string;
  deleteAfter: string | null;
  onRestore: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-4">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate font-medium">{title}</p>
          <span className="rounded bg-bokgi-surface-muted px-2 py-0.5 text-xs text-bokgi-ink-soft">
            {typeLabel}
          </span>
        </div>
        <p className="mt-1 text-xs text-bokgi-muted">
          완전 삭제 예정일 {formatKoreanDate(deleteAfter)}
        </p>
      </div>
      <button
        onClick={onRestore}
        className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-bokgi-surface-hover"
        title="복원"
        aria-label="복원"
      >
        <RotateCcw size={17} />
      </button>
      <button
        onClick={onDelete}
        className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-bokgi-surface-hover"
        title="완전 삭제"
        aria-label="완전 삭제"
      >
        <Trash2 size={17} />
      </button>
    </div>
  );
}
