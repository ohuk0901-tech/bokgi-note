import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "이용 안내",
};

const contact = process.env.NEXT_PUBLIC_CONTACT_EMAIL || "ohuk0901@gmail.com";

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-bokgi-bg px-5 py-10 text-bokgi-ink">
      <article className="mx-auto max-w-2xl">
        <Link href="/login" className="text-sm text-bokgi-ink-soft underline">
          로그인으로 돌아가기
        </Link>
        <h1 className="mt-6 text-3xl font-semibold">이용 안내</h1>
        <p className="mt-3 text-sm leading-6 text-bokgi-ink-soft">
          복기노트는 장기투자자가 자신의 판단을 기록하고 시간이 지난 뒤 복기하기
          위한 베타 서비스입니다.
        </p>

        <section className="mt-8 space-y-6 text-sm leading-7">
          <InfoBlock title="베타 서비스">
            현재 서비스는 테스트와 피드백 수집을 목적으로 운영됩니다. 기능, 화면,
            데이터 정책은 개선 과정에서 바뀔 수 있습니다.
          </InfoBlock>
          <InfoBlock title="투자 조언이 아닙니다">
            복기노트는 투자 판단을 기록하는 도구이며, 특정 종목·코인 매수나 매도를
            권유하지 않습니다. 최종 투자 판단과 결과는 사용자 본인에게 있습니다.
          </InfoBlock>
          <InfoBlock title="기록 내용">
            투자 판단, 감정, 원칙을 자유롭게 기록할 수 있습니다. 다만 계좌번호,
            인증번호, API 키, 주민등록번호 등 민감하거나 위험한 정보는 입력하지
            마세요.
          </InfoBlock>
          <InfoBlock title="계정과 삭제">
            사용자는 설정에서 계정 삭제를 요청할 수 있습니다. 삭제 요청 후 앱
            데이터는 삭제 예정 상태가 되며, 정책상 30일 후 완전 삭제 대상이 됩니다.
          </InfoBlock>
          <InfoBlock title="피드백">
            베타 사용 중 불편한 점이나 개선 의견은 {contact}로 알려주세요.
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
