import React, { useState, useCallback } from "react";
import {
  View, Text, ScrollView, StyleSheet, RefreshControl,
  TouchableOpacity, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import api from "../../api/client";
import { LoadingSpinner } from "../../components/common/LoadingSpinner";
import { useFocusEffect } from "@react-navigation/native";

interface BillingInfo {
  planName?: string;
  status?: string;
  nextBillingDate?: string;
  amount?: number;
  billingCycle?: string;
  currency?: string;
  trialEndsAt?: string;
  maxContacts?: number;
  maxUsers?: number;
  maxMessages?: number;
  currentContacts?: number;
  currentUsers?: number;
  currentMessages?: number;
  tenantName?: string;
  email?: string;
}

interface Invoice {
  id: string;
  invoiceNumber?: string;
  amount?: number;
  status?: string;
  dueDate?: string;
  paidAt?: string;
  createdAt?: string;
  description?: string;
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  ACTIVE:    { bg: "#dcfce7", text: "#22c55e" },
  INACTIVE:  { bg: "#fee2e2", text: "#ef4444" },
  TRIAL:     { bg: "#fef3c7", text: "#f59e0b" },
  CANCELLED: { bg: "#f1f5f9", text: "#94a3b8" },
  PAID:      { bg: "#dcfce7", text: "#22c55e" },
  UNPAID:    { bg: "#fee2e2", text: "#ef4444" },
  OVERDUE:   { bg: "#fee2e2", text: "#ef4444" },
  PENDING:   { bg: "#fef3c7", text: "#f59e0b" },
};

function fmtDate(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function fmtAmount(amount?: number, currency = "INR") {
  if (amount == null) return "—";
  return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
}

function UsageBar({ label, current, max }: { label: string; current?: number; max?: number }) {
  if (max == null || max === 0) return null;
  const pct = Math.min(100, Math.round(((current ?? 0) / max) * 100));
  const color = pct >= 90 ? "#ef4444" : pct >= 70 ? "#f59e0b" : "#22c55e";
  return (
    <View style={uStyles.row}>
      <View style={uStyles.labelRow}>
        <Text style={uStyles.label}>{label}</Text>
        <Text style={uStyles.value}>{(current ?? 0).toLocaleString()} / {max.toLocaleString()}</Text>
      </View>
      <View style={uStyles.track}>
        <View style={[uStyles.fill, { width: `${pct}%` as any, backgroundColor: color }]} />
      </View>
    </View>
  );
}

const uStyles = StyleSheet.create({
  row: { marginBottom: 14 },
  labelRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  label: { fontSize: 13, color: "#64748b" },
  value: { fontSize: 13, fontWeight: "600", color: "#1e293b" },
  track: { height: 6, backgroundColor: "#e2e8f0", borderRadius: 3, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 3 },
});

export default function BillingScreen() {
  const [billing, setBilling] = useState<BillingInfo | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invoicesLoading, setInvoicesLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setError(null);
    try {
      const res = await api.get("/api/tenant/billing");
      setBilling(res.data ?? null);
    } catch (e: any) {
      // Try alternate endpoint
      try {
        const res2 = await api.get("/api/tenant/subscription");
        setBilling(res2.data ?? null);
      } catch {
        setError("Billing info not available");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }

    // Fetch invoices separately (non-blocking)
    setInvoicesLoading(true);
    try {
      const endpoints = ["/api/invoices", "/api/tenant/invoices", "/api/billing/invoices"];
      for (const ep of endpoints) {
        try {
          const r = await api.get(ep, { params: { page: 0, size: 20 } });
          const data = r.data;
          const items: Invoice[] = Array.isArray(data) ? data
            : Array.isArray(data?.items) ? data.items
            : Array.isArray(data?.content) ? data.content
            : [];
          setInvoices(items);
          break;
        } catch { /* try next */ }
      }
    } catch { /* no invoices */ } finally {
      setInvoicesLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    fetchData();
  }, [fetchData]));

  if (loading) return <LoadingSpinner message="Loading billing info..." />;

  const statusStyle = billing?.status
    ? (STATUS_COLORS[billing.status] || STATUS_COLORS.INACTIVE)
    : null;

  const hasUsage = billing && (billing.maxContacts || billing.maxUsers || billing.maxMessages);

  return (
    <SafeAreaView edges={["bottom"]} style={styles.container}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} tintColor="#0f766e" />}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      >
        {!!error && !billing && (
          <View style={styles.unavailableCard}>
            <Text style={styles.unavailableIcon}>💳</Text>
            <Text style={styles.unavailableTitle}>No Billing Data</Text>
            <Text style={styles.unavailableText}>
              {error || "Billing information is not available. Please check the web dashboard."}
            </Text>
          </View>
        )}

        {billing && (
          <>
            {/* Plan card */}
            <View style={styles.planCard}>
              <Text style={styles.planLabel}>CURRENT PLAN</Text>
              <Text style={styles.planName}>{billing.planName || "Standard Plan"}</Text>
              {billing.billingCycle && (
                <Text style={styles.planCycle}>{billing.billingCycle}</Text>
              )}
              {statusStyle && (
                <View style={[styles.badge, { backgroundColor: statusStyle.bg }]}>
                  <Text style={[styles.badgeText, { color: statusStyle.text }]}>{billing.status}</Text>
                </View>
              )}
            </View>

            {/* Billing details */}
            <Text style={styles.sectionHeader}>BILLING DETAILS</Text>
            <View style={styles.card}>
              {billing.amount != null && (
                <View style={styles.row}>
                  <Text style={styles.label}>Amount</Text>
                  <Text style={[styles.value, styles.amountText]}>{fmtAmount(billing.amount, billing.currency || "INR")}</Text>
                </View>
              )}
              {billing.nextBillingDate && (
                <>
                  <View style={styles.divider} />
                  <View style={styles.row}>
                    <Text style={styles.label}>Next Billing Date</Text>
                    <Text style={styles.value}>{fmtDate(billing.nextBillingDate)}</Text>
                  </View>
                </>
              )}
              {billing.trialEndsAt && (
                <>
                  <View style={styles.divider} />
                  <View style={styles.row}>
                    <Text style={styles.label}>Trial Ends</Text>
                    <Text style={[styles.value, { color: "#f59e0b" }]}>{fmtDate(billing.trialEndsAt)}</Text>
                  </View>
                </>
              )}
              {billing.email && (
                <>
                  <View style={styles.divider} />
                  <View style={styles.row}>
                    <Text style={styles.label}>Billing Email</Text>
                    <Text style={styles.value} numberOfLines={1}>{billing.email}</Text>
                  </View>
                </>
              )}
            </View>

            {/* Usage */}
            {hasUsage && (
              <>
                <Text style={styles.sectionHeader}>USAGE</Text>
                <View style={styles.card}>
                  <UsageBar label="Contacts" current={billing.currentContacts} max={billing.maxContacts} />
                  <UsageBar label="Users" current={billing.currentUsers} max={billing.maxUsers} />
                  <UsageBar label="Messages" current={billing.currentMessages} max={billing.maxMessages} />
                </View>
              </>
            )}
          </>
        )}

        {/* Invoices */}
        <Text style={styles.sectionHeader}>INVOICE HISTORY</Text>
        {invoicesLoading ? (
          <ActivityIndicator color="#0f766e" style={{ marginTop: 20 }} />
        ) : invoices.length === 0 ? (
          <Text style={styles.emptyText}>No invoices found</Text>
        ) : invoices.map(inv => {
          const st = STATUS_COLORS[inv.status ?? "PENDING"] || STATUS_COLORS.PENDING;
          return (
            <View key={inv.id} style={styles.invoiceCard}>
              <View style={styles.invoiceRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.invoiceNum}>{inv.invoiceNumber || `INV-${inv.id}`}</Text>
                  {inv.description && <Text style={styles.invoiceDesc} numberOfLines={1}>{inv.description}</Text>}
                  <Text style={styles.invoiceDate}>{fmtDate(inv.paidAt || inv.dueDate || inv.createdAt)}</Text>
                </View>
                <View style={{ alignItems: "flex-end", gap: 6 }}>
                  <Text style={styles.invoiceAmount}>{fmtAmount(inv.amount)}</Text>
                  <View style={[styles.badge, { backgroundColor: st.bg }]}>
                    <Text style={[styles.badgeText, { color: st.text }]}>{inv.status || "PENDING"}</Text>
                  </View>
                </View>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f1f5f9" },
  planCard: {
    backgroundColor: "#0f766e",
    borderRadius: 16,
    padding: 24,
    marginBottom: 16,
    alignItems: "center",
    gap: 8,
  },
  planLabel: { fontSize: 11, color: "#99f6e4", fontWeight: "700", letterSpacing: 1, textTransform: "uppercase" },
  planName: { fontSize: 26, fontWeight: "800", color: "#fff" },
  planCycle: { fontSize: 13, color: "#ccfbf1" },
  badge: { borderRadius: 99, paddingHorizontal: 12, paddingVertical: 5 },
  badgeText: { fontSize: 12, fontWeight: "700" },
  sectionHeader: { fontSize: 11, fontWeight: "700", color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1, paddingVertical: 10 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 10 },
  label: { fontSize: 14, color: "#64748b" },
  value: { fontSize: 14, fontWeight: "600", color: "#1e293b", maxWidth: "55%", textAlign: "right" },
  amountText: { fontSize: 20, fontWeight: "800", color: "#0f766e" },
  divider: { height: 1, backgroundColor: "#f1f5f9" },
  invoiceCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  invoiceRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  invoiceNum: { fontSize: 14, fontWeight: "700", color: "#1e293b" },
  invoiceDesc: { fontSize: 12, color: "#64748b", marginTop: 2 },
  invoiceDate: { fontSize: 11, color: "#94a3b8", marginTop: 4 },
  invoiceAmount: { fontSize: 15, fontWeight: "700", color: "#0f766e" },
  emptyText: { fontSize: 14, color: "#94a3b8" },
  unavailableCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 32,
    alignItems: "center",
    gap: 12,
    elevation: 2,
  },
  unavailableIcon: { fontSize: 48 },
  unavailableTitle: { fontSize: 18, fontWeight: "700", color: "#1e293b" },
  unavailableText: { fontSize: 14, color: "#64748b", textAlign: "center", lineHeight: 20 },
});
