import { useEffect } from "react";
import { PermissionsAndroid, Platform } from "react-native";
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

// expo-notifications is used ONLY to display local banners for FCM
// data received while the app is foregrounded (FCM doesn't show those
// itself). Lazy-required so web / Expo Go never crash.
function getLocalNotifications() {
  if (Platform.OS === "web") return null;
  try {
    return require("expo-notifications");
  } catch {
    return null;
  }
}

async function requestAndroid13Permission(): Promise<boolean> {
  // Firebase's requestPermission() is a no-op for the Android 13+
  // POST_NOTIFICATIONS runtime permission — it must be requested via
  // PermissionsAndroid or notifications silently never appear.
  if (Platform.OS !== "android" || Number(Platform.Version) < 33) return true;
  try {
    const res = await PermissionsAndroid.request(
      "android.permission.POST_NOTIFICATIONS" as any
    );
    return res === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return true;
  }
}

interface Options {
  onNotificationTapped?: (remoteMessage: any) => void;
  /** Called when a message arrives while the app is open (badge refresh etc.) */
  onMessageReceived?: (remoteMessage: any) => void;
  enabled?: boolean;
}

export function usePushNotifications({ onNotificationTapped, onMessageReceived, enabled = true }: Options = {}) {
  useEffect(() => {
    if (!enabled) return;

    let unsubscribeTokenRefresh: (() => void) | undefined;
    let unsubscribeForeground: (() => void) | undefined;

    (async () => {
      try {
        const msg = await getMessaging();
        if (!msg) return;

        // Android 13+ runtime permission FIRST — without it nothing shows
        await requestAndroid13Permission();

        const authStatus = await msg.requestPermission();
        const allowed =
          authStatus === 1 /* AUTHORIZED */ ||
          authStatus === 2 /* PROVISIONAL */;
        if (!allowed) return;

        const token = await msg.getToken();
        if (token) {
          // Visible in `npx expo start` / adb logcat — copy this token into
          // Firebase Console > Messaging > Send test message to verify the
          // device pipeline end-to-end without any backend code.
          console.log("[FCM] Device token:", token);
          await registerTokenWithBackend(token);
        }

        unsubscribeTokenRefresh = msg.onTokenRefresh((newToken: string) => {
          registerTokenWithBackend(newToken);
        });

        // Foreground messages: FCM does NOT display these automatically.
        // Show a local notification banner so "app open" pushes are visible.
        unsubscribeForeground = msg.onMessage(async (remoteMessage: any) => {
          onMessageReceived?.(remoteMessage);
          const Notifications = getLocalNotifications();
          const title = remoteMessage?.notification?.title ?? remoteMessage?.data?.title;
          const body = remoteMessage?.notification?.body ?? remoteMessage?.data?.body;
          if (Notifications && (title || body)) {
            try {
              await Notifications.setNotificationHandler({
                handleNotification: async () => ({
                  shouldShowAlert: true,
                  shouldPlaySound: true,
                  shouldSetBadge: false,
                  shouldShowBanner: true,
                  shouldShowList: true,
                }),
              });
              await Notifications.scheduleNotificationAsync({
                content: {
                  title: title || "CRM Agent",
                  body: body || "",
                  data: remoteMessage?.data ?? {},
                },
                trigger: null, // show immediately
              });
            } catch {
              // Display is best-effort — never crash on it
            }
          }
        });

        msg.onNotificationOpenedApp((remoteMessage: any) => {
          onNotificationTapped?.(remoteMessage);
        });

        const initialMessage = await msg.getInitialNotification();
        if (initialMessage) {
          onNotificationTapped?.(initialMessage);
        }
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
