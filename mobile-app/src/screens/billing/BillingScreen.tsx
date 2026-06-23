import React, { useState, useCallback } from "react";
import {
  View, Text, ScrollView, StyleSheet, RefreshControl,
  TouchableOpacity, ActivityIndicator, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import RazorpayCheckout from "react-native-razorpay";
import api from "../../api/client";
import { LoadingSpinner } from "../../components/common/LoadingSpinner";
import { useFocusEffect } from "@react-navigation/native";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Payment {
  id: string;
  amount?: number;
  status?: string;
  createdAt?: string;
  description?: string;
  razorpayPaymentId?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

function fmtCurrency(paise?: number) {
  if (paise == null) return "—";
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(paise / 100);
}

function fmtCredits(v?: number) {
  if (v == null) return "0";
  return Number.isInteger(v) ? v.toLocaleString() : v.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function fmtStorage(bytes?: number) {
  if (!bytes) return "0 MB";
  const gb = bytes / 1024 / 1024 / 1024;
  if (gb >= 1) return `${Number.isInteger(gb) ? gb : gb.toFixed(1)} GB`;
  return `${Math.max(0, Math.round(bytes / 1024 / 1024))} MB`;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function UsageBar({ label, current, max }: { label: string; current?: number; max?: number }) {
  if (!max) return null;
  const pct = Math.min(100, Math.round(((current ?? 0) / max) * 100));
  const color = pct >= 90 ? "#ef4444" : pct >= 70 ? "#f59e0b" : "#22c55e";
  return (
    <View style={u.row}>
      <View style={u.labelRow}>
        <Text style={u.label}>{label}</Text>
        <Text style={u.value}>{(current ?? 0).toLocaleString()} / {max.toLocaleString()}</Text>
      </View>
      <View style={u.track}>
        <View style={[u.fill, { width: `${pct}%` as any, backgroundColor: color }]} />
      </View>
    </View>
  );
}

const u = StyleSheet.create({
  row: { marginBottom: 14 },
  labelRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  label: { fontSize: 13, color: "#64748b" },
  value: { fontSize: 13, fontWeight: "600", color: "#1e293b" },
  track: { height: 6, backgroundColor: "#e2e8f0", borderRadius: 3, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 3 },
});

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function BillingScreen() {
  const [summary, setSummary] = useState<any>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [creditPackages, setCreditPackages] = useState<any[]>([]);
  const [storagePackages, setStoragePackages] = useState<any[]>([]);
  const [billingCycle, setBillingCycle] = useState<"MONTHLY" | "YEARLY">("MONTHLY");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [buyingKey, setBuyingKey] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setError(null);
    try {
      const [summaryRes, paymentsRes, topupRes, storageRes] = await Promise.all([
        api.get("/api/billing/summary"),
        api.get("/api/billing/payments").catch(() => ({ data: [] })),
        api.get("/api/billing/topup-packages").catch(() => ({ data: [] })),
        api.get("/api/billing/storage-packages").catch(() => ({ data: [] })),
      ]);
      setSummary(summaryRes.data);
      setPayments(Array.isArray(paymentsRes.data) ? paymentsRes.data : []);
      setCreditPackages(Array.isArray(topupRes.data) ? topupRes.data : []);
      setStoragePackages(Array.isArray(storageRes.data) ? storageRes.data : []);
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

  const verifyPayment = async (orderId: string, paymentId: string, signature: string) => {
    await api.post("/api/billing/razorpay/verify", {
      razorpayOrderId: orderId,
      razorpayPaymentId: paymentId,
      razorpaySignature: signature,
    });
    fetchData();
  };

  const buyCredits = async (packageKey: string) => {
    setBuyingKey(packageKey);
    try {
      const { data: order } = await api.post("/api/billing/razorpay/credits/order", { packageKey });
      const payment = await RazorpayCheckout.open({
        key: order.keyId,
        amount: order.amountPaise,
        currency: order.currency ?? "INR",
        name: "CRM",
        order_id: order.razorpayOrderId,
        description: "Credit Top-up",
        theme: { color: "#0f766e" },
      });
      await verifyPayment(order.razorpayOrderId, payment.razorpay_payment_id, payment.razorpay_signature);
      Alert.alert("Success", "Credits purchased successfully!");
    } catch (err: any) {
      if (err?.code !== "PAYMENT_CANCELLED") {
        Alert.alert("Payment Failed", err?.description || err?.message || "Something went wrong");
      }
    } finally {
      setBuyingKey(null);
    }
  };

  const buyStorage = async (packageKey: string) => {
    setBuyingKey(packageKey);
    try {
      const { data: order } = await api.post("/api/billing/razorpay/storage/order", { packageKey });
      const payment = await RazorpayCheckout.open({
        key: order.keyId,
        amount: order.amountPaise,
        currency: order.currency ?? "INR",
        name: "CRM",
        order_id: order.razorpayOrderId,
        description: "Storage Package",
        theme: { color: "#0f766e" },
      });
      await verifyPayment(order.razorpayOrderId, payment.razorpay_payment_id, payment.razorpay_signature);
      Alert.alert("Success", "Storage upgraded successfully!");
    } catch (err: any) {
      if (err?.code !== "PAYMENT_CANCELLED") {
        Alert.alert("Payment Failed", err?.description || err?.message || "Something went wrong");
      }
    } finally {
      setBuyingKey(null);
    }
  };

  const upgradePlan = async (planKey: string) => {
    setBuyingKey(planKey + "_" + billingCycle);
    try {
      const { data: order } = await api.post("/api/billing/razorpay/plans/order", {
        planKey,
        billingCycle,
      });
      const payment = await RazorpayCheckout.open({
        key: order.keyId,
        amount: order.amountPaise,
        currency: order.currency ?? "INR",
        name: "CRM",
        order_id: order.razorpayOrderId,
        description: `${planKey} - ${billingCycle}`,
        theme: { color: "#0f766e" },
      });
      await verifyPayment(order.razorpayOrderId, payment.razorpay_payment_id, payment.razorpay_signature);
      Alert.alert("Success", "Plan upgraded successfully!");
    } catch (err: any) {
      if (err?.code !== "PAYMENT_CANCELLED") {
        Alert.alert("Payment Failed", err?.description || err?.message || "Something went wrong");
      }
    } finally {
      setBuyingKey(null);
    }
  };

  if (loading) return <LoadingSpinner message="Loading billing info..." />;

  const subscription = summary?.subscription ?? {};
  const usage = summary?.usage ?? {};
  const plans: any[] = summary?.plans ?? [];
  const paidPayments = payments.filter(p => p.status === "PAID");

  const statusStyle = subscription.status
    ? (STATUS_COLORS[subscription.status] || STATUS_COLORS.INACTIVE)
    : null;

  return (
    <SafeAreaView edges={["bottom"]} style={styles.container}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} tintColor="#0f766e" />}
        contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
      >
        {!!error && !summary && (
          <View style={styles.errorCard}>
            <Text style={{ fontSize: 40, marginBottom: 12 }}>💳</Text>
            <Text style={styles.errorTitle}>Billing Unavailable</Text>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* ── Available Credits ── */}
        {summary && (
          <View style={[styles.card, { alignItems: "center", paddingVertical: 20 }]}>
            <Text style={styles.sectionHeader}>AVAILABLE CREDITS</Text>
            <Text style={styles.creditsNum}>{fmtCredits(summary.availableCredits)}</Text>
            {summary.availableStorageBytes != null && (
              <Text style={styles.storageLine}>Storage: {fmtStorage(summary.availableStorageBytes)}</Text>
            )}
          </View>
        )}

        {/* ── Current Plan ── */}
        <View style={styles.planCard}>
          <Text style={styles.planLabel}>CURRENT PLAN</Text>
          <Text style={styles.planName}>{subscription.planName || "Free Plan"}</Text>
          {subscription.billingCycle && (
            <Text style={styles.planCycle}>{subscription.billingCycle}</Text>
          )}
          {statusStyle && (
            <View style={[styles.badge, { backgroundColor: statusStyle.bg, marginTop: 4 }]}>
              <Text style={[styles.badgeText, { color: statusStyle.text }]}>{subscription.status}</Text>
            </View>
          )}
          {subscription.currentPeriodEnd && (
            <Text style={styles.planRenews}>Renews {fmtDate(subscription.currentPeriodEnd)}</Text>
          )}
        </View>

        {/* ── Usage ── */}
        {summary && (
          <>
            <Text style={styles.sectionHeader}>USAGE</Text>
            <View style={styles.card}>
              <UsageBar label="Messages" current={usage.messagesSent} max={usage.messagesLimit} />
              <UsageBar label="Contacts" current={usage.contactsCount} max={usage.contactsLimit} />
              <UsageBar label="Storage" current={usage.storageUsedBytes} max={usage.storageLimitBytes} />
              <UsageBar label="Users" current={usage.usersCount} max={usage.usersLimit} />
            </View>
          </>
        )}

        {/* ── Buy Credits ── */}
        {creditPackages.length > 0 && (
          <>
            <Text style={styles.sectionHeader}>BUY CREDITS</Text>
            {creditPackages.map(pkg => {
              const key = pkg.packageKey;
              const busy = buyingKey === key;
              return (
                <View key={key} style={styles.pkgCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pkgName}>{pkg.displayName || pkg.name}</Text>
                    <Text style={styles.pkgDetail}>{fmtCredits(pkg.credits)} Credits</Text>
                    {pkg.bonusCredits > 0 && (
                      <Text style={styles.pkgBonus}>+{fmtCredits(pkg.bonusCredits)} bonus</Text>
                    )}
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 8 }}>
                    <Text style={styles.pkgPrice}>{fmtCurrency(pkg.amountPaise ?? pkg.price * 100)}</Text>
                    <TouchableOpacity
                      style={[styles.buyBtn, busy && styles.buyBtnDisabled]}
                      onPress={() => buyCredits(key)}
                      disabled={!!buyingKey}
                    >
                      {busy ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <Text style={styles.buyBtnText}>Buy</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </>
        )}

        {/* ── Storage Packages ── */}
        {storagePackages.length > 0 && (
          <>
            <Text style={styles.sectionHeader}>STORAGE PACKAGES</Text>
            {storagePackages.map(pkg => {
              const key = pkg.packageKey;
              const busy = buyingKey === key;
              return (
                <View key={key} style={styles.pkgCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pkgName}>{pkg.displayName || pkg.name}</Text>
                    <Text style={styles.pkgDetail}>{pkg.storageGb} GB Storage</Text>
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 8 }}>
                    <Text style={styles.pkgPrice}>{fmtCurrency(pkg.amountPaise ?? pkg.price * 100)}</Text>
                    <TouchableOpacity
                      style={[styles.buyBtn, busy && styles.buyBtnDisabled]}
                      onPress={() => buyStorage(key)}
                      disabled={!!buyingKey}
                    >
                      {busy ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <Text style={styles.buyBtnText}>Buy</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </>
        )}

        {/* ── Upgrade Plan ── */}
        {plans.length > 0 && (
          <>
            <Text style={styles.sectionHeader}>UPGRADE PLAN</Text>

            {/* Monthly / Yearly toggle */}
            <View style={styles.cycleToggle}>
              <TouchableOpacity
                style={[styles.cycleBtn, billingCycle === "MONTHLY" && styles.cycleBtnActive]}
                onPress={() => setBillingCycle("MONTHLY")}
              >
                <Text style={[styles.cycleBtnText, billingCycle === "MONTHLY" && styles.cycleBtnTextActive]}>Monthly</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.cycleBtn, billingCycle === "YEARLY" && styles.cycleBtnActive]}
                onPress={() => setBillingCycle("YEARLY")}
              >
                <Text style={[styles.cycleBtnText, billingCycle === "YEARLY" && styles.cycleBtnTextActive]}>Yearly</Text>
                <Text style={[styles.saveTag, billingCycle === "YEARLY" && { color: "#fff" }]}>Save 20%</Text>
              </TouchableOpacity>
            </View>

            {plans.map(plan => {
              const planKey = plan.planKey || plan.key;
              const busy = buyingKey === planKey + "_" + billingCycle;
              const isCurrent = subscription.planKey === planKey;
              const price = billingCycle === "YEARLY"
                ? (plan.yearlyAmountPaise ?? plan.yearlyPrice * 100)
                : (plan.monthlyAmountPaise ?? plan.monthlyPrice * 100);
              return (
                <View key={planKey} style={[styles.planPkgCard, isCurrent && styles.planPkgCurrent]}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
                    <Text style={styles.planPkgName}>{plan.displayName || plan.name}</Text>
                    {isCurrent && (
                      <View style={[styles.badge, { backgroundColor: "#dcfce7" }]}>
                        <Text style={[styles.badgeText, { color: "#22c55e" }]}>Current</Text>
                      </View>
                    )}
                  </View>
                  {plan.description && (
                    <Text style={styles.planPkgDesc}>{plan.description}</Text>
                  )}
                  {(plan.messagesLimit || plan.contactsLimit) && (
                    <View style={styles.planFeatures}>
                      {plan.messagesLimit && <Text style={styles.planFeature}>✓ {fmtCredits(plan.messagesLimit)} messages/mo</Text>}
                      {plan.contactsLimit && <Text style={styles.planFeature}>✓ {fmtCredits(plan.contactsLimit)} contacts</Text>}
                      {plan.usersLimit && <Text style={styles.planFeature}>✓ {plan.usersLimit} users</Text>}
                    </View>
                  )}
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 12 }}>
                    <Text style={styles.planPkgPrice}>{fmtCurrency(price)}<Text style={styles.planPkgCycle}>/{billingCycle === "YEARLY" ? "yr" : "mo"}</Text></Text>
                    {!isCurrent && (
                      <TouchableOpacity
                        style={[styles.upgradeBtn, busy && styles.buyBtnDisabled]}
                        onPress={() => upgradePlan(planKey)}
                        disabled={!!buyingKey}
                      >
                        {busy ? (
                          <ActivityIndicator color="#fff" size="small" />
                        ) : (
                          <Text style={styles.upgradeBtnText}>Upgrade</Text>
                        )}
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })}
          </>
        )}

        {/* ── Payment History ── */}
        <Text style={styles.sectionHeader}>PAYMENT HISTORY</Text>
        {paidPayments.length === 0 ? (
          <Text style={styles.emptyText}>No payments yet</Text>
        ) : paidPayments.map(p => (
          <View key={p.id} style={styles.payCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.payDesc}>{p.description || "Payment"}</Text>
              <Text style={styles.payDate}>{fmtDate(p.createdAt)}</Text>
              {p.razorpayPaymentId && (
                <Text style={styles.payId} numberOfLines={1}>{p.razorpayPaymentId}</Text>
              )}
            </View>
            <View style={{ alignItems: "flex-end", gap: 4 }}>
              <Text style={styles.payAmount}>{fmtCurrency(p.amount)}</Text>
              <View style={[styles.badge, { backgroundColor: "#dcfce7" }]}>
                <Text style={[styles.badgeText, { color: "#22c55e" }]}>PAID</Text>
              </View>
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f1f5f9" },

  planCard: {
    backgroundColor: "#0f766e",
    borderRadius: 16,
    padding: 24,
    marginBottom: 8,
    alignItems: "center",
  },
  planLabel: { fontSize: 11, color: "#99f6e4", fontWeight: "700", letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 },
  planName: { fontSize: 26, fontWeight: "800", color: "#fff" },
  planCycle: { fontSize: 13, color: "#ccfbf1", marginTop: 4 },
  planRenews: { fontSize: 12, color: "#99f6e4", marginTop: 8 },

  badge: { borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 11, fontWeight: "700" },

  sectionHeader: { fontSize: 11, fontWeight: "700", color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1, paddingVertical: 10 },

  creditsNum: { fontSize: 40, fontWeight: "800", color: "#0f766e", marginTop: 4 },
  storageLine: { fontSize: 13, color: "#64748b", marginTop: 6 },

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

  pkgCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  pkgName: { fontSize: 14, fontWeight: "700", color: "#1e293b" },
  pkgDetail: { fontSize: 13, color: "#64748b", marginTop: 2 },
  pkgBonus: { fontSize: 12, color: "#22c55e", marginTop: 2, fontWeight: "600" },
  pkgPrice: { fontSize: 16, fontWeight: "700", color: "#0f766e" },

  buyBtn: { backgroundColor: "#0f766e", borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8, minWidth: 64, alignItems: "center" },
  buyBtnDisabled: { opacity: 0.5 },
  buyBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },

  cycleToggle: { flexDirection: "row", backgroundColor: "#e2e8f0", borderRadius: 10, padding: 3, marginBottom: 12 },
  cycleBtn: { flex: 1, paddingVertical: 9, borderRadius: 8, alignItems: "center" },
  cycleBtnActive: { backgroundColor: "#0f766e" },
  cycleBtnText: { fontSize: 13, fontWeight: "600", color: "#64748b" },
  cycleBtnTextActive: { color: "#fff" },
  saveTag: { fontSize: 10, color: "#22c55e", fontWeight: "700" },

  planPkgCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  planPkgCurrent: { borderColor: "#0f766e", borderWidth: 2 },
  planPkgName: { fontSize: 16, fontWeight: "800", color: "#0f172a" },
  planPkgDesc: { fontSize: 12, color: "#64748b", marginBottom: 8 },
  planFeatures: { gap: 4, marginTop: 4 },
  planFeature: { fontSize: 13, color: "#475569" },
  planPkgPrice: { fontSize: 22, fontWeight: "800", color: "#0f766e" },
  planPkgCycle: { fontSize: 13, fontWeight: "400", color: "#64748b" },
  upgradeBtn: { backgroundColor: "#0f766e", borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10, alignItems: "center" },
  upgradeBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },

  payCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  payDesc: { fontSize: 14, fontWeight: "600", color: "#1e293b" },
  payDate: { fontSize: 12, color: "#94a3b8", marginTop: 2 },
  payId: { fontSize: 10, color: "#cbd5e1", marginTop: 2 },
  payAmount: { fontSize: 15, fontWeight: "700", color: "#0f766e" },

  emptyText: { fontSize: 14, color: "#94a3b8" },
  errorCard: { backgroundColor: "#fff", borderRadius: 14, padding: 32, alignItems: "center", elevation: 2 },
  errorTitle: { fontSize: 18, fontWeight: "700", color: "#1e293b", marginBottom: 8 },
  errorText: { fontSize: 14, color: "#64748b", textAlign: "center" },
});
