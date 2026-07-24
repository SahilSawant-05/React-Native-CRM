import React, { useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Clipboard,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import api from "../../api/client";

function aiError(err: any): string {
  const data = err?.response?.data;
  if (typeof data === "string") return data;
  return data?.message || data?.error || err?.message || "AI request failed";
}

interface Props {
  contactId?: string | number | null;
  opportunityId?: string | number | null;
  title?: string;
  contextPrompt?: string;
  replyPrompt?: string;
  onApply?: (text: string) => void;
  applyLabel?: string;
  onSaved?: () => void;
}

export default function AiAssistPanel({
  contactId,
  opportunityId,
  title = "AI Assistant",
  contextPrompt = "",
  replyPrompt = "",
  onApply,
  applyLabel = "Use result",
  onSaved,
}: Props) {
  const [loadingType, setLoadingType] = useState<"summary" | "reply" | "note" | "">("");
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const [actionMessage, setActionMessage] = useState("");

  async function runSummary() {
    if (!contactId) {
      setError("Link a contact before generating an AI summary.");
      return;
    }
    setLoadingType("summary");
    setError("");
    setResult("");
    try {
      const res = await api.post(`/api/ai/contacts/${contactId}/summary`);
      setResult(res.data?.text || "No AI summary returned.");
    } catch (err: any) {
      setError(aiError(err));
    } finally {
      setLoadingType("");
    }
  }

  async function runReply() {
    const prompt = replyPrompt || contextPrompt;
    if (!prompt.trim()) {
      setError("AI reply needs some CRM context first.");
      return;
    }
    setLoadingType("reply");
    setError("");
    setResult("");
    try {
      const res = await api.post("/api/ai/generate", { prompt, purpose: "ai_reply" });
      setResult(res.data?.text || "No AI reply returned.");
    } catch (err: any) {
      setError(aiError(err));
    } finally {
      setLoadingType("");
    }
  }

  function copyResult() {
    if (!result) return;
    Clipboard.setString(result);
    Alert.alert("Copied", "AI result copied to clipboard.");
  }

  // Web parity (AiAssistPanel.jsx saveAsNote): persist the AI output as a
  // contact note via POST /api/contacts/{id}/notes.
  async function saveAsNote() {
    if (!contactId || !result.trim()) return;
    setLoadingType("note");
    setError("");
    setActionMessage("");
    try {
      await api.post(`/api/contacts/${contactId}/notes`, {
        note: `AI note:\n\n${result}`,
        opportunityId: opportunityId ?? null,
      });
      setActionMessage("AI output saved as contact note.");
      onSaved?.();
    } catch (err: any) {
      setError(aiError(err));
    } finally {
      setLoadingType("");
    }
  }

  const busy = Boolean(loadingType);

  return (
    <View style={styles.panel}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Ionicons name="sparkles" size={16} color="#0f766e" style={{ marginTop: 1 }} />
          <View>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>Each successful AI action uses 0.25 credits.</Text>
          </View>
        </View>
        <View style={styles.btnGroup}>
          <TouchableOpacity
            style={[styles.btnOutline, busy && styles.btnDisabled]}
            onPress={runSummary}
            disabled={busy}
          >
            {loadingType === "summary"
              ? <ActivityIndicator size="small" color="#0f766e" />
              : (
                <View style={styles.btnInner}>
                  <Ionicons name="sparkles-outline" size={13} color="#0f766e" />
                  <Text style={styles.btnOutlineText}>AI Summary</Text>
                </View>
              )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btnFill, busy && styles.btnDisabled]}
            onPress={runReply}
            disabled={busy}
          >
            {loadingType === "reply"
              ? <ActivityIndicator size="small" color="#fff" />
              : (
                <View style={styles.btnInner}>
                  <Ionicons name="color-wand-outline" size={13} color="#fff" />
                  <Text style={styles.btnFillText}>AI Reply</Text>
                </View>
              )}
          </TouchableOpacity>
        </View>
      </View>

      {!!error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {!!actionMessage && (
        <View style={styles.successBox}>
          <Ionicons name="checkmark-circle" size={14} color="#047857" />
          <Text style={styles.successText}>{actionMessage}</Text>
        </View>
      )}

      {!!result && (
        <View style={styles.resultBox}>
          <Text style={styles.resultText}>{result}</Text>
          <View style={styles.resultActions}>
            <TouchableOpacity style={styles.copyBtn} onPress={copyResult}>
              <View style={styles.btnInner}>
                <Ionicons name="copy-outline" size={13} color="#4b5563" />
                <Text style={styles.copyBtnText}>Copy</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.noteBtn, (!contactId || loadingType === "note") && styles.btnDisabled]}
              onPress={saveAsNote}
              disabled={!contactId || loadingType === "note"}
            >
              {loadingType === "note"
                ? <ActivityIndicator size="small" color="#0f766e" />
                : (
                  <View style={styles.btnInner}>
                    <Ionicons name="create-outline" size={13} color="#0f766e" />
                    <Text style={styles.noteBtnText}>Save Note</Text>
                  </View>
                )}
            </TouchableOpacity>
            {onApply && (
              <TouchableOpacity style={styles.applyBtn} onPress={() => onApply(result)}>
                <Text style={styles.applyBtnText}>{applyLabel}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: "#f0fdfa",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#99f6e4",
    padding: 12,
    gap: 10,
  },
  header: { gap: 8 },
  titleRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  btnInner: { flexDirection: "row", alignItems: "center", gap: 5 },
  title: { fontSize: 13, fontWeight: "600", color: "#134e4a", fontFamily: Platform.OS === "android" ? "sans-serif-medium" : undefined },
  subtitle: { fontSize: 10, color: "#0f766e", marginTop: 1 },
  btnGroup: { flexDirection: "row", gap: 8 },
  btnOutline: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#0f766e",
    backgroundColor: "#fff",
    paddingVertical: 7,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 34,
  },
  btnOutlineText: { fontSize: 12, fontWeight: "600", color: "#0f766e" },
  btnFill: {
    flex: 1,
    borderRadius: 8,
    backgroundColor: "#0f766e",
    paddingVertical: 7,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 34,
  },
  btnFillText: { fontSize: 12, fontWeight: "600", color: "#fff" },
  btnDisabled: { opacity: 0.5 },
  errorBox: {
    backgroundColor: "#fef2f2",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#fecaca",
    padding: 10,
  },
  errorText: { fontSize: 12, color: "#dc2626", fontWeight: "600" },
  resultBox: {
    backgroundColor: "#fff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#99f6e4",
    padding: 10,
    gap: 8,
  },
  resultText: { fontSize: 13, color: "#1e293b", lineHeight: 20 },
  resultActions: { flexDirection: "row", justifyContent: "flex-end", gap: 8 },
  copyBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  copyBtnText: { fontSize: 11, fontWeight: "700", color: "#475569" },
  noteBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#5eead4",
    backgroundColor: "#f0fdfa",
    minHeight: 28,
    justifyContent: "center",
  },
  noteBtnText: { fontSize: 11, fontWeight: "700", color: "#0f766e" },
  successBox: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#ecfdf5", borderRadius: 8, borderWidth: 1,
    borderColor: "#a7f3d0", padding: 9,
  },
  successText: { fontSize: 12, color: "#047857", fontWeight: "600", flex: 1 },
  applyBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: "#0f172a",
  },
  applyBtnText: { fontSize: 11, fontWeight: "700", color: "#fff" },
});
