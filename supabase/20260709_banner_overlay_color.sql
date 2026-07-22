-- Adds a per-banner overlay gradient color so each hero banner can have its own
-- tint instead of the single hard-coded navy gradient (.hero-scrim in index.html)
-- that used to apply to every banner regardless of which one was showing.
-- Run this in the Supabase project's SQL Editor.

alter table public.site_banners
  add column if not exists overlay_color text not null default '#021642';

select 'banner_overlay_color_ok' as status;
