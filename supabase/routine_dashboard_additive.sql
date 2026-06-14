create table if not exists public.templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  content text not null default '',
  content_json jsonb not null default '{"type":"doc","content":[]}'::jsonb,
  content_text text not null default '',
  default_folder_id uuid references public.folders(id) on delete set null,
  is_primary boolean not null default false,
  usage_count integer not null default 0,
  allow_multiple_per_day boolean not null default false,
  review_schedule_preset text not null default 'none'
    check (review_schedule_preset in ('none', '1w_3m_1y')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  delete_after timestamptz
);

create table if not exists public.review_schedules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  note_id uuid not null references public.notes(id) on delete cascade,
  review_type text not null check (review_type in ('1w', '3m', '1y')),
  due_date date not null,
  status text not null default 'pending'
    check (status in ('pending', 'completed', 'skipped')),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (note_id, review_type)
);

alter table public.notes add column if not exists template_id uuid references public.templates(id) on delete set null;
alter table public.notes add column if not exists content_json jsonb not null default '{"type":"doc","content":[]}'::jsonb;
alter table public.notes add column if not exists content_text text not null default '';
alter table public.notes add column if not exists is_pinned boolean not null default false;
alter table public.notes add column if not exists pinned_at timestamptz;
alter table public.notes add column if not exists routine_key text;

alter table public.review_sessions add column if not exists content_json jsonb not null default '{"type":"doc","content":[]}'::jsonb;
alter table public.review_sessions add column if not exists content_text text not null default '';

create index if not exists templates_user_active_idx on public.templates(user_id, deleted_at, usage_count desc, created_at asc);
create unique index if not exists templates_user_name_active_unique_idx
  on public.templates(user_id, name)
  where deleted_at is null;
create unique index if not exists templates_one_primary_per_user_idx
  on public.templates(user_id)
  where is_primary is true and deleted_at is null;
create index if not exists notes_user_updated_idx on public.notes(user_id, deleted_at, updated_at desc);
create index if not exists notes_user_pinned_idx
  on public.notes(user_id, is_pinned, pinned_at desc)
  where deleted_at is null;
create unique index if not exists notes_user_routine_active_unique_idx
  on public.notes(user_id, routine_key)
  where routine_key is not null and deleted_at is null;
create index if not exists reviews_user_updated_idx on public.review_sessions(user_id, deleted_at, updated_at desc);
create index if not exists review_schedules_user_due_idx on public.review_schedules(user_id, status, due_date asc);
create index if not exists review_schedules_note_idx on public.review_schedules(note_id, status);

drop trigger if exists set_templates_updated_at on public.templates;
create trigger set_templates_updated_at
before update on public.templates
for each row execute function public.set_updated_at();

drop trigger if exists set_review_schedules_updated_at on public.review_schedules;
create trigger set_review_schedules_updated_at
before update on public.review_schedules
for each row execute function public.set_updated_at();

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

  delete from public.review_sessions where delete_after is not null and delete_after <= now();
  delete from public.notes where delete_after is not null and delete_after <= now();
  delete from public.templates where delete_after is not null and delete_after <= now();
  delete from public.folders where delete_after is not null and delete_after <= now();
  delete from public.profiles where delete_after is not null and delete_after <= now();
end;
$$;

alter table public.templates enable row level security;
alter table public.review_schedules enable row level security;

drop policy if exists "templates own all" on public.templates;
create policy "templates own all" on public.templates
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "review schedules own all" on public.review_schedules;
create policy "review schedules own all" on public.review_schedules
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
