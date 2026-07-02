const AUTH_KEYS = ["token", "role", "tenantId", "user", "lastActivityAt"];
export const IDLE_TIMEOUT_MS = 30 * 60 * 1000;

export function decodeToken(token) {
  if (!token) return null;
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(normalized));
  } catch {
    return null;
  }
}

export function isTokenExpired(token = sessionStorage.getItem("token")) {
  const payload = decodeToken(token);
  if (!payload?.exp) return false;
  return payload.exp * 1000 <= Date.now();
}

export function markActivity() {
  if (sessionStorage.getItem("token")) {
    sessionStorage.setItem("lastActivityAt", String(Date.now()));
  }
}

export function isIdleExpired() {
  const token = sessionStorage.getItem("token");
  if (!token) return false;
  const lastActivityAt = Number(sessionStorage.getItem("lastActivityAt") || Date.now());
  return Date.now() - lastActivityAt > IDLE_TIMEOUT_MS;
}

export function clearAuthSession(message = "") {
  AUTH_KEYS.forEach((key) => sessionStorage.removeItem(key));
  if (message) {
    sessionStorage.setItem("logoutMessage", message);
  }
}

export function isSessionInvalid() {
  return !sessionStorage.getItem("token") || isTokenExpired() || isIdleExpired();
}

export function redirectToLogin(message = "Your session expired. Please log in again.") {
  clearAuthSession(message);
  if (window.location.pathname !== "/login") {
    window.location.assign("/login");
  }
}
