-- Internal campaign state. No grants to the Data API roles.
create schema wm_acquisition;
revoke all on schema wm_acquisition from public, anon, authenticated, service_role;

create table wm_acquisition.territories (
    slug text primary key,
    city text not null,
    industry text not null,
    queue_position integer not null unique check (queue_position > 0),
    status text not null check (status in ('queued', 'active', 'exhausted', 'awaiting_replies', 'revisit')),
    discovery_passes smallint not null default 0 check (discovery_passes between 0 and 2),
    second_pass_evidence text,
    check (status <> 'exhausted' or
           (discovery_passes = 2 and nullif(trim(second_pass_evidence), '') is not null))
);
create unique index wm_one_active_territory on wm_acquisition.territories ((true))
where status = 'active';

create table wm_acquisition.runs (
    london_day date primary key,
    territory_slug text not null references wm_acquisition.territories,
    worker_id uuid not null unique,
    started_at timestamptz not null default now(),
    finished_at timestamptz,
    status text not null default 'running' check (status in ('running', 'complete', 'blocked', 'failed')),
    usage jsonb not null default '{}'::jsonb,
    cost_gbp numeric check (cost_gbp >= 0),
    check ((status = 'running') = (finished_at is null))
);
-- A dangling running lease deliberately blocks subsequent days until reconciled.
create unique index wm_one_running_batch on wm_acquisition.runs ((true))
where status = 'running';

create table wm_acquisition.initial_outreach (
    company_number text primary key check (company_number ~ '^[A-Z0-9]{8}$'),
    email text not null unique check (email = lower(trim(email))),
    territory_slug text not null references wm_acquisition.territories,
    london_day date not null references wm_acquisition.runs,
    preview_url text not null,
    eligibility_evidence jsonb not null check (jsonb_typeof(eligibility_evidence) = 'object' and eligibility_evidence <> '{}'::jsonb),
    state text not null default 'claimed' check (state in ('claimed', 'uncertain', 'sent', 'suppressed')),
    gmail_message_id text unique,
    confirmed_sent_at timestamptz,
    reply_at timestamptz,
    positive_reply_at timestamptz,
    stripe_payment_id text unique,
    gross_gbp numeric check (gross_gbp >= 0),
    check ((state = 'sent') = (gmail_message_id is not null and confirmed_sent_at is not null)),
    check (positive_reply_at is null or reply_at is not null),
    check ((stripe_payment_id is null) = (gross_gbp is null))
);

alter table wm_acquisition.territories enable row level security;
alter table wm_acquisition.runs enable row level security;
alter table wm_acquisition.initial_outreach enable row level security;

insert into wm_acquisition.territories (slug, city, industry, queue_position, status)
values ('cambridge-electricians', 'Cambridge', 'electricians', 1, 'active'),
       ('peterborough-electricians', 'Peterborough', 'electricians', 2, 'queued');
