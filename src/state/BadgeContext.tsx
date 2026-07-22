import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import api from "../api/client";
import { fetchInbox } from "../api/chat";
import { useAuth } from "../auth/AuthContext";

// Local-notification fallback: even without backend FCM pushes, the app
// alerts the user when polling detects NEW unread chat/mail. Lazy-required
// so web and Expo Go never crash.
function notifyLocally(title: string, body: string) {
  if (Platform.OS === "web") return;
  try {
    const Notifications = require("expo-notifications");
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
    Notifications.scheduleNotificationAsync({
      content: { title, body },
      trigger: null,
    }).catch(() => {});
  } catch {
    // expo-notifications unavailable — silent
  }
}

interface BadgeCounts {
  chat: number;
  mail: number;
  refresh: () => void;
  /** Screens push their own computed unread totals so the badge always
   *  matches exactly what the inbox screens display. */
  setChatCount: (n: number) => void;
  setMailCount: (n: number) => void;
}

const BadgeCtx = createContext<BadgeCounts>({
  chat: 0,
  mail: 0,
  refresh: () => {},
  setChatCount: () => {},
  setMailCount: () => {},
});

const POLL_MS = 30_000;

/**
 * Polls unread counts for the bottom-tab badges:
 *  - chat: sum of unreadCount across the WhatsApp inbox
 *  - mail: totalElements of the UNREAD email folder
 * Refreshes every 30s while logged in, and on demand (e.g. when a
 * push notification arrives).
 */
export function BadgeProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [chat, setChat] = useState(0);
  const [mail, setMail] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Previous poll values — used to detect NEW arrivals (count increases).
  // Start at Infinity so the first poll after login never notifies.
  const prevChatRef = useRef(Number.POSITIVE_INFINITY);
  const prevMailRef = useRef(Number.POSITIVE_INFINITY);

  const refresh = useCallback(() => {
    if (!user) return;

    // fetchInbox normalizes the backend's field-name variants
    // (items/content, unread/unreadCount) — reading the raw response
    // here always summed 0
    fetchInbox({ page: 0, size: 100 })
      .then((page) => {
        const total = (page.content ?? []).reduce((sum, i) => sum + (Number(i.unreadCount) || 0), 0);
        if (total > prevChatRef.current) {
          const diff = total - prevChatRef.current;
          notifyLocally(
            "New WhatsApp message",
            diff === 1 ? "You have a new message." : `You have ${diff} new messages.`
          );
        }
        prevChatRef.current = total;
        setChat(total);
      })
      .catch(() => {});

    api
      .get("/api/email/logs/page", { params: { folder: "UNREAD", page: 0, size: 1 } })
      .then((res) => {
        const total = Number(res.data?.totalElements) || 0;
        if (total > prevMailRef.current) {
          const diff = total - prevMailRef.current;
          notifyLocally(
            "New email",
            diff === 1 ? "You received a new email." : `You received ${diff} new emails.`
          );
        }
        prevMailRef.current = total;
        setMail(total);
      })
      .catch(() => {});
  }, [user]);

  useEffect(() => {
    if (!user) {
      setChat(0);
      setMail(0);
      prevChatRef.current = Number.POSITIVE_INFINITY;
      prevMailRef.current = Number.POSITIVE_INFINITY;
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    refresh();
    timerRef.current = setInterval(refresh, POLL_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [user, refresh]);

  return (
    <BadgeCtx.Provider value={{ chat, mail, refresh, setChatCount: setChat, setMailCount: setMail }}>
      {children}
    </BadgeCtx.Provider>
  );
}

export function useBadges(): BadgeCounts {
  return useContext(BadgeCtx);
}
