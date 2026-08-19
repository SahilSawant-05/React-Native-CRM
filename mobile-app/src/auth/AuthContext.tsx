import React, { createContext, useContext, useEffect, useState } from "react";
import { User } from "../types";
import {
  clearAuthSession,
  decodeToken,
  isTokenExpired,
  loadStoredSession,
  saveAuthSession,
} from "./session";
import { setCachedToken } from "../api/client";
import { unregisterPushToken, resetDeviceToken } from "../notifications/usePushNotifications";

interface AuthContextValue {
  token: string | null;
  user: User | null;
  loading: boolean;
  login: (data: {
    token: string;
    role: string;
    tenantId: string | number;
    userId: string | number;
    email: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { token: stored, role, user: userStr } = await loadStoredSession();
        if (stored && !isTokenExpired(stored)) {
          // Allow any role during dev — restrict to AGENT in production
          setCachedToken(stored);           // ← sync cache before any screen loads
          setToken(stored);
          setUser(userStr ? JSON.parse(userStr) : null);
        } else if (stored) {
          await clearAuthSession();
          setCachedToken(null);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function login(data: {
    token: string;
    role: string;
    tenantId: string | number;
    userId: string | number;
    email: string;
  }) {
    const decoded = decodeToken(data.token);
    const role = (data.role || decoded?.role || "").toUpperCase();

    if (!["AGENT", "ADMIN", "OWNER"].includes(role)) {
      throw new Error("Invalid account. Please contact your administrator.");
    }

    const userData: User = {
      id: data.userId,
      email: data.email,
      role: role as User["role"],
      tenantId: data.tenantId,
    };

    await saveAuthSession({
      token: data.token,
      role,
      tenantId: data.tenantId,
      user: userData,
    });

    setCachedToken(data.token);            // ← set sync cache immediately
    setToken(data.token);
    setUser(userData);
  }

  async function logout() {
    // Drop this device's push token from the backend WHILE still authenticated,
    // so notifications for this user don't keep arriving for whoever logs in
    // next on the same device (cross-account notification leak).
    await unregisterPushToken().catch(() => {});
    // Then invalidate the FCM token so the next user to log in on this device
    // gets a DIFFERENT token registered under their own id.
    await resetDeviceToken().catch(() => {});
    await clearAuthSession();
    setCachedToken(null);                  // ← clear sync cache
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ token, user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
