alter table if exists public.email_imports
  add column if not exists source_size_bytes bigint not null default 0,
  add column if not exists upload_offset_bytes bigint not null default 0;

-- Import history must preserve every source row, including invalid,
-- duplicate and suppressed rows. Deduplication is handled by row status,
-- not by a unique email constraint.
drop index if exists public.email_import_rows_import_email_uidx;

create unique index if not exists email_import_rows_import_row_uidx
  on public.email_import_rows (import_id, row_number);

create index if not exists email_import_rows_import_email_lookup_idx
  on public.email_import_rows (import_id, normalized_email);

create index if not exists email_imports_user_status_idx
  on public.email_imports (user_id, status);
