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

// The FCM device token as last read from Firebase, kept at module scope
// (independent of lastRegisteredToken, which gets cleared on logout/unregister)
// so we can re-POST the SAME token to a newly active backend — e.g. after
// switching between the testing and production API endpoints — without
// needing to re-request permissions or hit Firebase again.
let lastKnownDeviceToken: string | null = null;

// The current logged-in user id, kept at module scope so token registration
// can bind the device token to the RIGHT user (the auth token identifies the
// caller, but sending the id explicitly lets the backend reassign a token that
// was previously bound to another user on this device — e.g. owner → agent).
let currentUserId: string | number | null = null;
export function setPushUserId(id: string | number | null) {
  currentUserId = id;
}

// Last registration outcome, exposed to an in-app diagnostics card so support
// can see — without dev tools — whether THIS device registered its push token
// and, if it failed, the exact HTTP status/message. Also records which env
// (api.defaults.baseURL at the time of the call) the token was sent to, so
// you can visually confirm a test/production switch actually re-registered.
export interface PushDiagnostics {
  token: string | null;
  userId: string | number | null;
  ok: boolean | null;   // null = not attempted yet
  status: number | null;
  message: string | null;
  baseURL: string | null;
  at: string | null;
}
let pushDiagnostics: PushDiagnostics = { token: null, userId: null, ok: null, status: null, message: null, baseURL: null, at: null };
const diagListeners = new Set<(d: PushDiagnostics) => void>();
function setDiagnostics(patch: Partial<PushDiagnostics>) {
  pushDiagnostics = { ...pushDiagnostics, ...patch, at: new Date().toLocaleTimeString() };
  diagListeners.forEach((l) => l(pushDiagnostics));
}
export function getPushDiagnostics(): PushDiagnostics {
  return pushDiagnostics;
}
export function subscribePushDiagnostics(fn: (d: PushDiagnostics) => void): () => void {
  diagListeners.add(fn);
  return () => diagListeners.delete(fn);
}

// Force a re-registration of the current device token (used by the diagnostics
// "Re-register" button, and by forceReregisterPushToken below). Returns the
// fresh device token, or null.
export async function forceReregisterPushToken(): Promise<string | null> {
  try {
    const rnfbMessaging = await getMessagingModule();
    if (!rnfbMessaging) return null;
    const token = await rnfbMessaging.getToken(rnfbMessaging.getMessaging());
    if (token) {
      lastKnownDeviceToken = token;
      await registerTokenWithBackend(token);
    }
    return token || null;
  } catch {
    return null;
  }
}

// Call this immediately after you switch which backend the app talks to
// (testing <-> production), wherever that switch happens in your code —
// e.g. right after you update your api client's baseURL. It re-POSTs the
// EXISTING device token (no need to touch Firebase again, the token itself
// doesn't change) to whichever backend `api` now points at, so the test/
// production DB you just switched to gets a fresh row immediately instead
// of waiting for the next full app restart.
export async function reregisterPushTokenForCurrentEnvironment(): Promise<void> {
  let token = lastKnownDeviceToken ?? lastRegisteredToken;
  if (!token) {
    // No cached token yet (e.g. called before initial setup finished) —
    // fetch fresh instead of no-op-ing.
    token = await forceReregisterPushToken();
    return;
  }
  await registerTokenWithBackend(token);
}

// A stable per-install device identifier. The backend deactivates old active
// tokens for the SAME deviceId when a new user registers this device, so this
// value MUST stay constant across logins/logouts on this device (persisted in
// AsyncStorage) for owner→agent hand-off to work correctly.
async function getPushDeviceId(): Promise<string> {
  const storageKey = "crm_push_device_id";
  const existing = await AsyncStorage.getItem(storageKey);
  if (existing) return existing;
  const generated = `${Platform.OS}-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
  await AsyncStorage.setItem(storageKey, generated);
  return generated;
}

async function registerTokenWithBackend(token: string, attempt = 1): Promise<void> {
  const deviceId = await getPushDeviceId();
  // Send several field-name variants so the token lands regardless of what
  // the backend's /api/users/push-token endpoint expects for its columns.
  const payload: Record<string, any> = {
    token,
    fcmToken: token,
    pushToken: token,
    platform: Platform.OS,
    deviceId,
    deviceType: Platform.OS?.toUpperCase(),
    tokenType: "FCM",
    provider: "FCM",
  };
  if (currentUserId != null && currentUserId !== "") {
    payload.userId = currentUserId;
    payload.assignedUserId = currentUserId;
  }
  const baseURL = (api as any)?.defaults?.baseURL ?? null;
  try {
    const response = await api.post("/api/users/push-token", payload);
    lastRegisteredToken = token;
    lastKnownDeviceToken = token;
    // Backend returns tenantId/userId so we can verify the token was saved
    // under the CURRENT user (agent) — not left bound to a previous user.
    const savedTenant = response?.data?.tenantId;
    const savedUser = response?.data?.userId;
    setDiagnostics({ token, userId: savedUser ?? currentUserId, ok: true, status: 200, message: "Registered", baseURL });
    if (__DEV__) {
      console.log(
        `[FCM] push-token registered with backend (${baseURL}) ✔`,
        savedTenant != null ? `tenant=${savedTenant}` : "",
        savedUser != null ? `user=${savedUser}` : "",
        `device=${deviceId}`
      );
    }
  } catch (err: any) {
    const status = err?.response?.status;
    const message = err?.response?.data?.message ?? err?.response?.data?.error ?? err?.message ?? "Registration failed";
    setDiagnostics({ token, userId: currentUserId, ok: false, status: status ?? null, message, baseURL });
    if (__DEV__) {
      console.warn(
        `[FCM] push-token registration failed against ${baseURL} (attempt ${attempt}) — ` +
        `status=${status ?? "network"} ${message}`
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
  const deviceId = await getPushDeviceId();
  const payload = { token, fcmToken: token, pushToken: token, deviceId, provider: "FCM" };
  try {
    await api.delete("/api/users/push-token", { data: payload, params: { token, deviceId } });
    if (__DEV__) console.log("[FCM] push-token unregistered from backend ✔");
  } catch (err: any) {
    if (__DEV__) console.warn("[FCM] push-token unregister failed:", err?.response?.status ?? err?.message);
  } finally {
    lastRegisteredToken = null;
  }
}

// Force Firebase to issue a BRAND-NEW device token. Called on logout (after
// unregister) so the next user to log in on this device gets a different token
// registered under THEIR id — guaranteeing the previous user can never keep
// receiving this device's notifications. The next getToken() (on the new
// login) returns the fresh token, which then registers under the new user.
export async function resetDeviceToken(): Promise<void> {
  try {
    const rnfbMessaging = await getMessagingModule();
    if (!rnfbMessaging) return;
    await rnfbMessaging.deleteToken(rnfbMessaging.getMessaging());
    lastRegisteredToken = null;
    lastKnownDeviceToken = null;
    if (__DEV__) console.log("[FCM] device token reset — a new token will issue on next login");
  } catch (err: any) {
    if (__DEV__) console.warn("[FCM] device token reset failed:", err?.message);
  }
}

async function getMessagingModule() {
  try {
    const mod = await import("@react-native-firebase/messaging");
    return mod;
  } catch {
    return null;
  }
}
 
function getLocalNotifications() {
  if (Platform.OS === "web") return null;
  try {
    return require("expo-notifications");
  } catch {
    return null;
  }
}
 
async function requestAndroid13Permission(): Promise<boolean> {
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
  onMessageReceived?: (remoteMessage: any) => void;
  enabled?: boolean;
  userId?: string | number | null;
  /**
   * Any value that identifies the current API environment (e.g. "testing" |
   * "production", or the base URL string itself). Optional — but if you pass
   * it, changing this value re-runs the whole setup effect, which re-POSTs
   * the device token to whichever backend `api` now points at. Use this if
   * your env switch happens via a React state/context value rather than a
   * full app restart.
   */
  environment?: string | number | null;
}

export function usePushNotifications({ onNotificationTapped, onMessageReceived, enabled = true, userId, environment }: Options = {}) {
  useEffect(() => {
    setPushUserId(enabled ? (userId ?? null) : null);
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
 
        const androidPermissionGranted = await requestAndroid13Permission();
        if (!androidPermissionGranted) return;
 
        if (Platform.OS === "android") {
          await ensureNotificationChannel();
        }
 
        const authStatus = await rnfbMessaging.requestPermission(messagingInstance);
        const allowed =
          authStatus === rnfbMessaging.AuthorizationStatus.AUTHORIZED ||
          authStatus === rnfbMessaging.AuthorizationStatus.PROVISIONAL;
        if (!allowed) return;
 
        promptBatteryExemptionOnce();
 
        const token = await rnfbMessaging.getToken(messagingInstance);
        if (token) {
          console.log("[FCM] Device token:", token);
          currentToken = token;
          lastKnownDeviceToken = token;
          // Always (re)register on every run of this effect — including the
          // run triggered by an `environment` change — so switching test/
          // production re-POSTs the token to whichever backend is now active.
          await registerTokenWithBackend(token);
        }
 
        unsubscribeTokenRefresh = rnfbMessaging.onTokenRefresh(messagingInstance, (newToken: string) => {
          currentToken = newToken;
          lastKnownDeviceToken = newToken;
          registerTokenWithBackend(newToken);
        });

        appStateSub = AppState.addEventListener("change", (state) => {
          if (state === "active" && currentToken) registerTokenWithBackend(currentToken);
        });
 
        unsubscribeForeground = rnfbMessaging.onMessage(messagingInstance, async (remoteMessage: any) => {
          onMessageReceived?.(remoteMessage);
          const data = remoteMessage?.data ?? {};
          const convId =
            data.contactId ?? data.conversationId ?? data.chatId ?? data.senderId ?? data.fromContactId;
          if (convId != null && isActiveConversation(convId)) {
            return;
          }
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
    // Re-run when the account OR the environment changes, so the device
    // token is re-registered against whichever backend is now active.
  }, [enabled, userId, environment]);
}