import React, { useState, useCallback } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, ActivityIndicator, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import * as DocumentPicker from "expo-document-picker";
import api from "../../api/client";
import { LoadingSpinner } from "../../components/common/LoadingSpinner";

interface UploadRecord {
  id: string;
  fileName: string;
  status: string;
  recordCount: number;
  createdAt: string;
}

interface PreviewRow {
  rowNumber: number;
  status: "NEW" | "EXACT_DUPLICATE" | "DUPLICATE" | "INVALID";
  name?: string;
  phone?: string;
  email?: string;
}

interface PreviewData {
  summary: { total: number; new: number; duplicates: number; invalid: number };
  rows: PreviewRow[];
}

function normalize(data: any): any[] {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.content)) return data.content;
  return [];
}

const ROW_COLORS: Record<string, { bg: string; text: string }> = {
  NEW:             { bg: "#dcfce7", text: "#16a34a" },
  EXACT_DUPLICATE: { bg: "#fef3c7", text: "#d97706" },
  DUPLICATE:       { bg: "#fef3c7", text: "#d97706" },
  INVALID:         { bg: "#fee2e2", text: "#dc2626" },
};

function fmtDate(iso: string) {
  try { return new Date(iso).toLocaleDateString(); } catch { return ""; }
}

export default function UploadLeadsScreen() {
  const [history, setHistory] = useState<UploadRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [updateExisting, setUpdateExisting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState("");

  const fetchHistory = useCallback(async () => {
    try {
      const res = await api.get("/api/contacts/upload/history");
      setHistory(normalize(res.data));
    } catch {
      setHistory([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    fetchHistory();
  }, [fetchHistory]));

  const pickAndUpload = async () => {
    setError(null);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          "text/csv",
          "text/comma-separated-values",
          "application/vnd.ms-excel",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "*/*",
        ],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.length) return;

      const file = result.assets[0];
      setUploading(true);

      const formData = new FormData();
      formData.append("file", {
        uri: file.uri,
        name: file.name ?? "upload.csv",
        type: file.mimeType ?? "text/csv",
      } as any);

      const res = await api.post("/api/contacts/upload/preview", formData, {
        headers: { "Content-Type": "multipart/form-data" },
        transformRequest: (data: any) => data,
      });

      const data: PreviewData = res.data;
      setPreview(data);
      // Auto-select all NEW rows
      setSelected(new Set((data.rows ?? []).filter(r => r.status === "NEW").map(r => r.rowNumber)));
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const toggleRow = (n: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(n) ? next.delete(n) : next.add(n);
      return next;
    });
  };

  const selectNew   = () => preview && setSelected(new Set(preview.rows.filter(r => r.status === "NEW").map(r => r.rowNumber)));
  const selectValid = () => preview && setSelected(new Set(preview.rows.filter(r => r.status !== "INVALID").map(r => r.rowNumber)));
  const clearAll    = () => setSelected(new Set());

  const commit = async () => {
    if (!preview || selected.size === 0) return;
    setCommitting(true);
    setError(null);
    try {
      const rows = preview.rows.filter((r) => selected.has(r.rowNumber));
      const res = await api.post("/api/contacts/upload/commit", { updateExisting, rows });
      const { created = 0, updated = 0, skipped = 0 } = res.data ?? {};
      setSuccessMsg(`✅ Done: ${created} created, ${updated} updated, ${skipped} skipped.`);
      setPreview(null);
      setSelected(new Set());
      fetchHistory();
      setTimeout(() => setSuccessMsg(""), 6000);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || "Import failed");
    } finally {
      setCommitting(false);
    }
  };

  if (loading) return <LoadingSpinner message="Loading upload history..." />;

  return (
    <SafeAreaView edges={["bottom"]} style={styles.container}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchHistory(); }} tintColor="#0f766e" />}
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        {!!error && <View style={styles.errorBanner}><Text style={styles.errorText}>{error}</Text></View>}
        {!!successMsg && <View style={styles.successBanner}><Text style={styles.successText}>{successMsg}</Text></View>}

        {/* Upload card */}
        <View style={styles.infoCard}>
          <Text style={styles.infoIcon}>📤</Text>
          <Text style={styles.infoTitle}>Upload Leads via CSV / XLSX</Text>
          <Text style={styles.infoDesc}>
            Supported columns: name, phone, email, city, tags, leadSource, industryKey
          </Text>
          <TouchableOpacity
            style={[styles.uploadBtn, uploading && styles.btnDisabled]}
            onPress={pickAndUpload}
            disabled={uploading}
          >
            {uploading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.uploadBtnText}>+ Pick & Upload File</Text>}
          </TouchableOpacity>
        </View>

        {/* Preview section */}
        {preview && (
          <>
            {/* Summary stats */}
            <View style={styles.summaryRow}>
              {[
                { label: "Total",   val: preview.summary.total,      color: "#0f172a" },
                { label: "New",     val: preview.summary.new,         color: "#16a34a" },
                { label: "Dupes",   val: preview.summary.duplicates,  color: "#d97706" },
                { label: "Invalid", val: preview.summary.invalid,     color: "#dc2626" },
              ].map(({ label, val, color }) => (
                <View key={label} style={styles.sumCard}>
                  <Text style={[styles.sumNum, { color }]}>{val}</Text>
                  <Text style={styles.sumLabel}>{label}</Text>
                </View>
              ))}
            </View>

            {/* Bulk actions */}
            <View style={styles.actRow}>
              <TouchableOpacity style={styles.actBtn} onPress={selectNew}>
                <Text style={styles.actBtnText}>New only</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actBtn} onPress={selectValid}>
                <Text style={styles.actBtnText}>Select valid</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actBtn, updateExisting && styles.actBtnOn]}
                onPress={() => setUpdateExisting(p => !p)}
              >
                <Text style={[styles.actBtnText, updateExisting && styles.actBtnTextOn]}>
                  Update dupes
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actBtn} onPress={clearAll}>
                <Text style={styles.actBtnText}>Clear</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.sectionHeader}>PREVIEW ({selected.size} / {preview.rows.length} selected)</Text>

            {preview.rows.map((row) => {
              const cl = ROW_COLORS[row.status] || ROW_COLORS.NEW;
              const on = selected.has(row.rowNumber);
              return (
                <TouchableOpacity key={row.rowNumber} onPress={() => toggleRow(row.rowNumber)} activeOpacity={0.7}>
                  <View style={[styles.pRow, on && styles.pRowOn]}>
                    <View style={[styles.chk, on && styles.chkOn]}>
                      {on && <Text style={styles.chkMark}>✓</Text>}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.pName}>{row.name || "—"}</Text>
                      <Text style={styles.pMeta}>
                        {[row.phone, row.email].filter(Boolean).join(" · ")}
                      </Text>
                    </View>
                    <View style={[styles.pBadge, { backgroundColor: cl.bg }]}>
                      <Text style={[styles.pBadgeText, { color: cl.text }]}>
                        {row.status === "EXACT_DUPLICATE" || row.status === "DUPLICATE" ? "DUPE" : row.status}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}

            <TouchableOpacity
              style={[styles.commitBtn, (committing || selected.size === 0) && styles.btnDisabled]}
              onPress={commit}
              disabled={committing || selected.size === 0}
            >
              {committing
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.commitBtnText}>Import {selected.size} Contacts</Text>}
            </TouchableOpacity>
          </>
        )}

        {/* Upload history */}
        <Text style={styles.sectionHeader}>UPLOAD HISTORY</Text>
        {history.length === 0 ? (
          <Text style={styles.emptyText}>No upload history yet</Text>
        ) : history.map((item) => (
          <View key={item.id} style={styles.card}>
            <View style={styles.cardRow}>
              <Text style={styles.fileName} numberOfLines={1}>{item.fileName}</Text>
              <View style={[styles.badge, { backgroundColor: item.status === "COMPLETED" ? "#dcfce7" : "#fef3c7" }]}>
                <Text style={[styles.badgeText, { color: item.status === "COMPLETED" ? "#22c55e" : "#f59e0b" }]}>
                  {item.status}
                </Text>
              </View>
            </View>
            <Text style={styles.meta}>📋 {item.recordCount} records · {fmtDate(item.createdAt)}</Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f1f5f9" },
  errorBanner: { backgroundColor: "#fee2e2", margin: 16, marginBottom: 0, borderRadius: 10, padding: 12 },
  errorText: { fontSize: 13, color: "#b91c1c" },
  successBanner: { backgroundColor: "#d1fae5", margin: 16, marginBottom: 0, borderRadius: 10, padding: 12 },
  successText: { fontSize: 13, color: "#065f46", fontWeight: "600" },
  infoCard: { backgroundColor: "#fff", borderRadius: 14, padding: 24, margin: 16, alignItems: "center", elevation: 2, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3 },
  infoIcon: { fontSize: 40, marginBottom: 12 },
  infoTitle: { fontSize: 18, fontWeight: "700", color: "#1e293b", marginBottom: 8 },
  infoDesc: { fontSize: 13, color: "#64748b", textAlign: "center", lineHeight: 19, marginBottom: 16 },
  uploadBtn: { backgroundColor: "#0f766e", borderRadius: 10, paddingHorizontal: 24, paddingVertical: 12, minWidth: 180, alignItems: "center" },
  uploadBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  btnDisabled: { opacity: 0.5 },
  sectionHeader: { fontSize: 11, fontWeight: "700", color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1, paddingHorizontal: 16, paddingVertical: 8 },
  summaryRow: { flexDirection: "row", paddingHorizontal: 16, gap: 8, marginBottom: 8 },
  sumCard: { flex: 1, backgroundColor: "#fff", borderRadius: 10, padding: 10, alignItems: "center", elevation: 1, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 2 },
  sumNum: { fontSize: 22, fontWeight: "800" },
  sumLabel: { fontSize: 11, color: "#64748b", marginTop: 2 },
  actRow: { flexDirection: "row", paddingHorizontal: 16, gap: 6, marginBottom: 4, flexWrap: "wrap" },
  actBtn: { backgroundColor: "#fff", borderRadius: 8, paddingVertical: 7, paddingHorizontal: 10, borderWidth: 1, borderColor: "#e2e8f0" },
  actBtnOn: { backgroundColor: "#0f766e", borderColor: "#0f766e" },
  actBtnText: { fontSize: 12, fontWeight: "600", color: "#475569" },
  actBtnTextOn: { color: "#fff" },
  pRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#f1f5f9", backgroundColor: "#fff" },
  pRowOn: { backgroundColor: "#f0fdfa" },
  chk: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: "#d1d5db", alignItems: "center", justifyContent: "center" },
  chkOn: { backgroundColor: "#0f766e", borderColor: "#0f766e" },
  chkMark: { color: "#fff", fontSize: 11, fontWeight: "800" },
  pName: { fontSize: 13, fontWeight: "600", color: "#1e293b" },
  pMeta: { fontSize: 11, color: "#64748b", marginTop: 2 },
  pBadge: { borderRadius: 99, paddingHorizontal: 7, paddingVertical: 2 },
  pBadgeText: { fontSize: 10, fontWeight: "700" },
  commitBtn: { margin: 16, backgroundColor: "#0f766e", borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  commitBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  card: { backgroundColor: "#fff", borderRadius: 14, padding: 16, marginHorizontal: 16, marginBottom: 10, elevation: 1, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3 },
  cardRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  fileName: { fontSize: 14, fontWeight: "600", color: "#1e293b", flex: 1, marginRight: 8 },
  badge: { borderRadius: 99, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 11, fontWeight: "700" },
  meta: { fontSize: 12, color: "#64748b" },
  emptyText: { fontSize: 14, color: "#94a3b8", paddingHorizontal: 16 },
});
