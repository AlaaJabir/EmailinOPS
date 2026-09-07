alter table if exists public.email_imports
  add column if not exists list_id uuid references public.contact_lists(id) on delete set null;

create index if not exists email_imports_user_created_idx
  on public.email_imports (user_id, created_at desc);

create index if not exists email_imports_list_id_idx
  on public.email_imports (list_id);
