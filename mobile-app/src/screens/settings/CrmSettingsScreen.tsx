import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  Clipboard,
  Alert,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import api from "../../api/client";
import { API_BASE_URL } from "../../config/env";
import { LoadingSpinner } from "../../components/common/LoadingSpinner";
import { ErrorBanner } from "../../components/common/ErrorBanner";
import { useFocusEffect } from "@react-navigation/native";

interface Pipeline {
  id: string;
  name: string;
  stages?: any;
  stageCount?: number;
  stageList?: any;
  pipelineStages?: any;
  numStages?: number;
  totalStages?: number;
}

interface CustomField {
  id: string;
  label: string;
  type: string;
}

interface CrmSettings {
  [key: string]: any;
}

// Normalizes the "list of pipelines" response the same way the calendar
// screen normalizes events — some endpoints return a bare array, others
// wrap it in { items }, { content }, or { data }.
function normalizeList(data: any): any[] {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.content)) return data.content;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

// Resolves a stage count for a pipeline no matter which shape the API
// used. Previously this only read `p.stages?.length`, which assumes
// `stages` is a plain array sitting directly on the pipeline object. If
// the backend nests it (`stages: { items: [...] }` / `{ content: [...] }`),
// paginates it, or just sends a precomputed count under a different field
// name (`stageCount`, `numStages`, `totalStages`, `pipelineStages`), that
// expression evaluates to `undefined` and silently falls back to the `?? 0`
// default — so every pipeline shows "0 stages" even when it has stages.
function getStageCount(p: Pipeline): number {
  if (Array.isArray(p.stages)) return p.stages.length;

  const nestedArray =
    normalizeList(p.stages).length
      ? normalizeList(p.stages)
      : Array.isArray(p.stageList)
      ? p.stageList
      : normalizeList(p.stageList).length
      ? normalizeList(p.stageList)
      : Array.isArray(p.pipelineStages)
      ? p.pipelineStages
      : normalizeList(p.pipelineStages);

  if (nestedArray && nestedArray.length) return nestedArray.length;

  const explicitCount = p.stageCount ?? p.numStages ?? p.totalStages;
  if (typeof explicitCount === "number") return explicitCount;

  return 0;
}

export default function CrmSettingsScreen() {
  const [settings, setSettings] = useState<CrmSettings | null>(null);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  // Gmail connection (web parity: Phase2Settings.jsx email card reads
  // /api/email/config → gmailOAuthConnected + gmailOauthEmail/fromEmail)
  const [emailConfig, setEmailConfig] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      setError(null);
      const [settingsRes, pipelinesRes, fieldsRes, emailRes] = await Promise.all([
        api.get<CrmSettings>("/api/tenant/crm-settings"),
        api.get<Pipeline[]>("/api/pipelines"),
        api.get<CustomField[]>("/api/crm-config/custom-fields"),
        api.get("/api/email/config").catch(() => ({ data: null })),
      ]);
      setSettings(settingsRes.data);
      setPipelines(normalizeList(pipelinesRes.data));
      setCustomFields(normalizeList(fieldsRes.data));
      setEmailConfig((emailRes as any).data);
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
    <SafeAreaView edges={[]} style={styles.container}>
      {error && <ErrorBanner message={error} onRetry={() => { setLoading(true); fetchAll(); }} />}
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0f766e" />}
        contentContainerStyle={{ paddingBottom: 24 }}
      >
        <Text style={styles.sectionHeader}>EMAIL</Text>
        {/* Gmail (web parity: Phase2Settings.jsx gmailOAuthConnected) */}
        {(() => {
          const connected = Boolean(emailConfig?.gmailOAuthConnected);
          const who = emailConfig?.gmailOauthEmail || emailConfig?.fromEmail || "";
          return (
            <View style={[styles.card, { backgroundColor: connected ? "#ecfdf5" : "#eff6ff" }]}>
              <View style={styles.row}>
                <Text style={[styles.itemName, { color: connected ? "#065f46" : "#1e40af" }]}>Gmail</Text>
                <View style={[styles.badge, { backgroundColor: connected ? "#059669" : "#dbeafe" }]}>
                  <Text style={[styles.badgeText, { color: connected ? "#fff" : "#1d4ed8" }]}>
                    {connected ? "Connected" : "Not connected"}
                  </Text>
                </View>
              </View>
              <Text style={{ fontSize: 12.5, marginTop: 4, color: connected ? "#047857" : "#1e40af" }}>
                {connected
                  ? `Connected as ${who}`
                  : "Connect Gmail from the web CRM (Settings → Email) to send and receive email."}
              </Text>
            </View>
          );
        })()}
        {/* Outlook / Microsoft 365 (web parity: Phase2Settings.jsx
            outlookOAuthConnected). Previously missing entirely, so a tenant
            connected via Outlook always looked "Not connected". */}
        {(() => {
          const connected = Boolean(emailConfig?.outlookOAuthConnected);
          const who = emailConfig?.outlookOauthEmail || emailConfig?.fromEmail || "";
          return (
            <View style={[styles.card, { backgroundColor: connected ? "#ecfdf5" : "#f0f9ff" }]}>
              <View style={styles.row}>
                <Text style={[styles.itemName, { color: connected ? "#065f46" : "#075985" }]}>Microsoft 365 / Outlook</Text>
                <View style={[styles.badge, { backgroundColor: connected ? "#059669" : "#e0f2fe" }]}>
                  <Text style={[styles.badgeText, { color: connected ? "#fff" : "#0284c7" }]}>
                    {connected ? "Connected" : "Not connected"}
                  </Text>
                </View>
              </View>
              <Text style={{ fontSize: 12.5, marginTop: 4, color: connected ? "#047857" : "#075985" }}>
                {connected
                  ? `Connected as ${who}`
                  : "Connect Microsoft 365 from the web CRM (Settings → Email) to send and receive email."}
              </Text>
            </View>
          );
        })()}

        {/* Website widget snippet (web parity: Phase2Settings.jsx —
            <script src="{baseUrl}/widget.js" data-tenant=… data-key=…>). */}
        <Text style={styles.sectionHeader}>WEBSITE WIDGET</Text>
        {(() => {
          const tenantKey = settings?.widgetTenantKey;
          const publicKey = settings?.widgetPublicKey;
          if (!tenantKey || !publicKey) {
            return <Text style={styles.emptyText}>Widget keys not available yet.</Text>;
          }
          const baseUrl = String(API_BASE_URL || "").replace(/\/+$/, "");
          const snippet = `<script src="${baseUrl}/widget.js" data-tenant="${tenantKey}" data-key="${publicKey}"></script>`;
          const copy = () => {
            Clipboard.setString(snippet);
            Alert.alert("Copied", "Widget snippet copied to clipboard.");
          };
          return (
            <View style={styles.card}>
              <Text style={{ fontSize: 12.5, color: "#475569", marginBottom: 8 }}>
                Paste this script on any website to capture leads into this CRM.
              </Text>
              <View style={styles.codeBox}>
                <Text style={styles.codeText} selectable>{snippet}</Text>
              </View>
              <TouchableOpacity style={styles.copyBtn} onPress={copy} activeOpacity={0.8}>
                <Text style={styles.copyBtnText}>Copy snippet</Text>
              </TouchableOpacity>
            </View>
          );
        })()}

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
                <Text style={styles.badgeText}>{getStageCount(p)} stages</Text>
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
  codeBox: { backgroundColor: "#0f172a", borderRadius: 10, padding: 12 },
  codeText: { fontSize: 12, color: "#e2e8f0", fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" },
  copyBtn: { marginTop: 10, alignSelf: "flex-start", backgroundColor: "#0f766e", borderRadius: 8, paddingHorizontal: 16, paddingVertical: 9 },
  copyBtnText: { fontSize: 13, fontWeight: "700", color: "#fff" },
});