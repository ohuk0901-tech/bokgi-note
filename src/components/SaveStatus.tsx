import { AlertCircle, CheckCircle2, LoaderCircle } from "lucide-react";

export type SaveState = "idle" | "saving" | "saved" | "error";

export function SaveStatus({ state }: { state: SaveState }) {
  if (state === "idle") return null;

  const content = {
    saving: {
      icon: <LoaderCircle className="animate-spin" size={15} />,
      label: "저장 중",
    },
    saved: {
      icon: <CheckCircle2 size={15} />,
      label: "저장됨",
    },
    error: {
      icon: <AlertCircle size={15} />,
      label: "저장 실패",
    },
  }[state];

  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-bokgi-muted">
      {content.icon}
      {content.label}
    </span>
  );
}
