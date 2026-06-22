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

interface BillingInfo {
  planName: string;
  status: string;
  nextBillingDate: string;
  amount: number;
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  ACTIVE: { bg: "#dcfce7", text: "#22c55e" },
  INACTIVE: { bg: "#fee2e2", text: "#ef4444" },
  TRIAL: { bg: "#fef3c7", text: "#f59e0b" },
  CANCELLED: { bg: "#f1f5f9", text: "#94a3b8" },
};

export default function BillingScreen() {
  const [billing, setBilling] = useState<BillingInfo | null>(null);
  const [notAvailable, setNotAvailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchBilling = useCallback(async () => {
    try {
      const res = await api.get<BillingInfo>("/api/tenant/billing");
      setBilling(res.data);
      setNotAvailable(false);
    } catch {
      setBilling(null);
      setNotAvailable(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchBilling();
    }, [fetchBilling])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchBilling();
  };

  const formatDate = (iso: string) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
  };

  const formatAmount = (amount: number) =>
    "₹" + amount.toLocaleString("en-IN", { maximumFractionDigits: 0 });

  if (loading) return <LoadingSpinner message="Loading billing info..." />;

  return (
    <SafeAreaView edges={["bottom"]} style={styles.container}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0f766e" />}
        contentContainerStyle={{ padding: 16 }}
      >
        {notAvailable || !billing ? (
          <View style={styles.unavailableCard}>
            <Text style={styles.unavailableIcon}>💳</Text>
            <Text style={styles.unavailableText}>
              Billing information not available. Please check the web dashboard.
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.planCard}>
              <Text style={styles.planLabel}>Current Plan</Text>
              <Text style={styles.planName}>{billing.planName}</Text>
              <View style={[styles.badge, { backgroundColor: (STATUS_COLORS[billing.status] || STATUS_COLORS.INACTIVE).bg }]}>
                <Text style={[styles.badgeText, { color: (STATUS_COLORS[billing.status] || STATUS_COLORS.INACTIVE).text }]}>
                  {billing.status}
                </Text>
              </View>
            </View>

            <Text style={styles.sectionHeader}>BILLING DETAILS</Text>
            <View style={styles.card}>
              <View style={styles.row}>
                <Text style={styles.label}>Next Billing Date</Text>
                <Text style={styles.value}>{formatDate(billing.nextBillingDate)}</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.row}>
                <Text style={styles.label}>Amount</Text>
                <Text style={[styles.value, styles.amount]}>{formatAmount(billing.amount)}</Text>
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f1f5f9" },
  planCard: {
    backgroundColor: "#0f766e",
    borderRadius: 14,
    padding: 24,
    marginBottom: 16,
    alignItems: "center",
  },
  planLabel: { fontSize: 13, color: "#99f6e4", marginBottom: 6 },
  planName: { fontSize: 24, fontWeight: "700", color: "#fff", marginBottom: 12 },
  badge: { borderRadius: 99, paddingHorizontal: 12, paddingVertical: 5 },
  badgeText: { fontSize: 13, fontWeight: "700" },
  sectionHeader: { fontSize: 11, fontWeight: "700", color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1, paddingVertical: 8 },
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
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 10 },
  label: { fontSize: 14, color: "#64748b" },
  value: { fontSize: 14, fontWeight: "600", color: "#1e293b" },
  amount: { fontSize: 18, fontWeight: "700", color: "#0f766e" },
  divider: { height: 1, backgroundColor: "#f1f5f9" },
  unavailableCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 32,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  unavailableIcon: { fontSize: 48, marginBottom: 16 },
  unavailableText: { fontSize: 15, color: "#64748b", textAlign: "center", lineHeight: 22 },
});
