import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import api from "../../api/client";

// ---- Formatting helpers (mirror ainew/src/pages/Reports.jsx) -------------
function formatCurrency(value: any): string {
  const number = Number(value ?? 0);
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(Number.isFinite(number) ? number : 0);
  } catch {
    return `₹${Number.isFinite(number) ? Math.round(number) : 0}`;
  }
}

function formatPercent(value: any): string {
  let number = Number(value ?? 0);
  if (!Number.isFinite(number)) number = 0;
  // Backend may return a fraction (0.42) or a percent (42) — normalise.
  if (number > 0 && number <= 1) number = number * 100;
  return `${number.toFixed(2)}%`;
}

function formatLabel(value: any): string {
  return String(value || "Unknown").replace(/_/g, " ");
}

// ---- Date presets --------------------------------------------------------
const PRESETS: { key: string; label: string; days: number | null }[] = [
  { key: "7D", label: "7D", days: 6 },
  { key: "30D", label: "30D", days: 29 },
  { key: "90D", label: "90D", days: 89 },
  { key: "ALL", label: "All", days: null },
];

function presetParams(presetKey: string): { fromAt?: string; toAt?: string } {
  const preset = PRESETS.find((p) => p.key === presetKey) || PRESETS[1];
  if (preset.days == null) return {};
  const now = new Date();
  const to = new Date(now);
  to.setHours(23, 59, 59, 999);
  const from = new Date(now);
  from.setDate(now.getDate() - preset.days);
  from.setHours(0, 0, 0, 0);
  return { fromAt: from.toISOString(), toAt: to.toISOString() };
}

// ---- Types ---------------------------------------------------------------
interface BreakdownItem {
  label?: string;
  source?: string;
  count?: number;
  amount?: number;
}
interface Summary {
  totalContacts?: number;
  totalOpportunities?: number;
  wonOpportunities?: number;
  wonValue?: number;
  totalPipelineValue?: number;
  conversionRate?: number;
  opportunitiesByStage?: BreakdownItem[];
  opportunitiesBySource?: BreakdownItem[];
  contactsByLeadSource?: BreakdownItem[];
  callOutcomes?: BreakdownItem[];
  appointmentOutcomes?: BreakdownItem[];
  sourceToWon?: any[];
  agentPerformance?: any[];
  callAgentPerformance?: any[];
}
interface UserOption {
  id: string | number;
  name?: string;
  email?: string;
}

// ---- Small presentational pieces -----------------------------------------
function KpiTile({ label, value, helper, accent }: { label: string; value: string | number; helper?: string; accent: string }) {
  return (
    <View style={styles.kpiTile}>
      <View style={[styles.kpiAccent, { backgroundColor: accent }]} />
      <Text style={styles.kpiLabel}>{label.toUpperCase()}</Text>
      <Text style={styles.kpiValue}>{value}</Text>
      {helper ? <Text style={styles.kpiHelper}>{helper}</Text> : null}
    </View>
  );
}

function BarBreakdown({
  title,
  description,
  items,
  showAmount,
  barColor = "#0f766e",
}: {
  title: string;
  description: string;
  items: BreakdownItem[];
  showAmount?: boolean;
  barColor?: string;
}) {
  const total = items.reduce((s, i) => s + Number(i.count || 0), 0);
  const maxCount = Math.max(1, ...items.map((i) => Number(i.count || 0)));
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={{ flex: 1, paddingRight: 8 }}>
          <Text style={styles.cardTitle}>{title}</Text>
          <Text style={styles.cardDesc}>{description}</Text>
        </View>
        <View style={styles.pill}>
          <Text style={styles.pillText}>{total} total</Text>
        </View>
      </View>
      {items.length === 0 ? (
        <Text style={styles.emptyText}>No report data yet.</Text>
      ) : (
        items.map((item, idx) => {
          const count = Number(item.count || 0);
          const width = Math.max(6, Math.round((count / maxCount) * 100));
          return (
            <View key={`${item.label || item.source}-${idx}`} style={styles.barRow}>
              <View style={styles.barLabelRow}>
                <Text style={styles.barLabel} numberOfLines={2}>
                  {formatLabel(item.label || item.source)}
                </Text>
                <Text style={styles.barValue}>
                  {count}
                  {showAmount ? ` · ${formatCurrency(item.amount)}` : ""}
                </Text>
              </View>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { width: `${width}%`, backgroundColor: barColor }]} />
              </View>
            </View>
          );
        })
      )}
    </View>
  );
}

function SourceToWonCard({ items }: { items: any[] }) {
  const maxWon = Math.max(1, ...items.map((i) => Number(i.wonOpportunities || 0)));
  const totalWon = items.reduce((s, i) => s + Number(i.wonOpportunities || 0), 0);
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={{ flex: 1, paddingRight: 8 }}>
          <Text style={styles.cardTitle}>Source to Won</Text>
          <Text style={styles.cardDesc}>Which channels turn opportunities into won deals.</Text>
        </View>
        <View style={[styles.pill, { backgroundColor: "#ecfdf5" }]}>
          <Text style={[styles.pillText, { color: "#047857" }]}>{totalWon} won</Text>
        </View>
      </View>
      {items.length === 0 ? (
        <Text style={styles.emptyText}>No source conversion data yet.</Text>
      ) : (
        items.map((item, idx) => {
          const won = Number(item.wonOpportunities || 0);
          const width = Math.max(6, Math.round((won / maxWon) * 100));
          return (
            <View key={`${item.source}-${idx}`} style={styles.barRow}>
              <View style={styles.barLabelRow}>
                <Text style={styles.barLabel} numberOfLines={2}>
                  {formatLabel(item.source)}
                </Text>
                <Text style={styles.barValue}>
                  {won}/{item.opportunities} · {formatPercent(item.conversionRate)} · {formatCurrency(item.wonValue)}
                </Text>
              </View>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { width: `${width}%`, backgroundColor: "#059669" }]} />
              </View>
            </View>
          );
        })
      )}
    </View>
  );
}

function AgentPerformanceCard({ items }: { items: any[] }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={{ flex: 1, paddingRight: 8 }}>
          <Text style={styles.cardTitle}>Agent Performance</Text>
          <Text style={styles.cardDesc}>Opportunities, won deals, revenue and conversion by agent.</Text>
        </View>
        <View style={[styles.pill, { backgroundColor: "#eff6ff" }]}>
          <Text style={[styles.pillText, { color: "#1d4ed8" }]}>{items.length} agents</Text>
        </View>
      </View>
      {items.length === 0 ? (
        <Text style={styles.emptyText}>No agent performance data yet.</Text>
      ) : (
        items.map((item, idx) => (
          <View key={`${item.agentUserId || item.agentEmail}-${idx}`} style={styles.agentRow}>
            <Text style={styles.agentEmail} numberOfLines={1}>
              {item.agentEmail || `User #${item.agentUserId}`}
            </Text>
            <View style={styles.agentStats}>
              <View style={styles.agentStat}>
                <Text style={styles.agentStatValue}>{item.opportunities ?? 0}</Text>
                <Text style={styles.agentStatLabel}>Opps</Text>
              </View>
              <View style={styles.agentStat}>
                <Text style={[styles.agentStatValue, { color: "#047857" }]}>{item.wonOpportunities ?? 0}</Text>
                <Text style={styles.agentStatLabel}>Won</Text>
              </View>
              <View style={styles.agentStat}>
                <Text style={styles.agentStatValue}>{formatCurrency(item.wonValue)}</Text>
                <Text style={styles.agentStatLabel}>Value</Text>
              </View>
              <View style={styles.agentStat}>
                <Text style={[styles.agentStatValue, { color: "#0f766e" }]}>{formatPercent(item.conversionRate)}</Text>
                <Text style={styles.agentStatLabel}>Conv.</Text>
              </View>
            </View>
          </View>
        ))
      )}
    </View>
  );
}

// ---- Screen --------------------------------------------------------------
export default function ReportsScreen() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [preset, setPreset] = useState("30D");
  const [users, setUsers] = useState<UserOption[]>([]);
  const [ownerUserId, setOwnerUserId] = useState<string>("");
  const [ownerPickerOpen, setOwnerPickerOpen] = useState(false);

  const loadUsers = useCallback(async () => {
    try {
      const res = await api.get("/api/users");
      setUsers(Array.isArray(res.data) ? res.data : []);
    } catch {
      setUsers([]);
    }
  }, []);

  const loadReports = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError("");
      try {
        const res = await api.get("/api/reports/summary", {
          params: {
            ...presetParams(preset),
            ownerUserId: ownerUserId || undefined,
          },
        });
        setSummary(res.data || {});
      } catch (err: any) {
        setError(err?.response?.data?.message || err?.message || "Failed to load reports");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [preset, ownerUserId]
  );

  useFocusEffect(
    useCallback(() => {
      loadUsers();
      loadReports();
    }, [loadUsers, loadReports])
  );

  const ownerLabel = useMemo(() => {
    if (!ownerUserId) return "All users";
    const u = users.find((x) => String(x.id) === String(ownerUserId));
    return u?.name || u?.email || `User #${ownerUserId}`;
  }, [ownerUserId, users]);

  const appointmentTotal = (summary?.appointmentOutcomes || []).reduce((s, i) => s + Number(i.count || 0), 0);
  const callTotal = (summary?.callOutcomes || []).reduce((s, i) => s + Number(i.count || 0), 0);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadReports(true)} />}
    >
      <View style={styles.headerCard}>
        <Text style={styles.eyebrow}>REPORTS</Text>
        <Text style={styles.h1}>CRM Performance</Text>
        <Text style={styles.headerSub}>Track lead sources, pipeline value and opportunity movement.</Text>

        <View style={styles.presetRow}>
          {PRESETS.map((p) => (
            <TouchableOpacity
              key={p.key}
              onPress={() => setPreset(p.key)}
              style={[styles.presetChip, preset === p.key && styles.presetChipActive]}
            >
              <Text style={[styles.presetChipText, preset === p.key && styles.presetChipTextActive]}>{p.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.ownerBtn} onPress={() => setOwnerPickerOpen(true)}>
          <Text style={styles.ownerBtnLabel}>User scope</Text>
          <Text style={styles.ownerBtnValue}>{ownerLabel} ▾</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#0f766e" />
          <Text style={styles.mutedText}>Loading reports…</Text>
        </View>
      ) : error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => loadReports()}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <View style={styles.kpiGrid}>
            <KpiTile label="Total Contacts" value={summary?.totalContacts ?? 0} helper="Contacts in scope" accent="#3b82f6" />
            <KpiTile label="Opportunities" value={summary?.totalOpportunities ?? 0} helper="Open + historical" accent="#10b981" />
            <KpiTile label="Pipeline Value" value={formatCurrency(summary?.totalPipelineValue)} helper="Sum of value" accent="#f59e0b" />
            <KpiTile
              label="Conversion"
              value={formatPercent(summary?.conversionRate)}
              helper={`${summary?.wonOpportunities || 0} won`}
              accent="#8b5cf6"
            />
            <KpiTile label="Won Value" value={formatCurrency(summary?.wonValue)} helper="Revenue won" accent="#f43f5e" />
            <KpiTile label="Appointments" value={appointmentTotal} helper="All outcomes" accent="#06b6d4" />
            <KpiTile label="Calls" value={callTotal} helper="All outcomes" accent="#6366f1" />
          </View>

          <BarBreakdown
            title="Leads by Source"
            description="Where contacts are coming from."
            items={summary?.contactsByLeadSource || []}
            barColor="#2563eb"
          />
          <BarBreakdown
            title="Opportunities by Stage"
            description="Pipeline movement and value by stage."
            items={summary?.opportunitiesByStage || []}
            showAmount
          />
          <BarBreakdown
            title="Opportunity Value by Source"
            description="Which channels create opportunity value."
            items={summary?.opportunitiesBySource || []}
            showAmount
            barColor="#d97706"
          />
          <BarBreakdown
            title="Appointment Outcomes"
            description="Site visits, demos and sessions by status."
            items={summary?.appointmentOutcomes || []}
            barColor="#0891b2"
          />
          <BarBreakdown
            title="Call Outcomes"
            description="Connected, missed, callback and converted."
            items={summary?.callOutcomes || []}
            barColor="#6366f1"
          />
          <SourceToWonCard items={summary?.sourceToWon || []} />
          <AgentPerformanceCard items={summary?.agentPerformance || []} />
        </>
      )}

      <Modal visible={ownerPickerOpen} transparent animationType="slide" onRequestClose={() => setOwnerPickerOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setOwnerPickerOpen(false)}>
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            <Text style={styles.modalTitle}>User scope</Text>
            <ScrollView style={{ maxHeight: 360 }}>
              <TouchableOpacity
                style={styles.ownerOption}
                onPress={() => {
                  setOwnerUserId("");
                  setOwnerPickerOpen(false);
                }}
              >
                <Text style={[styles.ownerOptionText, !ownerUserId && styles.ownerOptionTextActive]}>All users</Text>
              </TouchableOpacity>
              {users.map((u) => (
                <TouchableOpacity
                  key={String(u.id)}
                  style={styles.ownerOption}
                  onPress={() => {
                    setOwnerUserId(String(u.id));
                    setOwnerPickerOpen(false);
                  }}
                >
                  <Text
                    style={[styles.ownerOptionText, String(u.id) === ownerUserId && styles.ownerOptionTextActive]}
                    numberOfLines={1}
                  >
                    {u.name || u.email || `User #${u.id}`}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.modalClose} onPress={() => setOwnerPickerOpen(false)}>
              <Text style={styles.modalCloseText}>Close</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f1f5f9" },
  content: { padding: 14, paddingBottom: 40, gap: 14 },
  headerCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  eyebrow: { fontSize: 11, fontWeight: "800", letterSpacing: 2, color: "#0f766e" },
  h1: { marginTop: 4, fontSize: 22, fontWeight: "800", color: "#0f172a" },
  headerSub: { marginTop: 4, fontSize: 13, color: "#64748b", lineHeight: 18 },
  presetRow: { flexDirection: "row", gap: 8, marginTop: 14 },
  presetChip: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#fff",
  },
  presetChipActive: { backgroundColor: "#0f766e", borderColor: "#0f766e" },
  presetChipText: { fontSize: 13, fontWeight: "700", color: "#475569" },
  presetChipTextActive: { color: "#fff" },
  ownerBtn: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "#f8fafc",
  },
  ownerBtnLabel: { fontSize: 12, fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: 1 },
  ownerBtnValue: { fontSize: 14, fontWeight: "700", color: "#0f172a", maxWidth: "60%" },

  centered: { alignItems: "center", justifyContent: "center", paddingVertical: 60, gap: 12 },
  mutedText: { fontSize: 14, color: "#64748b" },
  errorBox: { backgroundColor: "#fef2f2", borderRadius: 12, borderWidth: 1, borderColor: "#fecaca", padding: 16, gap: 12 },
  errorText: { color: "#b91c1c", fontSize: 14, fontWeight: "600" },
  retryBtn: { alignSelf: "flex-start", backgroundColor: "#b91c1c", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  retryBtnText: { color: "#fff", fontWeight: "700" },

  kpiGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  kpiTile: {
    width: "48%",
    flexGrow: 1,
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 1,
  },
  kpiAccent: { position: "absolute", left: 0, top: 0, bottom: 0, width: 4 },
  kpiLabel: { fontSize: 10, fontWeight: "800", letterSpacing: 1, color: "#94a3b8" },
  kpiValue: { marginTop: 8, fontSize: 22, fontWeight: "800", color: "#0f172a" },
  kpiHelper: { marginTop: 4, fontSize: 11, color: "#94a3b8" },

  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
  cardHeader: { flexDirection: "row", alignItems: "flex-start", marginBottom: 14 },
  cardTitle: { fontSize: 16, fontWeight: "800", color: "#0f172a" },
  cardDesc: { marginTop: 3, fontSize: 12, color: "#64748b", lineHeight: 16 },
  pill: { backgroundColor: "#f1f5f9", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  pillText: { fontSize: 11, fontWeight: "800", color: "#475569" },
  emptyText: {
    textAlign: "center",
    color: "#94a3b8",
    fontSize: 13,
    paddingVertical: 22,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderStyle: "dashed",
    borderRadius: 10,
    backgroundColor: "#f8fafc",
  },
  barRow: { marginBottom: 14 },
  barLabelRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 5, gap: 8 },
  barLabel: { flex: 1, fontSize: 13, fontWeight: "700", color: "#334155" },
  barValue: { fontSize: 12, color: "#64748b", fontWeight: "600" },
  barTrack: { height: 10, borderRadius: 999, backgroundColor: "#f1f5f9", overflow: "hidden" },
  barFill: { height: "100%", borderRadius: 999 },

  agentRow: { paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#e2e8f0" },
  agentEmail: { fontSize: 14, fontWeight: "700", color: "#0f172a", marginBottom: 8 },
  agentStats: { flexDirection: "row", justifyContent: "space-between" },
  agentStat: { alignItems: "center", flex: 1 },
  agentStatValue: { fontSize: 14, fontWeight: "800", color: "#0f172a" },
  agentStatLabel: { fontSize: 10, color: "#94a3b8", marginTop: 2, fontWeight: "600" },

  modalBackdrop: { flex: 1, backgroundColor: "rgba(15,23,42,0.45)", justifyContent: "flex-end" },
  modalSheet: { backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 18, paddingBottom: 30 },
  modalTitle: { fontSize: 17, fontWeight: "800", color: "#0f172a", marginBottom: 12 },
  ownerOption: { paddingVertical: 13, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#e2e8f0" },
  ownerOptionText: { fontSize: 15, color: "#334155" },
  ownerOptionTextActive: { color: "#0f766e", fontWeight: "800" },
  modalClose: { marginTop: 14, backgroundColor: "#0f172a", borderRadius: 10, paddingVertical: 13, alignItems: "center" },
  modalCloseText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
