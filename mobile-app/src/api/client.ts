import axios from "axios";
import { API_BASE_URL } from "../config/env";
import {
  clearAuthSession,
  getToken,
  isIdleExpired,
  isTokenExpired,
  markActivity,
} from "../auth/session";

let _onSessionExpired: (() => void) | null = null;

export function setSessionExpiredCallback(cb: () => void) {
  _onSessionExpired = cb;
}

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
});

api.interceptors.request.use(async (config) => {
  const token = await getToken();

  if (token) {
    if (isTokenExpired(token) || (await isIdleExpired())) {
      await clearAuthSession();
      _onSessionExpired?.();
      return Promise.reject(new axios.Cancel("Session expired"));
    }
    config.headers.Authorization = `Bearer ${token}`;
    await markActivity();
  }

  if (config.data instanceof FormData) {
    delete config.headers["Content-Type"];
  } else {
    config.headers["Content-Type"] = "application/json";
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const requestUrl = error.config?.url || "";
    const isLoginRequest = requestUrl.includes("/auth/login");

    if (error.response?.status === 401 && !isLoginRequest) {
      await clearAuthSession();
      _onSessionExpired?.();
    }
    return Promise.reject(error);
  }
);

export default api;
