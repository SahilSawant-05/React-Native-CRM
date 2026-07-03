import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import api from "../../api/client";

interface FbPage {
  id: string;
  name?: string;
}

interface FbForm {
  id: string;
  name?: string;
}

interface SyncResult {
  fetched?: number;
  created?: number;
  updated?: number;
  skipped?: number;
  warnings?: string[];
}

function errMsg(err: any, fallback = "Something went wrong."): string {
  const data = err?.response?.data;
  if (typeof data === "string") return data;
  return data?.message || data?.error || err?.message || fallback;
}

function MetricCard({ label, value }: { label: string; value?: number }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value ?? 0}</Text>
    </View>
  );
}

function SelectPicker({
  label,
  items,
  selectedId,
  onSelect,
  placeholder,
  disabled,
}: {
  label: string;
  items: { id: string; name?: string }[];
  selectedId: string;
  onSelect: (id: string) => void;
  placeholder: string;
  disabled?: boolean;
}) {
  return (
    <View style={styles.pickerWrap}>
      <Text style={styles.pickerLabel}>{label}</Text>
      {disabled || items.length === 0 ? (
        <View style={[styles.pickerBox, disabled && styles.pickerBoxDisabled]}>
          <Text style={styles.pickerPlaceholder}>{placeholder}</Text>
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.pickerChips}
        >
          {items.map((item) => {
            const active = selectedId === item.id;
            return (
              <TouchableOpacity
                key={item.id}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => onSelect(item.id)}
                activeOpacity={0.8}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {item.name || item.id}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

export default function FacebookLeadsScreen() {
  const [pages, setPages] = useState<FbPage[]>([]);
  const [forms, setForms] = useState<FbForm[]>([]);
  const [pageId, setPageId] = useState("");
  const [formId, setFormId] = useState("");
  const [limit, setLimit] = useState("100");
  const [loadingPages, setLoadingPages] = useState(false);
  const [loadingForms, setLoadingForms] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<SyncResult | null>(null);

  const selectedPage = useMemo(() => pages.find((p) => p.id === pageId) || null, [pages, pageId]);
  const selectedForm = useMemo(() => forms.find((f) => f.id === formId) || null, [forms, formId]);

  const loadPages = useCallback(async () => {
    setError("");
    setResult(null);
    setLoadingPages(true);
    try {
      const res = await api.get("/api/facebook-leads/pages");
      const next: FbPage[] = Array.isArray(res.data) ? res.data : [];
      setPages(next);
      if (!pageId && next.length > 0) setPageId(next[0].id);
    } catch (err: any) {
      setError(errMsg(err, "Unable to load Facebook pages. Reconnect Meta with lead permissions."));
    } finally {
      setLoadingPages(false);
    }
  }, [pageId]);

  const loadForms = useCallback(async (pid: string) => {
    if (!pid) { setForms([]); setFormId(""); return; }
    setError("");
    setResult(null);
    setLoadingForms(true);
    try {
      const res = await api.get("/api/facebook-leads/forms", { params: { pageId: pid } });
      const next: FbForm[] = Array.isArray(res.data) ? res.data : [];
      setForms(next);
      setFormId(next[0]?.id || "");
    } catch (err: any) {
      setForms([]);
      setFormId("");
      setError(errMsg(err, "Unable to load lead forms for this page."));
    } finally {
      setLoadingForms(false);
    }
  }, []);

  const syncLeads = async () => {
    if (!pageId || !formId) {
      setError("Select a Facebook page and lead form first.");
      return;
    }
    const parsedLimit = Math.min(500, Math.max(1, parseInt(limit, 10) || 100));
    setError("");
    setResult(null);
    setSyncing(true);
    try {
      const res = await api.post("/api/facebook-leads/sync", null, {
        params: { pageId, formId, limit: parsedLimit },
      });
      setResult(res.data);
    } catch (err: any) {
      setError(errMsg(err, "Facebook lead sync failed."));
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => { loadPages(); }, []);
  useEffect(() => { if (pageId) loadForms(pageId); }, [pageId]);

  return (
    <SafeAreaView style={styles.root} edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        {/* Header */}
        <View style={styles.card}>
          <Text style={styles.tagline}>Meta Lead Ads</Text>
          <Text style={styles.heading}>Facebook Leads</Text>
          <Text style={styles.subheading}>
            Pull leads from connected Facebook forms into Contacts with duplicate protection.
          </Text>
          <TouchableOpacity
            style={[styles.refreshBtn, loadingPages && styles.btnDisabled]}
            onPress={loadPages}
            disabled={loadingPages}
          >
            {loadingPages
              ? <ActivityIndicator size="small" color="#1d4ed8" />
              : <Text style={styles.refreshBtnText}>↺  Refresh pages</Text>}
          </TouchableOpacity>
        </View>

        {/* Error */}
        {!!error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorIcon}>⚠️</Text>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Page picker */}
        <View style={styles.card}>
          {loadingPages ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color="#1d4ed8" />
              <Text style={styles.loadingText}>Loading pages…</Text>
            </View>
          ) : (
            <SelectPicker
              label="Facebook Page"
              items={pages}
              selectedId={pageId}
              onSelect={setPageId}
              placeholder="No pages connected — tap Refresh pages"
            />
          )}

          {/* Form picker */}
          {loadingForms ? (
            <View style={[styles.loadingRow, { marginTop: 12 }]}>
              <ActivityIndicator color="#1d4ed8" />
              <Text style={styles.loadingText}>Loading forms…</Text>
            </View>
          ) : (
            <SelectPicker
              label="Lead Form"
              items={forms}
              selectedId={formId}
              onSelect={setFormId}
              placeholder={pageId ? "No forms found for this page" : "Select a page first"}
              disabled={!pageId}
            />
          )}

          {/* Limit */}
          <Text style={[styles.pickerLabel, { marginTop: 16 }]}>Sync limit (max 500)</Text>
          <TextInput
            style={styles.limitInput}
            value={limit}
            onChangeText={setLimit}
            keyboardType="number-pad"
            maxLength={3}
            placeholder="100"
            placeholderTextColor="#94a3b8"
          />

          {/* Sync button */}
          <TouchableOpacity
            style={[styles.syncBtn, (syncing || !pageId || !formId) && styles.btnDisabled]}
            onPress={syncLeads}
            disabled={syncing || !pageId || !formId}
          >
            {syncing
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.syncBtnText}>⬇  Sync selected form</Text>}
          </TouchableOpacity>
        </View>

        {/* Selected source summary */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>📄  Selected source</Text>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryKey}>Page</Text>
              <Text style={styles.summaryValue}>{selectedPage?.name || "No page selected"}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryKey}>Form</Text>
              <Text style={styles.summaryValue}>{selectedForm?.name || "No form selected"}</Text>
            </View>
          </View>
        </View>

        {/* How it works */}
        <View style={styles.infoCard}>
          <Text style={styles.infoIcon}>ℹ️</Text>
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={styles.infoTitle}>How sync works</Text>
            <Text style={styles.infoBody}>
              Leads are matched by phone first, then email. New contacts are assigned using your lead
              assignment rules.
            </Text>
            <Text style={styles.infoBody}>
              Re-syncing the same form skips already-imported Meta lead IDs — no duplicates.
            </Text>
          </View>
        </View>

        {/* Sync result */}
        {result && (
          <View style={[styles.card, styles.resultCard]}>
            <Text style={styles.resultTitle}>Sync result</Text>
            <View style={styles.metricsGrid}>
              <MetricCard label="Fetched"  value={result.fetched} />
              <MetricCard label="Created"  value={result.created} />
              <MetricCard label="Updated"  value={result.updated} />
              <MetricCard label="Skipped"  value={result.skipped} />
            </View>
            {Array.isArray(result.warnings) && result.warnings.length > 0 && (
              <View style={styles.warningBox}>
                {result.warnings.map((w, i) => (
                  <Text key={i} style={styles.warningText}>⚠️  {w}</Text>
                ))}
              </View>
            )}
          </View>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f1f5f9" },
  scroll: { padding: 16, gap: 12 },

  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },

  tagline: { fontSize: 10, fontWeight: "800", color: "#1d4ed8", letterSpacing: 2, textTransform: "uppercase", marginBottom: 4 },
  heading: { fontSize: 22, fontWeight: "800", color: "#0f172a" },
  subheading: { fontSize: 13, color: "#64748b", lineHeight: 20, marginTop: 4 },

  refreshBtn: {
    marginTop: 12,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#bfdbfe",
    backgroundColor: "#eff6ff",
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  refreshBtnText: { fontSize: 13, fontWeight: "700", color: "#1d4ed8" },

  errorBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "#fef2f2",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#fecaca",
    padding: 12,
  },
  errorIcon: { fontSize: 16, marginTop: 1 },
  errorText: { flex: 1, fontSize: 13, fontWeight: "600", color: "#dc2626" },

  loadingRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 },
  loadingText: { fontSize: 13, color: "#64748b" },

  pickerWrap: { gap: 6 },
  pickerLabel: { fontSize: 12, fontWeight: "700", color: "#475569", letterSpacing: 0.4, textTransform: "uppercase" },
  pickerBox: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    padding: 12,
    backgroundColor: "#f8fafc",
  },
  pickerBoxDisabled: { opacity: 0.6 },
  pickerPlaceholder: { fontSize: 13, color: "#94a3b8" },
  pickerChips: { flexDirection: "row", gap: 8, paddingVertical: 4 },
  chip: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#bfdbfe",
    backgroundColor: "#eff6ff",
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipActive: { backgroundColor: "#1d4ed8", borderColor: "#1d4ed8" },
  chipText: { fontSize: 13, fontWeight: "600", color: "#1d4ed8" },
  chipTextActive: { color: "#fff" },

  limitInput: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#0f172a",
    backgroundColor: "#f8fafc",
    width: 120,
  },

  syncBtn: {
    marginTop: 16,
    backgroundColor: "#1d4ed8",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
  },
  syncBtnText: { fontSize: 15, fontWeight: "700", color: "#fff" },
  btnDisabled: { opacity: 0.5 },

  sectionTitle: { fontSize: 14, fontWeight: "800", color: "#0f172a", marginBottom: 10 },
  summaryRow: { flexDirection: "row", gap: 16 },
  summaryItem: { flex: 1, gap: 4 },
  summaryKey: { fontSize: 11, fontWeight: "700", color: "#94a3b8", textTransform: "uppercase" },
  summaryValue: { fontSize: 14, fontWeight: "600", color: "#0f172a" },

  infoCard: {
    backgroundColor: "#eff6ff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#bfdbfe",
    padding: 16,
    flexDirection: "row",
    gap: 12,
  },
  infoIcon: { fontSize: 22, marginTop: 2 },
  infoTitle: { fontSize: 15, fontWeight: "800", color: "#1e3a5f", marginBottom: 4 },
  infoBody: { fontSize: 13, color: "#1e40af", lineHeight: 20 },

  resultCard: { borderWidth: 1, borderColor: "#bbf7d0" },
  resultTitle: { fontSize: 16, fontWeight: "800", color: "#0f172a", marginBottom: 12 },
  metricsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  metric: {
    flex: 1,
    minWidth: "40%",
    backgroundColor: "#f8fafc",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 12,
  },
  metricLabel: { fontSize: 10, fontWeight: "800", color: "#64748b", textTransform: "uppercase", letterSpacing: 1 },
  metricValue: { fontSize: 28, fontWeight: "800", color: "#0f172a", marginTop: 4 },

  warningBox: {
    marginTop: 12,
    backgroundColor: "#fffbeb",
    borderRadius: 8,
    padding: 10,
    gap: 4,
  },
  warningText: { fontSize: 12, fontWeight: "600", color: "#92400e" },
});
