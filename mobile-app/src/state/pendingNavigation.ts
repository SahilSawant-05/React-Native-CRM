// A tiny cross-tree store for "a notification was tapped, go to this screen".
// The FCM tap handler (PushNotificationProvider) lives ABOVE the drawers, so it
// can't call the drawer's navigate/openChat directly. It writes an intent here;
// the active drawer (Admin/Agent) consumes it and performs the navigation.

export interface PendingChatTarget {
  contactId: string | number;
  contactName: string;
  contactPhone?: string;
}

export interface NavIntent {
  /** Drawer tab name to open, e.g. "Chat", "Tasks", "Mail". */
  tab?: string | null;
  /** When the notification is a chat/message, open this conversation directly. */
  chat?: PendingChatTarget | null;
}

let pending: NavIntent | null = null;
const listeners = new Set<(intent: NavIntent) => void>();

// Record a navigation intent (from a tapped notification) and notify any
// mounted drawer listening for it.
export function setPendingNavigation(intent: NavIntent): void {
  pending = intent;
  listeners.forEach((l) => l(intent));
}

// Read AND clear the pending intent (used on drawer mount for cold-start taps
// where the app was launched from a killed state by the notification).
export function consumePendingNavigation(): NavIntent | null {
  const p = pending;
  pending = null;
  return p;
}

export function subscribePendingNavigation(fn: (intent: NavIntent) => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
