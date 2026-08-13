import React from "react";
import { useAuth } from "../auth/AuthContext";
import { useBadges } from "../state/BadgeContext";
import { usePushNotifications } from "./usePushNotifications";

interface Props {
  children: React.ReactNode;
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
    onNotificationTapped: (_remoteMessage) => {
      badges.refresh();
      // Use remoteMessage.data?.screen to navigate when a nav ref is wired up
    },
  });

  return <>{children}</>;
}
