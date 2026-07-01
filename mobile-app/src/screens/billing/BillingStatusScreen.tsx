import React, { useCallback, useState } from "react";
import {
  View, Text, ScrollView, StyleSheet, RefreshControl, TouchableOpacity, Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import api from "../../api/client";
import { LoadingSpinner } from "../../components/common/LoadingSpinner";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(v?: string) {
  if (!v) return "—";
  try {
    return new Date(v).toLocaleDateString("en-IN", {
      day: "numeric", month: "short", year: "numeric",
    });
  } catch { return v; }
}

function fmtStorage(bytes?: number | null) {
  const n = Number(bytes ?? 0);
  if (!n) return "0 MB";
  const gb = n / 1024 / 1024 / 1024;
  if (gb >= 1) return `${gb % 1 === 0 ? gb : gb.toFixed(1)} GB`;
  return `${Math.max(0, Math.round(n / 1024 / 1024))} MB`;
}

function fmtNum(v?: number | null) {
  const n = Number(v ?? 0);
  return isNaN(n) ? "0" : n.toLocaleString("en-IN");
}

// ─── UsageMeter ──────────────────────────────────────────────────────────────

function UsageMeter({
  label, used, limit, fmt = fmtNum,
}: {
  label: string;
  used?: number;
  limit?: number;
  fmt?: (v: number) => string;
}) {
  if (!limit) return null;
  const pct = Math.min(100, Math.round(((used ?? 0) / limit) * 100));
  const color = pct >= 90 ? "#ef4444" : pct >= 70 ? "#f59e0b" : "#22c55e";
  return (
    <View style={s.meterRow}>
      <View style={s.meterTop}>
        <Text style={s.meterLabel}>{label}</Text>
        <Text style={s.meterVal}>{fmt(used ?? 0)} / {fmt(limit)}</Text>
      </View>
      <View style={s.track}>
        <View style={[s.fill, { width: `${pct}%` as any, backgroundColor: color }]} />
      </View>
      <Text style={[s.pct, { color }]}>{pct}% used</Text>
    </View>
  );
}

// ─── InfoRow ─────────────────────────────────────────────────────────────────

function InfoRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={s.infoRow}>
      <Text style={s.infoLabel}>{label}</Text>
      <Text style={[s.infoVal, highlight && s.infoValHighlight]}>{value}</Text>
    </View>
  );
}

// ─── Screen ──────────────────────────────────────────────────────────────────

// Update this to your actual web dashboard / billing URL
const WEB_DASHBOARD_URL = "https://app.vistaarflow.in/dashboard/billing";

export default function BillingStatusScreen() {
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setError(null);
    try {
      const res = await api.get("/api/billing/summary");
      setSummary(res.data);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || "Failed to load billing");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    fetchData();
  }, [fetchData]));

  if (loading) return <LoadingSpinner message="Loading billing..." />;

  const usage = summary?.usage ?? {};
  const subscription = summary?.subscription ?? {};

  const statusColor = (s: string) => {
    const v = (s || "").toUpperCase();
    if (v === "ACTIVE") return "#16a34a";
    if (v === "TRIAL") return "#f59e0b";
    if (v === "EXPIRED" || v === "CANCELLED") return "#ef4444";
    return "#64748b";
  };

  return (
    <SafeAreaView edges={["bottom"]} style={s.container}>
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchData(); }}
            tintColor="#0f766e"
          />
        }
        contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
      >
        {!!error && !summary && (
          <View style={s.errorCard}>
            <Text style={s.errorIcon}>💳</Text>
            <Text style={s.errorTitle}>Billing Unavailable</Text>
            <Text style={s.errorMsg}>{error}</Text>
          </View>
        )}

        {summary && (
          <>
            {/* Plan banner */}
            <View style={s.planCard}>
              <Text style={s.planMeta}>CURRENT PLAN</Text>
              <Text style={s.planName}>{summary.planKey || "STARTER"}</Text>
              <View style={[s.statusBadge, { backgroundColor: statusColor(summary.subscriptionStatus) + "22" }]}>
                <Text style={[s.statusText, { color: statusColor(summary.subscriptionStatus) }]}>
                  {summary.subscriptionStatus || "TRIAL"}
                </Text>
              </View>
            </View>

            {/* Subscription details */}
            <Text style={s.sectionHeader}>SUBSCRIPTION</Text>
            <View style={s.card}>
              <InfoRow label="Plan" value={summary.planKey || "—"} />
              <InfoRow label="Status" value={summary.subscriptionStatus || "—"} highlight />
              <InfoRow
                label="Next Due Date"
                value={fmtDate(subscription.currentPeriodEnd)}
                highlight={!!subscription.currentPeriodEnd}
              />
              {subscription.currentPeriodStart && (
                <InfoRow label="Started" value={fmtDate(subscription.currentPeriodStart)} />
              )}
              {summary.balanceCredits != null && (
                <InfoRow label="Credits Balance" value={fmtNum(summary.balanceCredits)} />
              )}
            </View>

            {/* Usage */}
            <Text style={s.sectionHeader}>USAGE</Text>
            <View style={s.card}>
              <UsageMeter label="Seats"     used={usage.seatsUsed}     limit={usage.seatsLimit} />
              <UsageMeter label="Contacts"  used={usage.contactsUsed}  limit={usage.contactsLimit} />
              <UsageMeter label="Pipelines" used={usage.pipelinesUsed} limit={usage.pipelinesLimit} />
              <UsageMeter
                label="Storage"
                used={usage.storageUsedBytes}
                limit={usage.storageLimitBytes}
                fmt={fmtStorage}
              />
              {!usage.seatsLimit && !usage.contactsLimit && (
                <Text style={{ fontSize: 13, color: "#94a3b8", textAlign: "center", paddingVertical: 8 }}>
                  No usage data available
                </Text>
              )}
            </View>
          </>
        )}

        {/* ── Footer note: purchases happen on web ── */}
        <View style={s.footerNote}>
          <Text style={s.footerNoteText}>
            To buy or purchase a package, please visit our website or the web dashboard.
          </Text>
          <TouchableOpacity onPress={() => Linking.openURL(WEB_DASHBOARD_URL)} activeOpacity={0.7}>
            <Text style={s.footerNoteLink}>Open web dashboard</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f1f5f9" },

  planCard: {
    backgroundColor: "#0f766e", borderRadius: 16, padding: 24,
    marginBottom: 8, alignItems: "center",
  },
  planMeta: {
    fontSize: 11, color: "#99f6e4", fontWeight: "700",
    letterSpacing: 1, marginBottom: 6, textTransform: "uppercase",
  },
  planName: { fontSize: 30, fontWeight: "800", color: "#fff", marginBottom: 10 },
  statusBadge: { borderRadius: 99, paddingHorizontal: 16, paddingVertical: 5 },
  statusText: { fontSize: 13, fontWeight: "700" },

  sectionHeader: {
    fontSize: 11, fontWeight: "700", color: "#94a3b8",
    textTransform: "uppercase", letterSpacing: 1, paddingVertical: 10,
  },

  card: {
    backgroundColor: "#fff", borderRadius: 14, padding: 16, marginBottom: 8,
    elevation: 1, shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 3,
  },

  infoRow: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: "#f1f5f9",
  },
  infoLabel: { fontSize: 14, color: "#64748b" },
  infoVal: { fontSize: 14, fontWeight: "600", color: "#1e293b" },
  infoValHighlight: { color: "#0f766e" },

  meterRow: { marginBottom: 16 },
  meterTop: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  meterLabel: { fontSize: 13, color: "#64748b" },
  meterVal: { fontSize: 13, fontWeight: "600", color: "#1e293b" },
  track: { height: 7, backgroundColor: "#e2e8f0", borderRadius: 4, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 4 },
  pct: { fontSize: 11, marginTop: 3, fontWeight: "600" },

  errorCard: {
    backgroundColor: "#fff", borderRadius: 14, padding: 32,
    alignItems: "center", marginTop: 20,
  },
  errorIcon: { fontSize: 40, marginBottom: 10 },
  errorTitle: { fontSize: 18, fontWeight: "700", color: "#1e293b", marginBottom: 8 },
  errorMsg: { fontSize: 14, color: "#64748b", textAlign: "center" },

  footerNote: { marginTop: 20, alignItems: "center", paddingHorizontal: 24, paddingVertical: 8 },
  footerNoteText: { fontSize: 12, color: "#94a3b8", textAlign: "center", lineHeight: 18 },
  footerNoteLink: { fontSize: 12, color: "#0f766e", fontWeight: "700", marginTop: 6, textDecorationLine: "underline" },
});