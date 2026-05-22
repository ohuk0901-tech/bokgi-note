"use client";

import { LogOut, Smartphone, UserX } from "lucide-react";
import { useRouter } from "next/navigation";
import { AppChrome } from "@/components/AppChrome";
import { LoadingState } from "@/components/LoadingState";
import { SetupNotice } from "@/components/SetupNotice";
import { useRequireAuth } from "@/components/useRequireAuth";
import { requestAccountDeletion } from "@/lib/data";

export function SettingsPage() {
  const router = useRouter();
  const { supabase, configured, user, loading } = useRequireAuth();

  if (!configured) return <SetupNotice />;
  if (loading || !supabase || !user) return <LoadingState />;

  const client = supabase;
  const currentUser = user;

  async function logout() {
    await client.auth.signOut();
    router.replace("/login");
  }

  async function deleteAccount() {
    const ok = window.confirm(
      "계정을 삭제하면 모든 데이터가 휴지통 처리되고 30일 후 완전 삭제됩니다. 계속할까요?",
    );
    if (!ok) return;
    await requestAccountDeletion(client, currentUser.id);
    router.replace("/login");
  }

  return (
    <AppChrome>
      <h1 className="text-2xl font-semibold">설정</h1>
      <div className="mt-5 divide-y divide-[#e1e3de] overflow-hidden rounded border border-[#d9dcd6] bg-white">
        <section className="px-4 py-4">
          <p className="text-sm text-[#72786f]">로그인 계정</p>
          <p className="mt-1 font-medium">{user.email}</p>
        </section>
        <section className="px-4 py-4">
          <div className="flex items-start gap-3">
            <Smartphone className="mt-1 text-[#2f6b4f]" size={20} />
            <div>
              <p className="font-medium">홈 화면에 추가</p>
              <p className="mt-1 text-sm leading-6 text-[#63685f]">
                앱처럼 빠르게 열 수 있습니다. iPhone은 Safari 공유 버튼,
                Android는 Chrome 메뉴에서 추가하세요.
              </p>
            </div>
          </div>
        </section>
        <button
          onClick={logout}
          className="flex w-full items-center gap-3 px-4 py-4 text-left hover:bg-[#f2f5f1]"
        >
          <LogOut size={19} />
          로그아웃
        </button>
        <button
          onClick={deleteAccount}
          className="flex w-full items-center gap-3 px-4 py-4 text-left text-red-700 hover:bg-red-50"
        >
          <UserX size={19} />
          계정 삭제
        </button>
      </div>
    </AppChrome>
  );
}
