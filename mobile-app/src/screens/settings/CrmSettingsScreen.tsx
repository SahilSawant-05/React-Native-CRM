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
import { ErrorBanner } from "../../components/common/ErrorBanner";
import { useFocusEffect } from "@react-navigation/native";

interface Pipeline {
  id: string;
  name: string;
  stages: any[];
}

interface CustomField {
  id: string;
  label: string;
  type: string;
}

interface CrmSettings {
  [key: string]: any;
}

export default function CrmSettingsScreen() {
  const [settings, setSettings] = useState<CrmSettings | null>(null);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      setError(null);
      const [settingsRes, pipelinesRes, fieldsRes] = await Promise.all([
        api.get<CrmSettings>("/api/tenant/crm-settings"),
        api.get<Pipeline[]>("/api/pipelines"),
        api.get<CustomField[]>("/api/crm-config/custom-fields"),
      ]);
      setSettings(settingsRes.data);
      setPipelines(pipelinesRes.data);
      setCustomFields(fieldsRes.data);
    } catch (e: any) {
      setError(e?.message || "Failed to load settings");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchAll();
    }, [fetchAll])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchAll();
  };

  if (loading) return <LoadingSpinner message="Loading settings..." />;

  const settingsEntries = settings
    ? Object.entries(settings).filter(([, v]) => typeof v !== "object")
    : [];

  return (
    <SafeAreaView edges={["bottom"]} style={styles.container}>
      {error && <ErrorBanner message={error} onRetry={() => { setLoading(true); fetchAll(); }} />}
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0f766e" />}
        contentContainerStyle={{ paddingBottom: 24 }}
      >
        <Text style={styles.sectionHeader}>GENERAL SETTINGS</Text>
        {settingsEntries.length === 0 && (
          <Text style={styles.emptyText}>No settings available</Text>
        )}
        {settingsEntries.map(([key, value]) => (
          <View key={key} style={styles.card}>
            <Text style={styles.settingKey}>{key.replace(/([A-Z])/g, " $1").trim()}</Text>
            <Text style={styles.settingValue}>{String(value)}</Text>
          </View>
        ))}

        <Text style={styles.sectionHeader}>PIPELINES</Text>
        {pipelines.length === 0 && <Text style={styles.emptyText}>No pipelines</Text>}
        {pipelines.map((p) => (
          <View key={p.id} style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.itemName}>{p.name}</Text>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{p.stages?.length ?? 0} stages</Text>
              </View>
            </View>
          </View>
        ))}

        <Text style={styles.sectionHeader}>CUSTOM FIELDS</Text>
        {customFields.length === 0 && <Text style={styles.emptyText}>No custom fields</Text>}
        {customFields.map((f) => (
          <View key={f.id} style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.itemName}>{f.label}</Text>
              <View style={[styles.badge, { backgroundColor: "#e0f2fe" }]}>
                <Text style={[styles.badgeText, { color: "#0ea5e9" }]}>{f.type}</Text>
              </View>
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f1f5f9" },
  emptyText: { fontSize: 14, color: "#94a3b8", paddingHorizontal: 16, paddingBottom: 8 },
  sectionHeader: { fontSize: 11, fontWeight: "700", color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1, paddingHorizontal: 16, paddingVertical: 8 },
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
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  settingKey: { fontSize: 12, color: "#94a3b8", textTransform: "capitalize", marginBottom: 4 },
  settingValue: { fontSize: 15, fontWeight: "600", color: "#1e293b" },
  itemName: { fontSize: 15, fontWeight: "600", color: "#1e293b", flex: 1 },
  badge: { borderRadius: 99, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: "#ccfbf1" },
  badgeText: { fontSize: 11, fontWeight: "700", color: "#0f766e" },
});
