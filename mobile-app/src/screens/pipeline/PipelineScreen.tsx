import React, { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, ActivityIndicator, RefreshControl, TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import api from "../../api/client";
import { LoadingSpinner } from "../../components/common/LoadingSpinner";
import { ErrorBanner } from "../../components/common/ErrorBanner";

interface Opportunity {
  id: string;
  title: string;
  contactName?: string;
  contactPhone?: string;
  stage: string;
  amount?: number | null;
  priority?: string;
  source?: string;
  expectedCloseDate?: string;
  lostReason?: string;
  domainItemName?: string;
}

// ─── Stage config (matches web Pipeline.jsx) ─────────────────────────────────

const STAGES = [
  { key: "NEW",         label: "New",          color: "#6366f1" },
  { key: "QUALIFIED",   label: "Qualified",    color: "#3b82f6" },
  { key: "FOLLOW_UP",   label: "Follow Up",    color: "#f59e0b" },
  { key: "WON",         label: "Won",          color: "#22c55e" },
  { key: "LOST",        label: "Lost",         color: "#ef4444" },
];

const STAGE_COLOR: Record<string, string> = Object.fromEntries(STAGES.map(s => [s.key, s.color]));
const STAGE_LABEL: Record<string, string> = Object.fromEntries(STAGES.map(s => [s.key, s.label]));

const PRIORITY_COLORS: Record<string, { bg: string; text: string }> = {
  HIGH:   { bg: "#fee2e2", text: "#ef4444" },
  MEDIUM: { bg: "#fef3c7", text: "#f59e0b" },
  LOW:    { bg: "#f1f5f9", text: "#94a3b8" },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function normalize(data: any): Opportunity[] {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.content)) return data.content;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

function formatCurrency(n?: number | null) {
  if (n == null || isNaN(n)) return "";
  return "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

// ─── Move-Stage Modal ─────────────────────────────────────────────────────────

function MoveStageModal({
  visible, opp, onClose, onMoved,
}: {
  visible: boolean;
  opp: Opportunity | null;
  onClose: () => void;
  onMoved: (id: string, newStage: string) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [lostReason, setLostReason] = useState("");
  const [pendingStage, setPendingStage] = useState<string | null>(null);

  const move = async (stage: string) => {
    if (!opp) return;
    if (stage === "LOST" && !pendingStage) {
      setPendingStage("LOST");
      return;
    }
    setSaving(true);
    try {
      await api.post(`/api/opportunities/${opp.id}/stage`, {
        stage,
        lostReason: stage === "LOST" ? lostReason.trim() || null : null,
      });
      onMoved(opp.id, stage);
      setPendingStage(null);
      setLostReason("");
      onClose();
    } catch {
      // silently keep modal open
    } finally {
      setSaving(false);
    }
  };

  const reset = () => { setPendingStage(null); setLostReason(""); onClose(); };

  if (!opp) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={reset}>
      <View style={ms.overlay}>
        <View style={ms.sheet}>
          <Text style={ms.title} numberOfLines={2}>{opp.title}</Text>
          <Text style={ms.sub}>👤 {opp.contactName || "—"}</Text>
          {!!opp.amount && <Text style={ms.sub}>💰 {formatCurrency(opp.amount)}</Text>}

          <View style={ms.divider} />

          {pendingStage === "LOST" ? (
            <>
              <Text style={ms.label}>Reason for loss (optional)</Text>
              <TextInput
                style={ms.input}
                value={lostReason}
                onChangeText={setLostReason}
                placeholder="e.g. Budget constraints..."
                placeholderTextColor="#94a3b8"
                multiline
              />
              <View style={ms.btnRow}>
                <TouchableOpacity style={ms.cancelBtn} onPress={reset}>
                  <Text style={ms.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[ms.moveBtn, { backgroundColor: "#ef4444" }, saving && ms.btnDisabled]}
                  onPress={() => move("LOST")}
                  disabled={saving}
                >
                  {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={ms.moveBtnText}>Mark Lost</Text>}
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              <Text style={ms.label}>Move to stage</Text>
              {STAGES.filter(s => s.key !== opp.stage).map(s => (
                <TouchableOpacity
                  key={s.key}
                  style={[ms.stageRow, { borderLeftColor: s.color }]}
                  onPress={() => move(s.key)}
                  disabled={saving}
                >
                  <View style={[ms.stageDot, { backgroundColor: s.color }]} />
                  <Text style={ms.stageLabel}>{s.label}</Text>
                  {saving && <ActivityIndicator size="small" color={s.color} />}
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={ms.cancelBtn} onPress={reset}>
                <Text style={ms.cancelText}>Cancel</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const ms = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  sheet: { backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 36 },
  title: { fontSize: 17, fontWeight: "700", color: "#0f172a", marginBottom: 4 },
  sub: { fontSize: 13, color: "#64748b", marginBottom: 2 },
  divider: { height: 1, backgroundColor: "#f1f5f9", marginVertical: 16 },
  label: { fontSize: 12, fontWeight: "700", color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 },
  stageRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 13, paddingHorizontal: 14, borderRadius: 10, borderLeftWidth: 3, backgroundColor: "#f8fafc", marginBottom: 8 },
  stageDot: { width: 10, height: 10, borderRadius: 5 },
  stageLabel: { fontSize: 14, fontWeight: "600", color: "#1e293b", flex: 1 },
  btnRow: { flexDirection: "row", gap: 10, marginTop: 12 },
  cancelBtn: { flex: 1, paddingVertical: 12, alignItems: "center", borderRadius: 10, borderWidth: 1, borderColor: "#e2e8f0" },
  cancelText: { fontSize: 14, fontWeight: "600", color: "#64748b" },
  moveBtn: { flex: 1, paddingVertical: 12, alignItems: "center", borderRadius: 10 },
  moveBtnText: { fontSize: 14, fontWeight: "700", color: "#fff" },
  btnDisabled: { opacity: 0.6 },
  input: { backgroundColor: "#f8fafc", borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 10, padding: 12, fontSize: 14, color: "#1e293b", minHeight: 80, marginBottom: 12, textAlignVertical: "top" },
});

// ─── Opportunity Card ─────────────────────────────────────────────────────────

function OppCard({ opp, onPress }: { opp: Opportunity; onPress: () => void }) {
  const pc = PRIORITY_COLORS[opp.priority ?? "MEDIUM"] || PRIORITY_COLORS.MEDIUM;
  const color = STAGE_COLOR[opp.stage] || "#6366f1";
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.75}>
      <View style={card.wrap}>
        <View style={[card.accent, { backgroundColor: color }]} />
        <View style={card.body}>
          <Text style={card.title} numberOfLines={2}>{opp.title}</Text>
          {!!opp.contactName && <Text style={card.contact}>👤 {opp.contactName}</Text>}
          {!!opp.domainItemName && <Text style={card.meta}>🏷 {opp.domainItemName}</Text>}
          <View style={card.footer}>
            {!!opp.priority && (
              <View style={[card.badge, { backgroundColor: pc.bg }]}>
                <Text style={[card.badgeText, { color: pc.text }]}>{opp.priority}</Text>
              </View>
            )}
            {!!opp.amount && <Text style={card.amount}>{formatCurrency(opp.amount)}</Text>}
          </View>
          {opp.stage === "LOST" && !!opp.lostReason && (
            <Text style={card.lost} numberOfLines={1}>❌ {opp.lostReason}</Text>
          )}
        </View>
        <View style={card.moveHint}>
          <Text style={card.moveIcon}>⇄</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const card = StyleSheet.create({
  wrap: { flexDirection: "row", backgroundColor: "#fff", borderRadius: 12, marginBottom: 8, overflow: "hidden", elevation: 2, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.07, shadowRadius: 3 },
  accent: { width: 4 },
  body: { flex: 1, padding: 12 },
  title: { fontSize: 14, fontWeight: "700", color: "#0f172a", marginBottom: 4 },
  contact: { fontSize: 12, color: "#64748b", marginBottom: 2 },
  meta: { fontSize: 12, color: "#64748b", marginBottom: 4 },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 },
  badge: { borderRadius: 99, paddingHorizontal: 7, paddingVertical: 2 },
  badgeText: { fontSize: 10, fontWeight: "700" },
  amount: { fontSize: 13, fontWeight: "700", color: "#0f766e" },
  lost: { fontSize: 11, color: "#ef4444", marginTop: 4 },
  moveHint: { justifyContent: "center", paddingRight: 10, paddingLeft: 4 },
  moveIcon: { fontSize: 16, color: "#cbd5e1" },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function PipelineScreen() {
  const [opps, setOpps] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeStage, setActiveStage] = useState<string>("NEW");
  const [selectedOpp, setSelectedOpp] = useState<Opportunity | null>(null);
  const [moveModalOpen, setMoveModalOpen] = useState(false);
  const [search, setSearch] = useState("");

  const fetchOpps = useCallback(async () => {
    setError(null);
    const endpoints = [
      "/api/opportunities/page",
      "/api/opportunities",
    ];
    let lastErr: any;
    for (const ep of endpoints) {
      try {
        const res = await api.get(ep, { params: { page: 0, size: 200 } });
        const data = normalize(res.data);
        setOpps(data);
        setLoading(false);
        setRefreshing(false);
        return;
      } catch (e: any) {
        lastErr = e;
      }
    }
    setError(lastErr?.response?.data?.message || lastErr?.message || "Failed to load pipeline");
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    fetchOpps();
  }, [fetchOpps]));

  const handleMoved = (id: string, newStage: string) => {
    setOpps(prev => prev.map(o => o.id === id ? { ...o, stage: newStage } : o));
  };

  // Stage counts
  const counts = STAGES.reduce<Record<string, number>>((acc, s) => {
    acc[s.key] = opps.filter(o => o.stage === s.key).length;
    return acc;
  }, {});

  const filtered = opps.filter(o => {
    if (o.stage !== activeStage) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      o.title?.toLowerCase().includes(q) ||
      o.contactName?.toLowerCase().includes(q) ||
      o.contactPhone?.includes(q)
    );
  });

  const totalValue = opps
    .filter(o => o.stage === activeStage)
    .reduce((s, o) => s + (o.amount ?? 0), 0);

  if (loading && !refreshing) return <LoadingSpinner message="Loading pipeline..." />;

  return (
    <SafeAreaView edges={["bottom"]} style={styles.container}>
      {!!error && <ErrorBanner message={error} onRetry={() => { setLoading(true); fetchOpps(); }} />}

      {/* Stage tabs – horizontal scroll */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabsScroll}
        contentContainerStyle={styles.tabsContent}
      >
        {STAGES.map(s => {
          const active = s.key === activeStage;
          return (
            <TouchableOpacity
              key={s.key}
              onPress={() => setActiveStage(s.key)}
              style={[styles.tab, active && { borderBottomColor: s.color, borderBottomWidth: 3 }]}
            >
              <Text style={[styles.tabLabel, active && { color: s.color }]}>{s.label}</Text>
              <View style={[styles.tabCount, active && { backgroundColor: s.color }]}>
                <Text style={[styles.tabCountText, active && { color: "#fff" }]}>{counts[s.key] ?? 0}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Search + value bar */}
      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search leads..."
          placeholderTextColor="#94a3b8"
        />
        {totalValue > 0 && (
          <Text style={styles.totalValue}>{formatCurrency(totalValue)}</Text>
        )}
      </View>

      {/* Cards */}
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchOpps(); }} tintColor="#0f766e" />}
        contentContainerStyle={styles.listContent}
      >
        {filtered.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>{activeStage === "WON" ? "🏆" : activeStage === "LOST" ? "😔" : "📋"}</Text>
            <Text style={styles.emptyText}>
              {search ? "No matches found" : `No leads in ${STAGE_LABEL[activeStage] ?? activeStage}`}
            </Text>
            <Text style={styles.emptyHint}>Tap ⇄ on a card from another stage to move it here</Text>
          </View>
        ) : (
          filtered.map(opp => (
            <OppCard
              key={opp.id}
              opp={opp}
              onPress={() => { setSelectedOpp(opp); setMoveModalOpen(true); }}
            />
          ))
        )}
      </ScrollView>

      <MoveStageModal
        visible={moveModalOpen}
        opp={selectedOpp}
        onClose={() => { setMoveModalOpen(false); setSelectedOpp(null); }}
        onMoved={handleMoved}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f1f5f9" },
  tabsScroll: { flexGrow: 0, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  tabsContent: { paddingHorizontal: 8 },
  tab: { paddingHorizontal: 14, paddingVertical: 13, alignItems: "center", borderBottomWidth: 3, borderBottomColor: "transparent", flexDirection: "row", gap: 6 },
  tabLabel: { fontSize: 13, fontWeight: "600", color: "#94a3b8" },
  tabCount: { borderRadius: 99, paddingHorizontal: 6, paddingVertical: 1, backgroundColor: "#e2e8f0" },
  tabCountText: { fontSize: 11, fontWeight: "700", color: "#64748b" },
  searchRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 10 },
  searchInput: { flex: 1, height: 38, backgroundColor: "#fff", borderRadius: 10, paddingHorizontal: 14, fontSize: 14, color: "#1e293b", borderWidth: 1, borderColor: "#e2e8f0" },
  totalValue: { fontSize: 14, fontWeight: "700", color: "#0f766e" },
  listContent: { paddingHorizontal: 16, paddingBottom: 24, paddingTop: 4 },
  empty: { alignItems: "center", paddingTop: 60, gap: 6 },
  emptyIcon: { fontSize: 40, marginBottom: 4 },
  emptyText: { fontSize: 15, color: "#64748b", fontWeight: "600" },
  emptyHint: { fontSize: 12, color: "#94a3b8", textAlign: "center", paddingHorizontal: 32 },
});
