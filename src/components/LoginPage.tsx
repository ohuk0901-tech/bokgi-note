"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CircleUserRound, Mail } from "lucide-react";
import {
  createSupabaseBrowserClient,
  hasSupabaseEnv,
  isGoogleLoginEnabled,
} from "@/lib/supabase/browser";
import { SetupNotice } from "@/components/SetupNotice";

export function LoginPage() {
  const router = useRouter();
  const configured = hasSupabaseEnv();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const googleLoginEnabled = isGoogleLoginEnabled();

  if (!configured) return <SetupNotice />;

  const supabase = createSupabaseBrowserClient();

  async function handleEmailAuth(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");

    const redirectTo = `${window.location.origin}/auth/callback`;
    const result =
      mode === "signup"
        ? await supabase.auth.signUp({
            email,
            password,
            options: { emailRedirectTo: redirectTo },
          })
        : await supabase.auth.signInWithPassword({ email, password });

    setBusy(false);

    if (result.error) {
      setMessage(result.error.message);
      return;
    }

    if (mode === "signup") {
      setMessage("인증 메일을 보냈습니다. 이메일 인증 후 로그인해주세요.");
      return;
    }

    router.replace("/dashboard");
  }

  async function handleGoogle() {
    setBusy(true);
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  }

  async function handlePasswordReset() {
    const targetEmail = email.trim();
    if (!targetEmail) {
      setMessage("비밀번호 재설정 메일을 받을 이메일을 먼저 입력해주세요.");
      return;
    }

    setBusy(true);
    setMessage("");

    const redirectTo = new URL("/auth/callback", window.location.origin);
    redirectTo.searchParams.set("next", "/reset-password");

    const { error } = await supabase.auth.resetPasswordForEmail(targetEmail, {
      redirectTo: redirectTo.toString(),
    });

    setBusy(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("비밀번호 재설정 메일을 보냈습니다. 메일함을 확인해주세요.");
  }

  return (
    <main className="min-h-screen bg-bokgi-bg px-5 py-10 text-bokgi-ink">
      <section className="mx-auto max-w-sm pt-10">
        <p className="text-sm font-medium text-bokgi-accent">복기노트</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-normal">
          기록을 모아 복기하세요
        </h1>
        <p className="mt-3 text-sm leading-6 text-bokgi-ink-soft">
          베타 기간에는 공개 회원가입으로 사용할 수 있습니다. 이메일로 가입하면
          인증 메일을 확인한 뒤 로그인해주세요.
        </p>

        <form onSubmit={handleEmailAuth} className="mt-8 space-y-3">
          <input
            className="h-12 w-full rounded border border-bokgi-border bg-bokgi-surface px-4 outline-none focus:border-bokgi-accent"
            type="email"
            placeholder="이메일"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          <input
            className="h-12 w-full rounded border border-bokgi-border bg-bokgi-surface px-4 outline-none focus:border-bokgi-accent"
            type="password"
            placeholder="비밀번호"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            minLength={6}
          />
          <button
            className="flex h-12 w-full items-center justify-center gap-2 rounded bg-bokgi-primary px-4 text-sm font-medium text-bokgi-primary-on disabled:opacity-50"
            disabled={busy}
          >
            <Mail size={18} />
            {mode === "login" ? "이메일로 로그인" : "이메일로 가입"}
          </button>
        </form>

        {googleLoginEnabled ? (
          <button
            onClick={handleGoogle}
            disabled={busy}
            className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded border border-bokgi-border bg-bokgi-surface px-4 text-sm font-medium disabled:opacity-50"
          >
            <CircleUserRound size={18} />
            Google로 계속하기
          </button>
        ) : null}

        <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2 text-sm text-bokgi-ink-soft">
          <button
            onClick={() => setMode(mode === "login" ? "signup" : "login")}
            className="underline"
          >
            {mode === "login" ? "처음이라면 가입하기" : "이미 계정이 있다면 로그인"}
          </button>
          {mode === "login" ? (
            <button onClick={handlePasswordReset} disabled={busy} className="underline">
              비밀번호 재설정
            </button>
          ) : null}
        </div>

        {message ? (
          <p className="mt-5 rounded border border-bokgi-border bg-bokgi-surface p-3 text-sm text-bokgi-ink-soft">
            {message}
          </p>
        ) : null}

        <p className="mt-8 text-xs leading-5 text-bokgi-muted">
          가입하면{" "}
          <Link href="/terms" className="underline">
            이용 안내
          </Link>
          와{" "}
          <Link href="/privacy" className="underline">
            개인정보 안내
          </Link>
          를 확인한 것으로 봅니다. 투자 판단은 본인 책임이며, 계좌번호나
          주민등록번호 같은 민감정보는 입력하지 마세요.
        </p>
      </section>
    </main>
  );
}
