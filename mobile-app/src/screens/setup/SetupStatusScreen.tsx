import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import api from "../../api/client";
import { useAppNav, tabForTarget } from "../../navigation/useAppNav";

interface SetupItem {
  key?: string;
  label?: string;
  description?: string;
  complete?: boolean;
  count?: number;
  actionPath?: string;
  actionLabel?: string;
}
interface SetupStatus {
  completionPercent?: number;
  completedCount?: number;
  totalCount?: number;
  defaultPipelineName?: string;
  recommendedNextAction?: string;
  items?: SetupItem[];
}

// Item keys that support a one-tap "quick action" via POST /api/setup/actions.
const QUICK_ACTIONS: Record<string, string> = {
  templates: "CREATE_STARTER_TEMPLATES",
  assignment: "CREATE_DEFAULT_ASSIGNMENT",
  automation: "CREATE_FOLLOWUP_AUTOMATION",
};

function errMsg(err: any, fallback: string): string {
  const d = err?.response?.data;
  if (typeof d === "string") return d;
  return d?.message || d?.error || err?.message || fallback;
}

export default function SetupStatusScreen() {
  const { navigateTo } = useAppNav();
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyKey, setBusyKey] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const res = await api.get("/api/setup/status");
      setStatus(res.data || null);
    } catch (err: any) {
      setError(errMsg(err, "Unable to load setup status."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const runAction = async (item: SetupItem) => {
    const action = item.key ? QUICK_ACTIONS[item.key] : undefined;
    if (!action) return;
    setBusyKey(item.key!);
    try {
      const res = await api.post(`/api/setup/actions/${action}`);
      setStatus(res.data || status);
    } catch (err: any) {
      setError(errMsg(err, "Action failed."));
    } finally {
      setBusyKey("");
    }
  };

  const goTo = (item: SetupItem) => {
    const tab = tabForTarget(item.actionPath) || tabForTarget(item.key) || tabForTarget(item.label);
    if (tab) navigateTo(tab);
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.root, styles.center]} edges={[]}>
        <ActivityIndicator color="#0f766e" />
      </SafeAreaView>
    );
  }

  const percent = Math.max(0, Math.min(100, Math.round(status?.completionPercent ?? 0)));
  const items = status?.items ?? [];
  const nextActions = items.filter((i) => !i.complete).slice(0, 3);

  return (
    <SafeAreaView style={styles.root} edges={[]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Progress */}
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.heading}>Setup progress</Text>
            <TouchableOpacity onPress={load} style={styles.refreshBtn}>
              <Ionicons name="refresh-outline" size={16} color="#0f766e" />
            </TouchableOpacity>
          </View>
          <Text style={styles.percentText}>{percent}%</Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${percent}%` }]} />
          </View>
          <Text style={styles.sub}>
            {status?.completedCount ?? 0} of {status?.totalCount ?? items.length} steps complete
            {status?.defaultPipelineName ? ` · ${status.defaultPipelineName}` : ""}
          </Text>
          {!!status?.recommendedNextAction && (
            <View style={styles.recommendBox}>
              <Ionicons name="bulb-outline" size={16} color="#b45309" />
              <Text style={styles.recommendText}>{status.recommendedNextAction}</Text>
            </View>
          )}
        </View>

        {!!error && <View style={styles.errorBanner}><Text style={styles.errorText}>{error}</Text></View>}

        {/* Next best actions */}
        {nextActions.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Next best actions</Text>
            {nextActions.map((item, i) => (
              <View key={`na-${item.key || i}`} style={styles.nextRow}>
                <View style={styles.dotIncomplete} />
                <Text style={styles.nextLabel}>{item.label || item.key}</Text>
              </View>
            ))}
          </View>
        )}

        {/* All items */}
        {items.map((item, i) => {
          const quick = item.key ? QUICK_ACTIONS[item.key] : undefined;
          return (
            <View key={`it-${item.key || i}`} style={styles.card}>
              <View style={styles.rowStart}>
                <View style={[styles.checkCircle, item.complete && styles.checkCircleDone]}>
                  {item.complete
                    ? <Ionicons name="checkmark" size={15} color="#fff" />
                    : <View style={styles.hollow} />}
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={styles.rowBetween}>
                    <Text style={styles.itemLabel}>{item.label || item.key}</Text>
                    {typeof item.count === "number" && <Text style={styles.count}>{item.count}</Text>}
                  </View>
                  {!!item.description && <Text style={styles.itemDesc}>{item.description}</Text>}
                  {!item.complete && (
                    <View style={styles.actionRow}>
                      {!!quick && (
                        <TouchableOpacity
                          style={[styles.quickBtn, busyKey === item.key && { opacity: 0.6 }]}
                          onPress={() => runAction(item)}
                          disabled={busyKey === item.key}
                        >
                          {busyKey === item.key
                            ? <ActivityIndicator size="small" color="#fff" />
                            : <Text style={styles.quickBtnText}>Set up automatically</Text>}
                        </TouchableOpacity>
                      )}
                      {!!item.actionLabel && (
                        <TouchableOpacity style={styles.linkBtn} onPress={() => goTo(item)}>
                          <Text style={styles.linkBtnText}>{item.actionLabel}</Text>
                          <Ionicons name="chevron-forward" size={14} color="#0f766e" />
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </View>
              </View>
            </View>
          );
        })}

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const mediumFont = Platform.OS === "android" ? "sans-serif-medium" : undefined;
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f1f5f9" },
  center: { justifyContent: "center", alignItems: "center" },
  scroll: { padding: 16, gap: 12 },
  card: { backgroundColor: "#fff", borderRadius: 14, padding: 16, gap: 10, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  rowStart: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  heading: { fontSize: 18, fontWeight: "700", color: "#0f172a", fontFamily: mediumFont },
  refreshBtn: { padding: 6, borderRadius: 8, backgroundColor: "#ecfdf5" },
  percentText: { fontSize: 34, fontWeight: "800", color: "#0f766e", fontFamily: mediumFont },
  progressTrack: { height: 10, borderRadius: 6, backgroundColor: "#e2e8f0", overflow: "hidden" },
  progressFill: { height: 10, borderRadius: 6, backgroundColor: "#0f766e" },
  sub: { fontSize: 13, color: "#64748b" },
  recommendBox: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#fffbeb", borderRadius: 10, borderWidth: 1, borderColor: "#fde68a", padding: 10 },
  recommendText: { flex: 1, fontSize: 13, fontWeight: "600", color: "#92400e" },
  errorBanner: { backgroundColor: "#fef2f2", borderRadius: 10, borderWidth: 1, borderColor: "#fecaca", padding: 12 },
  errorText: { fontSize: 13, fontWeight: "600", color: "#dc2626" },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: "#0f172a", fontFamily: mediumFont },
  nextRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  dotIncomplete: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#f59e0b" },
  nextLabel: { fontSize: 14, fontWeight: "600", color: "#334155" },
  checkCircle: { width: 26, height: 26, borderRadius: 13, backgroundColor: "#f1f5f9", alignItems: "center", justifyContent: "center", marginTop: 2 },
  checkCircleDone: { backgroundColor: "#0f766e" },
  hollow: { width: 10, height: 10, borderRadius: 5, borderWidth: 2, borderColor: "#94a3b8" },
  itemLabel: { fontSize: 15, fontWeight: "700", color: "#0f172a", flex: 1 },
  count: { fontSize: 12.5, fontWeight: "700", color: "#64748b" },
  itemDesc: { fontSize: 13, color: "#64748b", lineHeight: 19, marginTop: 3 },
  actionRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 10, flexWrap: "wrap" },
  quickBtn: { backgroundColor: "#0f766e", borderRadius: 8, paddingHorizontal: 14, paddingVertical: 9 },
  quickBtnText: { fontSize: 13, fontWeight: "700", color: "#fff" },
  linkBtn: { flexDirection: "row", alignItems: "center", gap: 3, paddingVertical: 6 },
  linkBtnText: { fontSize: 13, fontWeight: "700", color: "#0f766e" },
});
