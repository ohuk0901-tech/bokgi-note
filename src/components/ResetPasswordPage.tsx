"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { KeyRound } from "lucide-react";
import { SetupNotice } from "@/components/SetupNotice";
import { createSupabaseBrowserClient, hasSupabaseEnv } from "@/lib/supabase/browser";

export function ResetPasswordPage() {
  const router = useRouter();
  const configured = hasSupabaseEnv();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!configured) return;
    const supabase = createSupabaseBrowserClient();

    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (error || !data.session) {
          setMessage("비밀번호 재설정 메일의 링크로 다시 들어와주세요.");
          return;
        }
        setReady(true);
      })
      .catch(() => {
        setMessage("비밀번호 재설정 상태를 확인하지 못했습니다.");
      });
  }, [configured]);

  if (!configured) return <SetupNotice />;

  const supabase = createSupabaseBrowserClient();

  async function updatePassword(event: React.FormEvent) {
    event.preventDefault();
    setMessage("");

    if (password.length < 6) {
      setMessage("비밀번호는 6자 이상으로 입력해주세요.");
      return;
    }

    if (password !== confirmPassword) {
      setMessage("새 비밀번호가 서로 다릅니다.");
      return;
    }

    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    await supabase.auth.signOut();
    setMessage("비밀번호를 변경했습니다. 새 비밀번호로 다시 로그인해주세요.");
    window.setTimeout(() => router.replace("/login"), 1200);
  }

  return (
    <main className="min-h-screen bg-bokgi-bg px-5 py-10 text-bokgi-ink">
      <section className="mx-auto max-w-sm pt-10">
        <p className="text-sm font-medium text-bokgi-accent">복기노트</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-normal">
          비밀번호 재설정
        </h1>
        <p className="mt-3 text-sm leading-6 text-bokgi-ink-soft">
          새 비밀번호를 입력하면 기존 비밀번호가 교체됩니다.
        </p>

        <form onSubmit={updatePassword} className="mt-8 space-y-3">
          <input
            className="h-12 w-full rounded border border-bokgi-border bg-bokgi-surface px-4 outline-none focus:border-bokgi-accent"
            type="password"
            placeholder="새 비밀번호"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            minLength={6}
            disabled={!ready || busy}
          />
          <input
            className="h-12 w-full rounded border border-bokgi-border bg-bokgi-surface px-4 outline-none focus:border-bokgi-accent"
            type="password"
            placeholder="새 비밀번호 확인"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            required
            minLength={6}
            disabled={!ready || busy}
          />
          <button
            className="flex h-12 w-full items-center justify-center gap-2 rounded bg-bokgi-primary px-4 text-sm font-medium text-bokgi-primary-on disabled:opacity-50"
            disabled={!ready || busy}
          >
            <KeyRound size={18} />
            비밀번호 변경
          </button>
        </form>

        {message ? (
          <p className="mt-5 rounded border border-bokgi-border bg-bokgi-surface p-3 text-sm text-bokgi-ink-soft">
            {message}
          </p>
        ) : null}

        <Link href="/login" className="mt-5 inline-block text-sm text-bokgi-ink-soft underline">
          로그인 화면으로 돌아가기
        </Link>
      </section>
    </main>
  );
}
