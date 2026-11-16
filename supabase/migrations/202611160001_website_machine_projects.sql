-- Website Machine staging-compatible schema. Customer data is private by default.
create extension if not exists pgcrypto;

create table if not exists public.website_machine_projects (
  id uuid primary key default gen_random_uuid(),
  idempotency_key text not null unique check (length(idempotency_key) between 12 and 100),
  access_token_hash text not null check (access_token_hash ~ '^[0-9a-f]{64}$'),
  business jsonb not null,
  content jsonb not null,
  research jsonb not null default '[]'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'review', 'preview_pending', 'preview_ready', 'delivered')),
  preview_deploy_id text,
  preview_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.website_machine_project_revisions (
  id bigint generated always as identity primary key,
  project_id uuid not null references public.website_machine_projects(id) on delete cascade,
  content jsonb not null,
  research jsonb not null default '[]'::jsonb,
  status text not null,
  created_at timestamptz not null default now()
);

create index if not exists website_machine_project_revisions_project_idx
  on public.website_machine_project_revisions(project_id, created_at desc);

create or replace function public.website_machine_audit_revision()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if new.content is distinct from old.content or new.research is distinct from old.research or new.status is distinct from old.status then
    insert into public.website_machine_project_revisions(project_id, content, research, status)
      values (new.id, new.content, new.research, new.status);
    new.updated_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists website_machine_projects_revision on public.website_machine_projects;
create trigger website_machine_projects_revision before update on public.website_machine_projects
for each row execute function public.website_machine_audit_revision();

alter table public.website_machine_projects enable row level security;
alter table public.website_machine_project_revisions enable row level security;
revoke all on public.website_machine_projects, public.website_machine_project_revisions from anon, authenticated;
grant all on public.website_machine_projects, public.website_machine_project_revisions to service_role;
grant usage, select on sequence public.website_machine_project_revisions_id_seq to service_role;
