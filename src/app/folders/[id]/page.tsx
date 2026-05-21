import { FolderDetailPage } from "@/components/FolderDetailPage";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <FolderDetailPage folderId={id} />;
}
