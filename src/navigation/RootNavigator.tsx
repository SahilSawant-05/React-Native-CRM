import React, { useEffect, useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { useAuth } from "../auth/AuthContext";
import { setSessionExpiredCallback } from "../api/client";
import AuthStack from "./AuthStack";
import AgentDrawer from "./AgentDrawer";
import AdminDrawer from "./AdminDrawer";
import SplashScreen from "../components/common/SplashScreen";

export default function RootNavigator() {
  const { token, user, loading, logout } = useAuth();

  useEffect(() => {
    setSessionExpiredCallback(logout);
  }, [logout]);

  // Keep the branded splash on screen long enough for its animation to read,
  // even when the stored session restores almost instantly.
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMinTimeElapsed(true), 1600);
    return () => clearTimeout(t);
  }, []);

  if (loading || !minTimeElapsed) return <SplashScreen message="Loading your workspace" />;

  const isAdmin = user?.role === "ADMIN" || user?.role === "OWNER";

  return (
    <NavigationContainer>
      {token ? (isAdmin ? <AdminDrawer /> : <AgentDrawer />) : <AuthStack />}
    </NavigationContainer>
  );
}
