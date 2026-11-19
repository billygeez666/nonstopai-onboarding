-- Apply after the acquisition queue migration. Store business data only in CRM.
create table wm_acquisition.preview_batch_input (
    batch_id uuid not null,
    company_number text not null check (company_number ~ '^[A-Z0-9]{8}$'),
    territory_slug text not null references wm_acquisition.territories,
    payload jsonb not null check (jsonb_typeof(payload) = 'object'),
    approved_until timestamptz not null,
    revoked_at timestamptz,
    primary key (batch_id, company_number)
);

create table wm_acquisition.preview_generation (
    company_number text primary key,
    batch_id uuid not null,
    state text not null default 'claimed' check (state in ('claimed', 'rendered')),
    claimed_at timestamptz not null default now(),
    rendered_at timestamptz,
    foreign key (batch_id, company_number)
        references wm_acquisition.preview_batch_input (batch_id, company_number),
    check ((state = 'rendered') = (rendered_at is not null))
);

alter table wm_acquisition.preview_batch_input enable row level security;
alter table wm_acquisition.preview_generation enable row level security;

-- This group cannot log in. An administrator can grant it to a dedicated worker.
create role wm_preview_worker nologin;
grant usage on schema wm_acquisition to wm_preview_worker;
grant select on wm_acquisition.territories, wm_acquisition.preview_batch_input,
    wm_acquisition.preview_generation to wm_preview_worker;
grant insert (batch_id, company_number), update (state, rendered_at)
    on wm_acquisition.preview_generation to wm_preview_worker;
create policy wm_preview_worker_active on wm_acquisition.territories
    for select to wm_preview_worker using (status = 'active');
create policy wm_preview_worker_input on wm_acquisition.preview_batch_input
    for select to wm_preview_worker using (
        revoked_at is null and approved_until > now() and exists (
            select 1 from wm_acquisition.territories where slug = territory_slug
        )
    );
create policy wm_preview_worker_results on wm_acquisition.preview_generation
    for select to wm_preview_worker using (true);
create policy wm_preview_worker_claim on wm_acquisition.preview_generation
    for insert to wm_preview_worker with check (exists (
        select 1 from wm_acquisition.preview_batch_input input
        where input.batch_id = preview_generation.batch_id
          and input.company_number = preview_generation.company_number
    ));
create policy wm_preview_worker_complete on wm_acquisition.preview_generation
    for update to wm_preview_worker using (state = 'claimed')
    with check (state = 'rendered' and rendered_at is not null);
