export type UserRole = "admin" | "doctor" | "dispenser";
export type VisitStatus = "open" | "discharged" | "dispensed" | "cancelled";
export type Frequency = "OD" | "BD" | "TDS" | "QID" | "HS" | "STAT" | "SOS";

export interface Profile {
  id: string;
  username: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
}

export interface Settings {
  id: number;
  clinic_name: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  currency: string;
  currency_symbol: string;
  region: string;
  tax_rate: number;
  logo_url: string | null;
  receipt_footer: string | null;
}

export interface Patient {
  id: string;
  patient_no: number;
  name: string;
  age: number | null;
  gender: string | null;
  phone: string | null;
  weight: number | null;
  allergies: string | null;
  address: string | null;
  created_by: string | null;
  created_at: string;
}

export interface Medicine {
  id: string;
  name: string;
  generic_name: string | null;
  form: string | null;
  strength: string | null;
  price: number;
  stock_qty: number;
  batch_no: string | null;
  expiry_date: string | null;
  reorder_level: number;
  is_active: boolean;
  created_at: string;
}

export interface Vitals {
  bp?: string;
  pulse?: string;
  temp?: string;
  spo2?: string;
}

export interface Visit {
  id: string;
  patient_id: string;
  doctor_id: string | null;
  visit_date: string;
  complaint: string | null;
  diagnosis: string | null;
  comorbidities: string | null;
  vitals: Vitals | null;
  consultation_fee: number;
  notes: string | null;
  status: VisitStatus;
}

export interface Prescription {
  id: string;
  visit_id: string;
  medicine_id: string | null;
  dose: string | null;
  freq: Frequency;
  route: string | null;
  duration_days: number | null;
  before_after_food: string | null;
  qty_calculated: number | null;
  instructions: string | null;
}

export interface Receipt {
  id: string;
  receipt_no: number;
  visit_id: string;
  dispense_id: string;
  consultation_fee: number;
  medicines_total: number;
  tax: number;
  grand_total: number;
  amount_received: number;
  change_due: number;
  payment_method: string | null;
  received_by: string | null;
  created_at: string;
}

export interface Expense {
  id: string;
  category: string | null;
  description: string | null;
  amount: number;
  expense_date: string;
  created_by: string | null;
  created_at: string;
}

// Frequency -> doses per day (see spec §4)
export const FREQ_DOSES: Record<Frequency, number> = {
  OD: 1,
  BD: 2,
  TDS: 3,
  QID: 4,
  HS: 1,
  STAT: 1,
  SOS: 0,
};

export function calcQty(freq: Frequency, durationDays: number | null): number {
  const doses = FREQ_DOSES[freq] ?? 0;
  if (freq === "STAT") return 1; // one-time, ignore duration
  if (freq === "SOS") return 0; // manual / as-needed
  return doses * (durationDays ?? 0);
}
