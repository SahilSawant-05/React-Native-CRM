import { useEffect } from "react";
import { Platform } from "react-native";
import messaging from "@react-native-firebase/messaging";
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

async function requestPermissionAndGetToken(): Promise<string | null> {
  const authStatus = await messaging().requestPermission();
  const allowed =
    authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
    authStatus === messaging.AuthorizationStatus.PROVISIONAL;

  if (!allowed) return null;

  const token = await messaging().getToken();
  return token;
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
      const token = await requestPermissionAndGetToken();
      if (token) await registerTokenWithBackend(token);

      // Re-register whenever FCM rotates the token
      unsubscribeTokenRefresh = messaging().onTokenRefresh((newToken) => {
        registerTokenWithBackend(newToken);
      });

      // Foreground messages — app is open
      unsubscribeForeground = messaging().onMessage(async (_remoteMessage) => {
        // Foreground messages are silently received; the app can display
        // an in-app banner here if needed. Background/quit messages are
        // shown as system notifications automatically by FCM.
      });

      // Notification tapped while app was in background
      messaging().onNotificationOpenedApp((remoteMessage) => {
        onNotificationTapped?.(remoteMessage);
      });

      // Notification tapped while app was fully quit
      const initialMessage = await messaging().getInitialNotification();
      if (initialMessage) {
        onNotificationTapped?.(initialMessage);
      }
    })();

    return () => {
      unsubscribeTokenRefresh?.();
      unsubscribeForeground?.();
    };
  }, [enabled]);
}
