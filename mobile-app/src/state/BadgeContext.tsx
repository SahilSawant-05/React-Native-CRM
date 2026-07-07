import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import api from "../api/client";
import { fetchInbox } from "../api/chat";
import { useAuth } from "../auth/AuthContext";

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

  const refresh = useCallback(() => {
    if (!user) return;

    // fetchInbox normalizes the backend's field-name variants
    // (items/content, unread/unreadCount) — reading the raw response
    // here always summed 0
    fetchInbox({ page: 0, size: 100 })
      .then((page) => {
        setChat((page.content ?? []).reduce((sum, i) => sum + (Number(i.unreadCount) || 0), 0));
      })
      .catch(() => {});

    api
      .get("/api/email/logs/page", { params: { folder: "UNREAD", page: 0, size: 1 } })
      .then((res) => {
        setMail(Number(res.data?.totalElements) || 0);
      })
      .catch(() => {});
  }, [user]);

  useEffect(() => {
    if (!user) {
      setChat(0);
      setMail(0);
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
