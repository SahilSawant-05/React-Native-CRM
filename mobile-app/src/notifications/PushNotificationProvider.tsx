import React, { useEffect } from "react";
import messaging from "@react-native-firebase/messaging";
import { useAuth } from "../auth/AuthContext";
import { usePushNotifications } from "./usePushNotifications";

interface Props {
  children: React.ReactNode;
}

// Register a background handler at module level (outside any component).
// FCM requires this to be set before the app renders.
messaging().setBackgroundMessageHandler(async (_remoteMessage) => {
  // Background/quit messages are displayed as system notifications by FCM
  // automatically — no extra work needed here.
});

export default function PushNotificationProvider({ children }: Props) {
  const { user } = useAuth();

  usePushNotifications({
    enabled: !!user,
    onNotificationTapped: (remoteMessage) => {
      // remoteMessage.data?.screen tells you where to navigate, e.g.:
      //   { screen: "Chat", contactId: "42" }
      // Wire up a navigation ref here once one is exposed.
      void remoteMessage;
    },
  });

  return <>{children}</>;
}
