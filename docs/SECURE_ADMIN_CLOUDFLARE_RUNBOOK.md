# 보안 관리자·Cloudflare Pages 전환 운영서

## 현재 상태

- 작업 브랜치: `feat/cloudflare-secure-admin`
- `main`, 현재 GitHub Pages, `newaileaders.co.kr`, 운영 Supabase는 변경하지 않았다.
- Cloudflare Pages 프로젝트, 커스텀 도메인, R2는 아직 만들거나 연결하지 않았다.
- 이 저장소의 대상 Supabase 프로젝트가 현재 연결된 관리 도구 계정에 보이지 않아 SQL은 파일로만 준비했다.
- 운영 적용 전 반드시 별도 Supabase 개발 브랜치 또는 별도 개발 프로젝트에서 검증한다.

## 최종 구성

| 영역 | 담당 서비스 | 운영 원칙 |
| --- | --- | --- |
| 코드·리뷰 | GitHub | 직원은 역할별 브랜치에서 수정하고 PR 승인을 거쳐 `main`에 반영 |
| 정적 사이트 배포 | Cloudflare Pages | PR·기능 브랜치는 미리보기, `main`만 운영 배포 |
| 콘텐츠·신청 데이터 | Supabase Database | 브라우저 공개 키를 사용하되 RLS가 모든 권한을 강제 |
| 직원 로그인 | Supabase Auth | 개인별 계정 사용, 공유 비밀번호 금지 |
| 공개 이미지·영상 | Supabase `site-assets` | 공개 읽기, 로그인한 콘텐츠 담당자만 변경 |
| 강사 지원 파일 | Supabase `instructor-portfolio` | 비공개 버킷, 담당 직원만 5분짜리 서명 URL로 열람 |
| 대용량 오브젝트 | Cloudflare R2 | 현재는 연결하지 않음 |

R2는 개별 파일이 Cloudflare Pages의 25 MiB 제한을 넘거나, 공개 영상 트래픽·보관 비용·수명주기 관리가 실제 문제가 될 때 별도 검토한다. 현재 저장소 파일은 이 기준 안에 있으므로 저장소를 하나 더 늘리지 않는다.

## 사용한 오픈소스 기준

- 직원 인증·세션·서명 URL: 공식 MIT 라이선스 `supabase/supabase-js` 2.110.7
- 관리자 드래그 정렬: 저장소에 이미 포함된 MIT 라이선스 SortableJS 1.15.6
- 정적 라우트 빌드·검증: 오픈소스 Node.js 기본 기능

현재 사이트가 순수 HTML·CSS·JavaScript 구조이므로 별도 프레임워크를 추가하지 않았다. 브라우저 테스트 자동화는 Supabase 개발 환경과 Cloudflare 미리보기 URL이 준비된 후 Playwright를 추가하는 편이 검증 가치가 높다.

## 직원 역할

| 화면·작업 | 총괄 관리자 | 디자인팀 | 광고·마케팅팀 | 기술팀 |
| --- | :---: | :---: | :---: | :---: |
| 대시보드 | O | O | O | O |
| 강연 등록·수정 | O | - | O | O |
| 배너·강사진 | O | O | O | O |
| 폼 선택지 | O | - | O | O |
| 강연 신청·출강 문의·강사 지원 열람 | O | - | O | O |
| 강사 지원 비공개 파일 | O | - | O | O |
| 자동 변경 기록 | O | O | O | O |
| 직원 권한 등록·변경 | O | - | - | 기술 지원 |

디자인팀에는 개인정보 신청 목록을 노출하지 않는다. 화면에서 메뉴를 숨기는 것과 별개로 Supabase RLS가 데이터 접근도 차단한다.

## GitHub 운영 규칙

직원용 한 장 절차는 저장소 루트의 `CONTRIBUTING.md`, PR 확인 항목은 `.github/PULL_REQUEST_TEMPLATE.md`에 둔다. 회사 승인 후 GitHub Ruleset에서 아래 항목을 적용한다.

- `main` 직접 푸시와 강제 푸시를 금지하고 PR만 허용
- 최소 1명 승인과 최신 승인 유지 요구
- `Security boundaries / verify` 검사를 필수 상태 검사로 지정
- 대화가 해결되지 않은 PR의 병합 금지
- 브랜치 삭제 금지와 관리자 우회 권한 최소화

CODEOWNERS는 실제 GitHub 팀 이름이 확정된 뒤 디자인·마케팅·기술 경로 담당자를 등록한다. 현재 임의 계정이나 팀을 지정하지 않는다.

## 편집 원본과 배포 결과물

- `src/pages/`: 회사 소개·강연·신청 폼·관리자 카테고리별 HTML 원본
- `src/assets/`: 공통 JavaScript·CSS 원본
- `src/static/`: 이미지·영상·공개 설정 파일
- `dist/`: 빌드 때만 생성되는 Cloudflare Pages 배포 결과물

직원과 개발자는 `src`만 수정한다. 주소별 `index.html` 폴더는 Git에 저장하지 않으며 빌드가 `dist` 안에 자동으로 생성한다. 기존 `/course-free/`, `/admin-dashboard/` 등의 공개 URL은 유지된다.

## 적용 파일

- `supabase/20260719_secure_staff_access.sql`: 직원 역할, RLS, Storage, 중복 신청·신청자 수 트리거, 변경 이력
- `src/assets/admin-auth.js`: 관리자 화면 인증·역할 확인·로그아웃
- `src/pages/admin/login.html`: 개인별 직원 로그인
- `src/static/_headers`: Cloudflare Pages 보안·캐시 헤더
- `tools/build-cloudflare-pages.mjs`: 카테고리별 원본을 공개 URL별 `dist`로 만들고 Pages 파일 제한 검사
- `supabase/verify-public-api.mjs`: 익명 공개/비공개 조회 경계 검증

## 1단계: Supabase 개발 환경 검증

1. 운영 프로젝트의 데이터베이스 백업 가능 여부와 복구 절차를 먼저 확인한다.
2. 운영 데이터가 복사되지 않는 Supabase 개발 브랜치 또는 별도 개발 프로젝트를 준비한다.
3. 기존 스키마 마이그레이션을 순서대로 적용한 뒤 `20260719_secure_staff_access.sql`을 적용한다.
4. Supabase Auth에서 테스트 직원을 네 역할로 각각 만든다.
5. 첫 번째 총괄 관리자는 SQL Editor에서 한 번만 등록한다.

```sql
insert into public.staff_members (user_id, display_name, role, is_active)
values ('AUTH_USERS_UUID', '총괄 관리자 이름', 'owner', true);
```

첫 총괄 관리자가 생기기 전에는 브라우저에서 다른 직원 권한을 만들 수 없다. 사용자 초대·삭제 기능은 `service_role`이 필요한 서버 기능이므로 정적 브라우저 코드에 넣지 않는다.

6. 환경 변수를 개발 프로젝트 값으로 설정하고 익명 공개 경계를 확인한다.

```powershell
$env:SUPABASE_URL='https://YOUR_DEV_PROJECT.supabase.co'
$env:SUPABASE_PUBLISHABLE_KEY='YOUR_DEV_PUBLISHABLE_KEY'
node supabase/verify-public-api.mjs
```

7. 아래 항목을 네 역할 계정으로 직접 확인한다.

- 로그인하지 않으면 모든 `/admin-*` 화면이 로그인으로 이동한다.
- 디자인팀은 신청자 개인정보 메뉴와 데이터를 볼 수 없다.
- 마케팅팀은 강연·신청·문의는 관리하지만 직원 권한은 바꿀 수 없다.
- 공개 사이트는 강연·배너·강사진을 정상 조회한다.
- 공개 신청자는 신청 데이터를 다시 읽을 수 없다.
- 포트폴리오의 영구 공개 URL이 없어지고 로그인한 담당자만 5분 링크로 연다.
- 중복 강연 신청은 저장되지만 신청자 수가 중복 증가하지 않는다.
- 저장·수정·삭제 기록이 업데이트 로그에 남는다.

## 2단계: Cloudflare Pages 미리보기

회사 승인 후 별도 확인을 받고 Cloudflare에서 프로젝트를 만든다.

권장 설정:

- Git 저장소: `lavia0711/ai-leaders-site`
- Framework preset: 없음
- Node.js: 저장소 `.node-version`의 `22.16.0`
- Production branch: `main`
- Build command: `node tools/build-cloudflare-pages.mjs`
- Build output directory: `dist`
- Preview branch 포함: `feat/*`, `fix/*`, `design/*`, `marketing/*`, `tech/*`
- 커스텀 도메인: 아직 연결하지 않음
- Preview Access policy: 활성화하여 회사 계정만 접근

Cloudflare Pages 미리보기는 기본적으로 공개 URL이므로 Access 정책을 먼저 켠다. 미리보기에는 Cloudflare가 `X-Robots-Tag: noindex`를 기본 적용하지만, 접근 제어를 검색 차단 대용으로 사용하지 않는다.

## 3단계: 회사 최종 승인 후 운영 전환

Supabase 보안 정책과 새 프런트엔드는 서로 의존하므로 유지보수 시간에 연속 적용한다.

1. 운영 데이터베이스 백업과 롤백 SQL을 준비한다.
2. 새 Cloudflare Pages 운영 배포를 만들되 아직 도메인은 연결하지 않는다.
3. 운영 Supabase Auth에 직원 계정을 만들고 첫 총괄 관리자 UUID를 준비한다.
4. 짧은 신청 접수 유지보수 시간을 공지한다.
5. 운영 Supabase에 보안 마이그레이션을 적용하고 첫 총괄 관리자를 등록한다.
6. Pages의 `pages.dev` 운영 URL에서 공개 페이지·신청·직원 로그인을 즉시 점검한다.
7. 이상이 없을 때만 `newaileaders.co.kr`을 Cloudflare Pages에 연결한다.
8. DNS·SSL·Google Ads 이벤트를 확인한 뒤 기존 GitHub Pages를 대기 상태로 유지한다.
9. 안정화 기간 후 GitHub Pages 배포를 정리한다.

회사 승인 전에는 PR 생성·`main` 머지·운영 SQL 적용·도메인 변경을 하지 않는다.

## 남은 보안 항목

- 공개 신청 폼의 자동화 스팸·대량 파일 업로드를 막으려면 운영 전 Cloudflare Turnstile과 서버 검증 함수가 필요하다.
- 총괄 관리자·기술팀 계정에는 Supabase MFA(AAL2)를 단계적으로 적용한다.
- 직원 퇴사·부서 이동 시 Auth 계정과 `staff_members.is_active`를 같은 날 중지한다.
- 분기마다 Supabase Security Advisor, RLS 정책, Storage 공개 여부, 변경 로그 보관 기간을 점검한다.

Turnstile·MFA·직원 초대 서버 기능은 외부 서비스 설정과 회사 정책 결정이 필요하므로 이번 승인 전 브랜치에서는 활성화하지 않는다.
