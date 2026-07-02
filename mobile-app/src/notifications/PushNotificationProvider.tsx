import React from "react";
import * as Notifications from "expo-notifications";
import { useAuth } from "../auth/AuthContext";
import { usePushNotifications } from "./usePushNotifications";

interface Props {
  children: React.ReactNode;
}

/**
 * Place this inside AuthProvider so it can read the logged-in user.
 * Registers the device push token when the user is authenticated and
 * tears it down (removes listeners) on logout.
 */
export default function PushNotificationProvider({ children }: Props) {
  const { user } = useAuth();

  usePushNotifications({
    enabled: !!user,
    onNotificationTapped: (notification: Notifications.Notification) => {
      // Extract any routing data the backend embeds in the notification payload
      const data = notification.request.content.data as Record<string, any> | undefined;

      // Future: use a navigation ref here to route to the relevant screen.
      // e.g. data?.screen === "Chat" → navigate to ChatInbox
      // For now the notification tap simply brings the app to the foreground,
      // which is the correct default behaviour.
      void data;
    },
  });

  return <>{children}</>;
}
