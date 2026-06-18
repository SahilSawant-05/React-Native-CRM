import React, { createContext, useContext, useEffect, useState } from "react";
import { User } from "../types";
import {
  clearAuthSession,
  decodeToken,
  isTokenExpired,
  loadStoredSession,
  saveAuthSession,
} from "./session";

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
        const { token: stored, role, tenantId, user: userStr } = await loadStoredSession();
        if (stored && !isTokenExpired(stored) && role === "AGENT") {
          setToken(stored);
          setUser(userStr ? JSON.parse(userStr) : null);
        } else if (stored) {
          await clearAuthSession();
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
    if (role !== "AGENT") {
      throw new Error("This app is for agents only. Please use the web app.");
    }
    const userData: User = {
      id: data.userId,
      email: data.email,
      role: "AGENT",
      tenantId: data.tenantId,
    };
    await saveAuthSession({
      token: data.token,
      role,
      tenantId: data.tenantId,
      user: userData,
    });
    setToken(data.token);
    setUser(userData);
  }

  async function logout() {
    await clearAuthSession();
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
