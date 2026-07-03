import React from "react";
import { Alert } from "react-native";
import * as Notifications from "expo-notifications";
import { useAuth } from "../auth/AuthContext";
import { usePushNotifications } from "./usePushNotifications";

interface Props {
  children: React.ReactNode;
}

/**
 * Sits inside AuthProvider so it can read the logged-in user.
 * Registers the FCM device token when the user is authenticated,
 * tears down listeners on logout, and handles notification taps.
 */
export default function PushNotificationProvider({ children }: Props) {
  const { user } = useAuth();

  usePushNotifications({
    enabled: !!user,
    onNotificationTapped: (notification: Notifications.Notification) => {
      const data = notification.request.content.data as Record<string, any> | undefined;
      const title = notification.request.content.title ?? "Notification";
      const body = notification.request.content.body ?? "";

      // Route to the right screen based on the "screen" field your backend
      // embeds in the FCM data payload, e.g.:
      //   { screen: "Chat", contactId: "123" }
      //   { screen: "Notifications" }
      //
      // Example — show the message for now; replace with navigation when
      // a navigation ref is available in this provider.
      if (body) {
        Alert.alert(title, body);
      }

      // TODO: wire up a navigation ref (createNavigationContainerRef)
      // and call navigationRef.navigate(data?.screen) here once the
      // drawer-based navigation exposes a ref.
      void data;
    },
  });

  return <>{children}</>;
}
