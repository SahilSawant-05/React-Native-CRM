import { useEffect } from "react";
import { Platform } from "react-native";
import api from "../api/client";

async function registerTokenWithBackend(token: string) {
  try {
    await api.post("/api/users/push-token", {
      token,
      platform: Platform.OS,
      tokenType: "FCM",
    });
  } catch {
    // Non-fatal
  }
}

async function getMessaging() {
  try {
    const mod = await import("@react-native-firebase/messaging");
    return mod.default();
  } catch {
    // Native module not available (Expo Go, web, etc.)
    return null;
  }
}

interface Options {
  onNotificationTapped?: (remoteMessage: any) => void;
  enabled?: boolean;
}

export function usePushNotifications({ onNotificationTapped, enabled = true }: Options = {}) {
  useEffect(() => {
    if (!enabled) return;

    let unsubscribeTokenRefresh: (() => void) | undefined;
    let unsubscribeForeground: (() => void) | undefined;

    (async () => {
      try {
        const msg = await getMessaging();
        if (!msg) return;

        const authStatus = await msg.requestPermission();
        const allowed =
          authStatus === 1 /* AUTHORIZED */ ||
          authStatus === 2 /* PROVISIONAL */;

        if (!allowed) return;

        const token = await msg.getToken();
        if (token) await registerTokenWithBackend(token);

        unsubscribeTokenRefresh = msg.onTokenRefresh((newToken: string) => {
          registerTokenWithBackend(newToken);
        });

        unsubscribeForeground = msg.onMessage(async (_msg: any) => {
          // Foreground message received — FCM won't auto-display it
          // Add an in-app toast here if needed
        });

        msg.onNotificationOpenedApp((remoteMessage: any) => {
          onNotificationTapped?.(remoteMessage);
        });

        const initial = await msg.getInitialNotification();
        if (initial) onNotificationTapped?.(initial);
      } catch (err) {
        console.warn("[FCM] Push notification setup failed:", err);
      }
    })();

    return () => {
      unsubscribeTokenRefresh?.();
      unsubscribeForeground?.();
    };
  }, [enabled]);
}
