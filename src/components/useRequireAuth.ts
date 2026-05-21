"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createSupabaseBrowserClient, hasSupabaseEnv } from "@/lib/supabase/browser";
import { ensureUserReady } from "@/lib/data";

async function withTimeout<T>(promise: Promise<T>, message: string) {
  return Promise.race([
    promise,
    new Promise<never>((_resolve, reject) => {
      window.setTimeout(() => reject(new Error(message)), 8_000);
    }),
  ]);
}

export function useRequireAuth() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const configured = hasSupabaseEnv();
  const supabase = useMemo(
    () => (configured ? createSupabaseBrowserClient() : null),
    [configured],
  );

  useEffect(() => {
    if (!supabase) return;
    const client = supabase;

    let active = true;

    async function checkUser() {
      try {
        const sessionResult = await withTimeout(
          client.auth.getSession(),
          "로그인 세션 확인 시간이 초과되었습니다.",
        );

        if (!active) return;
        if (sessionResult.error) throw sessionResult.error;
        if (!sessionResult.data.session) {
          setUser(null);
          router.replace("/login");
          return;
        }

        const userResult = await withTimeout(
          client.auth.getUser(),
          "로그인 사용자 확인 시간이 초과되었습니다.",
        );

        if (!active) return;
        if (userResult.error) throw userResult.error;
        if (!userResult.data.user) {
          setUser(null);
          router.replace("/login");
          return;
        }

        await ensureUserReady(client, userResult.data.user);
        if (!active) return;
        setUser(userResult.data.user);
        setError(null);
      } catch (error) {
        console.error(error);
        if (!active) return;
        setError("로그인 상태를 확인하지 못했습니다. 다시 로그인해주세요.");
        await client.auth.signOut().catch(console.error);
        router.replace("/login");
      } finally {
        if (active) setLoading(false);
      }
    }

    void checkUser();

    const { data: listener } = client.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        setUser(null);
        setLoading(false);
        router.replace("/login");
      }
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [router, supabase]);

  return {
    supabase,
    configured,
    user,
    loading: configured ? loading : false,
    error,
  };
}
