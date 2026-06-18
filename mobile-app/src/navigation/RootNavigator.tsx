import React, { useEffect } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { useAuth } from "../auth/AuthContext";
import { setSessionExpiredCallback } from "../api/client";
import AuthStack from "./AuthStack";
import AppTabs from "./AppTabs";
import { LoadingSpinner } from "../components/common/LoadingSpinner";

export default function RootNavigator() {
  const { token, loading, logout } = useAuth();

  useEffect(() => {
    setSessionExpiredCallback(logout);
  }, [logout]);

  if (loading) return <LoadingSpinner message="Starting…" />;

  return (
    <NavigationContainer>
      {token ? <AppTabs /> : <AuthStack />}
    </NavigationContainer>
  );
}
