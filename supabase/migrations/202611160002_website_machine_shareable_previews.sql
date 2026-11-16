-- Short-lived, unguessable share links for reviewed drafts. The database stores
-- only a SHA-256 token hash; the unauthenticated RPC returns content only for
-- a matching, unexpired token.
alter table public.wm_projects
  add column if not exists preview_token_hash text,
  add column if not exists preview_expires_at timestamptz;

revoke update (business, content, research, status, preview_deploy_id, preview_url) on public.wm_projects from authenticated;
grant update (business, content, research, status, preview_deploy_id, preview_url, preview_token_hash, preview_expires_at)
  on public.wm_projects to authenticated;

create or replace function public.wm_get_public_preview(p_project_id uuid, p_token_hash text)
returns table(content jsonb)
language sql security definer set search_path = '' as $$
  select p.content
  from public.wm_projects as p
  where p.id = p_project_id
    and p.preview_token_hash = p_token_hash
    and p.preview_expires_at > now()
    and p.status = 'preview_ready'
  limit 1;
$$;

revoke all on function public.wm_get_public_preview(uuid, text) from public, authenticated;
grant execute on function public.wm_get_public_preview(uuid, text) to anon;
