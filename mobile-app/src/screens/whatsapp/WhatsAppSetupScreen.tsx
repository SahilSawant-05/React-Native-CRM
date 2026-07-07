import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import api from "../../api/client";
import { LoadingSpinner } from "../../components/common/LoadingSpinner";
import { useFocusEffect } from "@react-navigation/native";

interface WhatsAppInfo {
  wabaId: string;
  phoneNumberId: string;
  displayName?: string;
}

export default function WhatsAppSetupScreen() {
  const [info, setInfo] = useState<WhatsAppInfo | null>(null);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await api.get<WhatsAppInfo>("/api/whatsapp/me");
      setInfo(res.data);
      setConnected(true);
    } catch (e: any) {
      setConnected(false);
      setInfo(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchStatus();
    }, [fetchStatus])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchStatus();
  };

  if (loading) return <LoadingSpinner message="Checking WhatsApp status..." />;

  return (
    <SafeAreaView edges={["bottom"]} style={styles.container}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0f766e" />}
        contentContainerStyle={{ padding: 16 }}
      >
        <View style={styles.headerCard}>
          <View style={styles.waIconWrap}>
            <Ionicons name="logo-whatsapp" size={30} color="#25d366" />
          </View>
          <Text style={styles.headerTitle}>WhatsApp Business</Text>
          <View style={[styles.badge, { backgroundColor: connected ? "#dcfce7" : "#fee2e2" }]}>
            <Text style={[styles.badgeText, { color: connected ? "#15803d" : "#b91c1c" }]}>
              {connected ? "Connected" : "Not Connected"}
            </Text>
          </View>
        </View>

        {connected && info ? (
          <View style={styles.card}>
            <Text style={styles.sectionHeader}>ACCOUNT DETAILS</Text>
            <View style={styles.row}>
              <Text style={styles.label}>WABA ID</Text>
              <Text style={styles.value}>{info.wabaId}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.row}>
              <Text style={styles.label}>Phone Number ID</Text>
              <Text style={styles.value}>{info.phoneNumberId}</Text>
            </View>
            {info.displayName && (
              <>
                <View style={styles.divider} />
                <View style={styles.row}>
                  <Text style={styles.label}>Display Name</Text>
                  <Text style={styles.value}>{info.displayName}</Text>
                </View>
              </>
            )}
          </View>
        ) : (
          <View style={[styles.card, styles.notConnectedCard]}>
            <Ionicons name="alert-circle-outline" size={36} color="#9ca3af" style={styles.notConnectedIcon} />
            <Text style={styles.notConnectedText}>
              Connect via web dashboard to set up WhatsApp
            </Text>
            <Text style={styles.notConnectedSub}>
              Visit the web dashboard to connect your WhatsApp Business account.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8f9fb" },
  headerCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 24,
    marginBottom: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  waIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(37,211,102,0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 12,
    fontFamily: Platform.OS === "android" ? "sans-serif-medium" : undefined,
    letterSpacing: Platform.OS === "ios" ? -0.32 : 0,
  },
  badge: { borderRadius: 99, paddingHorizontal: 12, paddingVertical: 5 },
  badgeText: { fontSize: 11, fontWeight: "600" },
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: "600",
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 12,
    fontFamily: Platform.OS === "android" ? "sans-serif-medium" : undefined,
  },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 10 },
  label: {
    fontSize: 13,
    color: "#6b7280",
    letterSpacing: Platform.OS === "ios" ? -0.15 : 0,
  },
  value: {
    fontSize: 13,
    fontWeight: "600",
    color: "#111827",
    maxWidth: "60%",
    textAlign: "right",
    fontFamily: Platform.OS === "android" ? "sans-serif-medium" : undefined,
    letterSpacing: Platform.OS === "ios" ? -0.15 : 0,
  },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: "rgba(60,60,67,0.12)" },
  notConnectedCard: { alignItems: "center", padding: 32 },
  notConnectedIcon: { marginBottom: 12 },
  notConnectedText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111827",
    textAlign: "center",
    marginBottom: 8,
    fontFamily: Platform.OS === "android" ? "sans-serif-medium" : undefined,
    letterSpacing: Platform.OS === "ios" ? -0.32 : 0,
  },
  notConnectedSub: {
    fontSize: 12.5,
    color: "#6b7280",
    textAlign: "center",
    lineHeight: 18,
  },
});
