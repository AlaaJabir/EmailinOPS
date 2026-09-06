-- EmailinOPS production persistence migration
-- Safe for the current schema: creates only missing tables and adds missing
-- campaign/template fields needed by the Send Email and Marketing modules.
-- Run in Supabase SQL Editor or through the project's migration runner.

create extension if not exists pgcrypto;

create table if not exists public.templates (
  id uuid primary key default gen_random_uuid(), user_id uuid not null, name text not null,
  subject text not null default '', preheader text not null default '', head_html text not null default '',
  html_body text not null default '', plain_text text not null default '', variables text[] not null default '{}',
  from_name text, from_email text, reply_to text, custom_headers jsonb not null default '{}'::jsonb,
  track_opens boolean not null default true, track_clicks boolean not null default true,
  is_marketing boolean not null default false, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.campaign_recipients (
  id uuid primary key default gen_random_uuid(), campaign_id uuid not null, contact_id uuid, email text not null,
  message_id uuid, status text not null default 'QUEUED', queued_at timestamptz, sent_at timestamptz,
  delivered_at timestamptz, bounced_at timestamptz, complained_at timestamptz, unsubscribed_at timestamptz,
  failure_reason text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.unsubscribe_tokens (
  id uuid primary key default gen_random_uuid(), token text not null, user_id uuid, email text not null,
  contact_id uuid, message_id text, campaign_id uuid, created_at timestamptz not null default now(), unsubscribed_at timestamptz
);

create table if not exists public.settings (
  id uuid primary key default gen_random_uuid(), user_id uuid not null, category text not null,
  values jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (user_id, category)
);

alter table public.campaigns
  add column if not exists template_id uuid,
  add column if not exists preheader text not null default '',
  add column if not exists head_html text not null default '',
  add column if not exists from_name text,
  add column if not exists from_email text,
  add column if not exists reply_to text,
  add column if not exists custom_headers jsonb not null default '{}'::jsonb,
  add column if not exists is_marketing boolean not null default false,
  add column if not exists unsubscribe_count integer not null default 0;

alter table public.messages
  add column if not exists preheader text,
  add column if not exists head_html text,
  add column if not exists is_marketing boolean not null default false,
  add column if not exists open_tracking_enabled boolean not null default true,
  add column if not exists click_tracking_enabled boolean not null default true;

alter table public.domains
  alter column spf_status set default 'PENDING', alter column dkim_status set default 'PENDING',
  alter column dmarc_status set default 'PENDING', alter column ses_status set default 'PENDING';

create unique index if not exists templates_user_name_uidx on public.templates (user_id, name);
create unique index if not exists unsubscribe_tokens_token_uidx on public.unsubscribe_tokens (token);
create unique index if not exists contacts_user_email_uidx on public.contacts (user_id, lower(email));
create unique index if not exists domains_user_domain_uidx on public.domains (user_id, lower(domain_name));
create unique index if not exists senders_user_email_uidx on public.senders (user_id, lower(from_email));
create unique index if not exists campaign_recipients_campaign_email_uidx on public.campaign_recipients (campaign_id, lower(email));
create index if not exists campaign_recipients_campaign_status_idx on public.campaign_recipients (campaign_id, status);
create index if not exists messages_user_created_idx on public.messages (user_id, created_at desc);
create index if not exists messages_campaign_created_idx on public.messages (campaign_id, created_at desc);
create index if not exists messages_to_email_idx on public.messages (lower(to_email));
create index if not exists message_events_message_type_idx on public.message_events (message_id, event_type, timestamp desc);
create index if not exists message_events_user_type_idx on public.message_events (user_id, event_type, timestamp desc);
create index if not exists suppressions_user_email_idx on public.suppressions (user_id, lower(email));
create index if not exists technical_logs_user_timestamp_idx on public.technical_logs (user_id, timestamp desc);
create index if not exists settings_user_category_idx on public.settings (user_id, category);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'campaign_recipients_campaign_id_fkey') THEN
    ALTER TABLE public.campaign_recipients ADD CONSTRAINT campaign_recipients_campaign_id_fkey
      FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'campaign_recipients_contact_id_fkey') THEN
    ALTER TABLE public.campaign_recipients ADD CONSTRAINT campaign_recipients_contact_id_fkey
      FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE SET NULL NOT VALID;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'campaign_recipients_message_id_fkey') THEN
    ALTER TABLE public.campaign_recipients ADD CONSTRAINT campaign_recipients_message_id_fkey
      FOREIGN KEY (message_id) REFERENCES public.messages(id) ON DELETE SET NULL NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'campaigns_template_id_fkey') THEN
    ALTER TABLE public.campaigns ADD CONSTRAINT campaigns_template_id_fkey
      FOREIGN KEY (template_id) REFERENCES public.templates(id) ON DELETE SET NULL NOT VALID;
  END IF;
END $$;

alter table public.templates enable row level security;
alter table public.campaign_recipients enable row level security;
alter table public.unsubscribe_tokens enable row level security;
alter table public.settings enable row level security;

comment on table public.templates is 'Persistent EmailinOPS email templates';
comment on table public.campaign_recipients is 'Durable per-recipient campaign state';
comment on table public.unsubscribe_tokens is 'Opaque unsubscribe tokens for List-Unsubscribe and web unsubscribe';
comment on table public.settings is 'Persistent per-user EmailinOPS application settings';
