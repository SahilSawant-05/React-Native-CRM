import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import api from "../api/client";

// Show banners / play sound even while the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function setupAndroidChannel() {
  await Notifications.setNotificationChannelAsync("default", {
    name: "Default",
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#0f766e",
    sound: "default",
    enableVibrate: true,
    showBadge: true,
  });

  // Separate high-priority channel for chat messages
  await Notifications.setNotificationChannelAsync("chat", {
    name: "Chat Messages",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 200],
    lightColor: "#0f766e",
    sound: "default",
    showBadge: true,
  });
}

async function requestPermission(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === "granted") return true;
  const { status } = await Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowBadge: true,
      allowSound: true,
      allowProvisional: false,
    },
  });
  return status === "granted";
}

async function getFcmToken(): Promise<string | null> {
  // Physical device only — emulators can't receive FCM
  if (!Device.isDevice) {
    console.warn("[FCM] Running on emulator — push notifications disabled.");
    return null;
  }

  if (Platform.OS === "android") {
    await setupAndroidChannel();
  }

  const granted = await requestPermission();
  if (!granted) {
    console.warn("[FCM] Push notification permission denied.");
    return null;
  }

  try {
    // getDevicePushTokenAsync returns the raw FCM token on Android
    // and the raw APNs token on iOS — your backend sends via Firebase Admin SDK
    const { data } = await Notifications.getDevicePushTokenAsync();
    return data;
  } catch (err) {
    console.warn("[FCM] Failed to get device push token:", err);
    return null;
  }
}

async function registerTokenWithBackend(token: string) {
  await api.post("/api/users/push-token", {
    token,
    platform: Platform.OS,           // "android" | "ios"
    tokenType: Platform.OS === "android" ? "FCM" : "APNS",
  });
}

// ─────────────────────────────────────────────────────────────────────────────

interface Options {
  /** Called when the user taps a notification (foreground or background) */
  onNotificationTapped?: (notification: Notifications.Notification) => void;
  /** Only register when the user is logged in */
  enabled?: boolean;
}

export function usePushNotifications({ onNotificationTapped, enabled = true }: Options = {}) {
  const receivedListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);
  const tokenRefreshListener = useRef<Notifications.EventSubscription | null>(null);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    // Initial token registration
    (async () => {
      const token = await getFcmToken();
      if (!token || cancelled) return;
      try {
        await registerTokenWithBackend(token);
      } catch {
        // Non-fatal — app works fine even if token registration fails
      }
    })();

    // FCM tokens can rotate — re-register whenever the token changes
    tokenRefreshListener.current = Notifications.addPushTokenListener((pushToken) => {
      if (cancelled) return;
      registerTokenWithBackend(pushToken.data).catch(() => {});
    });

    // Foreground notification received — banner is shown automatically
    receivedListener.current = Notifications.addNotificationReceivedListener(() => {
      // Nothing extra needed; setNotificationHandler above handles display
    });

    // User tapped a notification (any app state)
    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      onNotificationTapped?.(response.notification);
    });

    return () => {
      cancelled = true;
      tokenRefreshListener.current?.remove();
      receivedListener.current?.remove();
      responseListener.current?.remove();
    };
  }, [enabled]);
}
