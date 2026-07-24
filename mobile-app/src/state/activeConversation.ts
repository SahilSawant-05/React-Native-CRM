// Single source of truth for "which conversation is open on screen right now".
// Read by both notification paths so a message arriving in the currently-open
// chat never raises a notification (WhatsApp behaviour):
//   - BadgeContext's poll-based local notification
//   - usePushNotifications' foreground FCM banner
// Set by ChatConversationScreen on focus, cleared on blur.

let activeConversationId: string | number | null = null;

export function setActiveConversationId(id: string | number | null): void {
  activeConversationId = id;
}

export function getActiveConversationId(): string | number | null {
  return activeConversationId;
}

// True when the given contact/conversation id is the one currently on screen.
export function isActiveConversation(id: unknown): boolean {
  if (activeConversationId == null || id == null || id === "") return false;
  return String(activeConversationId) === String(id);
}
