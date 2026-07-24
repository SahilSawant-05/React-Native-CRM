import axios from "axios";
import { API_BASE_URL } from "../config/env";
import { clearAuthSession, isTokenExpired } from "../auth/session";

/* ── In-memory token cache (set by AuthContext on mount/login/logout) ── */
let _token: string | null = null;

export function setCachedToken(token: string | null) {
  _token = token;
}

let _onSessionExpired: (() => void) | null = null;
export function setSessionExpiredCallback(cb: () => void) {
  _onSessionExpired = cb;
}

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20000,
});

/* ── Synchronous request interceptor — no async needed ─────────────── */
api.interceptors.request.use((config) => {
  if (_token) {
    if (isTokenExpired(_token)) {
      clearAuthSession();
      _onSessionExpired?.();
      return Promise.reject(new Error("Session expired"));
    }
    config.headers.Authorization = `Bearer ${_token}`;
  }

  if (!(config.data instanceof FormData)) {
    config.headers["Content-Type"] = "application/json";
  }

  return config;
});

/* ── Response error handler ─────────────────────────────────────────── */
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const isLogin = error.config?.url?.includes("/auth/login");
    if (error.response?.status === 401 && !isLogin) {
      await clearAuthSession();
      setCachedToken(null);
      _onSessionExpired?.();
    }
    return Promise.reject(error);
  }
);

export default api;
