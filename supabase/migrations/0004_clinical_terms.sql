-- Remembered complaint / diagnosis terms typed by clinicians, so they appear
-- in the type-ahead dropdowns next time. Run after 0001_init.sql.
create table if not exists clinical_terms (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('complaint','diagnosis')),
  label text not null,
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

-- case-insensitive uniqueness per kind
create unique index if not exists clinical_terms_kind_label
  on clinical_terms (kind, lower(label));

alter table clinical_terms enable row level security;

create policy ct_read on clinical_terms for select
  using (auth.uid() is not null);
create policy ct_insert on clinical_terms for insert
  with check (my_role() in ('admin','doctor','dispenser'));
