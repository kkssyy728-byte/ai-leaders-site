-- Secure staff access, public forms, content editing, and private portfolio files.
-- IMPORTANT: review and apply to a Supabase development branch before production.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '2min';

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create table if not exists public.staff_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  role text not null check (role in ('owner', 'design', 'marketing', 'technical')),
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_staff_members_active_role
  on public.staff_members(is_active, role);
create index if not exists idx_staff_members_created_by
  on public.staff_members(created_by);
create index if not exists idx_lecture_applications_course_id
  on public.lecture_applications(course_id);

drop trigger if exists trg_staff_members_set_updated_at on public.staff_members;
create trigger trg_staff_members_set_updated_at
before update on public.staff_members
for each row
execute function public.set_updated_at();

alter table public.staff_members enable row level security;

create or replace function private.has_staff_role(required_roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.staff_members as member
    where member.user_id = (select auth.uid())
      and member.is_active = true
      and member.role = any(required_roles)
  );
$$;

revoke all on function private.has_staff_role(text[]) from public, anon;
grant execute on function private.has_staff_role(text[]) to authenticated;

create table if not exists public.content_audit_log (
  id bigint generated always as identity primary key,
  entity_table text not null,
  entity_id text,
  operation text not null check (operation in ('INSERT', 'UPDATE', 'DELETE')),
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_display_name text,
  actor_role text,
  old_record jsonb,
  new_record jsonb,
  changed_at timestamptz not null default now()
);

alter table public.content_audit_log
  add column if not exists actor_display_name text;

create index if not exists idx_content_audit_log_changed_at
  on public.content_audit_log(changed_at desc);
create index if not exists idx_content_audit_log_actor
  on public.content_audit_log(actor_user_id, changed_at desc);

alter table public.content_audit_log enable row level security;

create or replace function private.write_content_audit_log()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_role text;
  current_display_name text;
  row_id text;
begin
  select member.role, member.display_name
    into current_role, current_display_name
    from public.staff_members as member
   where member.user_id = (select auth.uid())
     and member.is_active = true;

  if current_role is null then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  row_id := coalesce(to_jsonb(new) ->> 'id', to_jsonb(old) ->> 'id', to_jsonb(new) ->> 'user_id', to_jsonb(old) ->> 'user_id');

  insert into public.content_audit_log (
    entity_table,
    entity_id,
    operation,
    actor_user_id,
    actor_display_name,
    actor_role,
    old_record,
    new_record
  ) values (
    tg_table_name,
    row_id,
    tg_op,
    (select auth.uid()),
    current_display_name,
    current_role,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function private.write_content_audit_log() from public, anon, authenticated;

do $$
declare
  policy_record record;
begin
  for policy_record in
    select schemaname, tablename, policyname
      from pg_policies
     where schemaname = 'public'
       and tablename = any(array[
         'courses',
         'lecture_applications',
         'corporate_inquiries',
         'instructor_applications',
         'site_banners',
         'instructors',
         'form_options',
         'staff_members',
         'content_audit_log'
       ])
  loop
    execute format(
      'drop policy if exists %I on %I.%I',
      policy_record.policyname,
      policy_record.schemaname,
      policy_record.tablename
    );
  end loop;
end
$$;

revoke all on table public.staff_members from anon, authenticated;
grant select, insert, update, delete on table public.staff_members to authenticated;

create policy staff_members_select_self
on public.staff_members
for select
to authenticated
using ((select auth.uid()) = user_id and is_active = true);

create policy staff_members_select_owner
on public.staff_members
for select
to authenticated
using ((select private.has_staff_role(array['owner'])));

create policy staff_members_insert_owner
on public.staff_members
for insert
to authenticated
with check ((select private.has_staff_role(array['owner'])));

create policy staff_members_update_owner
on public.staff_members
for update
to authenticated
using ((select private.has_staff_role(array['owner'])))
with check ((select private.has_staff_role(array['owner'])));

create policy staff_members_delete_owner
on public.staff_members
for delete
to authenticated
using ((select private.has_staff_role(array['owner'])));

revoke all on table public.content_audit_log from anon, authenticated;
grant select on table public.content_audit_log to authenticated;

create policy content_audit_log_select_staff
on public.content_audit_log
for select
to authenticated
using ((select private.has_staff_role(array['owner', 'design', 'marketing', 'technical'])));

alter table public.courses enable row level security;
alter table public.lecture_applications enable row level security;
alter table public.corporate_inquiries enable row level security;
alter table public.instructor_applications enable row level security;
alter table public.site_banners enable row level security;
alter table public.instructors enable row level security;
alter table public.form_options enable row level security;

revoke all on table public.courses from anon, authenticated;
revoke all on table public.site_banners from anon, authenticated;
revoke all on table public.instructors from anon, authenticated;
revoke all on table public.form_options from anon, authenticated;

grant select on table public.courses to anon, authenticated;
grant select on table public.site_banners to anon, authenticated;
grant select on table public.instructors to anon, authenticated;
grant select on table public.form_options to anon, authenticated;
grant insert, update, delete on table public.courses to authenticated;
grant insert, update, delete on table public.site_banners to authenticated;
grant insert, update, delete on table public.instructors to authenticated;
grant insert, update, delete on table public.form_options to authenticated;

create policy courses_select_public
on public.courses for select to anon, authenticated
using (true);
create policy courses_insert_staff
on public.courses for insert to authenticated
with check ((select private.has_staff_role(array['owner', 'marketing', 'technical'])));
create policy courses_update_staff
on public.courses for update to authenticated
using ((select private.has_staff_role(array['owner', 'marketing', 'technical'])))
with check ((select private.has_staff_role(array['owner', 'marketing', 'technical'])));
create policy courses_delete_staff
on public.courses for delete to authenticated
using ((select private.has_staff_role(array['owner', 'marketing', 'technical'])));

create policy site_banners_select_public
on public.site_banners for select to anon, authenticated
using (true);
create policy site_banners_insert_staff
on public.site_banners for insert to authenticated
with check ((select private.has_staff_role(array['owner', 'design', 'marketing', 'technical'])));
create policy site_banners_update_staff
on public.site_banners for update to authenticated
using ((select private.has_staff_role(array['owner', 'design', 'marketing', 'technical'])))
with check ((select private.has_staff_role(array['owner', 'design', 'marketing', 'technical'])));
create policy site_banners_delete_staff
on public.site_banners for delete to authenticated
using ((select private.has_staff_role(array['owner', 'design', 'marketing', 'technical'])));

create policy instructors_select_public
on public.instructors for select to anon, authenticated
using (true);
create policy instructors_insert_staff
on public.instructors for insert to authenticated
with check ((select private.has_staff_role(array['owner', 'design', 'marketing', 'technical'])));
create policy instructors_update_staff
on public.instructors for update to authenticated
using ((select private.has_staff_role(array['owner', 'design', 'marketing', 'technical'])))
with check ((select private.has_staff_role(array['owner', 'design', 'marketing', 'technical'])));
create policy instructors_delete_staff
on public.instructors for delete to authenticated
using ((select private.has_staff_role(array['owner', 'design', 'marketing', 'technical'])));

create policy form_options_select_public
on public.form_options for select to anon, authenticated
using (true);
create policy form_options_insert_staff
on public.form_options for insert to authenticated
with check ((select private.has_staff_role(array['owner', 'marketing', 'technical'])));
create policy form_options_update_staff
on public.form_options for update to authenticated
using ((select private.has_staff_role(array['owner', 'marketing', 'technical'])))
with check ((select private.has_staff_role(array['owner', 'marketing', 'technical'])));
create policy form_options_delete_staff
on public.form_options for delete to authenticated
using ((select private.has_staff_role(array['owner', 'marketing', 'technical'])));

revoke all on table public.lecture_applications from anon, authenticated;
revoke all on table public.corporate_inquiries from anon, authenticated;
revoke all on table public.instructor_applications from anon, authenticated;

grant insert on table public.lecture_applications to anon, authenticated;
grant insert on table public.corporate_inquiries to anon, authenticated;
grant insert on table public.instructor_applications to anon, authenticated;
grant select, update, delete on table public.lecture_applications to authenticated;
grant select, update, delete on table public.corporate_inquiries to authenticated;
grant select, update, delete on table public.instructor_applications to authenticated;

create policy lecture_applications_insert_public
on public.lecture_applications
for insert
to anon, authenticated
with check (
  char_length(trim(coalesce(id, ''))) between 1 and 200
  and char_length(trim(coalesce(name, ''))) between 1 and 100
  and char_length(trim(coalesce(phone, ''))) between 1 and 30
  and char_length(coalesce(email, '')) <= 320
  and char_length(coalesce(course_title, '')) <= 500
  and char_length(coalesce(message, '')) <= 5000
  and char_length(coalesce(source, '')) <= 200
  and submitted_at between now() - interval '1 day' and now() + interval '5 minutes'
);

create policy corporate_inquiries_insert_public
on public.corporate_inquiries
for insert
to anon, authenticated
with check (
  char_length(trim(coalesce(id, ''))) between 1 and 200
  and char_length(trim(coalesce(company, ''))) between 1 and 200
  and char_length(trim(coalesce(name, ''))) between 1 and 100
  and char_length(trim(coalesce(phone, ''))) between 1 and 30
  and char_length(trim(coalesce(email, ''))) between 3 and 320
  and octet_length(topics::text) <= 20000
  and char_length(coalesce(message, '')) <= 5000
  and char_length(coalesce(source, '')) <= 200
  and submitted_at between now() - interval '1 day' and now() + interval '5 minutes'
);

create policy instructor_applications_insert_public
on public.instructor_applications
for insert
to anon, authenticated
with check (
  char_length(trim(coalesce(id, ''))) between 1 and 200
  and char_length(trim(coalesce(name, ''))) between 1 and 100
  and char_length(trim(coalesce(phone, ''))) between 1 and 30
  and char_length(trim(coalesce(email, ''))) between 3 and 320
  and octet_length(fields::text) <= 20000
  and char_length(coalesce(intro, '')) <= 10000
  and char_length(coalesce(source, '')) <= 200
  and char_length(coalesce(portfolio_file_path, '')) <= 500
  and (portfolio_file_path is null or portfolio_file_path like 'applications/%')
  and portfolio_file_public_url is null
  and coalesce(portfolio_file_size, 0) between 0 and 10485760
  and submitted_at between now() - interval '1 day' and now() + interval '5 minutes'
);

create policy lecture_applications_select_staff
on public.lecture_applications for select to authenticated
using ((select private.has_staff_role(array['owner', 'marketing', 'technical'])));
create policy lecture_applications_update_staff
on public.lecture_applications for update to authenticated
using ((select private.has_staff_role(array['owner', 'marketing', 'technical'])))
with check ((select private.has_staff_role(array['owner', 'marketing', 'technical'])));
create policy lecture_applications_delete_staff
on public.lecture_applications for delete to authenticated
using ((select private.has_staff_role(array['owner', 'marketing', 'technical'])));

create policy corporate_inquiries_select_staff
on public.corporate_inquiries for select to authenticated
using ((select private.has_staff_role(array['owner', 'marketing', 'technical'])));
create policy corporate_inquiries_update_staff
on public.corporate_inquiries for update to authenticated
using ((select private.has_staff_role(array['owner', 'marketing', 'technical'])))
with check ((select private.has_staff_role(array['owner', 'marketing', 'technical'])));
create policy corporate_inquiries_delete_staff
on public.corporate_inquiries for delete to authenticated
using ((select private.has_staff_role(array['owner', 'marketing', 'technical'])));

create policy instructor_applications_select_staff
on public.instructor_applications for select to authenticated
using ((select private.has_staff_role(array['owner', 'marketing', 'technical'])));
create policy instructor_applications_update_staff
on public.instructor_applications for update to authenticated
using ((select private.has_staff_role(array['owner', 'marketing', 'technical'])))
with check ((select private.has_staff_role(array['owner', 'marketing', 'technical'])));
create policy instructor_applications_delete_staff
on public.instructor_applications for delete to authenticated
using ((select private.has_staff_role(array['owner', 'marketing', 'technical'])));

update public.instructor_applications
   set portfolio_file_public_url = null
 where portfolio_file_public_url is not null;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'site-assets',
  'site-assets',
  true,
  26214400,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'instructor-portfolio',
  'instructor-portfolio',
  false,
  10485760,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

do $$
declare
  policy_record record;
begin
  for policy_record in
    select schemaname, tablename, policyname
      from pg_policies
     where schemaname = 'storage'
       and tablename = 'objects'
       and (
         coalesce(qual, '') like '%site-assets%'
         or coalesce(with_check, '') like '%site-assets%'
         or coalesce(qual, '') like '%instructor-portfolio%'
         or coalesce(with_check, '') like '%instructor-portfolio%'
       )
  loop
    execute format('drop policy if exists %I on storage.objects', policy_record.policyname);
  end loop;
end
$$;

create policy storage_site_assets_select_staff
on storage.objects
for select
to authenticated
using (
  bucket_id = 'site-assets'
  and (select private.has_staff_role(array['owner', 'design', 'marketing', 'technical']))
);

create policy storage_site_assets_insert_staff
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'site-assets'
  and (select private.has_staff_role(array['owner', 'design', 'marketing', 'technical']))
);

create policy storage_site_assets_update_staff
on storage.objects
for update
to authenticated
using (
  bucket_id = 'site-assets'
  and (select private.has_staff_role(array['owner', 'design', 'marketing', 'technical']))
)
with check (
  bucket_id = 'site-assets'
  and (select private.has_staff_role(array['owner', 'design', 'marketing', 'technical']))
);

create policy storage_site_assets_delete_staff
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'site-assets'
  and (select private.has_staff_role(array['owner', 'design', 'marketing', 'technical']))
);

create policy storage_portfolio_insert_public
on storage.objects
for insert
to anon, authenticated
with check (
  bucket_id = 'instructor-portfolio'
  and (storage.foldername(name))[1] = 'applications'
);

create policy storage_portfolio_select_staff
on storage.objects
for select
to authenticated
using (
  bucket_id = 'instructor-portfolio'
  and (select private.has_staff_role(array['owner', 'marketing', 'technical']))
);

create policy storage_portfolio_delete_staff
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'instructor-portfolio'
  and (select private.has_staff_role(array['owner', 'marketing', 'technical']))
);

create or replace function private.prepare_lecture_application()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  duplicate_exists boolean;
begin
  select exists (
    select 1
      from public.lecture_applications as existing
     where (
       (new.course_id is not null and existing.course_id = new.course_id)
       or (
         new.course_id is null
         and lower(trim(coalesce(existing.course_title, ''))) = lower(trim(coalesce(new.course_title, '')))
         and existing.course_type = new.course_type
       )
     )
       and lower(regexp_replace(trim(coalesce(existing.name, '')), '\s+', ' ', 'g'))
         = lower(regexp_replace(trim(coalesce(new.name, '')), '\s+', ' ', 'g'))
       and regexp_replace(coalesce(existing.phone, ''), '[^0-9]', '', 'g')
         = regexp_replace(coalesce(new.phone, ''), '[^0-9]', '', 'g')
  ) into duplicate_exists;

  new.applicant_count_adjusted := not duplicate_exists;
  if duplicate_exists and right(coalesce(new.source, ''), 11) <> '::duplicate' then
    new.source := coalesce(new.source, '') || '::duplicate';
  end if;
  return new;
end;
$$;

create or replace function private.sync_course_applicant_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' and new.applicant_count_adjusted = true and new.course_id is not null then
    update public.courses
       set applicant_count = greatest(0, applicant_count + 1)
     where id = new.course_id;
    return new;
  end if;

  if tg_op = 'DELETE' and old.applicant_count_adjusted = true and old.course_id is not null then
    update public.courses
       set applicant_count = greatest(0, applicant_count - 1)
     where id = old.course_id;
    return old;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function private.prepare_lecture_application() from public, anon, authenticated;
revoke all on function private.sync_course_applicant_count() from public, anon, authenticated;

drop trigger if exists trg_lecture_applications_prepare on public.lecture_applications;
create trigger trg_lecture_applications_prepare
before insert on public.lecture_applications
for each row execute function private.prepare_lecture_application();

drop trigger if exists trg_lecture_applications_sync_count on public.lecture_applications;
create trigger trg_lecture_applications_sync_count
after insert or delete on public.lecture_applications
for each row execute function private.sync_course_applicant_count();

drop trigger if exists trg_courses_content_audit on public.courses;
create trigger trg_courses_content_audit
after insert or update or delete on public.courses
for each row execute function private.write_content_audit_log();

drop trigger if exists trg_site_banners_content_audit on public.site_banners;
create trigger trg_site_banners_content_audit
after insert or update or delete on public.site_banners
for each row execute function private.write_content_audit_log();

drop trigger if exists trg_instructors_content_audit on public.instructors;
create trigger trg_instructors_content_audit
after insert or update or delete on public.instructors
for each row execute function private.write_content_audit_log();

drop trigger if exists trg_form_options_content_audit on public.form_options;
create trigger trg_form_options_content_audit
after insert or update or delete on public.form_options
for each row execute function private.write_content_audit_log();

drop trigger if exists trg_staff_members_content_audit on public.staff_members;
create trigger trg_staff_members_content_audit
after insert or update or delete on public.staff_members
for each row execute function private.write_content_audit_log();

commit;
