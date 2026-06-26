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
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import RenderHtml from "react-native-render-html";
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

function isHtml(str: string): boolean {
  return /<[a-z][\s\S]*>/i.test(str);
}

function sanitizeEmailHtml(raw: string): string {
  let html = raw;
  html = html.replace(/<!--\[if[\s\S]*?<!\[endif\]-->/gi, "");
  html = html.replace(/<!--[\s\S]*?-->/g, "");
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch) html = bodyMatch[1];
  html = html.replace(/<\?xml[\s\S]*?\?>/gi, "");
  html = html.replace(/<\/?[a-z]+:[a-z]+[^>]*>/gi, "");
  html = html.replace(/<style[\s\S]*?<\/style>/gi, "");
  html = html.replace(/<script[\s\S]*?<\/script>/gi, "");
  html = html.replace(/<head[\s\S]*?<\/head>/gi, "");
  html = html.replace(/<meta[^>]*>/gi, "");
  html = html.replace(/<link[^>]*>/gi, "");
  html = html.replace(/\s+on\w+="[^"]*"/gi, "");
  html = html.replace(/\s+on\w+='[^']*'/gi, "");
  html = html.replace(/(\s*\n){3,}/g, "\n\n");
  return html.trim();
}

/**
 * Normalize whatever the list endpoint returns into EmailLog[].
 */
function extractList(data: any): EmailLog[] {
  if (Array.isArray(data))          return data;
  if (Array.isArray(data?.content)) return data.content;
  if (Array.isArray(data?.items))   return data.items;
  if (Array.isArray(data?.data))    return data.data;
  return [];
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function MailDetailScreen({ route, navigation }: any) {
  const { width } = useWindowDimensions();

  const rawId = route?.params?.emailId;
  const emailId: number | undefined =
    rawId !== undefined && rawId !== null && rawId !== ""
      ? Number(rawId)
      : undefined;

  console.log("[MailDetail] route.params:", route?.params);
  console.log("[MailDetail] emailId (coerced):", emailId, "| type:", typeof emailId);

  const [email,      setEmail]      = useState<EmailLog | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);
  const [replyBody,  setReplyBody]  = useState("");
  const [saving,     setSaving]     = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const isMountedRef = useRef(true);

  // ── Guard: invalid emailId ─────────────────────────────────────────────────
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

  // ── Fetch email ────────────────────────────────────────────────────────────
  const fetchEmail = useCallback(async () => {
    if (!isMountedRef.current) return;
    setError(null);

    let found: EmailLog | null = null;

    // ── Strategy 1: single-item endpoint ──────────────────────────────────
    // Backend 500s here (lazy-load / missing join bug). Catch and fall through.
    try {
      const res = await api.get(`/api/email/logs/${emailId}`);
      found = res.data ?? null;
      console.log("[MailDetail] single-item ok:", found?.id);
    } catch (e1: any) {
      console.log(
        "[MailDetail] single-item failed:",
        e1?.response?.status,
        e1?.response?.data?.message ?? e1?.message,
      );
    }

    // ── Strategy 2: flat list endpoint (matches web behaviour) ────────────
    // The web uses GET /api/email/logs (no pagination) and finds all emails
    // here. Try this BEFORE the paginated endpoint because /api/email/logs/page
    // only returns 17 items and email 474 is not among them.
    if (!found) {
      console.log("[MailDetail] trying flat list /api/email/logs ...");
      try {
        const res = await api.get("/api/email/logs");
        const list = extractList(res.data);
        console.log(`[MailDetail] /api/email/logs → ${list.length} items`);
        found = list.find((e) => Number(e.id) === emailId) ?? null;
        if (found) console.log("[MailDetail] found via flat list:", found.id);
      } catch (e2: any) {
        console.log(
          "[MailDetail] /api/email/logs failed:",
          e2?.response?.status,
          e2?.response?.data?.message ?? e2?.message,
        );
      }
    }

    // ── Strategy 3: paginated list endpoint ───────────────────────────────
    // Last resort — scan pages until we find the email (up to 10 pages).
    if (!found) {
      console.log("[MailDetail] trying paginated /api/email/logs/page ...");
      try {
        const firstRes = await api.get("/api/email/logs/page", {
          params: { page: 0, size: 100 },
        });
        const firstList = extractList(firstRes.data);
        console.log(`[MailDetail] /api/email/logs/page p0 → ${firstList.length} items`);
        found = firstList.find((e) => Number(e.id) === emailId) ?? null;

        if (!found) {
          const totalPages: number =
            firstRes.data?.totalPages ?? firstRes.data?.total_pages ?? 1;
          for (let p = 1; p < Math.min(totalPages, 10) && !found; p++) {
            const r = await api.get("/api/email/logs/page", {
              params: { page: p, size: 100 },
            });
            const l = extractList(r.data);
            found = l.find((e) => Number(e.id) === emailId) ?? null;
          }
        }
      } catch (e3: any) {
        console.log(
          "[MailDetail] /api/email/logs/page failed:",
          e3?.response?.status,
          e3?.response?.data?.message ?? e3?.message,
        );
      }
    }

    if (!isMountedRef.current) return;

    if (found) {
      setEmail(found);
      setError(null);
    } else {
      setError(
        "Could not load this email. The server returned an error for the " +
          "direct lookup (500) and it was not found in any email list. " +
          "Try refreshing or contact support.",
      );
    }

    setLoading(false);
  }, [emailId]);

  useFocusEffect(
    useCallback(() => {
      isMountedRef.current = true;
      setLoading(true);
      fetchEmail();
      return () => {
        isMountedRef.current = false;
      };
    }, [fetchEmail]),
  );

  // ── Mark as read ───────────────────────────────────────────────────────────
  useFocusEffect(
    useCallback(() => {
      if (!email || email.direction !== "INBOUND" || email.readAt) return;
      api
        .post(`/api/email/${email.id}/read`)
        .then((res) => {
          if (isMountedRef.current) setEmail(res.data);
        })
        .catch(() => undefined);
    }, [email]),
  );

  // ── Send reply ─────────────────────────────────────────────────────────────
  const sendReply = async () => {
    if (!email || !replyBody.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await api.post(`/api/email/${email.id}/reply`, {
        bodyText: replyBody.trim(),
      });
      setReplyBody("");
      setSuccessMsg("Reply sent.");
      setTimeout(() => setSuccessMsg(""), 3000);
      fetchEmail();
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || "Reply failed");
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
          <Text style={styles.loadingText}>Loading email...</Text>
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
          <TouchableOpacity
            onPress={() => {
              setLoading(true);
              fetchEmail();
            }}
            style={styles.retryBtn}
          >
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Derived values ─────────────────────────────────────────────────────────
  const isInbound = email.direction === "INBOUND";
  const contact   = isInbound ? email.fromEmail : email.toEmail;
  const htmlContentWidth = width - 64;

  // ── Render: email ──────────────────────────────────────────────────────────
  return (
    <SafeAreaView edges={["bottom"]} style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        {/* ── Header ── */}
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
          {/* ── Subject ── */}
          <Text style={styles.subject}>{email.subject || "(No subject)"}</Text>
          <Text style={styles.subMeta}>
            {isInbound ? "Received" : "Sent"} · {formatDate(email.createdAt)}
          </Text>

          {/* ── Sender row ── */}
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

          {/* ── Body ── */}
          <View style={styles.bodyCard}>
            {email.body ? (
              isHtml(email.body) ? (
                <RenderHtml
                  contentWidth={htmlContentWidth}
                  source={{ html: sanitizeEmailHtml(email.body) }}
                  tagsStyles={{
                    body:       { margin: 0, padding: 0 },
                    p:          { fontSize: 14, color: "#334155", lineHeight: 22, marginTop: 0, marginBottom: 8 },
                    a:          { color: "#0f766e", textDecorationLine: "underline" },
                    h1:         { fontSize: 20, color: "#0f172a", fontWeight: "700" },
                    h2:         { fontSize: 17, color: "#0f172a", fontWeight: "700" },
                    h3:         { fontSize: 15, color: "#0f172a", fontWeight: "600" },
                    ul:         { paddingLeft: 16 },
                    ol:         { paddingLeft: 16 },
                    li:         { fontSize: 14, color: "#334155", lineHeight: 22 },
                    blockquote: { borderLeftWidth: 3, borderLeftColor: "#0f766e", paddingLeft: 12, marginLeft: 0, color: "#64748b", fontStyle: "italic" },
                    pre:        { backgroundColor: "#f1f5f9", padding: 10, borderRadius: 6 },
                    code:       { fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace", fontSize: 13, color: "#0f172a", backgroundColor: "#f1f5f9" },
                    img:        { maxWidth: htmlContentWidth },
                    table:      { borderWidth: 1, borderColor: "#e2e8f0" },
                    th:         { backgroundColor: "#f8fafc", padding: 8, fontWeight: "700", fontSize: 13 },
                    td:         { padding: 8, fontSize: 13, color: "#334155" },
                  }}
                  baseStyle={{ fontSize: 14, color: "#334155", lineHeight: 22 }}
                />
              ) : (
                <Text style={styles.bodyText}>{email.body}</Text>
              )
            ) : (
              <Text style={[styles.bodyText, { color: "#94a3b8" }]}>
                No email body available.
              </Text>
            )}
          </View>

          {/* ── Error message from email record ── */}
          {!!email.errorMessage && (
            <View style={styles.errorCard}>
              <Text style={styles.errorCardText}>{email.errorMessage}</Text>
            </View>
          )}

          {/* ── Success / error banners ── */}
          {!!successMsg && (
            <View style={styles.successBanner}>
              <Text style={styles.successText}>{successMsg}</Text>
            </View>
          )}
{!!error && !!email && (
  <View style={styles.errorBanner}>
    <Text style={styles.errorBannerText}>{error}</Text>
  </View>
)}
          {/* ── Reply ── */}
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
  container:   { flex: 1, backgroundColor: "#f1f5f9" },
  centered:    { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  loadingText: { marginTop: 12, fontSize: 14, color: "#64748b" },

  header:       { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#e2e8f0" },
  backBtn:      { paddingVertical: 4, paddingRight: 12 },
  backText:     { fontSize: 15, color: "#0f766e", fontWeight: "700" },
  statusBadge:  { borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4 },
  badgeFailed:  { backgroundColor: "#fee2e2" },
  badgeDefault: { backgroundColor: "#f1f5f9" },
  statusText:   { fontSize: 12, fontWeight: "700" },
  statusFailed: { color: "#ef4444" },
  statusDefault:{ color: "#475569" },

  scrollContent: { padding: 16, gap: 14, paddingBottom: 40 },

  subject: { fontSize: 20, fontWeight: "800", color: "#0f172a", lineHeight: 28 },
  subMeta: { fontSize: 13, color: "#64748b", marginTop: 4 },

  senderRow: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#fff", borderRadius: 14, padding: 14, elevation: 1, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3 },
  avatar:    { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  avatarText:  { fontSize: 14, fontWeight: "800" },
  senderName:  { fontSize: 14, fontWeight: "700", color: "#0f172a" },
  senderMeta:  { fontSize: 12, color: "#64748b", marginTop: 2 },

  bodyCard: { backgroundColor: "#fff", borderRadius: 14, padding: 16, elevation: 1, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3 },
  bodyText: { fontSize: 14, color: "#334155", lineHeight: 22 },

  errorCard:     { backgroundColor: "#fef2f2", borderRadius: 12, padding: 12, borderWidth: 1, borderColor: "#fecaca" },
  errorCardText: { fontSize: 13, color: "#b91c1c" },

  successBanner:   { backgroundColor: "#d1fae5", borderRadius: 10, padding: 12 },
  successText:     { fontSize: 13, color: "#065f46", fontWeight: "600" },
  errorBanner:     { backgroundColor: "#fee2e2", borderRadius: 10, padding: 12 },
  errorBannerText: { fontSize: 13, color: "#b91c1c", fontWeight: "600" },

  replyCard:    { backgroundColor: "#fff", borderRadius: 14, padding: 16, elevation: 1, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3 },
  replyLabel:   { fontSize: 12, fontWeight: "800", color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 },
  replyInput:   { backgroundColor: "#f8fafc", borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 10, padding: 12, fontSize: 14, color: "#1e293b", minHeight: 120 },
  sendBtn:         { marginTop: 12, backgroundColor: "#0f766e", borderRadius: 10, paddingVertical: 13, alignItems: "center" },
  sendBtnDisabled: { opacity: 0.5 },
  sendBtnText:     { color: "#fff", fontWeight: "700", fontSize: 14 },

  errorText: { fontSize: 14, color: "#ef4444", textAlign: "center", marginBottom: 16 },
  retryBtn:  { backgroundColor: "#0f766e", borderRadius: 10, paddingHorizontal: 24, paddingVertical: 10 },
  retryText: { color: "#fff", fontWeight: "700" },
});