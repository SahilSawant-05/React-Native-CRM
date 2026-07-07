import React from "react";
import { useAuth } from "../auth/AuthContext";
import { useBadges } from "../state/BadgeContext";
import { usePushNotifications } from "./usePushNotifications";

interface Props {
  children: React.ReactNode;
}

// Register the background handler once at startup.
// Wrapped in try/catch — fails silently in Expo Go where native modules
// are not available, but works correctly in a dev-client or production build.
try {
  const { default: messaging } = require("@react-native-firebase/messaging");
  messaging().setBackgroundMessageHandler(async (_remoteMessage: any) => {
    // FCM displays background/quit notifications automatically — nothing to do
  });
} catch {
  // Firebase native module unavailable (Expo Go / web)
}

export default function PushNotificationProvider({ children }: Props) {
  const { user } = useAuth();
  const badges = useBadges();

  usePushNotifications({
    enabled: !!user,
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
