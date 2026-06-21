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

create index if not exists templates_user_kind_active_idx
  on public.templates(user_id, template_kind, deleted_at);
