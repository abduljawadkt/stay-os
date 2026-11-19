"use client";

import { create } from "zustand";
import { neon, neonConfigured, errorText } from "./neon";
import { loadOrg, startSync, stopSync, clearOrgData } from "./sync";
import type { Role } from "./store";

export type MemberRole = Role;
export type Plan = "starter" | "growth" | "scale";

export interface Membership {
  orgId: string;
  role: MemberRole;
  residentId: string | null;
  orgName: string;
  city: string;
  plan: Plan;
  subscriptionStatus: "trialing" | "active" | "past_due" | "canceled";
  trialEndsAt: string | null;
  isDemo: boolean;
}

export interface OrgRow {
  id: string;
  name: string;
  city: string;
  address: string;
  phone: string;
  whatsapp: string;
  upi_id: string;
  bank: string;
  owner_name: string;
  owner_phone: string;
  rent_by_type: Record<string, number>;
  mess_fee: number;
  deposit: number;
  due_day: number;
  settings: {
    clock?: { mode: "demo" | "real"; now?: string };
    months?: string[];
    blocks?: { id: string; name: string; gender: "M" | "F"; floors: number; wardenId?: string; curfew: string }[];
    wardenId?: string;
    mess?: Record<string, unknown>;
    reset_at?: string;
  };
  plan: Plan;
  billing_cycle: "monthly" | "yearly";
  subscription_status: Membership["subscriptionStatus"];
  trial_ends_at: string | null;
  current_period_end: string | null;
  is_demo: boolean;
  created_at: string;
}

export interface SessionUser {
  id: string;
  name: string;
  email: string;
}

type AuthStatus = "loading" | "signed_out" | "signed_in" | "unconfigured";
type OrgStatus = "none" | "loading" | "ready" | "error";

interface SessionState {
  auth: AuthStatus;
  user: SessionUser | null;
  memberships: Membership[] | null;
  orgStatus: OrgStatus;
  orgError: string | null;
  orgId: string | null;
  org: OrgRow | null;
  membership: Membership | null;
  saving: "idle" | "saving" | "saved" | "error";
}

const ORG_KEY = "stayos-org";

export const DEMO_PASSWORD = "stayos-demo-2026";
export const DEMO_ACCOUNTS: { role: MemberRole; email: string }[] = [
  { role: "owner", email: "owner@demo.stayos.app" },
  { role: "warden", email: "warden@demo.stayos.app" },
  { role: "resident", email: "anjali@demo.stayos.app" },
  { role: "parent", email: "parent@demo.stayos.app" },
];

export const useSession = create<SessionState>()(() => ({
  auth: neonConfigured ? "loading" : "unconfigured",
  user: null,
  memberships: null,
  orgStatus: "none",
  orgError: null,
  orgId: null,
  org: null,
  membership: null,
  saving: "idle",
}));

const set = useSession.setState;
const get = useSession.getState;

function mapMembership(r: Record<string, unknown>): Membership {
  return {
    orgId: r.org_id as string, role: r.role as MemberRole, residentId: (r.resident_id as string) ?? null, orgName: r.org_name as string,
    city: r.city as string, plan: r.plan as Plan, subscriptionStatus: r.subscription_status as Membership["subscriptionStatus"],
    trialEndsAt: (r.trial_ends_at as string) ?? null, isDemo: !!r.is_demo,
  };
}

async function fetchMemberships(): Promise<Membership[]> {
  // The first Data API call on a waking database can run before the token is applied; one retry covers it.
  for (let attempt = 0; attempt < 2; attempt++) {
    const { data, error } = await neon().rpc("my_memberships");
    if (error) throw error;
    const list = ((data ?? []) as Record<string, unknown>[]).map(mapMembership);
    if (list.length || attempt === 1) return list;
    await new Promise((r) => setTimeout(r, 600));
  }
  return [];
}

let booting: Promise<void> | null = null;

/** Find out who is signed in and which hostels they belong to. Safe to call many times. */
export function boot(): Promise<void> {
  if (!neonConfigured) return Promise.resolve();
  if (!booting) {
    booting = (async () => {
      try {
        const { data } = await neon().auth.getSession();
        const u = data?.user as { id: string; name?: string; email: string } | undefined;
        if (!u) {
          set({ auth: "signed_out", user: null, memberships: null });
          return;
        }
        set({ auth: "signed_in", user: { id: u.id, name: u.name ?? "", email: u.email } });
        set({ memberships: await fetchMemberships() });
      } catch {
        set({ auth: "signed_out", user: null, memberships: null });
      }
    })();
  }
  return booting;
}

export async function refreshMemberships() {
  const list = await fetchMemberships();
  set({ memberships: list, membership: list.find((m) => m.orgId === get().orgId) ?? get().membership });
  return list;
}

export async function signIn(email: string, password: string) {
  const { data, error } = await neon().auth.signIn.email({ email: email.trim(), password });
  if (error) throw new Error(errorText(error));
  const u = data?.user as { id: string; name?: string; email: string } | undefined;
  if (!u) throw new Error("Could not sign in");
  booting = Promise.resolve();
  set({ auth: "signed_in", user: { id: u.id, name: u.name ?? "", email: u.email }, memberships: null, orgStatus: "none", orgId: null, org: null });
  set({ memberships: await fetchMemberships() });
}

export async function signUp(name: string, email: string, password: string) {
  const { data, error } = await neon().auth.signUp.email({ name: name.trim(), email: email.trim(), password });
  if (error) throw new Error(errorText(error));
  const u = data?.user as { id: string; name?: string; email: string } | undefined;
  if (!u) throw new Error("Could not create the account");
  booting = Promise.resolve();
  set({ auth: "signed_in", user: { id: u.id, name: u.name ?? name, email: u.email }, memberships: [], orgStatus: "none", orgId: null, org: null });
}

export async function signOut() {
  stopSync();
  try {
    await neon().auth.signOut();
  } catch {}
  clearOrgData();
  try {
    localStorage.removeItem(ORG_KEY);
  } catch {}
  booting = Promise.resolve();
  set({ auth: "signed_out", user: null, memberships: null, orgStatus: "none", orgId: null, org: null, membership: null });
}

/** The hostel to open: the last one used, else the user's own, else the shared demo. */
export function pickOrg(list: Membership[]): Membership | null {
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(ORG_KEY);
  } catch {}
  return list.find((m) => m.orgId === saved) ?? list.find((m) => !m.isDemo) ?? list[0] ?? null;
}

let loadingOrg: Promise<void> | null = null;

/** Load a hostel's data into the app and keep it in sync. */
export function openOrg(orgId: string, opts: { force?: boolean } = {}): Promise<void> {
  const s = get();
  if (!opts.force && s.orgId === orgId && (s.orgStatus === "ready" || s.orgStatus === "loading") && loadingOrg) return loadingOrg;
  const membership = s.memberships?.find((m) => m.orgId === orgId) ?? null;
  if (!membership) return Promise.reject(new Error("You are not a member of that hostel"));
  stopSync();
  set({ orgId, membership, orgStatus: "loading", orgError: null });
  loadingOrg = (async () => {
    try {
      const org = await loadOrg(orgId, membership);
      if (get().orgId !== orgId) return;
      set({ org, orgStatus: "ready" });
      try {
        localStorage.setItem(ORG_KEY, orgId);
      } catch {}
      startSync(orgId);
    } catch (e) {
      console.error("[openOrg]", e);
      if (get().orgId === orgId) set({ orgStatus: "error", orgError: errorText(e) });
    }
  })();
  return loadingOrg;
}

export async function createOrg(input: { name: string; city: string; sample: boolean; blocks?: number; floors?: number }) {
  const { data, error } = await neon().rpc("create_org", {
    p_name: input.name, p_city: input.city, p_sample: input.sample, p_blocks: input.blocks ?? 2, p_floors: input.floors ?? 3,
  });
  if (error) throw new Error(errorText(error));
  await refreshMemberships();
  return data as string;
}

export async function acceptInvite(code: string) {
  const { data, error } = await neon().rpc("accept_invite", { p_code: code });
  if (error) throw new Error(errorText(error));
  await refreshMemberships();
  return data as string;
}

export async function refreshOrgRow() {
  const id = get().orgId;
  if (!id) return;
  const { data, error } = await neon().from("orgs").select("*").eq("id", id).single();
  if (!error && data) set({ org: data as OrgRow });
}

/** Views a member may switch to. Staff can preview the resident and parent apps. */
export function allowedViews(role: MemberRole | undefined): MemberRole[] {
  if (role === "owner") return ["owner", "warden", "resident", "parent"];
  if (role === "warden") return ["warden", "resident", "parent"];
  if (role === "resident") return ["resident"];
  if (role === "parent") return ["parent"];
  return [];
}

export const isStaffRole = (r: MemberRole | undefined) => r === "owner" || r === "warden";
