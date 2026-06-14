"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CircleUserRound, Mail } from "lucide-react";
import { createSupabaseBrowserClient, hasSupabaseEnv } from "@/lib/supabase/browser";
import { SetupNotice } from "@/components/SetupNotice";

export function LoginPage() {
  const router = useRouter();
  const configured = hasSupabaseEnv();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

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

  return (
    <main className="min-h-screen bg-[#f7f7f4] px-5 py-10 text-[#1f1f1f]">
      <section className="mx-auto max-w-sm pt-10">
        <p className="text-sm font-medium text-[#2f6b4f]">복기노트</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-normal">
          기록을 모아 복기하세요
        </h1>
        <p className="mt-3 text-sm leading-6 text-[#63685f]">
          이메일 인증 후 사용할 수 있습니다. Google 로그인을 써도 됩니다.
        </p>

        <form onSubmit={handleEmailAuth} className="mt-8 space-y-3">
          <input
            className="h-12 w-full rounded border border-[#d4d8d1] bg-white px-4 outline-none focus:border-[#2f6b4f]"
            type="email"
            placeholder="이메일"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          <input
            className="h-12 w-full rounded border border-[#d4d8d1] bg-white px-4 outline-none focus:border-[#2f6b4f]"
            type="password"
            placeholder="비밀번호"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            minLength={6}
          />
          <button
            className="flex h-12 w-full items-center justify-center gap-2 rounded bg-[#1f1f1f] px-4 text-sm font-medium text-white disabled:opacity-50"
            disabled={busy}
          >
            <Mail size={18} />
            {mode === "login" ? "이메일로 로그인" : "이메일로 가입"}
          </button>
        </form>

        <button
          onClick={handleGoogle}
          disabled={busy}
          className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded border border-[#d4d8d1] bg-white px-4 text-sm font-medium disabled:opacity-50"
        >
          <CircleUserRound size={18} />
          Google로 계속하기
        </button>

        <button
          onClick={() => setMode(mode === "login" ? "signup" : "login")}
          className="mt-5 text-sm text-[#63685f] underline"
        >
          {mode === "login" ? "처음이라면 가입하기" : "이미 계정이 있다면 로그인"}
        </button>

        {message ? (
          <p className="mt-5 rounded border border-[#d4d8d1] bg-white p-3 text-sm text-[#53584f]">
            {message}
          </p>
        ) : null}
      </section>
    </main>
  );
}
