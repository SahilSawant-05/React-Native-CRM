import React, { useCallback, useState } from "react";
import {
  View, Text, ScrollView, StyleSheet, RefreshControl, TouchableOpacity, Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import api from "../../api/client";
import { LoadingSpinner } from "../../components/common/LoadingSpinner";
import { useAppNav, tabForTarget } from "../../navigation/useAppNav";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtCurrency(v?: number | null) {
  const n = Number(v ?? 0);
  if (isNaN(n)) return "₹0";
  if (n >= 1_00_00_000) return `₹${(n / 1_00_00_000).toFixed(1)}Cr`;
  if (n >= 1_00_000)    return `₹${(n / 1_00_000).toFixed(1)}L`;
  if (n >= 1_000)       return `₹${(n / 1_000).toFixed(1)}K`;
  return `₹${n}`;
}

function fmtNum(v?: number | null) {
  const n = Number(v ?? 0);
  return isNaN(n) ? "0" : n.toLocaleString("en-IN");
}

function formatLabel(v?: string) {
  if (!v) return "—";
  return v.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ label, value, sub, accent, icon }: { label: string; value: string | number; sub?: string; accent: string; icon?: keyof typeof Ionicons.glyphMap }) {
  return (
    <View style={c.statCard}>
      {!!icon && (
        <View style={[c.statIconCircle, { backgroundColor: `${accent}1A` }]}>
          <Ionicons name={icon} size={18} color={accent} />
        </View>
      )}
      <Text style={c.statLabel}>{label}</Text>
      <Text style={c.statValue}>{value}</Text>
      {!!sub && <Text style={c.statSub}>{sub}</Text>}
    </View>
  );
}

function SectionTitle({ title }: { title: string }) {
  return <Text style={c.sectionTitle}>{title}</Text>;
}

function BarRow({ label, count, amount, max }: { label: string; count: number; amount?: number; max: number }) {
  const pct = Math.max(4, Math.round((count / Math.max(1, max)) * 100));
  return (
    <View style={c.barRow}>
      <View style={c.barTopRow}>
        <Text style={c.barLabel} numberOfLines={1}>{formatLabel(label)}</Text>
        <Text style={c.barCount}>
          {count}{amount ? `  ·  ${fmtCurrency(amount)}` : ""}
        </Text>
      </View>
      <View style={c.barTrack}>
        <View style={[c.barFill, { width: `${pct}%` as any }]} />
      </View>
    </View>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <View style={c.card}>{children}</View>;
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function DashboardScreen() {
  const { navigateTo, openChat } = useAppNav();

  // Route a recent-notification tap to the matching section — e.g. an email
  // notification opens Mail, a chat notification opens the conversation.
  function openNotification(n: any) {
    const type = n?.type || n?.targetType || n?.targetPath || "";
    const tab = tabForTarget(type) || tabForTarget(n?.targetPath);
    if (!tab) return;
    if (tab === "Chat" && n?.contactId) {
      openChat({ contactId: n.contactId, contactName: n.contactName || n.title || "Chat", contactPhone: n.contactPhone });
      return;
    }
    navigateTo(tab);
  }

  const [summary, setSummary] = useState<any>(null);
  const [reports, setReports] = useState<any>(null);
  const [notifications, setNotifications] = useState<{ unreadCount: number; items: any[] }>({ unreadCount: 0, items: [] });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setError(null);
    try {
      const [summaryRes, reportsRes, notifRes] = await Promise.all([
        api.get("/api/dashboard/summary"),
        api.get("/api/reports/summary").catch(() => ({ data: null })),
        api.get("/api/notifications").catch(() => ({ data: null })),
      ]);
      setSummary(summaryRes.data);
      setReports(reportsRes.data);
      const n = notifRes.data;
      setNotifications({
        unreadCount: n?.unreadCount ?? 0,
        items: Array.isArray(n?.items) ? n.items.slice(0, 4) : [],
      });
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || "Failed to load dashboard");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    fetchData();
  }, [fetchData]));

  if (loading) return <LoadingSpinner message="Loading dashboard..." />;

  if (error && !summary) {
    return (
      <SafeAreaView edges={[]} style={c.container}>
        <View style={c.errorWrap}>
          <Ionicons name="stats-chart-outline" size={44} color="#9ca3af" style={c.errorIcon} />
          <Text style={c.errorTitle}>Dashboard Unavailable</Text>
          <Text style={c.errorMsg}>{error}</Text>
          <TouchableOpacity style={c.retryBtn} onPress={() => { setLoading(true); fetchData(); }}>
            <Text style={c.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const contacts   = summary?.contacts   ?? {};
  const inbox      = summary?.inbox      ?? {};
  const tasks      = summary?.tasks      ?? {};
  const campaigns  = summary?.campaigns  ?? {};

  // Breakdowns from reports
  const byLeadSource = reports?.contactsByLeadSource ?? [];
  const byOppSource  = reports?.opportunitiesBySource ?? [];
  const byOppStage   = reports?.opportunitiesByStage  ?? [];

  const maxSrc   = Math.max(1, ...byLeadSource.map((i: any) => Number(i.count ?? 0)));
  const maxOppSrc = Math.max(1, ...byOppSource.map((i: any) => Number(i.count ?? 0)));
  const maxStage = Math.max(1, ...byOppStage.map((i: any) => Number(i.count ?? 0)));

  return (
    <SafeAreaView edges={[]} style={c.container}>
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} tintColor="#0f766e" />
        }
        contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
      >
        {/* ── Headline stats ── */}
        <SectionTitle title="OVERVIEW" />
        <View style={c.statGrid}>
          <StatCard
            label="Contacts"
            value={fmtNum(contacts.totalContacts)}
            sub={`${fmtNum(contacts.assignedToMeCount)} assigned to me`}
            accent="#3b82f6"
            icon="people-outline"
          />
          <StatCard
            label="Unread Inbox"
            value={fmtNum(inbox.unreadConversations)}
            sub={`${fmtNum(inbox.openConversations)} open`}
            accent="#f59e0b"
            icon="mail-unread-outline"
          />
          <StatCard
            label="My Open Tasks"
            value={fmtNum(tasks.myOpenCount)}
            sub={`${fmtNum(tasks.todayCount)} due today`}
            accent="#22c55e"
            icon="checkbox-outline"
          />
          <StatCard
            label="Notifications"
            value={fmtNum(notifications.unreadCount)}
            sub="Unread alerts"
            accent="#ef4444"
            icon="notifications-outline"
          />
          <StatCard
            label="Pipeline"
            value={fmtNum(reports?.totalOpportunities)}
            sub={`${fmtCurrency(reports?.totalPipelineValue)} value`}
            accent="#0f766e"
            icon="trending-up-outline"
          />
          {campaigns.available !== false && (
            <StatCard
              label="Campaigns"
              value={fmtNum(campaigns.totalCampaigns)}
              sub={`${fmtNum(campaigns.sendingCount)} sending`}
              accent="#8b5cf6"
              icon="megaphone-outline"
            />
          )}
        </View>

        {/* ── Tasks at a glance ── */}
        <SectionTitle title="TASKS" />
        <Card>
          {[
            { label: "Overdue",    value: fmtNum(tasks.overdueCount),  color: "#ef4444" },
            { label: "Due Today",  value: fmtNum(tasks.todayCount),    color: "#f59e0b" },
            { label: "My Open",   value: fmtNum(tasks.myOpenCount),   color: "#0f766e" },
          ].map(row => (
            <View key={row.label} style={c.infoRow}>
              <Text style={c.infoLabel}>{row.label}</Text>
              <Text style={[c.infoVal, { color: row.color }]}>{row.value}</Text>
            </View>
          ))}
        </Card>

        {/* ── Contacts by lead source ── */}
        {byLeadSource.length > 0 && (
          <>
            <SectionTitle title="CONTACTS BY LEAD SOURCE" />
            <Card>
              {byLeadSource.slice(0, 6).map((item: any) => (
                <BarRow key={item.label} label={item.label} count={Number(item.count ?? 0)} max={maxSrc} />
              ))}
            </Card>
          </>
        )}

        {/* ── Opportunities by stage ── */}
        {byOppStage.length > 0 && (
          <>
            <SectionTitle title="PIPELINE BY STAGE" />
            <Card>
              {byOppStage.slice(0, 8).map((item: any) => (
                <BarRow key={item.label} label={item.label} count={Number(item.count ?? 0)} amount={Number(item.amount ?? 0)} max={maxStage} />
              ))}
            </Card>
          </>
        )}

        {/* ── Opportunities by source ── */}
        {byOppSource.length > 0 && (
          <>
            <SectionTitle title="OPPORTUNITIES BY SOURCE" />
            <Card>
              {byOppSource.slice(0, 6).map((item: any) => (
                <BarRow key={item.label} label={item.label} count={Number(item.count ?? 0)} amount={Number(item.amount ?? 0)} max={maxOppSrc} />
              ))}
            </Card>
          </>
        )}

        {/* ── Recent notifications ── */}
        {notifications.items.length > 0 && (
          <>
            <SectionTitle title="RECENT NOTIFICATIONS" />
            <Card>
              {notifications.items.map((n: any, i: number) => (
                <TouchableOpacity
                  key={n.id ?? i}
                  style={[c.notifRow, i > 0 && c.notifBorder]}
                  activeOpacity={0.6}
                  onPress={() => openNotification(n)}
                >
                  <View style={[c.notifDot, !n.read && c.notifDotUnread]} />
                  <View style={{ flex: 1 }}>
                    <Text style={c.notifTitle} numberOfLines={1}>{n.title || n.message || "Notification"}</Text>
                    {!!n.body && <Text style={c.notifBody} numberOfLines={1}>{n.body}</Text>}
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#cbd5e1" />
                </TouchableOpacity>
              ))}
            </Card>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const headingFont = Platform.OS === "android" ? "sans-serif-medium" : undefined;

const c = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8f9fb" },

  sectionTitle: {
    fontSize: 12, fontWeight: "600", color: "#6b7280",
    fontFamily: headingFont,
    textTransform: "uppercase", letterSpacing: 0.6, paddingVertical: 10,
  },

  statGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 4 },
  statCard: {
    backgroundColor: "#fff", borderRadius: 16, padding: 14,
    flex: 1, minWidth: "47%",
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  statIconCircle: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: "center", justifyContent: "center", marginBottom: 10,
  },
  statLabel: {
    fontSize: 11, fontWeight: "600", color: "#6b7280",
    textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 4,
  },
  statValue: {
    fontSize: 25, fontWeight: "700", color: "#111827",
    fontFamily: headingFont,
  },
  statSub: { fontSize: 12, color: "#9ca3af", marginTop: 3 },

  card: {
    backgroundColor: "#fff", borderRadius: 16, padding: 14, marginBottom: 4,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },

  infoRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    minHeight: 44, paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "rgba(60,60,67,0.12)",
  },
  infoLabel: {
    fontSize: 14, color: "#374151",
    letterSpacing: Platform.OS === "ios" ? -0.15 : undefined,
  },
  infoVal: {
    fontSize: 14, fontWeight: "600", fontFamily: headingFont,
    letterSpacing: Platform.OS === "ios" ? -0.15 : undefined,
  },

  barRow: { marginBottom: 14 },
  barTopRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 5 },
  barLabel: {
    fontSize: 13, color: "#374151", flex: 1, marginRight: 8,
    letterSpacing: Platform.OS === "ios" ? -0.15 : undefined,
  },
  barCount: { fontSize: 12.5, color: "#6b7280", fontWeight: "600" },
  barTrack: { height: 6, backgroundColor: "rgba(118,118,128,0.08)", borderRadius: 3, overflow: "hidden" },
  barFill: { height: "100%", backgroundColor: "#0f766e", borderRadius: 3 },

  notifRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingVertical: 12, minHeight: 44 },
  notifBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(60,60,67,0.12)" },
  notifDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#e5e7eb", marginTop: 4 },
  notifDotUnread: { backgroundColor: "#0f766e" },
  notifTitle: {
    fontSize: 14, fontWeight: "600", color: "#111827",
    fontFamily: headingFont,
    letterSpacing: Platform.OS === "ios" ? -0.15 : undefined,
  },
  notifBody: { fontSize: 12.5, color: "#6b7280", marginTop: 2 },

  errorWrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  errorIcon: { marginBottom: 16 },
  errorTitle: {
    fontSize: 16, fontWeight: "600", color: "#111827", marginBottom: 8,
    fontFamily: headingFont,
    letterSpacing: Platform.OS === "ios" ? -0.32 : undefined,
  },
  errorMsg: { fontSize: 14, color: "#6b7280", textAlign: "center", marginBottom: 24 },
  retryBtn: {
    backgroundColor: "#0f766e", borderRadius: 99, paddingHorizontal: 28,
    minHeight: 44, justifyContent: "center",
  },
  retryBtnText: {
    color: "#fff", fontWeight: "600", fontSize: 15,
    fontFamily: headingFont,
    letterSpacing: Platform.OS === "ios" ? -0.32 : undefined,
  },
});
