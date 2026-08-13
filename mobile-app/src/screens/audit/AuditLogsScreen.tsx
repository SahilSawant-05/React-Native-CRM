import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator, Modal, Platform, ScrollView, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import api from "../../api/client";
import { DATE_PRESETS, dateRangeParams, presetDateRange } from "../../utils/dateRange";

interface AuditEntry {
  id: string | number;
  createdAt?: string;
  actionType?: string;
  entityType?: string;
  entityId?: string | number;
  actorUserEmail?: string;
  summary?: string;
  details?: string;
  oldValue?: any;
  newValue?: any;
}

const PAGE_SIZE = 20;

function errMsg(err: any, fallback: string): string {
  const d = err?.response?.data;
  if (typeof d === "string") return d;
  return d?.message || d?.error || err?.message || fallback;
}
function fmt(v?: string): string {
  if (!v) return "";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleString(undefined, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
function pretty(v: any): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  try { return JSON.stringify(v, null, 2); } catch { return String(v); }
}

export default function AuditLogsScreen() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [actionType, setActionType] = useState("");
  const [entityType, setEntityType] = useState("");
  const [preset, setPreset] = useState("30D");
  const [range, setRange] = useState(() => presetDateRange("30D"));
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrev, setHasPrev] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [detail, setDetail] = useState<AuditEntry | null>(null);

  const load = useCallback(async (nextPage = 0) => {
    setError("");
    setLoading(true);
    try {
      const res = await api.get("/api/audit", {
        params: {
          ...(actionType.trim() ? { actionType: actionType.trim() } : {}),
          ...(entityType.trim() ? { entityType: entityType.trim() } : {}),
          ...dateRangeParams(range),
          page: nextPage,
          size: PAGE_SIZE,
        },
      });
      const d = res.data || {};
      setEntries(Array.isArray(d) ? d : d.items || d.content || []);
      setPage(Number(d.page) || nextPage);
      setTotalPages(Number(d.totalPages) || 0);
      setHasNext(Boolean(d.hasNext));
      setHasPrev(Boolean(d.hasPrevious));
    } catch (err: any) {
      setError(errMsg(err, "Unable to load audit logs. Admin access may be required."));
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [actionType, entityType, range]);

  // Reload when the date range changes; text filters are applied on submit.
  useEffect(() => { load(0); }, [range]); // eslint-disable-line

  return (
    <SafeAreaView style={styles.root} edges={[]}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Filters */}
        <View style={styles.card}>
          <View style={styles.filterGrid}>
            <View style={{ flex: 1 }}>
              <Text style={styles.filterLabel}>Action</Text>
              <TextInput
                style={styles.input}
                value={actionType}
                onChangeText={setActionType}
                placeholder="e.g. UPDATE"
                placeholderTextColor="#94a3b8"
                autoCapitalize="characters"
                onSubmitEditing={() => load(0)}
                returnKeyType="search"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.filterLabel}>Entity</Text>
              <TextInput
                style={styles.input}
                value={entityType}
                onChangeText={setEntityType}
                placeholder="e.g. CONTACT"
                placeholderTextColor="#94a3b8"
                autoCapitalize="characters"
                onSubmitEditing={() => load(0)}
                returnKeyType="search"
              />
            </View>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {DATE_PRESETS.map((p) => {
              const active = preset === p.key;
              return (
                <TouchableOpacity
                  key={p.key}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => { setPreset(p.key); setRange(presetDateRange(p.key)); }}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{p.label}</Text>
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity style={styles.applyBtn} onPress={() => load(0)}>
              <Ionicons name="search" size={14} color="#fff" />
              <Text style={styles.applyText}>Apply</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        {!!error && <View style={styles.errorBanner}><Text style={styles.errorText}>{error}</Text></View>}

        {loading ? (
          <View style={styles.center}><ActivityIndicator color="#0f766e" /></View>
        ) : entries.length === 0 ? (
          <Text style={styles.empty}>No audit entries for this filter.</Text>
        ) : (
          entries.map((e) => (
            <TouchableOpacity key={String(e.id)} style={styles.card} activeOpacity={0.7} onPress={() => setDetail(e)}>
              <View style={styles.rowBetween}>
                <View style={styles.rowCenter}>
                  <View style={styles.actionBadge}><Text style={styles.actionBadgeText}>{String(e.actionType || "—").replace(/_/g, " ")}</Text></View>
                  {!!e.entityType && <Text style={styles.entity}>{e.entityType}{e.entityId ? ` #${e.entityId}` : ""}</Text>}
                </View>
                <Text style={styles.date}>{fmt(e.createdAt)}</Text>
              </View>
              {!!(e.summary || e.details) && <Text style={styles.summary} numberOfLines={2}>{e.summary || e.details}</Text>}
              {!!e.actorUserEmail && <Text style={styles.actor}>by {e.actorUserEmail}</Text>}
            </TouchableOpacity>
          ))
        )}

        {(hasPrev || hasNext) && (
          <View style={styles.pager}>
            <TouchableOpacity disabled={!hasPrev} style={[styles.pageBtn, !hasPrev && styles.pageBtnDisabled]} onPress={() => load(Math.max(0, page - 1))}>
              <Text style={styles.pageBtnText}>Previous</Text>
            </TouchableOpacity>
            <Text style={styles.pageInfo}>Page {page + 1}{totalPages ? ` of ${totalPages}` : ""}</Text>
            <TouchableOpacity disabled={!hasNext} style={[styles.pageBtn, !hasNext && styles.pageBtnDisabled]} onPress={() => load(page + 1)}>
              <Text style={styles.pageBtnText}>Next</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>

      <Modal visible={!!detail} transparent animationType="slide" onRequestClose={() => setDetail(null)}>
        <View style={styles.overlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{detail?.actionType} · {detail?.entityType}</Text>
              <TouchableOpacity onPress={() => setDetail(null)} style={styles.closeBtn}>
                <Ionicons name="close" size={20} color="#475569" />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
              <Text style={styles.metaSmall}>{fmt(detail?.createdAt)}{detail?.actorUserEmail ? ` · ${detail.actorUserEmail}` : ""}</Text>
              {!!(detail?.summary || detail?.details) && <Text style={styles.detailBody}>{detail?.summary || detail?.details}</Text>}
              {detail?.oldValue != null && (
                <View>
                  <Text style={styles.filterLabel}>Before</Text>
                  <View style={styles.diffOld}><Text style={styles.diffText} selectable>{pretty(detail.oldValue)}</Text></View>
                </View>
              )}
              {detail?.newValue != null && (
                <View>
                  <Text style={styles.filterLabel}>After</Text>
                  <View style={styles.diffNew}><Text style={styles.diffText} selectable>{pretty(detail.newValue)}</Text></View>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const mediumFont = Platform.OS === "android" ? "sans-serif-medium" : undefined;
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f1f5f9" },
  scroll: { padding: 16, gap: 12 },
  center: { paddingVertical: 30, alignItems: "center" },
  card: { backgroundColor: "#fff", borderRadius: 14, padding: 16, gap: 8, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  filterGrid: { flexDirection: "row", gap: 10 },
  filterLabel: { fontSize: 12, fontWeight: "700", color: "#475569", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9, fontSize: 14, color: "#0f172a", backgroundColor: "#f8fafc" },
  chipRow: { flexDirection: "row", gap: 8, paddingVertical: 6, marginTop: 6, alignItems: "center" },
  chip: { borderRadius: 20, backgroundColor: "#f1f5f9", paddingHorizontal: 14, paddingVertical: 7 },
  chipActive: { backgroundColor: "#0f766e" },
  chipText: { fontSize: 12.5, fontWeight: "700", color: "#475569" },
  chipTextActive: { color: "#fff" },
  applyBtn: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#0f172a", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 },
  applyText: { fontSize: 12.5, fontWeight: "700", color: "#fff" },
  errorBanner: { backgroundColor: "#fef2f2", borderRadius: 10, borderWidth: 1, borderColor: "#fecaca", padding: 12 },
  errorText: { fontSize: 13, fontWeight: "600", color: "#dc2626" },
  empty: { fontSize: 13, color: "#94a3b8", textAlign: "center", paddingVertical: 20 },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  rowCenter: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1, minWidth: 0 },
  actionBadge: { backgroundColor: "#eef2ff", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  actionBadgeText: { fontSize: 11, fontWeight: "800", color: "#4338ca", letterSpacing: 0.3 },
  entity: { fontSize: 13, fontWeight: "700", color: "#334155", flexShrink: 1 },
  date: { fontSize: 11.5, color: "#94a3b8" },
  summary: { fontSize: 13, color: "#475569", lineHeight: 19 },
  actor: { fontSize: 12, color: "#94a3b8" },
  pager: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 },
  pageBtn: { borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  pageBtnDisabled: { opacity: 0.4 },
  pageBtnText: { fontSize: 13, fontWeight: "700", color: "#334155" },
  pageInfo: { fontSize: 12.5, color: "#64748b", fontWeight: "600" },
  overlay: { flex: 1, backgroundColor: "rgba(15,23,42,0.5)", justifyContent: "flex-end" },
  modalCard: { backgroundColor: "#fff", borderTopLeftRadius: 18, borderTopRightRadius: 18, maxHeight: "85%" },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#e2e8f0" },
  modalTitle: { fontSize: 15.5, fontWeight: "700", color: "#0f172a", flex: 1, marginRight: 8 },
  closeBtn: { padding: 6, borderRadius: 8, backgroundColor: "#f1f5f9" },
  metaSmall: { fontSize: 12, color: "#64748b", fontWeight: "600" },
  detailBody: { fontSize: 14, color: "#334155", lineHeight: 20 },
  diffOld: { backgroundColor: "#fef2f2", borderRadius: 8, padding: 10, marginTop: 6 },
  diffNew: { backgroundColor: "#ecfdf5", borderRadius: 8, padding: 10, marginTop: 6 },
  diffText: { fontSize: 11.5, color: "#334155", fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" },
});
