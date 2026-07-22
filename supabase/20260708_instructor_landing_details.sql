-- Add editable "landing page feature tags" for instructors, so they no longer need
-- to be hardcoded in assets/site-content-renderer.js and can be managed from
-- admin-site-content.html instead.

alter table public.instructors
  add column if not exists landing_details jsonb not null default '[]'::jsonb;

-- Seed the two existing instructors with the tags that were previously hardcoded,
-- so the landing page keeps showing the same content after this migration runs.
update public.instructors
set landing_details = '[
  "AI 이미지·영상·숏폼 제작 실습",
  "수강생 결과물 중심의 실무형 커리큘럼",
  "기초부터 실전 활용까지 단계별 코칭",
  "현장에서 바로 쓰는 생성형 AI 활용 교육"
]'::jsonb
where id = 'aion' and (landing_details is null or landing_details = '[]'::jsonb);

update public.instructors
set landing_details = '[
  "브랜드 마케팅 컴퍼니 탈론 대표 / 브랜드 디렉터",
  "ChatGPT·생성형 AI 기반 브랜드 메시지 및 콘텐츠 기획 교육",
  "AI 활용 SNS·유튜브 콘텐츠 전략 및 마케팅 문안 실습",
  "국내 주요 기업·브랜드 마케팅 컨설팅 및 브랜드 프로젝트 수행"
]'::jsonb
where id = 'moon' and (landing_details is null or landing_details = '[]'::jsonb);

select 'instructor_landing_details_ok' as status;
