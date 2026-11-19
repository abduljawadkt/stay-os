// StayOS plans. Prices are per hostel per month in rupees, before 18% GST.
// The same amounts are in public.checkout_plan() in db/schema.sql.
export type PlanId = "starter" | "growth" | "scale";
export interface PlanDef {
  id: PlanId;
  monthly: number;
  beds: number;
  staff: number | null;
  features: string[];
  popular?: boolean;
}

export const GST_RATE = 0.18;
export const TRIAL_DAYS = 14;

export const PLANS: PlanDef[] = [
  { id: "starter", monthly: 1999, beds: 60, staff: 2, features: ["rent", "whatsapp", "rooms", "residents", "residentApp"] },
  { id: "growth", monthly: 4999, beds: 300, staff: 10, popular: true, features: ["rent", "whatsapp", "rooms", "residents", "residentApp", "mess", "gate", "parentApp", "complaints", "reports"] },
  { id: "scale", monthly: 9999, beds: 1000, staff: null, features: ["rent", "whatsapp", "rooms", "residents", "residentApp", "mess", "gate", "parentApp", "complaints", "reports", "ai", "multi", "priority"] },
];

export const planById = (id: string) => PLANS.find((p) => p.id === id) ?? PLANS[1];

/** Yearly billing is ten months' price: two months free. */
export function price(plan: PlanDef, cycle: "monthly" | "yearly") {
  const amount = cycle === "yearly" ? plan.monthly * 10 : plan.monthly;
  const gst = Math.round(amount * GST_RATE);
  return { amount, gst, total: amount + gst, perMonth: cycle === "yearly" ? Math.round(amount / 12) : amount };
}
