-- Durable compliance suppression from provider outcomes.
-- Hard bounces and complaints must remain suppressed even after an API restart.

create or replace function public.emailops_auto_suppress_message_recipient()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.user_id is null or new.to_email is null or btrim(new.to_email) = '' then
    return new;
  end if;

  if new.status = 'BOUNCED' and upper(coalesce(new.bounce_type, '')) = 'HARD' then
    if not exists (
      select 1 from public.suppressions
      where user_id = new.user_id
        and lower(email) = lower(btrim(new.to_email))
    ) then
      insert into public.suppressions (user_id, email, type, reason, source)
      values (
        new.user_id,
        lower(btrim(new.to_email)),
        'HARD_BOUNCE',
        coalesce(new.bounce_reason, 'Permanent hard bounce reported by provider'),
        'provider_event'
      );
    end if;
  elsif new.status = 'COMPLAINED' then
    if not exists (
      select 1 from public.suppressions
      where user_id = new.user_id
        and lower(email) = lower(btrim(new.to_email))
    ) then
      insert into public.suppressions (user_id, email, type, reason, source)
      values (
        new.user_id,
        lower(btrim(new.to_email)),
        'COMPLAINT',
        'Spam complaint reported by provider',
        'provider_event'
      );
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_emailops_auto_suppress_message on public.messages;
create trigger trg_emailops_auto_suppress_message
after update of status, bounce_type, bounce_reason
on public.messages
for each row
when (new.status in ('BOUNCED','COMPLAINED'))
execute function public.emailops_auto_suppress_message_recipient();

comment on function public.emailops_auto_suppress_message_recipient() is
  'Creates durable suppression entries for hard bounces and complaints';
