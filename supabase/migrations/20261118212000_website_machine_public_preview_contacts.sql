-- Keep link-based access and expiry semantics. Return only the fields used
-- by shared concepts, with contact details visible after explicit opt-in.
create or replace function public.wm_get_public_preview(p_project_id uuid, p_token_hash text)
returns table(content jsonb)
language sql security definer set search_path = '' as $$
  select jsonb_build_object(
    'businessName', p.content->'businessName',
    'industry', p.content->'industry',
    'location', p.content->'location',
    'heroTitle', p.content->'heroTitle',
    'heroDescription', p.content->'heroDescription',
    'aboutTitle', p.content->'aboutTitle',
    'aboutDescription', p.content->'aboutDescription',
    'facts', p.content->'facts',
    'services', coalesce(nullif(p.content->'services', 'null'::jsonb), '[]'::jsonb),
    'visualStyle', p.content->'visualStyle',
    'ctaLabel', p.content->'ctaLabel',
    'sharePublicContacts', p.content->'sharePublicContacts' = 'true'::jsonb,
    'verifiedPhone', case when p.content->'sharePublicContacts' = 'true'::jsonb then p.content->>'verifiedPhone' else '' end,
    'verifiedEmail', case when p.content->'sharePublicContacts' = 'true'::jsonb then p.content->>'verifiedEmail' else '' end
  )
  from public.wm_projects as p
  where p.id = p_project_id
    and p.preview_token_hash = p_token_hash
    and p.preview_expires_at > now()
    and p.status = 'preview_ready'
  limit 1;
$$;

revoke all on function public.wm_get_public_preview(uuid, text) from public, authenticated;
grant execute on function public.wm_get_public_preview(uuid, text) to anon;
