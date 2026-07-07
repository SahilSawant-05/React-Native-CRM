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
import { Ionicons } from "@expo/vector-icons";
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

// ─── Email HTML body (Gmail approach: a self-sizing WebView) ─────────────────
// RenderHtml chokes on real-world marketing emails (nested tables, CSS,
// tracker images). A WebView renders them exactly like Gmail does, loads
// remote images, and the injected script reports the content height so
// the WebView fits inside the outer ScrollView without its own scrolling.

// WebView is native-only — require it lazily so Expo web doesn't crash.
let NativeWebView: any = null;
if (Platform.OS !== "web") {
  try {
    NativeWebView = require("react-native-webview").WebView;
  } catch {
    NativeWebView = null;
  }
}

function EmailWebView({ html }: { html: string }) {
  const [height, setHeight] = useState(200);

  const doc = `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<style>
  html, body { margin:0; padding:0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, Roboto, "Segoe UI", sans-serif;
    font-size: 14px; line-height: 1.55; color: #374151;
    word-wrap: break-word; overflow-x: hidden;
  }
  img { max-width: 100% !important; height: auto !important; }
  table { max-width: 100% !important; height: auto !important; }
  * { box-sizing: border-box; }
  a { color: #0f766e; }
  blockquote { border-left: 3px solid #0f766e; margin-left: 0; padding-left: 12px; color: #6b7280; }
</style></head><body>${html}
<script>
  function post() {
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(String(document.documentElement.scrollHeight));
    }
  }
  window.addEventListener("load", post);
  setTimeout(post, 250);
  setTimeout(post, 1000);
  setTimeout(post, 2500);
</script></body></html>`;

  // Web (Expo web / react-native-web): use a sandboxed iframe — same
  // rendering fidelity, measures its own content height on load.
  if (Platform.OS === "web") {
    return React.createElement("iframe", {
      srcDoc: doc,
      sandbox: "allow-same-origin",
      style: { border: "none", width: "100%", height, overflow: "hidden" },
      onLoad: (e: any) => {
        try {
          const h = e.target?.contentDocument?.documentElement?.scrollHeight;
          if (h && h > 0) setHeight(h + 16);
        } catch {
          setHeight(600);
        }
      },
    });
  }

  if (!NativeWebView) {
    // Native module unavailable (e.g. not yet installed) — plain-text fallback
    return (
      <Text style={{ fontSize: 14, color: "#374151", lineHeight: 21 }}>
        {html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()}
      </Text>
    );
  }

  return (
    <NativeWebView
      source={{ html: doc }}
      originWhitelist={["*"]}
      scrollEnabled={false}
      javaScriptEnabled
      domStorageEnabled
      mixedContentMode="always"
      androidLayerType="software"
      setSupportMultipleWindows={false}
      style={{ height, backgroundColor: "transparent", opacity: 0.99 }}
      onMessage={(e: any) => {
        const h = Number(e.nativeEvent.data);
        if (Number.isFinite(h) && h > 0 && Math.abs(h - height) > 4) setHeight(h + 16);
      }}
    />
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function MailDetailScreen({ route, navigation }: any) {
  const rawId = route?.params?.emailId;
  const emailId: number | undefined =
    rawId !== undefined && rawId !== null && rawId !== ""
      ? Number(rawId)
      : undefined;

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
          <Ionicons name="arrow-back" size={24} color="#374151" />
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

    // ── Strategy 1: flat list endpoint ─────────────────────────────────────
    // The direct GET /api/email/logs/{id} endpoint 500s on this backend
    // (lazy-load / missing join bug), so go straight for the flat list the
    // web app uses — it contains the full email body.
    try {
      const res = await api.get("/api/email/logs");
      const list = extractList(res.data);
      found = list.find((e) => Number(e.id) === emailId) ?? null;
    } catch {
      // fall through
    }

    // ── Strategy 2: single-item endpoint ───────────────────────────────────
    if (!found) {
      try {
        const res = await api.get(`/api/email/logs/${emailId}`);
        found = res.data ?? null;
      } catch {
        // fall through
      }
    }

    // ── Strategy 3: paginated scan (up to 10 pages) ────────────────────────
    if (!found) {
      try {
        const firstRes = await api.get("/api/email/logs/page", {
          params: { page: 0, size: 100 },
        });
        const firstList = extractList(firstRes.data);
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
      } catch {
        // fall through to error state
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
          <Ionicons name="arrow-back" size={24} color="#374151" />
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

  // ── Render: email ──────────────────────────────────────────────────────────
  return (
    <SafeAreaView edges={["top", "bottom"]} style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        {/* ── Header (Gmail-style: back arrow only, status pill right) ── */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="arrow-back" size={24} color="#374151" />
          </TouchableOpacity>
          {email.status === "FAILED" && (
            <View style={[styles.statusBadge, styles.badgeFailed]}>
              <Text style={[styles.statusText, styles.statusFailed]}>Failed</Text>
            </View>
          )}
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Subject (Gmail: large, plain, top) ── */}
          <Text style={styles.subject}>{email.subject || "(No subject)"}</Text>

          {/* ── Sender row (Gmail anatomy) ── */}
          <View style={styles.senderRow}>
            <View
              style={[
                styles.avatar,
                { backgroundColor: isInbound ? "#dbeafe" : "#ccfbf1" },
              ]}
            >
              <Text
                style={[
                  styles.avatarText,
                  { color: isInbound ? "#2563eb" : "#0f766e" },
                ]}
              >
                {initials(contact)[0] ?? "?"}
              </Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={styles.senderTopRow}>
                <Text style={styles.senderName} numberOfLines={1}>
                  {(contact || "Unknown").split("@")[0]}
                </Text>
                <Text style={styles.senderDate}>{formatDate(email.createdAt)}</Text>
              </View>
              <Text style={styles.senderMeta} numberOfLines={1}>
                {isInbound ? `to me · ${email.fromEmail || ""}` : `to ${email.toEmail || ""}`}
              </Text>
            </View>
          </View>

          <View style={styles.bodyDivider} />

          {/* ── Body (full-bleed like Gmail; clipped so HTML can't break layout) ── */}
          <View style={styles.bodyCard}>
            {email.body ? (
              isHtml(email.body) ? (
                <EmailWebView html={sanitizeEmailHtml(email.body)} />
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
            <View style={styles.replyLabelRow}>
              <Ionicons name="arrow-undo-outline" size={16} color="#4b5563" />
              <Text style={styles.replyLabel}>Reply</Text>
            </View>
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
              {saving ? (
                <Text style={styles.sendBtnText}>Sending...</Text>
              ) : (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Ionicons name="send" size={15} color="#fff" />
                  <Text style={styles.sendBtnText}>Send</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: "#fff" },
  centered:    { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  loadingText: { marginTop: 12, fontSize: 13, color: "#6b7280" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#fff",
  },
  backBtn:      { padding: 6 },
  statusBadge:  { borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4 },
  badgeFailed:  { backgroundColor: "#fee2e2" },
  statusText:   { fontSize: 11, fontWeight: "700" },
  statusFailed: { color: "#dc2626" },

  scrollContent: { paddingHorizontal: 16, paddingBottom: 40 },

  subject: {
    fontSize: 19,
    fontWeight: "500",
    color: "#111827",
    lineHeight: 26,
    letterSpacing: Platform.OS === "ios" ? -0.4 : 0,
    fontFamily: Platform.OS === "android" ? "sans-serif-medium" : undefined,
    marginBottom: 16,
  },

  senderRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  avatarText: {
    fontSize: 16, fontWeight: "600",
    fontFamily: Platform.OS === "android" ? "sans-serif-medium" : undefined,
  },
  senderTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  senderName: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
    letterSpacing: Platform.OS === "ios" ? -0.15 : 0,
    fontFamily: Platform.OS === "android" ? "sans-serif-medium" : undefined,
  },
  senderDate: { fontSize: 11.5, color: "#6b7280" },
  senderMeta: { fontSize: 12, color: "#6b7280", marginTop: 2 },

  bodyDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(60,60,67,0.12)",
    marginVertical: 14,
  },

  // overflow: "hidden" is what stops rogue email HTML (wide tables,
  // fixed-width images) from breaking the whole screen sideways.
  bodyCard: { overflow: "hidden" },
  bodyText: { fontSize: 14, color: "#374151", lineHeight: 21 },

  errorCard:     { backgroundColor: "#fef2f2", borderRadius: 12, padding: 12, marginTop: 14 },
  errorCardText: { fontSize: 12.5, color: "#b91c1c" },

  successBanner:   { backgroundColor: "#d1fae5", borderRadius: 10, padding: 12, marginTop: 14 },
  successText:     { fontSize: 12.5, color: "#065f46", fontWeight: "600" },
  errorBanner:     { backgroundColor: "#fee2e2", borderRadius: 10, padding: 12, marginTop: 14 },
  errorBannerText: { fontSize: 12.5, color: "#b91c1c", fontWeight: "600" },

  replyCard: {
    marginTop: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(60,60,67,0.12)",
    paddingTop: 16,
  },
  replyLabelRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 },
  replyLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#4b5563",
    fontFamily: Platform.OS === "android" ? "sans-serif-medium" : undefined,
  },
  replyInput: {
    backgroundColor: "rgba(118,118,128,0.06)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(60,60,67,0.2)",
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: "#111827",
    minHeight: 110,
    lineHeight: 20,
  },
  sendBtn: {
    marginTop: 12,
    alignSelf: "flex-end",
    backgroundColor: "#0f766e",
    borderRadius: 20,
    paddingHorizontal: 22,
    paddingVertical: 10,
    alignItems: "center",
  },
  sendBtnDisabled: { opacity: 0.4 },
  sendBtnText: {
    color: "#fff", fontWeight: "600", fontSize: 14,
    fontFamily: Platform.OS === "android" ? "sans-serif-medium" : undefined,
  },

  errorText: { fontSize: 13.5, color: "#dc2626", textAlign: "center", marginBottom: 16 },
  retryBtn:  { backgroundColor: "#0f766e", borderRadius: 10, paddingHorizontal: 24, paddingVertical: 10 },
  retryText: { color: "#fff", fontWeight: "600", fontSize: 14 },
});
