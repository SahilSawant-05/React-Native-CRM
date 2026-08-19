import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../auth/AuthContext";
import {
  getPushDiagnostics,
  subscribePushDiagnostics,
  forceReregisterPushToken,
  PushDiagnostics,
} from "../../notifications/usePushNotifications";

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const [diag, setDiag] = useState<PushDiagnostics>(getPushDiagnostics());
  const [reRegistering, setReRegistering] = useState(false);

  useEffect(() => subscribePushDiagnostics(setDiag), []);

  async function reRegister() {
    setReRegistering(true);
    await forceReregisterPushToken();
    setDiag(getPushDiagnostics());
    setReRegistering(false);
  }

  const diagOk = diag.ok === true;
  const diagState = diag.ok === null ? "Pending" : diagOk ? "Registered" : "Failed";
  const diagColor = diag.ok === null ? "#94a3b8" : diagOk ? "#047857" : "#dc2626";
  const boundMatches = diag.userId != null && String(diag.userId) === String(user?.id ?? "");

  function handleLogout() {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: logout },
    ]);
  }

  const initials = (user?.email || "?")
    .split("@")[0]
    .split(/[._-]/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

  return (
    <SafeAreaView style={styles.root} edges={[]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Avatar */}
        <View style={styles.hero}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials || "A"}</Text>
          </View>
          <Text style={styles.email}>{user?.email}</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>{user?.role}</Text>
          </View>
        </View>

        {/* Info */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Account</Text>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Email</Text>
            <Text style={styles.rowValue}>{user?.email || "—"}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Role</Text>
            <Text style={styles.rowValue}>{user?.role}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Tenant ID</Text>
            <Text style={styles.rowValue}>{user?.tenantId || "—"}</Text>
          </View>
          <View style={[styles.row, { borderBottomWidth: 0 }]}>
            <Text style={styles.rowLabel}>User ID</Text>
            <Text style={styles.rowValue}>{user?.id || "—"}</Text>
          </View>
        </View>

        {/* Push notification diagnostics */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Push Notifications</Text>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Status</Text>
            <Text style={[styles.rowValue, { color: diagColor, fontWeight: "700" }]}>{diagState}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Bound to user</Text>
            <Text style={[styles.rowValue, diag.userId != null ? { color: boundMatches ? "#047857" : "#dc2626" } : null]}>
              {diag.userId != null ? `${diag.userId}${boundMatches ? " ✓" : " ✗"}` : "—"}
            </Text>
          </View>
          {diag.status != null && (
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Last response</Text>
              <Text style={styles.rowValue}>{diag.status}{diag.message ? ` · ${diag.message}` : ""}</Text>
            </View>
          )}
          {!!diag.baseURL && (
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Backend</Text>
              <Text style={styles.rowValue} numberOfLines={1}>{diag.baseURL.replace(/^https?:\/\//, "")}</Text>
            </View>
          )}
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Device token</Text>
            <Text style={styles.rowValue} numberOfLines={1}>
              {diag.token ? `${diag.token.slice(0, 10)}…${diag.token.slice(-6)}` : "—"}
            </Text>
          </View>
          <View style={[styles.row, { borderBottomWidth: 0 }]}>
            <Text style={styles.rowLabel}>Updated</Text>
            <Text style={styles.rowValue}>{diag.at || "—"}</Text>
          </View>
          <TouchableOpacity style={styles.reRegBtn} onPress={reRegister} disabled={reRegistering}>
            {reRegistering
              ? <ActivityIndicator size="small" color="#0f766e" />
              : <Text style={styles.reRegText}>Re-register this device</Text>}
          </TouchableOpacity>
        </View>

        {/* App info */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>App Info</Text>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Version</Text>
            <Text style={styles.rowValue}>1.0.0</Text>
          </View>
          <View style={[styles.row, { borderBottomWidth: 0 }]}>
            <Text style={styles.rowLabel}>Platform</Text>
            <Text style={styles.rowValue}>WhatsApp CRM</Text>
          </View>
        </View>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f1f5f9" },
  scroll: { gap: 16, paddingBottom: 40 },
  hero: {
    backgroundColor: "#fff",
    alignItems: "center",
    paddingVertical: 36,
    paddingHorizontal: 20,
    gap: 8,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#ccfbf1",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 30, fontWeight: "800", color: "#0f766e" },
  email: { fontSize: 16, fontWeight: "600", color: "#0f172a" },
  roleBadge: {
    backgroundColor: "#0f766e",
    borderRadius: 99,
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  roleText: { color: "#fff", fontSize: 12, fontWeight: "700", letterSpacing: 1 },
  card: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    borderRadius: 14,
    padding: 16,
  },
  cardTitle: { fontSize: 13, fontWeight: "700", color: "#64748b", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.8 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  rowLabel: { fontSize: 14, color: "#64748b" },
  rowValue: { fontSize: 14, fontWeight: "600", color: "#0f172a", maxWidth: "60%", textAlign: "right" },
  logoutBtn: {
    marginHorizontal: 16,
    backgroundColor: "#fef2f2",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#fecaca",
    paddingVertical: 14,
    alignItems: "center",
  },
  logoutText: { color: "#dc2626", fontSize: 15, fontWeight: "700" },
  reRegBtn: {
    marginTop: 12,
    backgroundColor: "#f0fdfa",
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: "center",
  },
  reRegText: { color: "#0f766e", fontSize: 14, fontWeight: "700" },
});
