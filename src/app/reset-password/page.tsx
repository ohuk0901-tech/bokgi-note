import type { Metadata } from "next";
import { ResetPasswordPage } from "@/components/ResetPasswordPage";

export const metadata: Metadata = {
  title: "비밀번호 재설정",
};

export default function Page() {
  return <ResetPasswordPage />;
}
