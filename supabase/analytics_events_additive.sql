create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_name text not null,
  event_key text,
  page_path text,
  properties jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists analytics_events_user_time_idx
  on public.analytics_events(user_id, created_at desc);
create index if not exists analytics_events_name_time_idx
  on public.analytics_events(event_name, created_at desc);
create unique index if not exists analytics_events_user_event_key_unique_idx
  on public.analytics_events(user_id, event_name, event_key)
  where event_key is not null;

create or replace function public.purge_deleted_items()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.editable_review_notes
  where review_session_id in (
    select id from public.review_sessions where delete_after is not null and delete_after <= now()
  )
  or note_id in (
    select id from public.notes where delete_after is not null and delete_after <= now()
  );

  delete from public.review_sources
  where review_session_id in (
    select id from public.review_sessions where delete_after is not null and delete_after <= now()
  )
  or source_note_id in (
    select id from public.notes where delete_after is not null and delete_after <= now()
  )
  or source_review_session_id in (
    select id from public.review_sessions where delete_after is not null and delete_after <= now()
  );

  delete from public.review_schedules
  where note_id in (
    select id from public.notes where delete_after is not null and delete_after <= now()
  );

  delete from public.analytics_events
  where user_id in (
    select id from public.profiles where delete_after is not null and delete_after <= now()
  );

  delete from public.review_sessions where delete_after is not null and delete_after <= now();
  delete from public.notes where delete_after is not null and delete_after <= now();
  delete from public.templates where delete_after is not null and delete_after <= now();
  delete from public.folders where delete_after is not null and delete_after <= now();
  delete from public.profiles where delete_after is not null and delete_after <= now();
end;
$$;

alter table public.analytics_events enable row level security;

drop policy if exists "analytics events own insert" on public.analytics_events;
create policy "analytics events own insert" on public.analytics_events
for insert with check (auth.uid() = user_id);
