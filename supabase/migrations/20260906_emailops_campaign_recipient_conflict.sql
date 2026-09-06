-- Align the durable campaign-recipient conflict target with the API's
-- onConflict='campaign_id,email' usage. Safe to run after the production schema migration.
drop index if exists public.campaign_recipients_campaign_email_uidx;
create unique index if not exists campaign_recipients_campaign_email_uidx
  on public.campaign_recipients (campaign_id, email);
