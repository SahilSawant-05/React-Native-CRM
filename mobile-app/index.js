import { registerRootComponent } from "expo";
import { Platform } from "react-native";
import App from "./App";

// Register the FCM background/quit message handler as EARLY as possible —
// RNFirebase requires it at the JS entry point (before the root component)
// for it to run when the app is fully killed. Data-only messages show
// nothing on their own, so we display a local notification here; messages
// that already carry a `notification` block are rendered by the system, so
// we skip them to avoid duplicates.
try {
  const { default: messaging } = require("@react-native-firebase/messaging");
  messaging().setBackgroundMessageHandler(async (remoteMessage) => {
    if (Platform.OS === "web") return;
    if (remoteMessage?.notification) return; // system already showed it
    const data = remoteMessage?.data ?? {};
    const title = data.title ?? data.notificationTitle;
    const body = data.body ?? data.message ?? data.notificationBody;
    if (!title && !body) return;
    try {
      const Notifications = require("expo-notifications");
      await Notifications.setNotificationChannelAsync?.("default", {
        name: "General",
        importance: Notifications.AndroidImportance?.HIGH ?? 4,
        sound: "default",
      });
      await Notifications.scheduleNotificationAsync({
        content: {
          title: title || "Vistaar Flow",
          body: body || "",
          data,
          ...(Platform.OS === "android" ? { channelId: "default" } : {}),
        },
        trigger: null,
      });
    } catch {
      // Best-effort
    }
  });
} catch {
  // Firebase native module unavailable (Expo Go / web)
}

registerRootComponent(App);
