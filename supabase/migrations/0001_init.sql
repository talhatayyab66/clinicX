-- =====================================================================
-- ClinicX — initial schema, helpers, RLS policies and dispensing RPC
-- =====================================================================

-- ---------- enums ----------
create type user_role   as enum ('admin', 'doctor', 'dispenser');
create type visit_status as enum ('open', 'discharged', 'dispensed', 'cancelled');
create type frequency    as enum ('OD','BD','TDS','QID','HS','STAT','SOS');
create type stock_move   as enum ('in','out','adjust');

-- ---------- tables ----------
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  full_name text not null,
  role user_role not null default 'doctor',
  is_active boolean not null default true,
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

create table settings (
  id int primary key default 1,
  clinic_name text,
  address text,
  phone text,
  currency text default 'USD',
  currency_symbol text default '$',
  region text default 'US',
  tax_rate numeric default 0,
  logo_url text,
  receipt_footer text,
  constraint single_row check (id = 1)
);

create table patients (
  id uuid primary key default gen_random_uuid(),
  patient_no serial unique,
  name text not null,
  age int,
  gender text,
  phone text,
  weight numeric,
  allergies text,
  address text,
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

create table medicines (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  generic_name text,
  form text,
  strength text,
  price numeric not null default 0,
  stock_qty int not null default 0,
  batch_no text,
  expiry_date date,
  reorder_level int default 10,
  is_active boolean default true,
  created_at timestamptz default now()
);

create table visits (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid references patients(id),
  doctor_id uuid references profiles(id),
  visit_date timestamptz default now(),
  complaint text,
  diagnosis text,
  comorbidities text,
  vitals jsonb,
  consultation_fee numeric default 0,
  notes text,
  status visit_status default 'open'
);

create table prescriptions (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid references visits(id) on delete cascade,
  medicine_id uuid references medicines(id),
  dose text,
  freq frequency not null,
  route text,
  duration_days int,
  before_after_food text,
  qty_calculated int,
  instructions text
);

create table dispenses (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid references visits(id),
  dispensed_by uuid references profiles(id),
  dispensed_at timestamptz default now()
);

create table dispense_items (
  id uuid primary key default gen_random_uuid(),
  dispense_id uuid references dispenses(id) on delete cascade,
  medicine_id uuid references medicines(id),
  qty int not null,
  unit_price numeric not null,
  line_total numeric not null
);

create table receipts (
  id uuid primary key default gen_random_uuid(),
  receipt_no serial unique,
  visit_id uuid references visits(id),
  dispense_id uuid references dispenses(id),
  consultation_fee numeric default 0,
  medicines_total numeric default 0,
  tax numeric default 0,
  grand_total numeric not null,
  amount_received numeric not null,
  change_due numeric default 0,
  payment_method text,
  received_by uuid references profiles(id),
  created_at timestamptz default now()
);

create table expenses (
  id uuid primary key default gen_random_uuid(),
  category text,
  description text,
  amount numeric not null,
  expense_date date default current_date,
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

create table stock_movements (
  id uuid primary key default gen_random_uuid(),
  medicine_id uuid references medicines(id),
  type stock_move not null,
  qty int not null,
  reason text,
  ref_id uuid,
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

-- ---------- helper: current user's role ----------
create or replace function my_role() returns user_role
language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid()
$$;

create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'admin' from profiles where id = auth.uid()), false)
$$;

create or replace function is_clinical() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role in ('admin','doctor') from profiles where id = auth.uid()), false)
$$;

-- =====================================================================
-- Row-Level Security
-- =====================================================================
alter table profiles        enable row level security;
alter table settings        enable row level security;
alter table patients        enable row level security;
alter table medicines       enable row level security;
alter table visits          enable row level security;
alter table prescriptions   enable row level security;
alter table dispenses       enable row level security;
alter table dispense_items  enable row level security;
alter table receipts        enable row level security;
alter table expenses        enable row level security;
alter table stock_movements enable row level security;

-- ---------- profiles ----------
create policy profiles_read_own   on profiles for select using (id = auth.uid() or is_admin());
create policy profiles_admin_ins  on profiles for insert with check (is_admin());
create policy profiles_admin_upd  on profiles for update using (is_admin()) with check (is_admin());

-- ---------- settings ----------
create policy settings_read_all   on settings for select using (auth.uid() is not null);
create policy settings_admin_ins  on settings for insert with check (is_admin());
create policy settings_admin_upd  on settings for update using (is_admin()) with check (is_admin());

-- ---------- patients ----------
create policy patients_clin_all   on patients for all
  using (is_clinical())
  with check (is_clinical());
-- dispenser may read patients that belong to a discharged/dispensed visit
create policy patients_disp_read  on patients for select using (
  my_role() = 'dispenser' and exists (
    select 1 from visits v
    where v.patient_id = patients.id
      and v.status in ('discharged','dispensed')
  )
);

-- ---------- visits ----------
create policy visits_clin_all     on visits for all
  using (is_clinical())
  with check (is_clinical());
create policy visits_disp_read    on visits for select using (
  my_role() = 'dispenser' and status in ('discharged','dispensed')
);

-- ---------- prescriptions ----------
create policy rx_clin_all         on prescriptions for all
  using (is_clinical())
  with check (is_clinical());
create policy rx_disp_read        on prescriptions for select using (
  my_role() = 'dispenser' and exists (
    select 1 from visits v
    where v.id = prescriptions.visit_id
      and v.status in ('discharged','dispensed')
  )
);

-- ---------- medicines ----------
create policy meds_clin_read      on medicines for select using (auth.uid() is not null);
create policy meds_admin_ins      on medicines for insert with check (is_admin());
create policy meds_admin_upd      on medicines for update using (is_admin()) with check (is_admin());
create policy meds_admin_del      on medicines for delete using (is_admin());

-- ---------- dispenses / dispense_items / receipts ----------
create policy disp_disp_admin     on dispenses for all
  using (my_role() in ('admin','dispenser'))
  with check (my_role() in ('admin','dispenser'));
create policy disp_doctor_read    on dispenses for select using (my_role() = 'doctor');

create policy di_disp_admin       on dispense_items for all
  using (my_role() in ('admin','dispenser'))
  with check (my_role() in ('admin','dispenser'));
create policy di_doctor_read      on dispense_items for select using (my_role() = 'doctor');

create policy rcpt_disp_admin     on receipts for all
  using (my_role() in ('admin','dispenser'))
  with check (my_role() in ('admin','dispenser'));
create policy rcpt_doctor_read    on receipts for select using (my_role() = 'doctor');

-- ---------- expenses (ADMIN ONLY — the line that matters) ----------
create policy exp_admin_all       on expenses for all
  using (is_admin())
  with check (is_admin());

-- ---------- stock_movements ----------
create policy sm_ins_disp_admin   on stock_movements for insert
  with check (my_role() in ('admin','dispenser'));
create policy sm_read_admin       on stock_movements for select using (is_admin());

-- =====================================================================
-- Dispensing RPC: one transaction — dispense + stock decrement +
-- movements + receipt. Stock can never go negative.
-- =====================================================================
create or replace function dispense_visit(
  p_visit_id uuid,
  p_items jsonb,            -- [{medicine_id, qty, unit_price}]
  p_payment_method text,
  p_amount_received numeric
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role user_role;
  v_dispense_id uuid;
  v_receipt_id uuid;
  v_item jsonb;
  v_med_id uuid;
  v_qty int;
  v_price numeric;
  v_line numeric;
  v_meds_total numeric := 0;
  v_consult numeric := 0;
  v_tax_rate numeric := 0;
  v_tax numeric := 0;
  v_grand numeric := 0;
  v_change numeric := 0;
  v_current_stock int;
begin
  v_role := my_role();
  if v_role not in ('admin','dispenser') then
    raise exception 'not authorized to dispense';
  end if;

  select consultation_fee into v_consult from visits where id = p_visit_id;
  if v_consult is null then
    raise exception 'visit not found';
  end if;
  select coalesce(tax_rate,0) into v_tax_rate from settings where id = 1;

  -- create the dispense header
  insert into dispenses (visit_id, dispensed_by)
  values (p_visit_id, auth.uid())
  returning id into v_dispense_id;

  -- iterate items: validate stock, decrement, log movement, add line
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_med_id := (v_item->>'medicine_id')::uuid;
    v_qty    := (v_item->>'qty')::int;
    v_price  := (v_item->>'unit_price')::numeric;

    if v_qty is null or v_qty <= 0 then
      continue;
    end if;

    select stock_qty into v_current_stock from medicines where id = v_med_id for update;
    if v_current_stock is null then
      raise exception 'medicine % not found', v_med_id;
    end if;
    if v_current_stock < v_qty then
      raise exception 'insufficient stock for medicine %', v_med_id;
    end if;

    v_line := v_price * v_qty;
    v_meds_total := v_meds_total + v_line;

    update medicines set stock_qty = stock_qty - v_qty where id = v_med_id;

    insert into dispense_items (dispense_id, medicine_id, qty, unit_price, line_total)
    values (v_dispense_id, v_med_id, v_qty, v_price, v_line);

    insert into stock_movements (medicine_id, type, qty, reason, ref_id, created_by)
    values (v_med_id, 'out', v_qty, 'dispense', v_dispense_id, auth.uid());
  end loop;

  v_tax   := round((v_meds_total + v_consult) * v_tax_rate / 100.0, 2);
  v_grand := v_meds_total + v_consult + v_tax;
  v_change := coalesce(p_amount_received,0) - v_grand;

  insert into receipts (
    visit_id, dispense_id, consultation_fee, medicines_total, tax,
    grand_total, amount_received, change_due, payment_method, received_by
  ) values (
    p_visit_id, v_dispense_id, v_consult, v_meds_total, v_tax,
    v_grand, coalesce(p_amount_received,0), greatest(v_change,0), p_payment_method, auth.uid()
  ) returning id into v_receipt_id;

  update visits set status = 'dispensed' where id = p_visit_id;

  return v_receipt_id;
end;
$$;

-- restock helper (admin) — bumps stock and logs movement atomically
create or replace function restock_medicine(
  p_medicine_id uuid,
  p_qty int,
  p_reason text default 'restock'
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'not authorized';
  end if;
  update medicines set stock_qty = stock_qty + p_qty where id = p_medicine_id;
  insert into stock_movements (medicine_id, type, qty, reason, created_by)
  values (p_medicine_id, 'in', p_qty, p_reason, auth.uid());
end;
$$;

grant execute on function dispense_visit(uuid, jsonb, text, numeric) to authenticated;
grant execute on function restock_medicine(uuid, int, text) to authenticated;
grant execute on function my_role() to authenticated;
grant execute on function is_admin() to authenticated;
grant execute on function is_clinical() to authenticated;
