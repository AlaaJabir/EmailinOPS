-- Durable event -> campaign recipient synchronization.
-- Message status is the authoritative delivery state; this trigger mirrors it
-- into campaign_recipients so webhook processing survives process restarts.

create index if not exists campaign_recipients_message_id_idx
  on public.campaign_recipients (message_id)
  where message_id is not null;

create or replace function public.emailops_sync_campaign_recipient()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.campaign_id is null then
    return new;
  end if;

  update public.campaign_recipients
  set
    status = case new.status
      when 'QUEUED' then 'QUEUED'
      when 'SENDING' then 'SENDING'
      when 'SENT' then 'SENT'
      when 'DELIVERED' then 'DELIVERED'
      when 'BOUNCED' then 'BOUNCED'
      when 'COMPLAINED' then 'COMPLAINED'
      when 'REJECTED' then 'REJECTED'
      when 'FAILED' then 'FAILED'
      when 'DELIVERY_DELAYED' then 'DELIVERY_DELAYED'
      when 'RENDERING_FAILED' then 'RENDERING_FAILED'
      else status
    end,
    sent_at = case when new.status = 'SENT' and sent_at is null then coalesce(new.sent_at, now()) else sent_at end,
    delivered_at = case when new.status = 'DELIVERED' then coalesce(new.delivered_at, now()) else delivered_at end,
    bounced_at = case when new.status = 'BOUNCED' then coalesce(new.bounced_at, now()) else bounced_at end,
    complained_at = case when new.status = 'COMPLAINED' then coalesce(complained_at, now()) else complained_at end,
    failure_reason = case
      when new.status in ('BOUNCED','FAILED','REJECTED','DELIVERY_DELAYED','RENDERING_FAILED')
        then coalesce(new.bounce_reason, failure_reason)
      else failure_reason
    end,
    updated_at = now()
  where message_id = new.id;

  return new;
end;
$$;

drop trigger if exists trg_emailops_sync_campaign_recipient on public.messages;
create trigger trg_emailops_sync_campaign_recipient
after update of status, sent_at, delivered_at, bounced_at, bounce_reason
on public.messages
for each row
when (old.status is distinct from new.status
   or old.sent_at is distinct from new.sent_at
   or old.delivered_at is distinct from new.delivered_at
   or old.bounced_at is distinct from new.bounced_at
   or old.bounce_reason is distinct from new.bounce_reason)
execute function public.emailops_sync_campaign_recipient();

comment on function public.emailops_sync_campaign_recipient() is
  'Mirrors durable message delivery status into campaign_recipients';
