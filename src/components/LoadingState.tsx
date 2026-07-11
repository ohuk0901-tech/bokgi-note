export function LoadingState({ label = "불러오는 중" }: { label?: string }) {
  return <p className="py-8 text-center text-sm text-bokgi-muted">{label}...</p>;
}
