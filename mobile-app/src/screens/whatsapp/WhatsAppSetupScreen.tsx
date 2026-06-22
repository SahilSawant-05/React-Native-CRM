import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
} from "react-native";
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
          <Text style={styles.waIcon}>💬</Text>
          <Text style={styles.headerTitle}>WhatsApp Business</Text>
          <View style={[styles.badge, { backgroundColor: connected ? "#dcfce7" : "#fee2e2" }]}>
            <Text style={[styles.badgeText, { color: connected ? "#22c55e" : "#ef4444" }]}>
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
            <Text style={styles.notConnectedIcon}>⚠️</Text>
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
  container: { flex: 1, backgroundColor: "#f1f5f9" },
  headerCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 24,
    marginBottom: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  waIcon: { fontSize: 48, marginBottom: 12 },
  headerTitle: { fontSize: 20, fontWeight: "700", color: "#1e293b", marginBottom: 12 },
  badge: { borderRadius: 99, paddingHorizontal: 12, paddingVertical: 5 },
  badgeText: { fontSize: 13, fontWeight: "700" },
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  sectionHeader: { fontSize: 11, fontWeight: "700", color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 8 },
  label: { fontSize: 13, color: "#64748b" },
  value: { fontSize: 13, fontWeight: "600", color: "#1e293b", maxWidth: "60%", textAlign: "right" },
  divider: { height: 1, backgroundColor: "#f1f5f9" },
  notConnectedCard: { alignItems: "center", padding: 32 },
  notConnectedIcon: { fontSize: 40, marginBottom: 12 },
  notConnectedText: { fontSize: 16, fontWeight: "600", color: "#1e293b", textAlign: "center", marginBottom: 8 },
  notConnectedSub: { fontSize: 13, color: "#64748b", textAlign: "center" },
});
