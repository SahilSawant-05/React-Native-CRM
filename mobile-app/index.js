import { registerRootComponent } from "expo";
import { Platform } from "react-native";
import App from "./App";
import { ensureNotificationChannel, displayFcmNotification } from "./src/notifications/displayNotification";

// Create the notification channel at process start (Android 8+ drops any
// notification whose channel doesn't exist). Runs before the UI / login.
if (Platform.OS === "android") {
  ensureNotificationChannel();
}

// Register the FCM background/quit message handler as EARLY as possible —
// RNFirebase requires it at the JS entry point (before the root component)
// for it to run when the app is fully killed.
//
// We display the notification with Notifee, which reliably renders from the
// headless background task in ANY state (background + swiped-away/killed) —
// this is the piece that makes pushes appear when the app is closed. If the
// message already carries a top-level `notification` block, the OS shows it
// itself, so we skip to avoid a duplicate.
try {
  const { default: messaging } = require("@react-native-firebase/messaging");
  messaging().setBackgroundMessageHandler(async (remoteMessage) => {
    if (remoteMessage?.notification) return; // system already showed it
    await displayFcmNotification(remoteMessage);
  });
} catch {
  // Firebase native module unavailable (Expo Go / web)
}

registerRootComponent(App);
