import Link from "next/link";

export function SetupNotice() {
  return (
    <main className="min-h-screen bg-bokgi-bg px-5 py-10 text-bokgi-ink">
      <section className="mx-auto max-w-2xl">
        <p className="mb-3 text-sm font-medium text-bokgi-accent">설정 필요</p>
        <h1 className="text-3xl font-semibold tracking-normal">Supabase 키를 연결해주세요</h1>
        <p className="mt-4 leading-7 text-bokgi-ink-soft">
          앱 코드는 준비됐지만, 로그인과 데이터 저장을 하려면 `.env.local`에
          Supabase 값을 넣어야 합니다. 아직 값이 없어도 빌드는 가능하고, 연결 후
          바로 사용할 수 있습니다.
        </p>
        <div className="mt-8 rounded border border-bokgi-border bg-bokgi-surface p-4 font-mono text-sm">
          <p>NEXT_PUBLIC_SUPABASE_URL=...</p>
          <p>NEXT_PUBLIC_SUPABASE_ANON_KEY=...</p>
          <p>SUPABASE_SERVICE_ROLE_KEY=...</p>
          <p>ADMIN_JOB_SECRET=...</p>
        </div>
        <p className="mt-6 text-sm text-bokgi-ink-soft">
          데이터베이스 구조는 <Link className="underline" href="/docs">docs</Link>와
          `supabase/schema.sql`을 기준으로 만듭니다.
        </p>
      </section>
    </main>
  );
}
