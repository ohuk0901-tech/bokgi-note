import Link from "next/link";
import { redirect } from "next/navigation";
import { AppChrome } from "@/components/AppChrome";
import {
  createSupabaseServerClient,
  hasSupabaseServerEnv,
} from "@/lib/supabase/server";

export default async function Page() {
  if (!hasSupabaseServerEnv()) {
    redirect("/login");
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    redirect("/login");
  }

  return (
    <AppChrome>
      <h1 className="text-2xl font-semibold">문서</h1>
      <p className="mt-2 text-sm leading-6 text-bokgi-ink-soft">
        Codex가 참고할 기획 문서는 프로젝트의 docs 폴더에 저장되어 있습니다.
      </p>
      <Link
        href="/folders"
        className="mt-5 inline-flex h-10 items-center rounded bg-bokgi-primary px-4 text-sm font-medium text-bokgi-primary-on"
      >
        앱으로 돌아가기
      </Link>
    </AppChrome>
  );
}
