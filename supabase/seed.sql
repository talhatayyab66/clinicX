-- Optional sample medicines to get started quickly.
-- Run AFTER 0001_init.sql and after the first admin has been created via /setup.
insert into medicines (name, generic_name, form, strength, price, stock_qty, batch_no, expiry_date, reorder_level)
values
  ('Paracetamol', 'Acetaminophen', 'tablet', '500mg', 0.10, 500, 'B-PARA-01', current_date + interval '18 months', 50),
  ('Amoxicillin', 'Amoxicillin', 'capsule', '250mg', 0.25, 300, 'B-AMOX-01', current_date + interval '12 months', 40),
  ('Ibuprofen', 'Ibuprofen', 'tablet', '400mg', 0.15, 200, 'B-IBU-01', current_date + interval '20 months', 30),
  ('ORS Sachet', 'Oral Rehydration Salts', 'sachet', '20.5g', 0.30, 150, 'B-ORS-01', current_date + interval '24 months', 25),
  ('Cetirizine', 'Cetirizine', 'tablet', '10mg', 0.08, 120, 'B-CET-01', current_date + interval '15 months', 30),
  ('Amoxicillin Syrup', 'Amoxicillin', 'syrup', '125mg/5ml', 1.80, 40, 'B-AMS-01', current_date + interval '8 months', 10),
  ('Metformin', 'Metformin', 'tablet', '500mg', 0.12, 8, 'B-MET-01', current_date + interval '14 months', 20)
on conflict do nothing;
