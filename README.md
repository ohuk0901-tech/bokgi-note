# 복기노트 MVP

메모를 쓰고, 여러 메모를 한 화면에서 읽으며 복기 세션을 작성하는 웹/PWA MVP입니다.

## 현재 구현 범위

- 이메일/비밀번호 로그인, Google 로그인 연결 준비
- 첫 로그인 시 기본 폴더 생성
- 1단 폴더
- 일반 메모 작성/수정, 자동 저장
- 폴더 안 일반 메모 + 복기 세션 통합 목록
- 제목/본문 검색
- 일반 메모와 과거 복기 세션을 최대 6개 선택해 새 복기 생성
- 복기 원본 읽기 전용 표시
- 복기 입력창 위치 이동
- 복기 중 기존 메모 최대 3개 불러오기/수정
- 휴지통, 30일 후 완전 삭제용 서버 함수
- 계정 삭제 요청
- PWA manifest와 임시 아이콘

## 중요한 폴더

- `docs/`: 기획/결정/화면/개발 체크리스트 문서
- `src/app/`: Next.js 화면 경로와 API 경로
- `src/components/`: 실제 화면 컴포넌트
- `src/lib/`: Supabase 연결, 데이터 처리, 타입
- `supabase/schema.sql`: Supabase DB 테이블/RLS/함수 생성 SQL

## 로컬 실행 준비

1. Supabase 프로젝트를 만듭니다.
2. Supabase SQL Editor에서 `supabase/schema.sql` 전체를 실행합니다.
3. `.env.example`을 참고해 `.env.local`을 만들고 값을 채웁니다.

```bash
NEXT_PUBLIC_SUPABASE_URL=Supabase Project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=Supabase anon publishable key
SUPABASE_SERVICE_ROLE_KEY=Supabase service role key
ADMIN_JOB_SECRET=아무도 모르는 긴 임의 문자열
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

4. 개발 서버를 실행합니다.

```bash
npm run dev
```

5. 브라우저에서 `http://localhost:3000`을 엽니다.

휴대폰에서 같은 로컬 서버를 보려면 맥과 휴대폰이 같은 Wi-Fi에 있어야 합니다.

```bash
npm run dev -- --hostname 0.0.0.0
```

그다음 휴대폰 브라우저에서 `http://맥의_현재_로컬_IP:3000`을 엽니다.
로컬 IP는 Wi-Fi를 바꾸거나 시간이 지나면 달라질 수 있으므로, 모바일 접속이 안 되면 다시 확인합니다.

```bash
ifconfig | rg 'inet '
```

## Supabase 인증 설정

- Email provider를 켭니다.
- 이메일 인증을 켭니다.
- Google 로그인은 Supabase Authentication > Providers > Google에서 설정합니다.
- 로컬 Redirect URL에는 `http://localhost:3000/auth/callback`을 추가합니다.
- 휴대폰 로컬 테스트를 할 때는 `http://맥의_현재_로컬_IP:3000/auth/callback`도 추가합니다.
- Vercel 배포 후에는 `https://배포주소/auth/callback`도 추가합니다.

## 검증 명령

```bash
npm run lint
npm run build
```

현재 두 명령 모두 통과하도록 맞춰져 있습니다.
