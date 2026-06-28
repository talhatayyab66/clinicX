-- =====================================================================
-- Let dispensers register patients and open visits (vitals + complaint).
-- Doctors then complete/prescribe/discharge those visits as before.
-- Run this in the Supabase SQL editor AFTER 0001_init.sql.
-- =====================================================================

-- patients: dispenser may read all + register new patients
create policy patients_disp_read_all on patients for select
  using (my_role() = 'dispenser');
create policy patients_disp_insert on patients for insert
  with check (my_role() = 'dispenser');

-- visits: dispenser may create an OPEN visit, read it, and edit it
-- while it is still open (intended for vitals + complaint only; the UI
-- limits which fields are shown).
create policy visits_disp_insert on visits for insert
  with check (my_role() = 'dispenser' and status = 'open');
create policy visits_disp_read_open on visits for select
  using (my_role() = 'dispenser');
create policy visits_disp_update_open on visits for update
  using (my_role() = 'dispenser' and status = 'open')
  with check (my_role() = 'dispenser' and status = 'open');
