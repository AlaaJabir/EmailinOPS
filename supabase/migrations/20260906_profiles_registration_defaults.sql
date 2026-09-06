-- New self-registered accounts must not receive administrator privileges by default.
alter table if exists public.profiles
  alter column role set default 'OPERATOR';
