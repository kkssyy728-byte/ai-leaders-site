-- form_options(드롭다운 옵션) 테이블에 삭제 RLS 정책이 빠져 있어서
-- 관리자 페이지에서 옵션 삭제가 항상 무시되던 문제 수정.
-- Run this in the Supabase project's SQL Editor.

grant delete on table public.form_options to anon, authenticated;

drop policy if exists form_options_delete_public on public.form_options;

create policy form_options_delete_public
on public.form_options
for delete
to anon, authenticated
using (true);

-- 테스트 중 남은 임시 행 정리
delete from public.form_options where id = 'qa-delete-test-row';

select 'form_options_delete_fix_ok' as status;
