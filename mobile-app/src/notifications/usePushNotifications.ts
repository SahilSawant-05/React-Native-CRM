import { useEffect } from "react";
import { AppState, Alert, Linking, PermissionsAndroid, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import api from "../api/client";
import { displayFcmNotification, ensureNotificationChannel } from "./displayNotification";
import { isActiveConversation } from "../state/activeConversation";
 
// Many Android OEMs (Xiaomi/MIUI, Oppo/Realme/ColorOS, Vivo, Samsung, …)
// force-stop apps that are swiped away or left idle, which BLOCKS FCM
// delivery entirely while the app is "closed" — the single most common
// reason "notifications don't work when the app is closed" even though the
// server and token are correct. Ask the user once to exempt the app from
// battery optimization, which keeps FCM delivering in the background.
async function promptBatteryExemptionOnce() {
  if (Platform.OS !== "android") return;
  try {
    const asked = await AsyncStorage.getItem("battery_exemption_prompted");
    if (asked) return;
    await AsyncStorage.setItem("battery_exemption_prompted", "1");
    Alert.alert(
      "Keep notifications working",
      "To receive chat, lead and mail notifications when the app is closed, " +
        "allow it to run in the background (disable battery optimization / enable Auto-start).",
      [
        { text: "Later", style: "cancel" },
        {
          text: "Open settings",
          onPress: () => {
            // Opens the per-app battery-optimization exemption screen; falls
            // back to this app's settings page if the intent isn't supported.
            Linking.sendIntent?.("android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS")
              .catch(() => Linking.openSettings());
          },
        },
      ]
    );
  } catch {
    // Best-effort — never block push setup on this prompt
  }
}
 
// The device token last registered with the backend for the CURRENT user. Kept
// at module scope so logout can unregister it (see unregisterPushToken) — the
// device token is tied to whichever user was logged in when it was registered,
// so it MUST be dropped on logout or the next account on this device would keep
// receiving the previous user's notifications.
let lastRegisteredToken: string | null = null;

async function registerTokenWithBackend(token: string, attempt = 1): Promise<void> {
  // Send several field-name variants so the token lands regardless of what
  // the backend's /api/users/push-token endpoint expects for its columns.
  const payload = {
    token,
    fcmToken: token,
    pushToken: token,
    platform: Platform.OS,
    deviceType: Platform.OS?.toUpperCase(),
    tokenType: "FCM",
    provider: "FCM",
  };
  try {
    await api.post("/api/users/push-token", payload);
    lastRegisteredToken = token;
    if (__DEV__) console.log("[FCM] push-token registered with backend ✔");
  } catch (err: any) {
    const status = err?.response?.status;
    if (__DEV__) {
      console.warn(
        `[FCM] push-token registration failed (attempt ${attempt}) — ` +
        `status=${status ?? "network"} ${err?.response?.data?.message ?? err?.message ?? ""}`
      );
    }
    // Retry transient failures (network / 5xx) a few times with backoff;
    // a slow-starting session token is the usual reason the first call 401s.
    if (attempt < 4 && (!status || status >= 500 || status === 401)) {
      await new Promise((r) => setTimeout(r, attempt * 2000));
      return registerTokenWithBackend(token, attempt + 1);
    }
  }
}
 
// Unregister this device's push token from the backend. MUST be called during
// logout while the session token is still valid (the request is authenticated),
// so the backend removes the token→user mapping. Without this, the token stays
// bound to the user who logged out and the next account on the same device
// receives that user's push notifications (cross-account leak).
export async function unregisterPushToken(): Promise<void> {
  let token = lastRegisteredToken;
  if (!token) {
    // The app may have been restarted since registration; recover the current
    // device token so we can still drop it.
    try {
      const rnfbMessaging = await getMessagingModule();
      if (rnfbMessaging) {
        token = await rnfbMessaging.getToken(rnfbMessaging.getMessaging());
      }
    } catch {
      /* ignore */
    }
  }
  if (!token) return;
  const payload = { token, fcmToken: token, pushToken: token, provider: "FCM" };
  try {
    await api.delete("/api/users/push-token", { data: payload, params: { token } });
    if (__DEV__) console.log("[FCM] push-token unregistered from backend ✔");
  } catch (err: any) {
    if (__DEV__) console.warn("[FCM] push-token unregister failed:", err?.response?.status ?? err?.message);
  } finally {
    lastRegisteredToken = null;
  }
}

// Loads the RNFirebase messaging module and returns its modular-API
// namespace (getMessaging, getToken, onMessage, …) rather than the
// deprecated messaging() namespaced instance. Returns null when the native
// module isn't available (Expo Go, web, etc.) so callers can no-op.
async function getMessagingModule() {
  try {
    const mod = await import("@react-native-firebase/messaging");
    return mod;
  } catch {
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
  /** Current logged-in user id — re-registers the token when the account changes. */
  userId?: string | number | null;
}

export function usePushNotifications({ onNotificationTapped, onMessageReceived, enabled = true, userId }: Options = {}) {
  useEffect(() => {
    if (!enabled) return;
 
    let unsubscribeTokenRefresh: (() => void) | undefined;
    let unsubscribeForeground: (() => void) | undefined;
    let unsubscribeOpenedApp: (() => void) | undefined;
    let appStateSub: { remove: () => void } | undefined;
    let currentToken: string | null = null;
 
    (async () => {
      try {
        const rnfbMessaging = await getMessagingModule();
        if (!rnfbMessaging) return;
 
        const messagingInstance = rnfbMessaging.getMessaging();
 
        // Android 13+ runtime permission FIRST. FCM can still generate a
        // device token before this permission is granted, but that token
        // cannot display notifications, so do not register it with the CRM
        // until the user explicitly allows notifications.
        const androidPermissionGranted = await requestAndroid13Permission();
        if (!androidPermissionGranted) return;
 
        // Android 8+ drops any notification sent to a channel that doesn't
        // exist. FCM background/quit notifications land on the channel named
        // by default_notification_channel_id ("default") in the manifest —
        // create it here so app-closed pushes actually appear.
        if (Platform.OS === "android") {
          await ensureNotificationChannel();
        }
 
        const authStatus = await rnfbMessaging.requestPermission(messagingInstance);
        const allowed =
          authStatus === rnfbMessaging.AuthorizationStatus.AUTHORIZED ||
          authStatus === rnfbMessaging.AuthorizationStatus.PROVISIONAL;
        if (!allowed) return;
 
        // Nudge the user to exempt the app from battery optimization so FCM
        // keeps arriving when the app is closed (OEM app-kill is the usual
        // cause of "no notifications when closed").
        promptBatteryExemptionOnce();
 
        const token = await rnfbMessaging.getToken(messagingInstance);
        if (token) {
          // Visible in `npx expo start` / adb logcat — copy this token into
          // Firebase Console > Messaging > Send test message to verify the
          // device pipeline end-to-end without any backend code.
          console.log("[FCM] Device token:", token);
          currentToken = token;
          await registerTokenWithBackend(token);
        }
 
        unsubscribeTokenRefresh = rnfbMessaging.onTokenRefresh(messagingInstance, (newToken: string) => {
          currentToken = newToken;
          registerTokenWithBackend(newToken);
        });

        // Re-assert the token → current-user binding every time the app returns
        // to the foreground. On a shared device this ensures an agent's token is
        // (re)bound to the agent, not left mapped to a previous user (e.g. the
        // owner), so agents reliably receive their OWN push notifications.
        appStateSub = AppState.addEventListener("change", (state) => {
          if (state === "active" && currentToken) registerTokenWithBackend(currentToken);
        });
 
        // Foreground messages: FCM does NOT display these automatically.
        // Show a local notification banner so "app open" pushes are visible.
        unsubscribeForeground = rnfbMessaging.onMessage(messagingInstance, async (remoteMessage: any) => {
          onMessageReceived?.(remoteMessage);
          // Do NOT show a banner for a message that belongs to the chat the
          // user is already viewing (WhatsApp behaviour). The FCM payload
          // carries the conversation/contact id in its data block.
          const data = remoteMessage?.data ?? {};
          const convId =
            data.contactId ?? data.conversationId ?? data.chatId ?? data.senderId ?? data.fromContactId;
          if (convId != null && isActiveConversation(convId)) {
            return;
          }
          // FCM never auto-displays in the foreground — render it ourselves
          // via Notifee (same path used in the background handler, so the
          // notification looks identical in every app state).
          await displayFcmNotification(remoteMessage);
        });
 
        unsubscribeOpenedApp = rnfbMessaging.onNotificationOpenedApp(messagingInstance, (remoteMessage: any) => {
          onNotificationTapped?.(remoteMessage);
        });
 
        const initialMessage = await rnfbMessaging.getInitialNotification(messagingInstance);
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
      unsubscribeOpenedApp?.();
      appStateSub?.remove();
    };
    // Re-run when the account changes so the device token is re-registered to
    // the newly logged-in user (defense in depth against stale token→user maps).
  }, [enabled, userId]);
}
 
 