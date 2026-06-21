create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  deletion_requested_at timestamptz,
  delete_after timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default '기본',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  delete_after timestamptz
);

create table if not exists public.templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  content text not null default '',
  content_json jsonb not null default '{"type":"doc","content":[]}'::jsonb,
  content_text text not null default '',
  default_folder_id uuid references public.folders(id) on delete set null,
  template_kind text not null default 'custom'
    check (template_kind in ('investment_journal', 'weekly_review', 'next_week_plan', 'free_note', 'custom')),
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

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  folder_id uuid not null references public.folders(id) on delete cascade,
  title text not null default '제목 없음',
  content text not null default '',
  note_date date not null default current_date,
  is_draft boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  delete_after timestamptz
);

create table if not exists public.review_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  folder_id uuid not null references public.folders(id) on delete cascade,
  title text not null,
  content text not null default '',
  review_date date not null default current_date,
  editor_position integer not null default 0,
  is_draft boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  delete_after timestamptz
);

create table if not exists public.review_sources (
  id uuid primary key default gen_random_uuid(),
  review_session_id uuid not null references public.review_sessions(id) on delete cascade,
  source_note_id uuid references public.notes(id) on delete cascade,
  source_review_session_id uuid references public.review_sessions(id) on delete cascade,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint review_sources_one_source check (
    (source_note_id is not null and source_review_session_id is null)
    or
    (source_note_id is null and source_review_session_id is not null)
  )
);

create table if not exists public.editable_review_notes (
  id uuid primary key default gen_random_uuid(),
  review_session_id uuid not null references public.review_sessions(id) on delete cascade,
  note_id uuid not null references public.notes(id) on delete cascade,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (review_session_id, note_id)
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

alter table public.templates add column if not exists template_kind text not null default 'custom'
  check (template_kind in ('investment_journal', 'weekly_review', 'next_week_plan', 'free_note', 'custom'));

update public.templates
set template_kind = case
  when name = '투자 일기' then 'investment_journal'
  when name = '한 주 마무리' then 'weekly_review'
  when name = '다음 주 계획' then 'next_week_plan'
  when name = '자유 메모' then 'free_note'
  else template_kind
end
where template_kind = 'custom';

alter table public.notes add column if not exists template_id uuid references public.templates(id) on delete set null;
alter table public.notes add column if not exists content_json jsonb not null default '{"type":"doc","content":[]}'::jsonb;
alter table public.notes add column if not exists content_text text not null default '';
alter table public.notes add column if not exists is_pinned boolean not null default false;
alter table public.notes add column if not exists pinned_at timestamptz;
alter table public.notes add column if not exists routine_key text;

alter table public.review_sessions add column if not exists content_json jsonb not null default '{"type":"doc","content":[]}'::jsonb;
alter table public.review_sessions add column if not exists content_text text not null default '';

create index if not exists folders_user_active_idx on public.folders(user_id, deleted_at, created_at desc);
create index if not exists templates_user_active_idx on public.templates(user_id, deleted_at, usage_count desc, created_at asc);
create index if not exists templates_user_kind_active_idx on public.templates(user_id, template_kind, deleted_at);
create unique index if not exists templates_user_name_active_unique_idx
  on public.templates(user_id, name)
  where deleted_at is null;
create unique index if not exists templates_one_primary_per_user_idx
  on public.templates(user_id)
  where is_primary is true and deleted_at is null;
create index if not exists notes_folder_active_idx on public.notes(folder_id, deleted_at, created_at desc);
create index if not exists notes_user_updated_idx on public.notes(user_id, deleted_at, updated_at desc);
create index if not exists notes_user_pinned_idx
  on public.notes(user_id, is_pinned, pinned_at desc)
  where deleted_at is null;
create unique index if not exists notes_user_routine_active_unique_idx
  on public.notes(user_id, routine_key)
  where routine_key is not null and deleted_at is null;
create index if not exists reviews_folder_active_idx on public.review_sessions(folder_id, deleted_at, created_at desc);
create index if not exists reviews_user_updated_idx on public.review_sessions(user_id, deleted_at, updated_at desc);
create index if not exists review_sources_session_idx on public.review_sources(review_session_id, sort_order);
create index if not exists editable_review_notes_session_idx on public.editable_review_notes(review_session_id, sort_order);
create index if not exists review_schedules_user_due_idx on public.review_schedules(user_id, status, due_date asc);
create index if not exists review_schedules_note_idx on public.review_schedules(note_id, status);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists set_folders_updated_at on public.folders;
create trigger set_folders_updated_at
before update on public.folders
for each row execute function public.set_updated_at();

drop trigger if exists set_templates_updated_at on public.templates;
create trigger set_templates_updated_at
before update on public.templates
for each row execute function public.set_updated_at();

drop trigger if exists set_notes_updated_at on public.notes;
create trigger set_notes_updated_at
before update on public.notes
for each row execute function public.set_updated_at();

drop trigger if exists set_review_sessions_updated_at on public.review_sessions;
create trigger set_review_sessions_updated_at
before update on public.review_sessions
for each row execute function public.set_updated_at();

drop trigger if exists set_review_schedules_updated_at on public.review_schedules;
create trigger set_review_schedules_updated_at
before update on public.review_schedules
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'name', new.email)
  )
  on conflict (id) do nothing;

  insert into public.folders (user_id, name, sort_order)
  values (new.id, '기본', 0)
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

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

alter table public.profiles enable row level security;
alter table public.folders enable row level security;
alter table public.templates enable row level security;
alter table public.notes enable row level security;
alter table public.review_sessions enable row level security;
alter table public.review_sources enable row level security;
alter table public.editable_review_notes enable row level security;
alter table public.review_schedules enable row level security;

drop policy if exists "profiles own select" on public.profiles;
create policy "profiles own select" on public.profiles
for select using (auth.uid() = id);

drop policy if exists "profiles own insert" on public.profiles;
create policy "profiles own insert" on public.profiles
for insert with check (auth.uid() = id);

drop policy if exists "profiles own update" on public.profiles;
create policy "profiles own update" on public.profiles
for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "folders own all" on public.folders;
create policy "folders own all" on public.folders
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "templates own all" on public.templates;
create policy "templates own all" on public.templates
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "notes own all" on public.notes;
create policy "notes own all" on public.notes
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "reviews own all" on public.review_sessions;
create policy "reviews own all" on public.review_sessions
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "review sources own all" on public.review_sources;
create policy "review sources own all" on public.review_sources
for all using (
  exists (
    select 1 from public.review_sessions rs
    where rs.id = review_sources.review_session_id
    and rs.user_id = auth.uid()
  )
) with check (
  exists (
    select 1 from public.review_sessions rs
    where rs.id = review_sources.review_session_id
    and rs.user_id = auth.uid()
  )
);

drop policy if exists "editable review notes own all" on public.editable_review_notes;
create policy "editable review notes own all" on public.editable_review_notes
for all using (
  exists (
    select 1 from public.review_sessions rs
    where rs.id = editable_review_notes.review_session_id
    and rs.user_id = auth.uid()
  )
) with check (
  exists (
    select 1 from public.review_sessions rs
    where rs.id = editable_review_notes.review_session_id
    and rs.user_id = auth.uid()
  )
);

drop policy if exists "review schedules own all" on public.review_schedules;
create policy "review schedules own all" on public.review_schedules
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
