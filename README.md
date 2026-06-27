# ClinicX

A responsive (mobile + desktop) clinic management app with **role-based access**, built per the build spec.

**Stack:** Next.js (App Router) · Supabase (Postgres + Auth + Storage) · Tailwind CSS · deployable on Vercel.

---

## Roles

| Role | Sees | Can do |
|---|---|---|
| **admin** (also a doctor) | Everything | All doctor actions **+** create/manage users, settings, reports, expenses |
| **doctor** | Patient flow + visits | Register/search patients, record visits, prescribe, discharge |
| **dispenser** | Discharge queue only | View discharged slips, dispense (auto-decrements stock), record payment, print receipt |

Access is enforced by **Postgres Row-Level Security** (see `supabase/migrations/0001_init.sql`), not just hidden UI. A dispenser is *technically unable* to read expenses or reports.

---

## Auth model — username login

Supabase Auth is email/password only, so usernames are mapped to a synthetic email:
`${username}@${CLINIC_DOMAIN}` (e.g. `drahmed@clinic.local`). The user only ever sees their username.

- **Login:** the frontend appends `@CLINIC_DOMAIN` and calls `signInWithPassword`.
- **Account creation:** goes through the protected server route `POST /api/admin/create-user`, which runs server-side only, uses the `SUPABASE_SERVICE_ROLE_KEY`, and verifies the caller is an `admin` first.

---

## Getting started

### 1. Create a Supabase project
Grab the project URL, anon key and service-role key from **Project Settings → API**.

### 2. Run the schema
In the Supabase SQL editor (or via the CLI), run:
```
supabase/migrations/0001_init.sql      # schema, helpers, RLS, dispensing RPC
supabase/seed.sql                      # OPTIONAL — a few sample medicines
```

### 3. Environment variables
Copy `.env.example` → `.env.local` and fill in:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=        # server-only, never NEXT_PUBLIC
CLINIC_DOMAIN=clinic.local        # used by the server to build synthetic emails
NEXT_PUBLIC_CLINIC_DOMAIN=clinic.local   # used by the login form
```

### 4. Install & run
```bash
npm install
npm run dev
```

### 5. Bootstrap the first admin
Open **`/setup`** once. It creates:
1. the first auth user,
2. a `profiles` row with `role = 'admin'`,
3. the `settings` singleton (id = 1).

`/setup` **self-disables** as soon as any profile exists. After that, the admin creates all
other accounts from **Users** inside the app.

---

## Key flows

- **Patients** — register, search by name / phone / patient #, view history.
- **Visit** — vitals (BP/pulse/temp/SpO₂), complaint, diagnosis, comorbidities, consultation fee,
  and a prescription table. Quantity auto-calculates from frequency × duration (`§4` of the spec)
  and the doctor can override it. **Save & discharge** moves the visit to the dispensing queue.
- **Discharge queue (dispenser)** — open a discharged slip, adjust quantities, take payment.
  Dispensing runs through the `dispense_visit()` Postgres RPC which, in **one transaction**:
  creates the dispense, decrements stock (never below zero), writes `stock_movements`, and
  creates a sequential **receipt**. Then prints.
- **Inventory** — medicines CRUD, restock (atomic `restock_medicine()` RPC), batch/expiry,
  reorder + near-expiry alerts. Admin writes; doctor reads.
- **Reports** — income vs expense, top medicines, top diagnoses, low stock — date-ranged,
  with **Export PDF** (print) and **Export Excel** (CSV). Doctors see a reduced view (no expenses).
- **Settings** — clinic info, currency + symbol, region/locale (drives date & number formatting),
  tax rate, logo, receipt footer.

## Printing

- **Prescription / discharge slip** — A4, clinic header, patient details, drug table
  (drug · dose · freq · duration · route · food · qty). Route: `/visits/[id]/slip`.
- **Receipt** — 80mm thermal-friendly layout (prints fine on A4 too), itemized with consultation,
  each medicine, tax, total, received, change. Sequential `receipt_no`, reprintable at
  `/receipts/[id]`.

## Quantity auto-calculation (spec §4)

| Freq | Doses/day |
|---|---|
| OD | 1 |
| BD | 2 |
| TDS | 3 |
| QID | 4 |
| HS | 1 |
| STAT | 1 (one-time, ignores duration) |
| SOS | manual |

`qty = doses_per_day × duration_days`, overridable by the doctor.

---

## Deploy to Vercel

1. Push this repo to GitHub and import it in Vercel.
2. Add the four environment variables above (keep `SUPABASE_SERVICE_ROLE_KEY` un-prefixed so it
   stays server-only).
3. Deploy, then hit `/setup` once on the live URL.

---

## Security notes

- The service-role key is only ever used in server routes (`/api/setup`, `/api/admin/create-user`)
  and is never exposed to the browser.
- RLS is the real access-control boundary; the UI gating and `middleware.ts` are convenience layers.
- Deactivated users are signed out on their next request (`(app)/layout.tsx`).

## Project layout

```
src/
  app/
    (app)/            # authenticated shell (dashboard, patients, visits, inventory,
                      # dispense, expenses, reports, users, settings, receipts)
    api/
      admin/create-user/route.ts   # protected admin-only user creation
      setup/route.ts               # first-admin bootstrap (self-disabling)
    login/  setup/                 # public pages
  components/         # Nav, print + sign-out helpers
  lib/
    supabase/         # browser / server / admin clients
    auth.ts  types.ts  format.ts
  middleware.ts       # session refresh + auth redirects
supabase/
  migrations/0001_init.sql   # schema + RLS + RPCs
  seed.sql                   # optional sample data
```
