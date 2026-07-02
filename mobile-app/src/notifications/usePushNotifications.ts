import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import api from "../api/client";

// Show notifications even while the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (!Device.isDevice) {
    // Simulators/emulators cannot receive push notifications
    return null;
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#0f766e",
      sound: "default",
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    return null;
  }

  const tokenData = await Notifications.getExpoPushTokenAsync();
  return tokenData.data;
}

interface Options {
  /** Called when user taps a notification — use to navigate */
  onNotificationTapped?: (notification: Notifications.Notification) => void;
  /** Whether the user is currently logged in; skips registration when false */
  enabled?: boolean;
}

export function usePushNotifications({ onNotificationTapped, enabled = true }: Options = {}) {
  const notificationListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    (async () => {
      const expoPushToken = await registerForPushNotificationsAsync();
      if (!expoPushToken || cancelled) return;

      try {
        await api.post("/api/users/push-token", {
          token: expoPushToken,
          platform: Platform.OS,
        });
      } catch {
        // Non-fatal — registration failures shouldn't break the app
      }
    })();

    // Fires while the app is foregrounded
    notificationListener.current = Notifications.addNotificationReceivedListener((_notification) => {
      // expo-notifications already shows the banner; nothing extra needed here
    });

    // Fires when the user taps a notification (foreground or background/killed)
    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      onNotificationTapped?.(response.notification);
    });

    return () => {
      cancelled = true;
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, [enabled]);
}
