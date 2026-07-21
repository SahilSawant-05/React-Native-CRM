import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import api from "../../api/client";

const androidMedium = Platform.OS === "android" ? "sans-serif-medium" : undefined;

const PROVIDERS = [
  {
    key: "OPENAI",
    name: "OpenAI",
    icon: "hardware-chip-outline" as const,
    defaultModel: "gpt-5.4-mini",
    helper: "Strong all-round CRM assistant for summaries, replies, and campaign writing.",
  },
  {
    key: "GEMINI",
    name: "Google Gemini",
    icon: "diamond-outline" as const,
    defaultModel: "gemini-2.5-flash",
    helper: "Good low-cost option for fast text generation and Google-first teams.",
  },
  {
    key: "CLAUDE",
    name: "Anthropic Claude",
    icon: "prism-outline" as const,
    defaultModel: "claude-sonnet-4-5",
    helper: "Useful for careful long-form summaries and polished business communication.",
  },
];

const MODEL_OPTIONS: Record<string, { value: string; label: string; helper: string }[]> = {
  OPENAI: [
    { value: "gpt-5.4-mini",  label: "GPT-5.4 mini",  helper: "Recommended: low cost and fast for CRM replies." },
    { value: "gpt-5.4-nano",  label: "GPT-5.4 nano",  helper: "Lowest cost for simple summaries and short replies." },
    { value: "gpt-5.4",       label: "GPT-5.4",        helper: "More capable for complex writing and longer context." },
    { value: "gpt-5.5",       label: "GPT-5.5",        helper: "Best quality if your OpenAI account has access." },
  ],
  GEMINI: [
    { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash", helper: "Recommended fast Google model." },
    { value: "gemini-2.5-pro",   label: "Gemini 2.5 Pro",   helper: "Higher quality for longer reasoning." },
    { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash",  helper: "Broad compatibility fallback." },
  ],
  CLAUDE: [
    { value: "claude-sonnet-4-5", label: "Claude Sonnet 4.5", helper: "Recommended balanced Claude model." },
    { value: "claude-opus-4-1",   label: "Claude Opus 4.1",   helper: "Higher quality for careful long-form work." },
    { value: "claude-haiku-3-5",  label: "Claude Haiku 3.5",  helper: "Lower cost for short CRM copy." },
  ],
};

const EMPTY_SETTINGS = { provider: "OPENAI", model: "gpt-5.4-mini", active: false, hasApiKey: false };

export default function AiSettingsScreen() {
  const [settings, setSettings] = useState(EMPTY_SETTINGS);
  const [apiKey, setApiKey] = useState("");
  const [prompt, setPrompt] = useState(
    "Write a friendly follow-up WhatsApp reply for a new real estate lead who asked for pricing."
  );
  const [result, setResult] = useState("");
  const [message, setMessage] = useState("");
  const [msgIsError, setMsgIsError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  const selectedProvider = useMemo(
    () => PROVIDERS.find((p) => p.key === settings.provider) || PROVIDERS[0],
    [settings.provider]
  );
  const modelOptions = MODEL_OPTIONS[selectedProvider.key] || [];
  const selectedModel = modelOptions.find((m) => m.value === settings.model) || modelOptions[0];

  useEffect(() => {
    let cancelled = false;
    api
      .get("/api/ai/settings")
      .then((res) => {
        if (cancelled) return;
        const next = { ...EMPTY_SETTINGS, ...(res.data || {}) };
        const prov = PROVIDERS.find((p) => p.key === next.provider) || PROVIDERS[0];
        const models = MODEL_OPTIONS[prov.key] || [];
        const validModel = models.some((m) => m.value === next.model);
        setSettings({ ...next, provider: prov.key, model: validModel ? next.model : prov.defaultModel });
      })
      .catch((err: any) => {
        if (cancelled) return;
        showMsg(err?.response?.data?.message || err.message || "Failed to load AI settings", true);
      })
      .finally(() => { if (!cancelled) setInitialLoading(false); });
    return () => { cancelled = true; };
  }, []);

  function showMsg(msg: string, isError = false) {
    setMessage(msg);
    setMsgIsError(isError);
  }

  function selectProvider(prov: typeof PROVIDERS[0]) {
    setSettings((s) => ({ ...s, provider: prov.key, model: prov.defaultModel }));
  }

  function cycleModel() {
    const idx = modelOptions.findIndex((m) => m.value === settings.model);
    const next = modelOptions[(idx + 1) % modelOptions.length];
    if (next) setSettings((s) => ({ ...s, model: next.value }));
  }

  async function save() {
    setLoading(true);
    setMessage("");
    try {
      const res = await api.post("/api/ai/settings", {
        provider: settings.provider,
        model: settings.model,
        active: settings.active,
        apiKey: apiKey.trim() || null,
      });
      setSettings({ ...EMPTY_SETTINGS, ...(res.data || {}) });
      setApiKey("");
      showMsg("AI settings saved.");
    } catch (err: any) {
      showMsg(err?.response?.data?.message || err?.response?.data?.error || err.message || "Save failed", true);
    } finally {
      setLoading(false);
    }
  }

  async function testConnection() {
    setLoading(true);
    setResult("");
    setMessage("");
    try {
      const res = await api.post("/api/ai/test");
      setResult(res.data?.text || "AI connection worked.");
      showMsg(`Connected with ${res.data?.provider || settings.provider}`);
    } catch (err: any) {
      showMsg(err?.response?.data?.message || err?.response?.data?.error || err.message || "AI test failed", true);
    } finally {
      setLoading(false);
    }
  }

  async function generate() {
    if (!prompt.trim()) return;
    setLoading(true);
    setResult("");
    setMessage("");
    try {
      const res = await api.post("/api/ai/generate", { prompt, purpose: "manual_test" });
      setResult(res.data?.text || "");
      showMsg(`Generated with ${res.data?.provider || settings.provider}`);
    } catch (err: any) {
      showMsg(err?.response?.data?.message || err?.response?.data?.error || err.message || "Generation failed", true);
    } finally {
      setLoading(false);
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
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        {/* Header */}
        <View style={styles.card}>
          <Text style={styles.tagline}>AI Settings</Text>
          <Text style={styles.heading}>Choose your CRM AI provider</Text>
          <Text style={styles.subheading}>
            Connect OpenAI, Gemini, or Claude. The chosen provider will be used for lead summaries,
            reply writing, campaign copy, and future AI actions.
          </Text>
          <View style={[styles.statusBadge, settings.active ? styles.statusActive : styles.statusInactive]}>
            <Text style={[styles.statusText, settings.active ? styles.statusActiveText : styles.statusInactiveText]}>
              {settings.active ? "AI Active" : "AI Disabled"} · {settings.hasApiKey ? "Key saved" : "No key saved"}
            </Text>
          </View>
        </View>

        {/* Message banner */}
        {!!message && (
          <View style={[styles.msgBanner, msgIsError && styles.msgBannerError]}>
            <Text style={[styles.msgText, msgIsError && styles.msgTextError]}>{message}</Text>
          </View>
        )}

        {/* Provider cards */}
        <Text style={styles.sectionLabel}>PROVIDER</Text>
        {PROVIDERS.map((prov) => {
          const active = settings.provider === prov.key;
          return (
            <TouchableOpacity
              key={prov.key}
              style={[styles.card, active && styles.cardActive]}
              onPress={() => selectProvider(prov)}
              activeOpacity={0.8}
            >
              <View style={styles.provRow}>
                <View style={styles.provIconWrap}>
                  <Ionicons name={prov.icon} size={20} color="#0f766e" />
                </View>
                {active && <Ionicons name="checkmark-circle" size={22} color="#0f766e" />}
              </View>
              <Text style={styles.provName}>{prov.name}</Text>
              <Text style={styles.provHelper}>{prov.helper}</Text>
              <View style={styles.defaultModelBadge}>
                <Text style={styles.defaultModelText}>Default: {prov.defaultModel}</Text>
              </View>
            </TouchableOpacity>
          );
        })}

        {/* Configuration */}
        <Text style={styles.sectionLabel}>CONFIGURATION · {selectedProvider.name}</Text>
        <View style={styles.card}>
          {/* Model selector (tap to cycle) */}
          <Text style={styles.fieldLabel}>Model</Text>
          <TouchableOpacity style={styles.modelSelector} onPress={cycleModel} activeOpacity={0.8}>
            <View style={{ flex: 1 }}>
              <Text style={styles.modelName}>{selectedModel?.label || settings.model}</Text>
              {selectedModel && <Text style={styles.modelHelper}>{selectedModel.helper}</Text>}
            </View>
            <Ionicons name="sync-outline" size={20} color="#0f766e" />
          </TouchableOpacity>
          <Text style={styles.modelHint}>Tap to cycle through {modelOptions.length} available models</Text>

          {/* API key */}
          <Text style={[styles.fieldLabel, { marginTop: 16 }]}>API Key</Text>
          <TextInput
            style={styles.input}
            value={apiKey}
            onChangeText={setApiKey}
            placeholder={settings.hasApiKey ? "Saved — enter new key to replace" : "Paste your provider API key"}
            placeholderTextColor="#94a3b8"
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
          />

          {/* Key status hint (web parity: AiSettings.jsx) */}
          <View
            style={[
              styles.keyHint,
              settings.hasApiKey ? styles.keyHintSaved : styles.keyHintNone,
            ]}
          >
            <Ionicons
              name={settings.hasApiKey ? "shield-checkmark" : "alert-circle-outline"}
              size={15}
              color={settings.hasApiKey ? "#047857" : "#b45309"}
              style={{ marginTop: 1 }}
            />
            <Text
              style={[
                styles.keyHintText,
                settings.hasApiKey ? styles.keyHintTextSaved : styles.keyHintTextNone,
              ]}
            >
              {settings.hasApiKey
                ? apiKey.trim()
                  ? "You are replacing the saved encrypted key. Save settings to apply the new key."
                  : "A key is already saved securely. Paste a new key only when you want to replace it."
                : "No API key saved yet. Paste your provider key, then save and test connection."}
            </Text>
          </View>

          {/* Active toggle */}
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Enable AI for CRM features</Text>
            <Switch
              value={Boolean(settings.active)}
              onValueChange={(v) => setSettings((s) => ({ ...s, active: v }))}
              trackColor={{ false: "#e2e8f0", true: "#0f766e" }}
              thumbColor="#fff"
            />
          </View>

          {/* Actions */}
          <View style={styles.btnRow}>
            <TouchableOpacity
              style={[styles.btnPrimary, loading && styles.btnDisabled]}
              onPress={save}
              disabled={loading}
            >
              {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.btnPrimaryText}>Save Settings</Text>}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btnSecondary, (loading || !settings.active) && styles.btnDisabled]}
              onPress={testConnection}
              disabled={loading || !settings.active}
            >
              <Text style={styles.btnSecondaryText}>Test Connection</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Try a prompt */}
        <Text style={styles.sectionLabel}>TRY A CRM PROMPT</Text>
        <View style={styles.card}>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={prompt}
            onChangeText={setPrompt}
            placeholder="Enter a prompt to test AI generation…"
            placeholderTextColor="#94a3b8"
            multiline
            numberOfLines={5}
            textAlignVertical="top"
          />
          <TouchableOpacity
            style={[styles.btnDark, (loading || !settings.active || !prompt.trim()) && styles.btnDisabled]}
            onPress={generate}
            disabled={loading || !settings.active || !prompt.trim()}
          >
            {loading
              ? <ActivityIndicator color="#fff" size="small" />
              : (
                <View style={styles.btnDarkContent}>
                  <Ionicons name="sparkles-outline" size={16} color="#fff" />
                  <Text style={styles.btnDarkText}>Generate</Text>
                </View>
              )}
          </TouchableOpacity>
          {!settings.active && (
            <Text style={styles.disabledHint}>Enable AI above to use the generator.</Text>
          )}
        </View>

        {/* Result */}
        {!!result && (
          <View style={styles.card}>
            <Text style={styles.tagline}>AI Result</Text>
            <View style={styles.resultBox}>
              <Text style={styles.resultText}>{result}</Text>
            </View>
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
  loadingText: { fontSize: 14, color: "#6b7280", letterSpacing: Platform.OS === "ios" ? -0.15 : 0 },

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
  cardActive: { borderWidth: 2, borderColor: "#0f766e" },

  tagline: { fontSize: 11, fontWeight: "600", color: "#6b7280", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 4, fontFamily: androidMedium },
  heading: { fontSize: 19, fontWeight: "600", color: "#111827", marginBottom: 6, fontFamily: androidMedium, letterSpacing: Platform.OS === "ios" ? -0.32 : 0 },
  subheading: { fontSize: 13.5, color: "#6b7280", lineHeight: 20, letterSpacing: Platform.OS === "ios" ? -0.15 : 0 },

  statusBadge: { marginTop: 12, alignSelf: "flex-start", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  statusActive: { backgroundColor: "#f0fdf4" },
  statusInactive: { backgroundColor: "#fffbeb" },
  statusText: { fontSize: 12, fontWeight: "600", fontFamily: androidMedium },
  statusActiveText: { color: "#15803d" },
  statusInactiveText: { color: "#92400e" },

  msgBanner: { backgroundColor: "#fff", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  msgBannerError: { backgroundColor: "#fef2f2" },
  msgText: { fontSize: 13, fontWeight: "600", color: "#374151", fontFamily: androidMedium, letterSpacing: Platform.OS === "ios" ? -0.15 : 0 },
  msgTextError: { color: "#dc2626" },

  sectionLabel: { fontSize: 11, fontWeight: "600", color: "#6b7280", letterSpacing: 0.8, marginTop: 4, fontFamily: androidMedium },

  provRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  provIconWrap: { width: 38, height: 38, borderRadius: 19, backgroundColor: "#f0fdfa", alignItems: "center", justifyContent: "center" },
  provName: { fontSize: 15, fontWeight: "600", color: "#111827", marginTop: 10, fontFamily: androidMedium, letterSpacing: Platform.OS === "ios" ? -0.32 : 0 },
  provHelper: { fontSize: 12.5, color: "#6b7280", marginTop: 4, lineHeight: 18, letterSpacing: Platform.OS === "ios" ? -0.15 : 0 },
  defaultModelBadge: { marginTop: 8, backgroundColor: "#f8f9fb", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, alignSelf: "flex-start" },
  defaultModelText: { fontSize: 11, fontWeight: "600", color: "#6b7280", fontFamily: androidMedium },

  fieldLabel: { fontSize: 11, fontWeight: "600", color: "#6b7280", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 6, fontFamily: androidMedium },
  modelSelector: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(60,60,67,0.2)",
    borderRadius: 12,
    padding: 12,
    backgroundColor: "rgba(118,118,128,0.06)",
    gap: 8,
  },
  modelName: { fontSize: 14, fontWeight: "600", color: "#111827", fontFamily: androidMedium, letterSpacing: Platform.OS === "ios" ? -0.15 : 0 },
  modelHelper: { fontSize: 12.5, color: "#6b7280", marginTop: 2 },
  modelHint: { fontSize: 11, color: "#9ca3af", marginTop: 4 },
  keyHint: {
    flexDirection: "row", gap: 8, alignItems: "flex-start",
    borderRadius: 10, borderWidth: 1, padding: 10, marginTop: 8,
  },
  keyHintSaved: { backgroundColor: "#ecfdf5", borderColor: "#a7f3d0" },
  keyHintNone: { backgroundColor: "#fffbeb", borderColor: "#fde68a" },
  keyHintText: { flex: 1, fontSize: 12, lineHeight: 17, fontWeight: "500" },
  keyHintTextSaved: { color: "#047857" },
  keyHintTextNone: { color: "#b45309" },

  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(60,60,67,0.2)",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 15,
    color: "#111827",
    backgroundColor: "rgba(118,118,128,0.06)",
  },
  textArea: { minHeight: 110, paddingTop: 11 },

  toggleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 16, paddingVertical: 4 },
  toggleLabel: { fontSize: 14, fontWeight: "600", color: "#374151", flex: 1, fontFamily: androidMedium, letterSpacing: Platform.OS === "ios" ? -0.15 : 0 },

  btnRow: { flexDirection: "row", gap: 10, marginTop: 16 },
  btnPrimary: { flex: 1, backgroundColor: "#0f766e", borderRadius: 12, minHeight: 46, alignItems: "center", justifyContent: "center" },
  btnPrimaryText: { fontSize: 15, fontWeight: "600", color: "#fff", fontFamily: androidMedium, letterSpacing: Platform.OS === "ios" ? -0.32 : 0 },
  btnSecondary: { flex: 1, backgroundColor: "#f0fdfa", borderRadius: 12, minHeight: 46, alignItems: "center", justifyContent: "center" },
  btnSecondaryText: { fontSize: 15, fontWeight: "600", color: "#0f766e", fontFamily: androidMedium, letterSpacing: Platform.OS === "ios" ? -0.32 : 0 },
  btnDark: { marginTop: 12, backgroundColor: "#111827", borderRadius: 12, minHeight: 46, alignItems: "center", justifyContent: "center" },
  btnDarkContent: { flexDirection: "row", alignItems: "center", gap: 8 },
  btnDarkText: { fontSize: 15, fontWeight: "600", color: "#fff", fontFamily: androidMedium, letterSpacing: Platform.OS === "ios" ? -0.32 : 0 },
  btnDisabled: { opacity: 0.5 },

  disabledHint: { fontSize: 12, color: "#9ca3af", marginTop: 8, textAlign: "center" },

  resultBox: { marginTop: 10, backgroundColor: "#f8f9fb", borderRadius: 12, padding: 14 },
  resultText: { fontSize: 13.5, color: "#374151", lineHeight: 22, letterSpacing: Platform.OS === "ios" ? -0.15 : 0 },
});
