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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDate(v?: string) {
  if (!v) return "—";
  try { return new Date(v).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }); }
  catch { return v; }
}

function fmtCurrency(paise?: number | null) {
  const n = Number(paise || 0);
  if (isNaN(n)) return "₹0";
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n / 100);
}

function fmtCredits(v?: number | string | null) {
  const n = Number(v || 0);
  if (isNaN(n)) return "0";
  return Number.isInteger(n) ? n.toLocaleString("en-IN") : n.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

function fmtStorage(bytes?: number | null) {
  const n = Number(bytes || 0);
  if (!n) return "0 MB";
  const gb = n / 1024 / 1024 / 1024;
  if (gb >= 1) return `${Number.isInteger(gb) ? gb : gb.toFixed(1)} GB`;
  return `${Math.max(0, Math.round(n / 1024 / 1024))} MB`;
}

// ─── UsageMeter ──────────────────────────────────────────────────────────────

function UsageMeter({
  label, used, limit, formatter = (v: number) => fmtCredits(v),
}: {
  label: string;
  used?: number;
  limit?: number;
  formatter?: (v: number) => string;
}) {
  if (!limit) return null;
  const pct = Math.min(100, Math.round(((used ?? 0) / limit) * 100));
  const color = pct >= 90 ? "#ef4444" : pct >= 70 ? "#f59e0b" : "#22c55e";
  return (
    <View style={u.row}>
      <View style={u.topRow}>
        <Text style={u.label}>{label}</Text>
        <Text style={u.val}>{formatter(used ?? 0)} / {formatter(limit)}</Text>
      </View>
      <View style={u.track}>
        <View style={[u.fill, { width: `${pct}%` as any, backgroundColor: color }]} />
      </View>
    </View>
  );
}

const u = StyleSheet.create({
  row: { marginBottom: 14 },
  topRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  label: { fontSize: 13, color: "#64748b" },
  val: { fontSize: 13, fontWeight: "600", color: "#1e293b" },
  track: { height: 6, backgroundColor: "#e2e8f0", borderRadius: 3, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 3 },
});

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function BillingScreen() {
  const [summary, setSummary] = useState<any>(null);
  const [payments, setPayments] = useState<any[]>([]);
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

  const openRazorpay = async (order: any, description: string) => {
    return RazorpayCheckout.open({
      key: order.keyId,
      amount: order.amountPaise,
      currency: order.currency ?? "INR",
      name: "CRM",
      order_id: order.razorpayOrderId,
      description,
      theme: { color: "#0f766e" },
    });
  };

  const buyCredits = async (pkg: any) => {
    const key = pkg.packageKey;
    setBuyingKey(key);
    try {
      const { data: order } = await api.post("/api/billing/razorpay/credits/order", { packageKey: key });
      const payment = await openRazorpay(order, `${fmtCredits(pkg.credits)} credits`);
      await verifyPayment(order.razorpayOrderId, payment.razorpay_payment_id, payment.razorpay_signature);
      Alert.alert("Success", `${fmtCredits(order.credits ?? pkg.credits)} credits added!`);
    } catch (err: any) {
      if (err?.code !== "PAYMENT_CANCELLED") Alert.alert("Payment Failed", err?.description || err?.message || "Try again");
    } finally { setBuyingKey(null); }
  };

  const buyStorage = async (pkg: any) => {
    const key = pkg.packageKey;
    setBuyingKey(key);
    try {
      const { data: order } = await api.post("/api/billing/razorpay/storage/order", { packageKey: key });
      const payment = await openRazorpay(order, `${pkg.storageGb} GB storage`);
      await verifyPayment(order.razorpayOrderId, payment.razorpay_payment_id, payment.razorpay_signature);
      Alert.alert("Success", "Storage upgraded!");
    } catch (err: any) {
      if (err?.code !== "PAYMENT_CANCELLED") Alert.alert("Payment Failed", err?.description || err?.message || "Try again");
    } finally { setBuyingKey(null); }
  };

  const upgradePlan = async (plan: any) => {
    const key = `PLAN_${plan.planKey}_${billingCycle}`;
    setBuyingKey(key);
    try {
      const { data: order } = await api.post("/api/billing/razorpay/plans/order", {
        planKey: plan.planKey,
        billingCycle,
      });
      const payment = await openRazorpay(order, `${plan.name} ${billingCycle.toLowerCase()}`);
      await verifyPayment(order.razorpayOrderId, payment.razorpay_payment_id, payment.razorpay_signature);
      Alert.alert("Success", `${plan.name} plan activated!`);
    } catch (err: any) {
      if (err?.code !== "PAYMENT_CANCELLED") Alert.alert("Payment Failed", err?.description || err?.message || "Try again");
    } finally { setBuyingKey(null); }
  };

  if (loading) return <LoadingSpinner message="Loading billing..." />;

  // --- Derived data using REAL API field names ---
  const usage = summary?.usage ?? {};
  const subscription = summary?.subscription ?? {};
  const plans: any[] = summary?.plans ?? [];
  const yearly = billingCycle === "YEARLY";

  return (
    <SafeAreaView edges={["bottom"]} style={s.container}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} tintColor="#0f766e" />}
        contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
      >
        {!!error && !summary && (
          <View style={s.errorCard}>
            <Text style={{ fontSize: 40, marginBottom: 10 }}>💳</Text>
            <Text style={s.errorTitle}>Billing Unavailable</Text>
            <Text style={s.errorText}>{error}</Text>
          </View>
        )}

        {summary && (
          <>
            {/* ── Credits + Plan header ── */}
            <View style={s.planCard}>
              <Text style={s.planMeta}>CURRENT PLAN</Text>
              <Text style={s.planName}>{summary.planKey || "STARTER"}</Text>
              <Text style={s.planStatus}>
                {summary.subscriptionStatus || "TRIAL"}
                {subscription.currentPeriodEnd ? `  ·  Renews ${fmtDate(subscription.currentPeriodEnd)}` : ""}
              </Text>
            </View>

            {/* ── Credits balance ── */}
            <View style={[s.card, { alignItems: "center", paddingVertical: 20 }]}>
              <Text style={s.sectionHeader}>AVAILABLE CREDITS</Text>
              <Text style={s.creditsNum}>{fmtCredits(summary.balanceCredits)}</Text>
              {summary.balancePoints != null && (
                <Text style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>{fmtCredits(summary.balancePoints)} points</Text>
              )}
            </View>

            {/* ── Usage ── */}
            <Text style={s.sectionHeader}>USAGE</Text>
            <View style={s.card}>
              <UsageMeter label="Seats" used={usage.seatsUsed} limit={usage.seatsLimit} />
              <UsageMeter label="Contacts" used={usage.contactsUsed} limit={usage.contactsLimit} />
              <UsageMeter label="Pipelines" used={usage.pipelinesUsed} limit={usage.pipelinesLimit} />
              <UsageMeter label="Storage" used={usage.storageUsedBytes} limit={usage.storageLimitBytes} formatter={fmtStorage} />
            </View>
          </>
        )}

        {/* ── Buy Credits ── */}
        {creditPackages.length > 0 && (
          <>
            <Text style={s.sectionHeader}>BUY CREDITS</Text>
            {creditPackages.map(pkg => {
              const busy = buyingKey === pkg.packageKey;
              return (
                <View key={pkg.packageKey} style={s.pkgCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.pkgName}>{pkg.displayName || pkg.name || pkg.packageKey}</Text>
                    <Text style={s.pkgDetail}>{fmtCredits(pkg.credits)} credits</Text>
                    {pkg.bonusCredits > 0 && <Text style={s.pkgBonus}>+{fmtCredits(pkg.bonusCredits)} bonus</Text>}
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 8 }}>
                    <Text style={s.pkgPrice}>{fmtCurrency(pkg.amountPaise)}</Text>
                    <TouchableOpacity
                      style={[s.buyBtn, (busy || !!buyingKey) && s.btnDisabled]}
                      onPress={() => buyCredits(pkg)}
                      disabled={!!buyingKey}
                    >
                      {busy ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.buyBtnText}>Buy</Text>}
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
            <Text style={s.sectionHeader}>STORAGE ADD-ONS</Text>
            {storagePackages.map(pkg => {
              const busy = buyingKey === pkg.packageKey;
              return (
                <View key={pkg.packageKey} style={s.pkgCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.pkgName}>{pkg.displayName || pkg.name || pkg.packageKey}</Text>
                    <Text style={s.pkgDetail}>{pkg.storageGb} GB · valid 12 months</Text>
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 8 }}>
                    <Text style={s.pkgPrice}>{fmtCurrency(pkg.amountPaise)}</Text>
                    <TouchableOpacity
                      style={[s.buyBtn, (busy || !!buyingKey) && s.btnDisabled]}
                      onPress={() => buyStorage(pkg)}
                      disabled={!!buyingKey}
                    >
                      {busy ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.buyBtnText}>Buy</Text>}
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
            <Text style={s.sectionHeader}>PLANS</Text>

            {/* Monthly / Yearly toggle */}
            <View style={s.cycleWrap}>
              {(["MONTHLY", "YEARLY"] as const).map(c => (
                <TouchableOpacity
                  key={c}
                  style={[s.cycleBtn, billingCycle === c && s.cycleBtnOn]}
                  onPress={() => setBillingCycle(c)}
                >
                  <Text style={[s.cycleTxt, billingCycle === c && s.cycleTxtOn]}>
                    {c === "MONTHLY" ? "Monthly" : "Yearly"}
                  </Text>
                  {c === "YEARLY" && (
                    <Text style={[s.saveTag, billingCycle === "YEARLY" && { color: "#fff" }]}>
                      Save {plans[0]?.yearlyDiscountPercent || 20}%
                    </Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>

            {plans.map(plan => {
              const key = `PLAN_${plan.planKey}_${billingCycle}`;
              const busy = buyingKey === key;
              const isCurrent = summary?.planKey === plan.planKey;
              const price = yearly ? plan.yearlyPricePaise : plan.monthlyPricePaise;
              const credits = yearly ? plan.yearlyCredits : plan.monthlyCredits;
              return (
                <View key={plan.planKey} style={[s.planPkgCard, isCurrent && s.planPkgCardCurrent]}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                    <View>
                      <Text style={s.planPkgName}>{plan.name}</Text>
                      {isCurrent && <Text style={{ fontSize: 11, color: "#0f766e", fontWeight: "700", marginTop: 2 }}>CURRENT PLAN</Text>}
                    </View>
                    <Text style={s.planPkgPrice}>
                      {fmtCurrency(price)}
                      <Text style={s.planPkgPer}>/{yearly ? "yr" : "mo"}</Text>
                    </Text>
                  </View>

                  <View style={s.planFeatures}>
                    {plan.maxUsers != null && <Text style={s.feat}>✓ {plan.maxUsers} seats</Text>}
                    {plan.maxContacts != null && <Text style={s.feat}>✓ {fmtCredits(plan.maxContacts)} contacts</Text>}
                    {plan.maxPipelines != null && <Text style={s.feat}>✓ {plan.maxPipelines} pipelines</Text>}
                    {plan.storageLimitBytes != null && <Text style={s.feat}>✓ {fmtStorage(plan.storageLimitBytes)} storage</Text>}
                    {credits != null && <Text style={s.feat}>✓ {fmtCredits(credits)} credits/{yearly ? "yr" : "mo"}</Text>}
                  </View>

                  {!isCurrent && (
                    <TouchableOpacity
                      style={[s.upgradeBtn, (busy || !!buyingKey) && s.btnDisabled]}
                      onPress={() => upgradePlan(plan)}
                      disabled={!!buyingKey}
                    >
                      {busy ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.upgradeBtnText}>Upgrade to {plan.name}</Text>}
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </>
        )}

        {/* ── Payment History ── */}
        <Text style={s.sectionHeader}>PAYMENT HISTORY</Text>
        {payments.length === 0 ? (
          <Text style={s.emptyText}>No payments yet</Text>
        ) : payments.filter(p => p.status === "PAID").map((p, i) => (
          <View key={p.id ?? i} style={s.payCard}>
            <View style={{ flex: 1 }}>
              <Text style={s.payDesc}>{p.description || "Payment"}</Text>
              <Text style={s.payDate}>{fmtDate(p.createdAt)}</Text>
            </View>
            <Text style={s.payAmt}>{fmtCurrency(p.amountPaise)}</Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f1f5f9" },

  planCard: { backgroundColor: "#0f766e", borderRadius: 16, padding: 24, marginBottom: 8, alignItems: "center" },
  planMeta: { fontSize: 11, color: "#99f6e4", fontWeight: "700", letterSpacing: 1, marginBottom: 6, textTransform: "uppercase" },
  planName: { fontSize: 28, fontWeight: "800", color: "#fff" },
  planStatus: { fontSize: 13, color: "#ccfbf1", marginTop: 6 },

  sectionHeader: { fontSize: 11, fontWeight: "700", color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1, paddingVertical: 10 },

  creditsNum: { fontSize: 44, fontWeight: "800", color: "#0f766e", marginTop: 4 },

  card: { backgroundColor: "#fff", borderRadius: 14, padding: 16, marginBottom: 8, elevation: 1, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3 },

  pkgCard: { backgroundColor: "#fff", borderRadius: 12, padding: 14, marginBottom: 8, flexDirection: "row", alignItems: "center", gap: 12, elevation: 1, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2 },
  pkgName: { fontSize: 14, fontWeight: "700", color: "#1e293b" },
  pkgDetail: { fontSize: 13, color: "#64748b", marginTop: 2 },
  pkgBonus: { fontSize: 12, color: "#22c55e", marginTop: 2, fontWeight: "600" },
  pkgPrice: { fontSize: 17, fontWeight: "800", color: "#0f766e" },

  buyBtn: { backgroundColor: "#0f766e", borderRadius: 8, paddingHorizontal: 18, paddingVertical: 8, minWidth: 64, alignItems: "center" },
  buyBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  btnDisabled: { opacity: 0.5 },

  cycleWrap: { flexDirection: "row", backgroundColor: "#e2e8f0", borderRadius: 10, padding: 3, marginBottom: 12 },
  cycleBtn: { flex: 1, paddingVertical: 9, borderRadius: 8, alignItems: "center", gap: 2 },
  cycleBtnOn: { backgroundColor: "#0f766e" },
  cycleTxt: { fontSize: 13, fontWeight: "600", color: "#64748b" },
  cycleTxtOn: { color: "#fff" },
  saveTag: { fontSize: 10, color: "#22c55e", fontWeight: "700" },

  planPkgCard: { backgroundColor: "#fff", borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: "#e2e8f0", elevation: 1 },
  planPkgCardCurrent: { borderColor: "#0f766e", borderWidth: 2 },
  planPkgName: { fontSize: 16, fontWeight: "800", color: "#0f172a" },
  planPkgPrice: { fontSize: 20, fontWeight: "800", color: "#0f766e" },
  planPkgPer: { fontSize: 13, fontWeight: "400", color: "#64748b" },
  planFeatures: { gap: 4, marginBottom: 12 },
  feat: { fontSize: 13, color: "#475569" },
  upgradeBtn: { backgroundColor: "#0f766e", borderRadius: 10, paddingVertical: 12, alignItems: "center" },
  upgradeBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },

  payCard: { backgroundColor: "#fff", borderRadius: 12, padding: 14, marginBottom: 8, flexDirection: "row", alignItems: "center", gap: 12, elevation: 1 },
  payDesc: { fontSize: 14, fontWeight: "600", color: "#1e293b" },
  payDate: { fontSize: 12, color: "#94a3b8", marginTop: 2 },
  payAmt: { fontSize: 15, fontWeight: "700", color: "#0f766e" },

  emptyText: { fontSize: 14, color: "#94a3b8" },
  errorCard: { backgroundColor: "#fff", borderRadius: 14, padding: 32, alignItems: "center", elevation: 2 },
  errorTitle: { fontSize: 18, fontWeight: "700", color: "#1e293b", marginBottom: 8 },
  errorText: { fontSize: 14, color: "#64748b", textAlign: "center" },
});
