import React, { useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import api from "../../api/client";

// ─── Types ────────────────────────────────────────────────────────────────────

interface EmailLog {
  id: number;
  direction: "INBOUND" | "OUTBOUND";
  subject: string;
  fromEmail: string;
  toEmail: string;
  status: string;
  body?: string;
  readAt?: string | null;
  createdAt: string;
  contactId?: number | null;
  opportunityId?: number | null;
  errorMessage?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  const d = new Date(iso);
  return (
    d.toLocaleDateString() +
    " " +
    d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  );
}

function initials(email: string) {
  if (!email) return "?";
  return email.split("@")[0].slice(0, 2).toUpperCase();
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function MailDetailScreen({ route, navigation }: any) {
  // ── Safely extract and coerce emailId ──────────────────────────────────────
  // route.params may be undefined if the screen is somehow mounted without params.
  // Coerce to number so the URL is always /api/email/logs/384, never /api/email/logs/undefined.
  const rawId = route?.params?.emailId;
  const emailId: number | undefined =
    rawId !== undefined && rawId !== null && rawId !== "" ? Number(rawId) : undefined;

  // ── Debug: log what we received ────────────────────────────────────────────
  console.log("[MailDetail] route.params:", route?.params);
  console.log("[MailDetail] emailId (coerced):", emailId, "| type:", typeof emailId);

  const [email, setEmail] = useState<EmailLog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const isMountedRef = useRef(true);

  // Guard: if emailId is missing, show an error immediately without hitting the API
  if (emailId === undefined || isNaN(emailId)) {
    return (
      <SafeAreaView style={styles.container}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>← Mail</Text>
        </TouchableOpacity>
        <View style={styles.centered}>
          <Text style={styles.errorText}>
            {"Invalid email ID: " + JSON.stringify(route?.params)}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const fetchEmail = useCallback(async () => {
    try {
      setError(null);
      console.log("[MailDetail] GET /api/email/logs/" + emailId);
      const res = await api.get(`/api/email/logs/${emailId}`);
      console.log("[MailDetail] Response status:", res.status);
      console.log("[MailDetail] Response data:", JSON.stringify(res.data).slice(0, 200));
      if (!isMountedRef.current) return;
      setEmail(res.data);
    } catch (e: any) {
      console.log("[MailDetail] Error:", e?.response?.status, e?.response?.data, e?.message);
      if (!isMountedRef.current) return;
      // Show the actual backend error message if available
      const serverMsg =
        e?.response?.data?.message ||
        e?.response?.data?.error ||
        e?.message ||
        "Failed to load email";
      setError(`${e?.response?.status ?? ""} ${serverMsg}`.trim());
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  }, [emailId]);

  useFocusEffect(
    useCallback(() => {
      isMountedRef.current = true;
      setLoading(true);
      fetchEmail();
      return () => {
        isMountedRef.current = false;
      };
    }, [fetchEmail])
  );

  // Mark as read
  useFocusEffect(
    useCallback(() => {
      if (!email || email.direction !== "INBOUND" || email.readAt) return;
      api
        .post(`/api/email/${email.id}/read`)
        .then((res) => {
          if (isMountedRef.current) setEmail(res.data);
        })
        .catch(() => undefined);
    }, [email])
  );

  const sendReply = async () => {
    if (!email || !replyBody.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await api.post(`/api/email/${email.id}/reply`, { bodyText: replyBody.trim() });
      setReplyBody("");
      setSuccessMsg("Reply sent.");
      setTimeout(() => setSuccessMsg(""), 3000);
      fetchEmail();
    } catch (e: any) {
      setError(e?.message || "Reply failed");
    } finally {
      setSaving(false);
    }
  };

  // ── Render: loading ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#0f766e" />
        </View>
      </SafeAreaView>
    );
  }

  // ── Render: error ──────────────────────────────────────────────────────────
  if (error || !email) {
    return (
      <SafeAreaView style={styles.container}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>← Mail</Text>
        </TouchableOpacity>
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error || "Email not found."}</Text>
          <TouchableOpacity onPress={fetchEmail} style={styles.retryBtn}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Render: email ──────────────────────────────────────────────────────────
  const isInbound = email.direction === "INBOUND";
  const contact = isInbound ? email.fromEmail : email.toEmail;

  return (
    <SafeAreaView edges={["bottom"]} style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backText}>← Mail</Text>
          </TouchableOpacity>
          <View
            style={[
              styles.statusBadge,
              email.status === "FAILED" ? styles.badgeFailed : styles.badgeDefault,
            ]}
          >
            <Text
              style={[
                styles.statusText,
                email.status === "FAILED" ? styles.statusFailed : styles.statusDefault,
              ]}
            >
              {email.status || email.direction}
            </Text>
          </View>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Subject */}
          <Text style={styles.subject}>{email.subject || "(No subject)"}</Text>
          <Text style={styles.subMeta}>
            {isInbound ? "Received" : "Sent"} · {formatDate(email.createdAt)}
          </Text>

          {/* Sender row */}
          <View style={styles.senderRow}>
            <View
              style={[
                styles.avatar,
                { backgroundColor: isInbound ? "#dbeafe" : "#d1fae5" },
              ]}
            >
              <Text
                style={[
                  styles.avatarText,
                  { color: isInbound ? "#3b82f6" : "#0f766e" },
                ]}
              >
                {initials(contact)}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.senderName} numberOfLines={1}>
                {contact || "Unknown"}
              </Text>
              <Text style={styles.senderMeta} numberOfLines={1}>
                From: {email.fromEmail || "—"}  ·  To: {email.toEmail || "—"}
              </Text>
            </View>
          </View>

          {/* Body */}
          <View style={styles.bodyCard}>
            <Text style={styles.bodyText}>
              {email.body || "No email body available."}
            </Text>
          </View>

          {/* Error message from email record */}
          {!!email.errorMessage && (
            <View style={styles.errorCard}>
              <Text style={styles.errorCardText}>{email.errorMessage}</Text>
            </View>
          )}

          {/* Banners */}
          {!!successMsg && (
            <View style={styles.successBanner}>
              <Text style={styles.successText}>{successMsg}</Text>
            </View>
          )}
          {!!error && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorBannerText}>{error}</Text>
            </View>
          )}

          {/* Reply */}
          <View style={styles.replyCard}>
            <Text style={styles.replyLabel}>↩ Reply</Text>
            <TextInput
              style={styles.replyInput}
              value={replyBody}
              onChangeText={setReplyBody}
              placeholder="Write your reply..."
              placeholderTextColor="#94a3b8"
              multiline
              textAlignVertical="top"
            />
            <TouchableOpacity
              onPress={sendReply}
              disabled={saving || !replyBody.trim()}
              style={[
                styles.sendBtn,
                (!replyBody.trim() || saving) && styles.sendBtnDisabled,
              ]}
            >
              <Text style={styles.sendBtnText}>
                {saving ? "Sending..." : "Send Reply"}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f1f5f9" },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  backBtn: { paddingVertical: 4, paddingRight: 12 },
  backText: { fontSize: 15, color: "#0f766e", fontWeight: "700" },

  statusBadge: { borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4 },
  badgeFailed: { backgroundColor: "#fee2e2" },
  badgeDefault: { backgroundColor: "#f1f5f9" },
  statusText: { fontSize: 12, fontWeight: "700" },
  statusFailed: { color: "#ef4444" },
  statusDefault: { color: "#475569" },

  scrollContent: { padding: 16, gap: 14, paddingBottom: 40 },

  subject: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0f172a",
    lineHeight: 28,
  },
  subMeta: { fontSize: 13, color: "#64748b", marginTop: 4 },

  senderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 14, fontWeight: "800" },
  senderName: { fontSize: 14, fontWeight: "700", color: "#0f172a" },
  senderMeta: { fontSize: 12, color: "#64748b", marginTop: 2 },

  bodyCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  bodyText: { fontSize: 14, color: "#334155", lineHeight: 22 },

  errorCard: {
    backgroundColor: "#fef2f2",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#fecaca",
  },
  errorCardText: { fontSize: 13, color: "#b91c1c" },

  successBanner: { backgroundColor: "#d1fae5", borderRadius: 10, padding: 12 },
  successText: { fontSize: 13, color: "#065f46", fontWeight: "600" },
  errorBanner: { backgroundColor: "#fee2e2", borderRadius: 10, padding: 12 },
  errorBannerText: { fontSize: 13, color: "#b91c1c", fontWeight: "600" },

  replyCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  replyLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  replyInput: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: "#1e293b",
    minHeight: 120,
  },
  sendBtn: {
    marginTop: 12,
    backgroundColor: "#0f766e",
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: "center",
  },
  sendBtnDisabled: { opacity: 0.5 },
  sendBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },

  errorText: {
    fontSize: 14,
    color: "#ef4444",
    textAlign: "center",
    marginBottom: 16,
  },
  retryBtn: {
    backgroundColor: "#0f766e",
    borderRadius: 10,
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  retryText: { color: "#fff", fontWeight: "700" },
});