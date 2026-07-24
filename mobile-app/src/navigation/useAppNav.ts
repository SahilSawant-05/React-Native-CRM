import { useContext } from "react";
import { DrawerCtx } from "./AdminDrawer";
import { AgentDrawerCtx, PendingChat } from "./AgentDrawer";

/**
 * Screens shared by AdminDrawer and AgentDrawer can't know which one wraps
 * them. This hook returns the navigation helpers of whichever drawer is
 * actually active (the real provider omits `isDefault`), so `navigateTo` /
 * `openChat` work on both the admin and agent side. Falls back gracefully so
 * it never crashes even if a drawer is missing a helper.
 */
export function useAppNav() {
  const adminDrawer = useContext(DrawerCtx);
  const agentDrawer = useContext(AgentDrawerCtx);
  const active = agentDrawer?.isDefault ? adminDrawer : agentDrawer;
  const fallback = active === agentDrawer ? adminDrawer : agentDrawer;
  const noop = () => {};
  return {
    navigateTo: active?.navigateTo || fallback?.navigateTo || noop,
    openChat: active?.openChat || fallback?.openChat || noop,
  };
}

/**
 * Maps a web-style targetPath (e.g. "/dashboard/mail",
 * "/dashboard/opportunities/12") — or a notification/work-item type/text — to
 * a mobile drawer tab name. Returns null when nothing sensible matches.
 */
export function tabForTarget(input?: string | null): string | null {
  const p = String(input || "").toLowerCase();
  if (!p) return null;
  if (p.includes("mail") || p.includes("email")) return "Mail";
  if (p.includes("chat") || p.includes("message") || p.includes("inbox")) return "Chat";
  if (p.includes("task") || p.includes("todo") || p.includes("queue")) return "Tasks";
  if (p.includes("appointment") || p.includes("calendar") || p.includes("event")) return "Calendar";
  if (p.includes("opportunit") || p.includes("pipeline") || p.includes("deal")) return "Pipeline";
  if (p.includes("contact") || p.includes("lead")) return "Contacts";
  return null;
}

export type { PendingChat };
