-- Isolated Website Machine tables. This deliberately does not alter existing
-- CRM, booking, onboarding, or Website Generator tables and uses the project's
-- existing pgcrypto extension (gen_random_uuid).
create table if not exists public.wm_projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  idempotency_key text not null check (length(idempotency_key) between 12 and 100),
  business jsonb not null,
  content jsonb not null,
  research jsonb not null default '[]'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'review', 'preview_pending', 'preview_ready', 'delivered')),
  preview_deploy_id text,
  preview_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, idempotency_key)
);

create table if not exists public.wm_project_revisions (
  id bigint generated always as identity primary key,
  project_id uuid not null references public.wm_projects(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  content jsonb not null,
  research jsonb not null default '[]'::jsonb,
  status text not null,
  created_at timestamptz not null default now()
);

create index if not exists wm_project_revisions_project_idx
  on public.wm_project_revisions(owner_id, project_id, created_at desc);

create table if not exists public.wm_rate_limits (
  owner_id uuid not null references auth.users(id) on delete cascade,
  window_start timestamptz not null,
  request_count integer not null default 0 check (request_count >= 0),
  primary key (owner_id, window_start)
);

alter table public.wm_projects enable row level security;
alter table public.wm_project_revisions enable row level security;
alter table public.wm_rate_limits enable row level security;

drop policy if exists wm_projects_owner_read on public.wm_projects;
create policy wm_projects_owner_read on public.wm_projects for select to authenticated using (owner_id = (select auth.uid()));
drop policy if exists wm_projects_owner_update on public.wm_projects;
create policy wm_projects_owner_update on public.wm_projects for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
drop policy if exists wm_revisions_owner_read on public.wm_project_revisions;
create policy wm_revisions_owner_read on public.wm_project_revisions for select to authenticated using (owner_id = (select auth.uid()));

revoke all on public.wm_projects, public.wm_project_revisions, public.wm_rate_limits from anon, authenticated;
grant select on public.wm_projects to authenticated;
grant update (business, content, research, status, preview_deploy_id, preview_url) on public.wm_projects to authenticated;
grant select on public.wm_project_revisions to authenticated;

create or replace function public.wm_audit_project_revision()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.content is distinct from old.content or new.research is distinct from old.research or new.status is distinct from old.status then
    insert into public.wm_project_revisions(project_id, owner_id, content, research, status)
      values (new.id, new.owner_id, new.content, new.research, new.status);
    new.updated_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists wm_projects_revision on public.wm_projects;
create trigger wm_projects_revision before update on public.wm_projects
for each row execute function public.wm_audit_project_revision();

create or replace function public.wm_create_project(
  p_idempotency_key text,
  p_business jsonb,
  p_content jsonb,
  p_research jsonb default '[]'::jsonb
)
returns setof public.wm_projects
language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid := auth.uid();
  v_window timestamptz := date_trunc('hour', now());
  v_count integer;
  v_project public.wm_projects;
begin
  if v_owner is null then raise exception 'authentication required' using errcode = '42501'; end if;
  if p_idempotency_key is null or length(p_idempotency_key) < 12 or length(p_idempotency_key) > 100 then
    raise exception 'invalid idempotency key' using errcode = '22023';
  end if;
  if jsonb_typeof(p_business) <> 'object' or jsonb_typeof(p_content) <> 'object' or jsonb_typeof(p_research) <> 'array' then
    raise exception 'invalid project shape' using errcode = '22023';
  end if;

  insert into public.wm_rate_limits(owner_id, window_start, request_count)
    values (v_owner, v_window, 1)
    on conflict (owner_id, window_start) do update
      set request_count = public.wm_rate_limits.request_count + 1
      where public.wm_rate_limits.request_count < 8
    returning request_count into v_count;
  if v_count is null then raise exception 'project creation rate limit exceeded' using errcode = 'P0001'; end if;

  insert into public.wm_projects(owner_id, idempotency_key, business, content, research)
    values (v_owner, p_idempotency_key, p_business, p_content, p_research)
    on conflict (owner_id, idempotency_key) do nothing
    returning * into v_project;
  if not found then
    select * into v_project from public.wm_projects
    where owner_id = v_owner and idempotency_key = p_idempotency_key;
  end if;
  return next v_project;
end;
$$;

revoke all on function public.wm_create_project(text, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.wm_create_project(text, jsonb, jsonb, jsonb) to authenticated;
revoke all on function public.wm_audit_project_revision() from public, anon, authenticated;
