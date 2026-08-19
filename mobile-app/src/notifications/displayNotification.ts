import { Platform } from "react-native";

// Notifee is the reliable way to DISPLAY a notification from any app state —
// foreground, background, and killed — including from the RNFirebase headless
// background message handler, where expo-notifications is unreliable. We use
// it to render data-only FCM messages (which the OS shows nothing for on its
// own). Messages that already carry a `notification` block are rendered by
// the system in background/killed, so callers skip those there.

let notifeeMod: any = null;
function getNotifee() {
  if (notifeeMod) return notifeeMod;
  try {
    notifeeMod = require("@notifee/react-native");
    return notifeeMod;
  } catch {
    return null;
  }
}

const CHANNEL_ID = "default";

export async function ensureNotificationChannel(): Promise<void> {
  if (Platform.OS !== "android") return;
  const n = getNotifee();
  if (!n) return;
  try {
    await n.default.createChannel({
      id: CHANNEL_ID,
      name: "General",
      importance: n.AndroidImportance?.HIGH ?? 4,
      sound: "default",
      vibration: true,
    });
  } catch {
    // best-effort
  }
}

// Pulls a usable title/body out of either shape (notification block or data).
function extractTitleBody(remoteMessage: any): { title?: string; body?: string; data: any } {
  const data = remoteMessage?.data ?? {};
  const title =
    remoteMessage?.notification?.title ??
    data.title ?? data.notificationTitle ?? data.subject;
  const body =
    remoteMessage?.notification?.body ??
    data.body ?? data.message ?? data.notificationBody ?? data.text;
  return { title, body, data };
}

export async function displayFcmNotification(remoteMessage: any): Promise<void> {
  if (Platform.OS === "web") return;
  const n = getNotifee();
  if (!n) return;
  const { title, body, data } = extractTitleBody(remoteMessage);
  if (!title && !body) return;
  try {
    await ensureNotificationChannel();
    await n.default.displayNotification({
      title: title || "Vistaar Flow",
      body: body || "",
      data,
      android: {
        channelId: CHANNEL_ID,
        smallIcon: "notification_icon", // white status-bar icon (drawable)
        color: "#003b85",
        pressAction: { id: "default" }, // makes tapping open the app
      },
    });
  } catch(err) {
    console.error("[FCM] displayNotification failed:", err); // TEMP — reveal the real error
  }
}
