import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { IDLE_TIMEOUT_MS, isIdleExpired, isTokenExpired, markActivity, redirectToLogin } from "./session";

const ACTIVITY_EVENTS = ["click", "keydown", "mousemove", "scroll", "touchstart"];

export default function SessionWatcher() {
  const location = useLocation();

  useEffect(() => {
    const recordActivity = () => markActivity();
    ACTIVITY_EVENTS.forEach((eventName) => window.addEventListener(eventName, recordActivity, { passive: true }));

    const interval = window.setInterval(() => {
      const token = sessionStorage.getItem("token");
      if (!token || location.pathname === "/login" || location.pathname === "/signup") return;
      if (isTokenExpired(token) || isIdleExpired()) {
        redirectToLogin("You were logged out because your session was idle.");
      }
    }, 30_000);

    return () => {
      ACTIVITY_EVENTS.forEach((eventName) => window.removeEventListener(eventName, recordActivity));
      window.clearInterval(interval);
    };
  }, [location.pathname]);

  useEffect(() => {
    const token = sessionStorage.getItem("token");
    if (!token || location.pathname === "/login" || location.pathname === "/signup") return;
    if (!sessionStorage.getItem("lastActivityAt")) markActivity();
    const timeout = window.setTimeout(() => {
      if (isIdleExpired()) {
        redirectToLogin("You were logged out because your session was idle.");
      }
    }, IDLE_TIMEOUT_MS);
    return () => window.clearTimeout(timeout);
  }, [location.pathname]);

  return null;
}
