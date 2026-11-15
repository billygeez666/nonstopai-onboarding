-- NONSTOP AI Booking Reminder MVP — proposed additive schema.
-- NOT APPLIED. Review tenant model, access policies and migration naming first.
-- Separate from existing taxi public.bookings table.
create table if not exists public.br_appointments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  calendar_id text not null,
  external_event_id text not null,
  event_version text not null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  status text not null check (status in ('confirmed','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, calendar_id, external_event_id),
  check (end_at > start_at)
);
create table if not exists public.br_message_queue (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  appointment_id uuid not null references public.br_appointments(id) on delete cascade,
  event_version text not null,
  kind text not null,
  channel text not null,
  due_at timestamptz not null,
  status text not null default 'planned' check (status in ('planned','claimed','sent','cancelled','failed')),
  idempotency_key text not null unique,
  attempts integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists br_queue_due_idx on public.br_message_queue(due_at) where status='planned';
alter table public.br_appointments enable row level security;
alter table public.br_message_queue enable row level security;
-- Deliberately NO client-facing RLS policies. Service-role only pending tenant access design.
-- Production migration also needs atomic claim, send lock, stale-event recheck, delivery logs,
-- consent store, retention policy, and a tenant-to-auth identity mapping.
