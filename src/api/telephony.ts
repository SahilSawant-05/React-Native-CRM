import { Linking } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import api from "./client";

// Per-agent, on-device preference for CRM calling. The tenant-wide toggle lives
// in the admin-only /api/telephony/config, so an agent can't change it. This
// lets an agent opt THEIR calls out of CRM calling (route to the phone dialer
// instead) without needing admin rights. Default = follow the tenant setting.
const AGENT_CRM_CALLING_KEY = "agent_crm_calling_enabled";
let agentPref: boolean | null = null; // in-memory cache; null = not loaded/unset

export async function getAgentCrmCallingPref(): Promise<boolean> {
  if (agentPref !== null) return agentPref;
  try {
    const v = await AsyncStorage.getItem(AGENT_CRM_CALLING_KEY);
    agentPref = v === null ? true : v === "1"; // default ON (follow tenant)
  } catch {
    agentPref = true;
  }
  return agentPref;
}

export async function setAgentCrmCallingPref(enabled: boolean): Promise<void> {
  agentPref = enabled;
  try {
    await AsyncStorage.setItem(AGENT_CRM_CALLING_KEY, enabled ? "1" : "0");
  } catch {
    /* best-effort */
  }
}

// Smart calling: when the telephony provider is active AND click-to-call is
// enabled (the toggles on the Calls → Telephony Settings screen / web CRM),
// calls are placed through the CRM (tracked, recorded, reported). When the
// toggle is off, we fall back to the phone's native dialer.

export interface TelephonyToggles {
  active: boolean;
  clickToCallEnabled: boolean;
}

export interface SmartCallResult {
  mode: "CRM" | "PHONE";
  status?: string;
  failureReason?: string;
}

let cachedToggles: TelephonyToggles | null = null;
let cachedAt = 0;
const CACHE_TTL_MS = 60_000;

export async function getTelephonyToggles(force = false): Promise<TelephonyToggles> {
  if (!force && cachedToggles && Date.now() - cachedAt < CACHE_TTL_MS) {
    return cachedToggles;
  }
  try {
    const res = await api.get("/api/telephony/config");
    cachedToggles = {
      active: Boolean(res.data?.active),
      clickToCallEnabled: Boolean(res.data?.clickToCallEnabled),
    };
  } catch {
    // No config / no permission → behave like telephony is off (native dial).
    cachedToggles = { active: false, clickToCallEnabled: false };
  }
  cachedAt = Date.now();
  return cachedToggles;
}

// Call after saving telephony settings so the next call re-reads the toggles.
export function invalidateTelephonyToggles() {
  cachedToggles = null;
  cachedAt = 0;
}

export function isCrmCallingOn(t: TelephonyToggles): boolean {
  return t.active && t.clickToCallEnabled;
}

// Place a call the "right" way based on the toggle:
//  • CRM ON  → POST click-to-call (provider bridges agent ↔ customer).
//              If the CRM call fails to start, we fall back to native dial
//              so the user is never left unable to call.
//  • CRM OFF → open the phone's native dialer.
export async function smartCall(opts: {
  contactId?: number | string | null;
  phone?: string | null;
  notes?: string | null;
}): Promise<SmartCallResult> {
  const toggles = await getTelephonyToggles();
  const agentWantsCrm = await getAgentCrmCallingPref();

  // CRM calling only when the tenant has it on AND this agent hasn't opted out.
  if (isCrmCallingOn(toggles) && agentWantsCrm) {
    try {
      const res = await api.post("/api/telephony/calls/click-to-call", {
        contactId: opts.contactId != null && opts.contactId !== "" ? Number(opts.contactId) : null,
        customerNumber: opts.phone || null,
        agentNumber: null, // uses the logged-in user's agent mapping
        notes: opts.notes || null,
      });
      const result = res.data || {};
      if (String(result.status || "").toUpperCase() === "FAILED") {
        // CRM refused (e.g. no agent mapping) — fall back to the dialer.
        if (opts.phone) await Linking.openURL(`tel:${opts.phone}`);
        return { mode: "PHONE", failureReason: result.failureReason || "CRM call failed" };
      }
      return { mode: "CRM", status: result.status || "REQUESTED" };
    } catch (err: any) {
      if (opts.phone) await Linking.openURL(`tel:${opts.phone}`);
      return {
        mode: "PHONE",
        failureReason:
          err?.response?.data?.message || err?.message || "CRM call failed",
      };
    }
  }

  if (opts.phone) await Linking.openURL(`tel:${opts.phone}`);
  return { mode: "PHONE" };
}
