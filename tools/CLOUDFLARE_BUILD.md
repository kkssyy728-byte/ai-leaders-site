# Cloudflare Pages build

편집 원본과 공개 배포 결과물을 분리한다.

## 편집 원본

- 페이지: `src/pages/`
- 공통 JavaScript·CSS: `src/assets/`
- 이미지·영상·공개 정적 파일: `src/static/`

페이지 원본은 회사 소개, 강연, 신청 폼, 관리자처럼 업무 카테고리별로 묶는다. 주소별 `index.html` 폴더를 저장소에서 직접 관리하지 않는다.

## 배포 결과물

```powershell
node tools/build-cloudflare-pages.mjs
```

빌드가 `dist/`를 새로 만들고 `src/pages/courses/free.html` 같은 원본을 `dist/course-free/index.html`로 변환한다. 따라서 주소창에는 `/course-free/`가 표시되고 `.html`은 노출되지 않는다.

`dist/`는 생성물이며 Git에 커밋하지 않는다. Cloudflare Pages의 빌드 출력 디렉터리로만 사용한다.

빌드 후 `node tools/verify-dist-links.mjs`가 생성된 모든 HTML의 내부 페이지·스크립트·이미지 경로를 검사한다.

새 페이지를 추가할 때는 `tools/build-cloudflare-pages.mjs`의 `pageRoutes`에 기존 또는 신규 공개 URL을 선언한다. 선언하지 않은 HTML 원본이나 중복 URL이 있으면 빌드가 실패한다.
