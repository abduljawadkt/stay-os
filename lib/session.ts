"use client";

import { create } from "zustand";
import { neon, neonConfigured, errorText, asError } from "./neon";
import { loadOrg, startSync, stopSync, clearOrgData, withIdentity } from "./sync";
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
  { role: "owner", email: "owner@demo.stayos.space" },
  { role: "warden", email: "warden@demo.stayos.space" },
  { role: "resident", email: "anjali@demo.stayos.space" },
  { role: "parent", email: "parent@demo.stayos.space" },
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
  return withIdentity(async () => {
    const { data, error } = await neon().rpc("my_memberships");
    if (error) throw asError(error);
    return ((data ?? []) as Record<string, unknown>[]).map(mapMembership);
  });
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
        try {
          set({ memberships: await fetchMemberships() });
        } catch (e) {
          set({ orgStatus: "error", orgError: errorText(e) });
        }
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

/** Thrown when an account exists but its email hasn't been confirmed with the emailed code yet. */
export class EmailNotVerified extends Error {
  constructor(public email: string) {
    super("Confirm your email to continue");
  }
}

// Better Auth client methods from the email-OTP plugin, which the Neon SDK types loosely.
type AuthExtras = {
  emailOtp: {
    verifyEmail: (a: { email: string; otp: string }) => Promise<{ data: unknown; error: unknown }>;
    sendVerificationOtp: (a: { email: string; type: "email-verification" | "sign-in" | "forget-password" }) => Promise<{ error: unknown }>;
    resetPassword: (a: { email: string; otp: string; password: string }) => Promise<{ error: unknown }>;
  };
  forgetPassword: { emailOtp: (a: { email: string }) => Promise<{ error: unknown }> };
  changePassword: (a: { currentPassword: string; newPassword: string; revokeOtherSessions?: boolean }) => Promise<{ error: unknown }>;
};
const authx = () => neon().auth as unknown as AuthExtras;
const codeOf = (e: unknown) => (e as { code?: string; error?: { code?: string } })?.code ?? (e as { error?: { code?: string } })?.error?.code ?? "";

export async function signIn(email: string, password: string) {
  const { data, error } = await neon().auth.signIn.email({ email: email.trim(), password });
  if (error) {
    if (/EMAIL_NOT_VERIFIED/i.test(codeOf(error)) || /not verified/i.test(errorText(error))) throw new EmailNotVerified(email.trim());
    throw new Error(errorText(error));
  }
  const u = data?.user as { id: string; name?: string; email: string } | undefined;
  if (!u) throw new Error("Could not sign in");
  booting = Promise.resolve();
  set({ auth: "signed_in", user: { id: u.id, name: u.name ?? "", email: u.email }, memberships: null, orgStatus: "none", orgId: null, org: null });
  set({ memberships: await fetchMemberships() });
}

/** Create an account. Returns "verify" when the emailed code must be entered before signing in. */
export async function signUp(name: string, email: string, password: string): Promise<"signed_in" | "verify"> {
  const { data, error } = await neon().auth.signUp.email({ name: name.trim(), email: email.trim(), password });
  if (error) throw new Error(errorText(error));
  const u = data?.user as { id: string; name?: string; email: string } | undefined;
  if (!u) throw new Error("Could not create the account");
  const signedIn = !!(data as { token?: string | null })?.token;
  if (!signedIn) return "verify";
  booting = Promise.resolve();
  set({ auth: "signed_in", user: { id: u.id, name: u.name ?? name, email: u.email }, memberships: [], orgStatus: "none", orgId: null, org: null });
  return "signed_in";
}

/** Confirm an email with the 6-digit code, then sign in (with the password when we have it). */
export async function verifyEmail(email: string, otp: string, password?: string) {
  const { error } = await authx().emailOtp.verifyEmail({ email: email.trim(), otp: otp.trim() });
  if (error) throw new Error(errorText(error));
  booting = null;
  if (password) await signIn(email, password);
  else await boot();
}

export async function resendVerification(email: string) {
  const { error } = await authx().emailOtp.sendVerificationOtp({ email: email.trim(), type: "email-verification" });
  if (error) throw new Error(errorText(error));
}

/** Forgot password, step 1: email a reset code. */
export async function requestPasswordReset(email: string) {
  const { error } = await authx().forgetPassword.emailOtp({ email: email.trim() });
  if (error) throw new Error(errorText(error));
}

/** Forgot password, step 2: set the new password with the code, then sign in. */
export async function resetPassword(email: string, otp: string, password: string) {
  const { error } = await authx().emailOtp.resetPassword({ email: email.trim(), otp: otp.trim(), password });
  if (error) throw new Error(errorText(error));
  await signIn(email, password);
}

/** Signed in: change the password and sign out every other device. */
export async function changePassword(currentPassword: string, newPassword: string) {
  const { error } = await authx().changePassword({ currentPassword, newPassword, revokeOtherSessions: true });
  if (error) throw new Error(errorText(error));
}

export async function signOut() {
  stopSync();
  try {
    await neon().auth.signOut();
  } catch {}
  clearOrgData();
  try {
    localStorage.removeItem(ORG_KEY);
    sessionStorage.removeItem("stayos-view");
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
