import React, { useEffect } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { useAuth } from "../auth/AuthContext";
import { setSessionExpiredCallback } from "../api/client";
import AuthStack from "./AuthStack";
import AgentDrawer from "./AgentDrawer";
import AdminDrawer from "./AdminDrawer";
import { LoadingSpinner } from "../components/common/LoadingSpinner";

export default function RootNavigator() {
  const { token, user, loading, logout } = useAuth();

  useEffect(() => {
    setSessionExpiredCallback(logout);
  }, [logout]);

  if (loading) return <LoadingSpinner message="Starting…" />;

  const isAdmin = user?.role === "ADMIN" || user?.role === "OWNER";

  return (
    <NavigationContainer>
      {token ? (isAdmin ? <AdminDrawer /> : <AgentDrawer />) : <AuthStack />}
    </NavigationContainer>
  );
}
