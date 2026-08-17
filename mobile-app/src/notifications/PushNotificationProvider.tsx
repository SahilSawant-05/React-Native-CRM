import React from "react";
import { useAuth } from "../auth/AuthContext";
import { useBadges } from "../state/BadgeContext";
import { usePushNotifications } from "./usePushNotifications";
import { tabForTarget } from "../navigation/useAppNav";
import { setPendingNavigation } from "../state/pendingNavigation";

interface Props {
  children: React.ReactNode;
}

// Turn a tapped FCM message into a drawer navigation intent. Uses the same
// target→tab mapping as the in-app notifications list. Chat/message pushes open
// the conversation directly when a contact id is present in the data payload.
function routeTappedNotification(remoteMessage: any) {
  const data = remoteMessage?.data ?? {};
  const structured = [data.type, data.targetType, data.targetPath, data.screen, data.category]
    .filter(Boolean)
    .join(" ");
  const text = [remoteMessage?.notification?.title, remoteMessage?.notification?.body, data.title, data.body]
    .filter(Boolean)
    .join(" ");
  const tab = tabForTarget(structured) || tabForTarget(text);
  if (!tab) return;
  const contactId = data.contactId ?? data.conversationId ?? data.chatId ?? data.fromContactId ?? data.senderId;
  if (tab === "Chat" && contactId != null && contactId !== "") {
    setPendingNavigation({
      tab: "Chat",
      chat: {
        contactId,
        contactName: data.contactName || data.title || remoteMessage?.notification?.title || "Chat",
        contactPhone: data.contactPhone || data.phone || undefined,
      },
    });
    return;
  }
  setPendingNavigation({ tab });
}

// NOTE: the FCM background/quit message handler is registered in index.js
// (the JS entry point) — RNFirebase requires it there for the killed-app
// case. Keeping it out of this component avoids a duplicate registration.

export default function PushNotificationProvider({ children }: Props) {
  const { user } = useAuth();
  const badges = useBadges();

  usePushNotifications({
    enabled: !!user,
    userId: user?.id ?? null,
    onMessageReceived: () => {
      // New chat/mail arrived while app is open — update tab badges
      badges.refresh();
    },
    onNotificationTapped: (remoteMessage) => {
      badges.refresh();
      // Route to the screen the notification belongs to. The active drawer
      // consumes this intent (see AdminDrawer/AgentDrawer).
      routeTappedNotification(remoteMessage);
    },
  });

  return <>{children}</>;
}
