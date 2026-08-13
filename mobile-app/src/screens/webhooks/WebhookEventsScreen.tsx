import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator, Modal, Platform, ScrollView, StyleSheet,
  Text, TouchableOpacity, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import api from "../../api/client";
import { DATE_PRESETS, dateRangeParams, presetDateRange } from "../../utils/dateRange";

interface WebhookEvent {
  id: string | number;
  createdAt?: string;
  provider?: string;
  status?: string;
  replayCount?: number;
  errorMessage?: string;
  processedAt?: string;
  lastReplayedAt?: string;
  payload?: any;
}
interface Health {
  totalWebhookEvents?: number;
  processedWebhookEvents?: number;
  failedWebhookEvents?: number;
  webhookReplayAttempts?: number;
  failedOutboundMessages?: number;
  lastReceivedAt?: string;
  lastProcessedAt?: string;
  lastFailedAt?: string;
}

const STATUS_FILTERS = ["ALL", "RECEIVED", "PROCESSED", "FAILED", "REPLAYING"];
const PAGE_SIZE = 20;

function errMsg(err: any, fallback: string): string {
  const d = err?.response?.data;
  if (typeof d === "string") return d;
  return d?.message || d?.error || err?.message || fallback;
}
function statusTone(status?: string): { bg: string; fg: string } {
  const s = String(status || "").toUpperCase();
  if (s === "PROCESSED") return { bg: "#ecfdf5", fg: "#047857" };
  if (s === "FAILED") return { bg: "#fef2f2", fg: "#dc2626" };
  if (s === "REPLAYING") return { bg: "#eff6ff", fg: "#1d4ed8" };
  return { bg: "#f1f5f9", fg: "#475569" };
}
function fmt(v?: string): string {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleString(undefined, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function WebhookEventsScreen() {
  const [events, setEvents] = useState<WebhookEvent[]>([]);
  const [health, setHealth] = useState<Health | null>(null);
  const [status, setStatus] = useState("ALL");
  const [preset, setPreset] = useState("30D");
  const [range, setRange] = useState(() => presetDateRange("30D"));
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrev, setHasPrev] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [banner, setBanner] = useState("");
  const [busyId, setBusyId] = useState<string>("");
  const [detail, setDetail] = useState<WebhookEvent | null>(null);

  const loadHealth = useCallback(async () => {
    try {
      const res = await api.get("/api/webhook-events/health");
      setHealth(res.data || null);
    } catch { /* non-fatal */ }
  }, []);

  const load = useCallback(async (nextPage = page) => {
    setError("");
    setLoading(true);
    try {
      const res = await api.get("/api/webhook-events", {
        params: {
          ...(status !== "ALL" ? { status } : {}),
          ...dateRangeParams(range),
          page: nextPage,
          size: PAGE_SIZE,
        },
      });
      const d = res.data || {};
      setEvents(Array.isArray(d) ? d : d.items || d.content || []);
      setPage(Number(d.page) || nextPage);
      setTotalPages(Number(d.totalPages) || 0);
      setHasNext(Boolean(d.hasNext));
      setHasPrev(Boolean(d.hasPrevious));
    } catch (err: any) {
      setError(errMsg(err, "Unable to load webhook events. Admin access may be required."));
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [status, range, page]);

  useEffect(() => { loadHealth(); }, [loadHealth]);
  useEffect(() => { load(0); /* reload on filter change */ }, [status, range]); // eslint-disable-line

  const replay = async (id: string | number) => {
    setBusyId(String(id)); setBanner("");
    try {
      await api.post(`/api/webhook-events/${id}/replay`);
      setBanner("Replay queued.");
      await Promise.all([load(page), loadHealth()]);
    } catch (err: any) {
      setBanner(errMsg(err, "Replay failed."));
    } finally {
      setBusyId("");
    }
  };

  const retryFailed = async () => {
    setBusyId("all"); setBanner("");
    try {
      const res = await api.post("/api/webhook-events/retry-failed", null, { params: { size: 10 } });
      setBanner(res.data?.message || "Retrying failed webhooks.");
      await Promise.all([load(page), loadHealth()]);
    } catch (err: any) {
      setBanner(errMsg(err, "Retry failed."));
    } finally {
      setBusyId("");
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={[]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Health */}
        {health && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Health</Text>
            <View style={styles.statsGrid}>
              <Stat label="Total" value={health.totalWebhookEvents} />
              <Stat label="Processed" value={health.processedWebhookEvents} tone="#047857" />
              <Stat label="Failed" value={health.failedWebhookEvents} tone="#dc2626" />
              <Stat label="Replays" value={health.webhookReplayAttempts} />
            </View>
            <Text style={styles.healthMeta}>Last received {fmt(health.lastReceivedAt)} · last failed {fmt(health.lastFailedAt)}</Text>
            <TouchableOpacity
              style={[styles.retryAllBtn, busyId === "all" && { opacity: 0.6 }]}
              onPress={retryFailed}
              disabled={busyId === "all"}
            >
              {busyId === "all" ? <ActivityIndicator size="small" color="#b45309" /> : (
                <View style={styles.rowCenter}>
                  <Ionicons name="refresh-outline" size={15} color="#b45309" />
                  <Text style={styles.retryAllText}>Retry failed webhooks</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        )}

        {!!banner && <View style={styles.infoBanner}><Text style={styles.infoText}>{banner}</Text></View>}

        {/* Filters */}
        <View style={styles.card}>
          <Text style={styles.filterLabel}>Status</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {STATUS_FILTERS.map((s) => {
              const active = status === s;
              return (
                <TouchableOpacity key={s} style={[styles.chip, active && styles.chipActive]} onPress={() => setStatus(s)}>
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{s}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <Text style={[styles.filterLabel, { marginTop: 12 }]}>Range</Text>
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
          </ScrollView>
        </View>

        {!!error && <View style={styles.errorBanner}><Text style={styles.errorText}>{error}</Text></View>}

        {loading ? (
          <View style={styles.center}><ActivityIndicator color="#0f766e" /></View>
        ) : events.length === 0 ? (
          <Text style={styles.empty}>No webhook events for this filter.</Text>
        ) : (
          events.map((e) => {
            const tone = statusTone(e.status);
            return (
              <TouchableOpacity key={String(e.id)} style={styles.card} activeOpacity={0.7} onPress={() => setDetail(e)}>
                <View style={styles.rowBetween}>
                  <View style={styles.rowCenter}>
                    <View style={[styles.badge, { backgroundColor: tone.bg }]}>
                      <Text style={[styles.badgeText, { color: tone.fg }]}>{String(e.status || "—").toUpperCase()}</Text>
                    </View>
                    {!!e.provider && <Text style={styles.provider}>{e.provider}</Text>}
                  </View>
                  <Text style={styles.date}>{fmt(e.createdAt)}</Text>
                </View>
                {!!e.errorMessage && <Text style={styles.errText} numberOfLines={2}>{e.errorMessage}</Text>}
                <View style={styles.rowBetween}>
                  <Text style={styles.metaSmall}>Replays: {e.replayCount ?? 0}</Text>
                  <TouchableOpacity
                    style={[styles.replayBtn, busyId === String(e.id) && { opacity: 0.6 }]}
                    onPress={() => replay(e.id)}
                    disabled={busyId === String(e.id)}
                  >
                    {busyId === String(e.id) ? <ActivityIndicator size="small" color="#1d4ed8" /> : (
                      <Text style={styles.replayText}>Replay</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            );
          })
        )}

        {/* Pagination */}
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

      {/* Payload detail */}
      <Modal visible={!!detail} transparent animationType="slide" onRequestClose={() => setDetail(null)}>
        <View style={styles.overlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Event #{detail?.id}</Text>
              <TouchableOpacity onPress={() => setDetail(null)} style={styles.closeBtn}>
                <Ionicons name="close" size={20} color="#475569" />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ padding: 16 }}>
              <Text style={styles.metaSmall}>Status: {detail?.status} · {fmt(detail?.createdAt)}</Text>
              {!!detail?.errorMessage && <Text style={[styles.errText, { marginTop: 8 }]}>{detail.errorMessage}</Text>}
              <Text style={[styles.filterLabel, { marginTop: 14 }]}>Payload</Text>
              <View style={styles.payloadBox}>
                <Text style={styles.payloadText} selectable>
                  {(() => { try { return JSON.stringify(detail?.payload, null, 2); } catch { return String(detail?.payload ?? ""); } })()}
                </Text>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function Stat({ label, value, tone }: { label: string; value?: number; tone?: string }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, tone ? { color: tone } : null]}>{value ?? 0}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const mediumFont = Platform.OS === "android" ? "sans-serif-medium" : undefined;
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f1f5f9" },
  scroll: { padding: 16, gap: 12 },
  center: { paddingVertical: 30, alignItems: "center" },
  card: { backgroundColor: "#fff", borderRadius: 14, padding: 16, gap: 10, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  cardTitle: { fontSize: 16, fontWeight: "700", color: "#0f172a", fontFamily: mediumFont },
  statsGrid: { flexDirection: "row", gap: 10 },
  stat: { flex: 1, backgroundColor: "#f8fafc", borderRadius: 10, borderWidth: 1, borderColor: "#e2e8f0", paddingVertical: 12, alignItems: "center" },
  statValue: { fontSize: 20, fontWeight: "800", color: "#0f172a", fontFamily: mediumFont },
  statLabel: { fontSize: 10.5, fontWeight: "600", color: "#64748b", textTransform: "uppercase", marginTop: 2 },
  healthMeta: { fontSize: 12, color: "#64748b" },
  retryAllBtn: { alignSelf: "flex-start", flexDirection: "row", borderWidth: 1, borderColor: "#fde68a", backgroundColor: "#fffbeb", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  retryAllText: { fontSize: 13, fontWeight: "700", color: "#b45309" },
  rowCenter: { flexDirection: "row", alignItems: "center", gap: 6 },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  infoBanner: { backgroundColor: "#eff6ff", borderRadius: 10, borderWidth: 1, borderColor: "#bfdbfe", padding: 12 },
  infoText: { fontSize: 13, fontWeight: "600", color: "#1d4ed8" },
  filterLabel: { fontSize: 12, fontWeight: "700", color: "#475569", textTransform: "uppercase", letterSpacing: 0.4 },
  chipRow: { flexDirection: "row", gap: 8, paddingVertical: 6 },
  chip: { borderRadius: 20, backgroundColor: "#f1f5f9", paddingHorizontal: 14, paddingVertical: 7 },
  chipActive: { backgroundColor: "#0f766e" },
  chipText: { fontSize: 12.5, fontWeight: "700", color: "#475569" },
  chipTextActive: { color: "#fff" },
  errorBanner: { backgroundColor: "#fef2f2", borderRadius: 10, borderWidth: 1, borderColor: "#fecaca", padding: 12 },
  errorText: { fontSize: 13, fontWeight: "600", color: "#dc2626" },
  empty: { fontSize: 13, color: "#94a3b8", textAlign: "center", paddingVertical: 20 },
  badge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  badgeText: { fontSize: 10.5, fontWeight: "800", letterSpacing: 0.3 },
  provider: { fontSize: 13, fontWeight: "700", color: "#334155" },
  date: { fontSize: 12, color: "#94a3b8" },
  errText: { fontSize: 12.5, color: "#b91c1c", backgroundColor: "#fef2f2", borderRadius: 8, padding: 8 },
  metaSmall: { fontSize: 12, color: "#64748b", fontWeight: "600" },
  replayBtn: { borderWidth: 1, borderColor: "#bfdbfe", backgroundColor: "#eff6ff", borderRadius: 8, paddingHorizontal: 14, paddingVertical: 7 },
  replayText: { fontSize: 12.5, fontWeight: "700", color: "#1d4ed8" },
  pager: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 },
  pageBtn: { borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  pageBtnDisabled: { opacity: 0.4 },
  pageBtnText: { fontSize: 13, fontWeight: "700", color: "#334155" },
  pageInfo: { fontSize: 12.5, color: "#64748b", fontWeight: "600" },
  overlay: { flex: 1, backgroundColor: "rgba(15,23,42,0.5)", justifyContent: "flex-end" },
  modalCard: { backgroundColor: "#fff", borderTopLeftRadius: 18, borderTopRightRadius: 18, maxHeight: "85%" },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#e2e8f0" },
  modalTitle: { fontSize: 16, fontWeight: "700", color: "#0f172a" },
  closeBtn: { padding: 6, borderRadius: 8, backgroundColor: "#f1f5f9" },
  payloadBox: { backgroundColor: "#0f172a", borderRadius: 10, padding: 12, marginTop: 6 },
  payloadText: { fontSize: 11.5, color: "#e2e8f0", fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" },
});
