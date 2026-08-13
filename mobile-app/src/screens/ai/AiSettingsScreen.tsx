import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import api from "../../api/client";

const androidMedium = Platform.OS === "android" ? "sans-serif-medium" : undefined;

interface AiSettings {
  provider?: string;
  model?: string;
  active?: boolean;
  hasApiKey?: boolean;
}

export default function AiSettingsScreen() {
  const [settings, setSettings] = useState<AiSettings>({ active: false, hasApiKey: false });
  const [initialLoading, setInitialLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState("");
  const [msgIsError, setMsgIsError] = useState(false);

  const connected = Boolean(settings.hasApiKey);

  useEffect(() => {
    let cancelled = false;
    api
      .get("/api/ai/settings")
      .then((res) => { if (!cancelled) setSettings({ active: false, hasApiKey: false, ...(res.data || {}) }); })
      .catch((err: any) => {
        if (!cancelled) showMsg(err?.response?.data?.message || err?.message || "Failed to load AI settings", true);
      })
      .finally(() => { if (!cancelled) setInitialLoading(false); });
    return () => { cancelled = true; };
  }, []);

  function showMsg(msg: string, isError = false) {
    setMessage(msg);
    setMsgIsError(isError);
  }

  // Persist the on/off toggle immediately (no other editable settings here).
  async function toggleActive(next: boolean) {
    setSettings((s) => ({ ...s, active: next }));
    setSaving(true);
    setMessage("");
    try {
      const res = await api.post("/api/ai/settings", {
        provider: settings.provider,
        model: settings.model,
        active: next,
      });
      setSettings((s) => ({ ...s, ...(res.data || {}), active: res.data?.active ?? next }));
      showMsg(next ? "AI turned on." : "AI turned off.");
    } catch (err: any) {
      setSettings((s) => ({ ...s, active: !next })); // revert on failure
      showMsg(err?.response?.data?.message || err?.response?.data?.error || err?.message || "Could not update AI", true);
    } finally {
      setSaving(false);
    }
  }

  async function testConnection() {
    setTesting(true);
    setMessage("");
    try {
      const res = await api.post("/api/ai/test");
      showMsg(`Connection OK — ${res.data?.provider || settings.provider || "AI provider"}`);
    } catch (err: any) {
      showMsg(err?.response?.data?.message || err?.response?.data?.error || err?.message || "AI test failed", true);
    } finally {
      setTesting(false);
    }
  }

  if (initialLoading) {
    return (
      <SafeAreaView style={styles.root} edges={[]}>
        <View style={styles.center}>
          <ActivityIndicator color="#0f766e" size="large" />
          <Text style={styles.loadingText}>Loading AI settings…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={[]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Connection status */}
        <View style={styles.card}>
          <View style={styles.statusRow}>
            <View style={[styles.iconWrap, connected ? styles.iconWrapOk : styles.iconWrapNo]}>
              <Ionicons
                name={connected ? "shield-checkmark" : "alert-circle-outline"}
                size={24}
                color={connected ? "#047857" : "#b45309"}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.statusTitle}>{connected ? "AI Connected" : "AI Not Connected"}</Text>
              <Text style={styles.statusMsg}>
                {connected
                  ? "Your AI provider key is saved securely. Turn AI on to use it across the CRM."
                  : "No AI provider is connected yet. Set up your API key on the web dashboard to enable AI features."}
              </Text>
            </View>
          </View>
        </View>

        {/* Message banner */}
        {!!message && (
          <View style={[styles.msgBanner, msgIsError && styles.msgBannerError]}>
            <Text style={[styles.msgText, msgIsError && styles.msgTextError]}>{message}</Text>
          </View>
        )}

        {/* When connected: on/off toggle + test connection only */}
        {connected && (
          <View style={styles.card}>
            <View style={styles.toggleRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.toggleLabel}>Enable AI for CRM features</Text>
                <Text style={styles.toggleHint}>
                  {settings.active ? "AI is currently on." : "AI is currently off."}
                </Text>
              </View>
              {saving
                ? <ActivityIndicator color="#0f766e" style={{ marginLeft: 8 }} />
                : (
                  <Switch
                    value={Boolean(settings.active)}
                    onValueChange={toggleActive}
                    trackColor={{ false: "#e2e8f0", true: "#0f766e" }}
                    thumbColor="#fff"
                  />
                )}
            </View>

            <TouchableOpacity
              style={[styles.testBtn, (testing || !settings.active) && styles.btnDisabled]}
              onPress={testConnection}
              disabled={testing || !settings.active}
            >
              {testing
                ? <ActivityIndicator color="#0f766e" size="small" />
                : (
                  <View style={styles.testBtnInner}>
                    <Ionicons name="flash-outline" size={16} color="#0f766e" />
                    <Text style={styles.testBtnText}>Test Connection</Text>
                  </View>
                )}
            </TouchableOpacity>
            {!settings.active && (
              <Text style={styles.disabledHint}>Turn AI on to test the connection.</Text>
            )}
          </View>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f8f9fb" },
  scroll: { padding: 16, gap: 12 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { fontSize: 14, color: "#6b7280" },

  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },

  statusRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  iconWrap: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  iconWrapOk: { backgroundColor: "#ecfdf5" },
  iconWrapNo: { backgroundColor: "#fffbeb" },
  statusTitle: { fontSize: 17, fontWeight: "700", color: "#111827", fontFamily: androidMedium },
  statusMsg: { fontSize: 13, color: "#6b7280", lineHeight: 19, marginTop: 4 },

  msgBanner: { backgroundColor: "#f0fdf4", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  msgBannerError: { backgroundColor: "#fef2f2" },
  msgText: { fontSize: 13, fontWeight: "600", color: "#15803d", fontFamily: androidMedium },
  msgTextError: { color: "#dc2626" },

  toggleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  toggleLabel: { fontSize: 15, fontWeight: "600", color: "#374151", fontFamily: androidMedium },
  toggleHint: { fontSize: 12.5, color: "#9ca3af", marginTop: 3 },

  testBtn: { marginTop: 16, backgroundColor: "#f0fdfa", borderRadius: 12, minHeight: 46, alignItems: "center", justifyContent: "center" },
  testBtnInner: { flexDirection: "row", alignItems: "center", gap: 8 },
  testBtnText: { fontSize: 15, fontWeight: "600", color: "#0f766e", fontFamily: androidMedium },
  btnDisabled: { opacity: 0.5 },
  disabledHint: { fontSize: 12, color: "#9ca3af", marginTop: 8, textAlign: "center" },
});
