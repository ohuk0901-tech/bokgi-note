import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "개인정보 안내",
};

const contact = process.env.NEXT_PUBLIC_CONTACT_EMAIL || "ohuk0901@gmail.com";

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-bokgi-bg px-5 py-10 text-bokgi-ink">
      <article className="mx-auto max-w-2xl">
        <Link href="/login" className="text-sm text-bokgi-ink-soft underline">
          로그인으로 돌아가기
        </Link>
        <h1 className="mt-6 text-3xl font-semibold">개인정보 안내</h1>
        <p className="mt-3 text-sm leading-6 text-bokgi-ink-soft">
          복기노트는 베타 테스트 중인 투자 복기 메모앱입니다. 아래 내용은
          베타 사용자에게 어떤 정보가 저장되는지 쉽게 알리기 위한 안내입니다.
        </p>

        <section className="mt-8 space-y-6 text-sm leading-7">
          <InfoBlock title="수집하는 정보">
            이메일 주소, 로그인 제공자 정보, 폴더/메모/복기/템플릿 내용,
            생성·수정·삭제 시각, 서비스 접속 및 사용 과정에서 생기는 기본 로그가
            저장될 수 있습니다.
          </InfoBlock>
          <InfoBlock title="이용 목적">
            회원 식별, 로그인 유지, 메모 저장과 동기화, 복기 기능 제공, 오류 확인,
            베타 서비스 개선을 위해 사용합니다.
          </InfoBlock>
          <InfoBlock title="보관과 삭제">
            사용자가 계정 삭제를 요청하면 앱 데이터는 삭제 예정 상태가 되며,
            정책상 30일 후 완전 삭제 대상이 됩니다. 베타 운영 상황에 따라 운영자가
            수동으로 정리할 수 있습니다.
          </InfoBlock>
          <InfoBlock title="외부 서비스">
            인증과 데이터 저장에는 Supabase, 웹앱 배포와 기본 방문 분석에는
            Vercel이 사용됩니다.
          </InfoBlock>
          <InfoBlock title="사용자가 주의할 점">
            계좌번호, 주민등록번호, 인증번호, 거래소 API 키처럼 노출되면 위험한
            정보는 메모에 입력하지 마세요.
          </InfoBlock>
          <InfoBlock title="문의">
            개인정보나 삭제 요청 관련 문의는 {contact}로 연락해주세요.
          </InfoBlock>
        </section>
      </article>
    </main>
  );
}

function InfoBlock({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded border border-bokgi-border bg-bokgi-surface p-4">
      <h2 className="font-semibold">{title}</h2>
      <p className="mt-2 text-bokgi-ink-soft">{children}</p>
    </section>
  );
}
