import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import api from "../../api/client";
import { LoadingSpinner } from "../../components/common/LoadingSpinner";
import { useFocusEffect } from "@react-navigation/native";

interface UploadHistory {
  id: string;
  fileName: string;
  status: string;
  recordCount: number;
  createdAt: string;
}

const STEPS = [
  { num: "1", label: "Prepare CSV", desc: "Ensure your file has headers: name, email, phone" },
  { num: "2", label: "Upload via web", desc: "Go to the web dashboard and navigate to Leads > Import" },
  { num: "3", label: "Review & commit", desc: "Preview the import and confirm to add leads to your CRM" },
];

export default function UploadLeadsScreen() {
  const [history, setHistory] = useState<UploadHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await api.get<UploadHistory[]>("/api/contacts/upload/history");
      setHistory(res.data);
    } catch {
      setHistory([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchHistory();
    }, [fetchHistory])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchHistory();
  };

  const formatDate = (iso: string) => new Date(iso).toLocaleDateString();

  if (loading) return <LoadingSpinner message="Loading upload history..." />;

  return (
    <SafeAreaView edges={["bottom"]} style={styles.container}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0f766e" />}
        contentContainerStyle={{ paddingBottom: 24 }}
      >
        <View style={styles.infoCard}>
          <Text style={styles.infoIcon}>📤</Text>
          <Text style={styles.infoTitle}>Upload Leads via CSV</Text>
          <Text style={styles.infoDesc}>
            Use the web dashboard to upload and import leads from CSV or XLSX files.
          </Text>
        </View>

        <Text style={styles.sectionHeader}>HOW IT WORKS</Text>
        {STEPS.map((step) => (
          <View key={step.num} style={styles.stepCard}>
            <View style={styles.stepNumBadge}>
              <Text style={styles.stepNum}>{step.num}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.stepLabel}>{step.label}</Text>
              <Text style={styles.stepDesc}>{step.desc}</Text>
            </View>
          </View>
        ))}

        <Text style={styles.sectionHeader}>UPLOAD HISTORY</Text>
        {history.length === 0 ? (
          <Text style={styles.emptyText}>No upload history yet</Text>
        ) : (
          history.map((item) => (
            <View key={item.id} style={styles.card}>
              <View style={styles.row}>
                <Text style={styles.fileName} numberOfLines={1}>{item.fileName}</Text>
                <View style={[styles.badge, { backgroundColor: item.status === "COMPLETED" ? "#dcfce7" : "#fef3c7" }]}>
                  <Text style={[styles.badgeText, { color: item.status === "COMPLETED" ? "#22c55e" : "#f59e0b" }]}>
                    {item.status}
                  </Text>
                </View>
              </View>
              <Text style={styles.meta}>📋 {item.recordCount} records · {formatDate(item.createdAt)}</Text>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f1f5f9" },
  infoCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 24,
    margin: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  infoIcon: { fontSize: 40, marginBottom: 12 },
  infoTitle: { fontSize: 18, fontWeight: "700", color: "#1e293b", marginBottom: 8 },
  infoDesc: { fontSize: 14, color: "#64748b", textAlign: "center", lineHeight: 20 },
  sectionHeader: { fontSize: 11, fontWeight: "700", color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1, paddingHorizontal: 16, paddingVertical: 8 },
  stepCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  stepNumBadge: { width: 28, height: 28, borderRadius: 14, backgroundColor: "#0f766e", alignItems: "center", justifyContent: "center" },
  stepNum: { fontSize: 13, fontWeight: "700", color: "#fff" },
  stepLabel: { fontSize: 14, fontWeight: "600", color: "#1e293b", marginBottom: 2 },
  stepDesc: { fontSize: 13, color: "#64748b" },
  emptyText: { fontSize: 14, color: "#94a3b8", paddingHorizontal: 16 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  fileName: { fontSize: 14, fontWeight: "600", color: "#1e293b", flex: 1, marginRight: 8 },
  badge: { borderRadius: 99, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 11, fontWeight: "700" },
  meta: { fontSize: 12, color: "#64748b" },
});
