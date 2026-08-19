import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Modal,
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
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import api from "../../api/client";
import { getTelephonyToggles, invalidateTelephonyToggles, isCrmCallingOn, getAgentCrmCallingPref, setAgentCrmCallingPref } from "../../api/telephony";
import { useAuth } from "../../auth/AuthContext";
import { ErrorBanner } from "../../components/common/ErrorBanner";
import { LoadingSpinner } from "../../components/common/LoadingSpinner";

// Mobile port of the web app's Telephony page (ainew/src/pages/Telephony.jsx).
// Focused on what an agent needs on the go: call history + filters, click-to-
// call, saving call outcomes (with follow-up task), and creating a lead from
// an unknown inbound call. Provider configuration, agent phone mappings and
// webhook diagnostics stay on the web CRM — they're one-time admin setup.

// ─── Constants (mirrors web) ──────────────────────────────────────────────────

const STATUS_OPTIONS = [
  "ALL", "REQUESTED", "QUEUED", "RINGING", "ANSWERED",
  "COMPLETED", "MISSED", "FAILED", "BUSY", "NO_ANSWER",
];

const DISPOSITION_OPTIONS = [
  { value: "INTERESTED",     label: "Interested" },
  { value: "NOT_INTERESTED", label: "Not Interested" },
  { value: "CALL_BACK_LATER", label: "Call Back Later" },
  { value: "WRONG_NUMBER",   label: "Wrong Number" },
  { value: "CONVERTED",      label: "Converted" },
  { value: "NOT_REACHABLE",  label: "Not Reachable" },
];

const CALL_NOTE_CHIPS = [
  "Interested", "Asked for pricing", "Wants callback", "Wrong number", "Not reachable",
];

interface CallLog {
  id: number;
  provider?: string;
  status?: string;
  direction?: string;
  customerNumber?: string;
  toNumber?: string;
  agentNumber?: string;
  fromNumber?: string;
  contactId?: number | null;
  userId?: number | null;
  durationSeconds?: number | null;
  recordingUrl?: string | null;
  recordingStatus?: string | null;
  disposition?: string | null;
  notes?: string | null;
  followUpTaskId?: number | null;
  nextActionHint?: string | null;
  failureReason?: string | null;
  createdAt?: string;
  opportunityId?: number | null;
  transcriptText?: string | null;
  transcriptStatus?: string | null;
  transcriptError?: string | null;
  transcriptProvider?: string | null;
  transcriptModel?: string | null;
}

interface CrmUser {
  id: number | string;
  name?: string;
  email?: string;
  role?: string;
}

interface AgentMapping {
  id?: number;
  userId: number | string;
  userEmail?: string;
  userRole?: string;
  phoneNumber?: string;
  active?: boolean;
}

interface TelephonyConfig {
  provider: string;
  active: boolean;
  clickToCallEnabled: boolean;
  accountSid: string;
  apiKey: string;
  apiBaseUrl: string;
  apiToken: string;
  callerId: string;
  inboundNumber: string;
  inboundWebhookUrl: string;
  webhookSecret: string;
  region: string;
  notes: string;
}

const DEFAULT_CONFIG: TelephonyConfig = {
  provider: "EXOTEL",
  active: false,
  clickToCallEnabled: false,
  accountSid: "",
  apiKey: "",
  apiBaseUrl: "",
  apiToken: "",
  callerId: "",
  inboundNumber: "",
  inboundWebhookUrl: "",
  webhookSecret: "",
  region: "IN",
  notes: "",
};

// Provider-specific labels/hints — mirrors the web's providerOptions so the
// form speaks each provider's language (Exotel "ExoPhone", Twilio "Auth
// Token", Plivo "Auth ID", …).
const PROVIDER_OPTIONS = [
  {
    value: "EXOTEL",
    label: "Exotel",
    hint: "Best first choice for India calling.",
    accountLabel: "Account SID",
    apiKeyLabel: "API Key",
    tokenLabel: "API Token",
    callerLabel: "Caller ID / ExoPhone",
    inboundLabel: "Inbound ExoPhone",
    basePlaceholder: "https://api.exotel.com",
    baseHelp: "Leave blank to use https://api.exotel.com. If Exotel gives a region-specific URL, paste it here.",
    webhookTitle: "Inbound call webhook for Exotel",
    webhookHelp: "Add this URL inside the customer's Exotel incoming call Landing Flow.",
  },
  {
    value: "TWILIO",
    label: "Twilio",
    hint: "Good for Canada and international calling.",
    accountLabel: "Account SID",
    apiKeyLabel: "API Key (optional)",
    tokenLabel: "Auth Token",
    callerLabel: "Twilio Phone Number",
    inboundLabel: "Inbound Twilio Number",
    basePlaceholder: "https://api.twilio.com",
    baseHelp: "Leave blank to use https://api.twilio.com. Twilio click-to-call calls the agent first, then bridges the customer.",
    webhookTitle: "Twilio Voice URL and status callback",
    webhookHelp: "Use the Voice URL for 'A call comes in'. Use the Status Callback URL for completed call updates, recordings, and call history.",
  },
  {
    value: "PLIVO",
    label: "Plivo",
    hint: "Flexible provider for India, Canada, and international calling.",
    accountLabel: "Auth ID",
    apiKeyLabel: "Auth ID / API Key",
    tokenLabel: "Auth Token",
    callerLabel: "Plivo Phone Number",
    inboundLabel: "Inbound Plivo Number",
    basePlaceholder: "https://api.plivo.com",
    baseHelp: "Leave blank to use https://api.plivo.com. Plivo click-to-call calls the agent first, then bridges the customer.",
    webhookTitle: "Inbound call webhook for Plivo",
    webhookHelp: "Use this URL in Plivo application answer/callback settings for inbound and completed call updates.",
  },
];

function defaultRegionForProvider(provider: string): string {
  if (provider === "TWILIO") return "CA";
  if (provider === "EXOTEL") return "IN";
  return "";
}

// The backend's inboundWebhookUrl ends in /webhook/{tenantId}/{provider}.
// Rewrite the provider segment so the shown URL always matches the selected
// provider, and derive the Voice URL (Twilio/Plivo) from the webhook path.
function providerWebhookUrl(baseUrl: string, provider: string): string {
  if (!baseUrl) return "";
  return baseUrl.replace(/\/webhook\/(\d+)\/[^/?#]+/i, `/webhook/$1/${String(provider || "exotel").toLowerCase()}`);
}

function providerVoiceUrl(baseUrl: string, provider: string): string {
  if (!baseUrl) return "";
  return providerWebhookUrl(baseUrl, provider).replace(/\/webhook\//i, "/voice/");
}

// Blank credentials for a provider switch, so Exotel/Twilio/Plivo data never
// mix (same rule as web's emptyProviderFields).
function emptyProviderFields(provider: string) {
  return {
    provider,
    active: false,
    clickToCallEnabled: false,
    accountSid: "",
    apiKey: "",
    apiBaseUrl: "",
    apiToken: "",
    callerId: "",
    inboundNumber: "",
    webhookSecret: "",
    region: defaultRegionForProvider(provider),
    notes: "",
  };
}

interface CallReport {
  totalCalls?: number;
  answeredCalls?: number;
  missedCalls?: number;
  failedCalls?: number;
  inboundCalls?: number;
  outboundCalls?: number;
  averageDurationSeconds?: number;
  recordingAvailable?: number;
  recordingMissing?: number;
  callMinutesUsedThisMonth?: number;
  callMinutesLimit?: number | null;
  followUpTasksCreated?: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function apiErrorMessage(error: any, fallback: string): string {
  const data = error?.response?.data;
  if (typeof data === "string") return data;
  return data?.message || data?.error || error?.message || fallback;
}

function formatDateTime(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function dispositionLabel(value?: string | null): string {
  return DISPOSITION_OPTIONS.find((o) => o.value === value)?.label || "No outcome";
}

// Status → badge colors (mirrors web's statusClass)
function statusColors(status?: string): { bg: string; text: string } {
  const s = String(status || "").toUpperCase();
  if (["COMPLETED", "ANSWERED"].includes(s)) return { bg: "#ecfdf5", text: "#047857" };
  if (["FAILED", "MISSED", "BUSY", "NO_ANSWER"].includes(s)) return { bg: "#fef2f2", text: "#b91c1c" };
  if (["QUEUED", "RINGING", "REQUESTED"].includes(s)) return { bg: "#fffbeb", text: "#b45309" };
  return { bg: "#f9fafb", text: "#374151" };
}

function recordingBadge(call: CallLog): { label: string; bg: string; text: string } {
  const status = String(call.recordingStatus || (call.recordingUrl ? "AVAILABLE" : "PENDING")).toUpperCase();
  if (status === "AVAILABLE") return { label: "Recording", bg: "#ecfdf5", text: "#047857" };
  if (status === "UNAVAILABLE") return { label: "No recording", bg: "#fef2f2", text: "#b91c1c" };
  return { label: "Rec. pending", bg: "#fffbeb", text: "#b45309" };
}

function outcomeGuidance(disposition: string): { title: string; body: string; bg: string; text: string } {
  switch (disposition) {
    case "INTERESTED":
      return {
        title: "Recommended next step",
        body: "Save this outcome, then open the linked opportunity to schedule a site visit, demo, or test ride.",
        bg: "#ecfdf5", text: "#065f46",
      };
    case "CALL_BACK_LATER":
      return {
        title: "Create a callback task",
        body: "Pick a follow-up date and time. CRM will create a task for the contact owner so this call is not missed.",
        bg: "#eff6ff", text: "#1e40af",
      };
    case "CONVERTED":
      return {
        title: "Converted from call",
        body: "Save this outcome, then update the opportunity stage/revenue from Pipeline.",
        bg: "#f0fdfa", text: "#115e59",
      };
    case "NOT_INTERESTED":
    case "WRONG_NUMBER":
    case "NOT_REACHABLE":
      return {
        title: "Low intent outcome",
        body: "Save the reason clearly in notes. Automation Rules can pause campaigns or mark these leads cold.",
        bg: "#fffbeb", text: "#92400e",
      };
    default:
      return {
        title: "Call outcome",
        body: "Capture what happened and choose a next action if follow-up is needed.",
        bg: "#f9fafb", text: "#374151",
      };
  }
}

// ─── Small UI pieces ──────────────────────────────────────────────────────────

function Badge({ label, bg, text }: { label: string; bg: string; text: string }) {
  return (
    <View style={[s.badge, { backgroundColor: bg }]}>
      <Text style={[s.badgeText, { color: text }]}>{label}</Text>
    </View>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <Text style={s.fieldLabel}>{children}</Text>;
}

// Collapsible "dropdown" section — tap the header to show/hide its content.
function Section({
  title, icon, subtitle, open, onToggle, children,
}: {
  title: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  subtitle?: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <View style={s.section}>
      <TouchableOpacity style={s.sectionHeader} onPress={onToggle} activeOpacity={0.7}>
        <View style={s.sectionIconWrap}>
          <Ionicons name={icon} size={17} color="#0f766e" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.sectionTitle}>{title}</Text>
          {!!subtitle && <Text style={s.sectionSubtitle}>{subtitle}</Text>}
        </View>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={18} color="#9ca3af" />
      </TouchableOpacity>
      {open && <View style={s.sectionBody}>{children}</View>}
    </View>
  );
}

// ─── Per-call AI panel: summary + transcript (mirrors web's
// AiCallSummaryButton and CallTranscriptButton) ───────────────────────────────

function CallAiPanel({
  call, onInfo, onRefresh,
}: {
  call: CallLog;
  onInfo: (msg: string) => void;
  onRefresh: () => void;
}) {
  const [summary, setSummary] = useState("");
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [error, setError] = useState("");

  const transcriptStatus =
    call.transcriptStatus || (call.transcriptText ? "COMPLETED" : "NOT_REQUESTED");

  async function generateSummary() {
    if (summaryLoading) return;
    setSummaryLoading(true);
    setError("");
    try {
      const res = await api.post(`/api/ai/calls/${call.id}/summary`);
      setSummary(res.data?.text || "No AI call summary returned.");
    } catch (err: any) {
      setError(apiErrorMessage(err, "AI call summary failed."));
    } finally {
      setSummaryLoading(false);
    }
  }

  async function saveSummaryAsNote() {
    if (!call.contactId || !summary.trim() || savingNote) return;
    setSavingNote(true);
    setError("");
    try {
      await api.post(`/api/contacts/${call.contactId}/notes`, {
        note: `AI call summary:\n\n${summary.trim()}`,
        opportunityId: call.opportunityId || null,
      });
      onInfo("AI call summary saved as a CRM note.");
    } catch (err: any) {
      setError(apiErrorMessage(err, "Could not save AI summary as note."));
    } finally {
      setSavingNote(false);
    }
  }

  async function generateTranscript() {
    if (transcribing) return;
    if (!call.recordingUrl) {
      setError("Recording is not available yet. Wait for the provider recording callback first.");
      return;
    }
    setTranscribing(true);
    setError("");
    try {
      await api.post(`/api/ai/calls/${call.id}/transcript`);
      onInfo("Call transcript generated.");
      onRefresh();
    } catch (err: any) {
      setError(apiErrorMessage(err, "Call transcription failed."));
    } finally {
      setTranscribing(false);
    }
  }

  return (
    <View style={s.aiPanel}>
      <View style={s.aiBtnRow}>
        <TouchableOpacity
          style={[s.aiBtn, s.aiBtnSummary, summaryLoading && { opacity: 0.6 }]}
          onPress={generateSummary}
          disabled={summaryLoading}
          activeOpacity={0.8}
        >
          {summaryLoading ? (
            <ActivityIndicator size="small" color="#7c3aed" />
          ) : (
            <Ionicons name="sparkles-outline" size={13} color="#7c3aed" />
          )}
          <Text style={s.aiBtnSummaryText}>{summaryLoading ? "Thinking…" : "AI summary"}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[s.aiBtn, s.aiBtnTranscript, transcribing && { opacity: 0.6 }]}
          onPress={generateTranscript}
          disabled={transcribing}
          activeOpacity={0.8}
        >
          {transcribing ? (
            <ActivityIndicator size="small" color="#0369a1" />
          ) : (
            <Ionicons name="document-text-outline" size={13} color="#0369a1" />
          )}
          <Text style={s.aiBtnTranscriptText}>
            {call.transcriptText ? "Regenerate transcript" : transcribing ? "Transcribing…" : "Transcript"}
          </Text>
        </TouchableOpacity>

        <Badge
          label={String(transcriptStatus).replaceAll("_", " ")}
          bg="#f3f4f6"
          text="#4b5563"
        />
      </View>

      {(call.transcriptProvider || call.transcriptModel) && (
        <Text style={s.aiMetaText}>
          Generated with {[call.transcriptProvider, call.transcriptModel].filter(Boolean).join(" · ")}
        </Text>
      )}

      {!!error && (
        <View style={s.aiResultBox}>
          <Text style={s.aiErrorText}>{error}</Text>
        </View>
      )}

      {!!summary && (
        <View style={s.aiResultBox}>
          <Text style={s.aiResultText}>{summary}</Text>
          {!!call.contactId && (
            <TouchableOpacity
              style={[s.aiSaveNoteBtn, savingNote && { opacity: 0.6 }]}
              onPress={saveSummaryAsNote}
              disabled={savingNote}
            >
              <Text style={s.aiSaveNoteText}>{savingNote ? "Saving…" : "Save as note"}</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {!!call.transcriptText && (
        <>
          <TouchableOpacity onPress={() => setTranscriptOpen((v) => !v)}>
            <Text style={s.aiToggleText}>
              {transcriptOpen ? "Hide transcript" : "View transcript"}
            </Text>
          </TouchableOpacity>
          {transcriptOpen && (
            <View style={s.aiResultBox}>
              <ScrollView style={{ maxHeight: 220 }} nestedScrollEnabled>
                <Text style={s.aiResultText}>{call.transcriptText}</Text>
              </ScrollView>
            </View>
          )}
        </>
      )}
      {!!call.transcriptError && (
        <View style={s.aiResultBox}>
          <Text style={s.aiErrorText}>{call.transcriptError}</Text>
        </View>
      )}
    </View>
  );
}

// ─── Telephony settings form (mirrors web Telephony Settings card) ────────────

function SettingsForm({ onInfo }: { onInfo: (msg: string) => void }) {
  const { user } = useAuth();
  const isPrivileged = ["ADMIN", "OWNER"].includes(String(user?.role || "").toUpperCase());
  const [config, setConfig] = useState<TelephonyConfig>(DEFAULT_CONFIG);
  const [hasToken, setHasToken] = useState(false);
  const [hasWebhookSecret, setHasWebhookSecret] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  // Agent-only, on-device CRM-calling preference (the tenant config is
  // admin-only, so agents control their own routing locally).
  const [crmCallingOn, setCrmCallingOn] = useState(true);

  const activeProvider =
    PROVIDER_OPTIONS.find((p) => p.value === config.provider) || PROVIDER_OPTIONS[0];

  useEffect(() => { getAgentCrmCallingPref().then(setCrmCallingOn); }, []);

  useEffect(() => {
    // Loading the tenant config is admin-only — skip it for agents so their
    // view (just the CRM-calling toggle) never hits a 403.
    if (!isPrivileged) { setLoading(false); return; }
    (async () => {
      try {
        const res = await api.get("/api/telephony/config");
        const data = res.data || {};
        setConfig({
          provider: data.provider || "EXOTEL",
          active: Boolean(data.active),
          clickToCallEnabled: Boolean(data.clickToCallEnabled),
          accountSid: data.accountSid || "",
          apiKey: data.apiKey || "",
          apiBaseUrl: data.apiBaseUrl || "",
          apiToken: data.hasApiToken ? "********" : "",
          callerId: data.callerId || "",
          inboundNumber: data.inboundNumber || "",
          inboundWebhookUrl: data.inboundWebhookUrl || "",
          webhookSecret: data.hasWebhookSecret ? "********" : "",
          region: data.region || "IN",
          notes: data.notes || "",
        });
        setHasToken(Boolean(data.hasApiToken));
        setHasWebhookSecret(Boolean(data.hasWebhookSecret));
      } catch (err: any) {
        setError(apiErrorMessage(err, "Failed to load telephony settings."));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function update(field: keyof TelephonyConfig, value: string | boolean) {
    setConfig((cur) => {
      // Only one provider can be active at a time (web parity): switching is
      // locked while the current provider is active, and switching to a new
      // provider starts with blank credentials so provider data never mixes.
      if (field === "provider" && typeof value === "string") {
        if (cur.active && value !== cur.provider) {
          setError(`Deactivate ${cur.provider} before switching to another provider.`);
          return cur;
        }
        if (value === cur.provider) return cur;
        setHasToken(false);
        setHasWebhookSecret(false);
        setError("");
        return {
          ...cur,
          ...emptyProviderFields(value),
          inboundWebhookUrl: cur.inboundWebhookUrl,
        };
      }
      return { ...cur, [field]: value };
    });
  }

  async function save() {
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      // Same masking rule as web: a still-masked secret means "keep existing".
      const { inboundWebhookUrl, ...editable } = config;
      await api.post("/api/telephony/config", {
        ...editable,
        apiToken: config.apiToken === "********" ? null : config.apiToken,
        webhookSecret: config.webhookSecret === "********" ? null : config.webhookSecret,
      });
      // Call buttons across the app re-read the toggles on next call.
      invalidateTelephonyToggles();
      onInfo("Telephony settings saved.");
    } catch (err: any) {
      setError(apiErrorMessage(err, "Failed to save telephony settings."));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <ActivityIndicator color="#0f766e" style={{ marginVertical: 16 }} />;

  // Agents get ONLY the enable/disable CRM-calling toggle — no provider,
  // credentials, webhooks, or agent mapping. The toggle saves immediately so
  // it behaves like a simple on/off switch (provider setup stays with admins).
  if (!isPrivileged) {
    const toggleCrmCalling = (v: boolean) => {
      setCrmCallingOn(v);
      setAgentCrmCallingPref(v);
      invalidateTelephonyToggles();
      onInfo(v ? "CRM calling enabled for your calls." : "CRM calling off — your calls use the phone dialer.");
    };
    return (
      <View style={{ gap: 12 }}>
        <View style={s.switchRow}>
          <Text style={s.switchLabel}>Enable CRM calling</Text>
          <Switch
            value={crmCallingOn}
            onValueChange={toggleCrmCalling}
            trackColor={{ true: "#0f766e" }}
          />
        </View>
        <Text style={s.fieldHelp}>
          When on, your calls are placed through the CRM (tracked and recorded). When off, your calls
          open the phone's dialer. Provider setup is managed by your administrator.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ gap: 12 }}>
      {!!error && (
        <View style={s.errorBox}><Text style={s.errorBoxText}>{error}</Text></View>
      )}

      <View style={s.statusRow}>
        <Badge
          label={config.active ? "Active" : "Not active"}
          bg={config.active ? "#ecfdf5" : "#f3f4f6"}
          text={config.active ? "#047857" : "#6b7280"}
        />
        <Text style={s.providerHint}>{activeProvider.hint}</Text>
      </View>

      <FieldLabel>Provider</FieldLabel>
      <View style={s.chipWrap}>
        {PROVIDER_OPTIONS.map((p) => {
          const selected = config.provider === p.value;
          const locked = config.active && !selected;
          return (
            <TouchableOpacity
              key={p.value}
              style={[s.chip, selected && s.chipActive, locked && { opacity: 0.45 }]}
              onPress={() => update("provider", p.value)}
              disabled={locked}
            >
              <Text style={[s.chipText, selected && s.chipTextActive]}>
                {p.label}{locked ? " 🔒" : ""}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <Text style={s.providerLockHint}>
        {config.active
          ? `${activeProvider.label} is active — deactivate it before switching provider.`
          : "Only one provider can be active at a time. Switching starts with blank credentials so provider data never mixes."}
      </Text>

      <View style={s.field}>
        <FieldLabel>Region</FieldLabel>
        <TextInput style={s.input} value={config.region} onChangeText={(v) => update("region", v)} placeholder="IN, CA, US" placeholderTextColor="#9ca3af" autoCapitalize="characters" />
      </View>
      <View style={s.field}>
        <FieldLabel>{activeProvider.accountLabel}</FieldLabel>
        <TextInput style={s.input} value={config.accountSid} onChangeText={(v) => update("accountSid", v)} placeholder="Provider account identifier" placeholderTextColor="#9ca3af" autoCapitalize="none" />
      </View>
      <View style={s.field}>
        <FieldLabel>{activeProvider.apiKeyLabel}</FieldLabel>
        <TextInput style={s.input} value={config.apiKey} onChangeText={(v) => update("apiKey", v)} placeholder="Provider API key" placeholderTextColor="#9ca3af" autoCapitalize="none" />
      </View>
      <View style={s.field}>
        <FieldLabel>API Base URL</FieldLabel>
        <TextInput style={s.input} value={config.apiBaseUrl} onChangeText={(v) => update("apiBaseUrl", v)} placeholder={activeProvider.basePlaceholder} placeholderTextColor="#9ca3af" autoCapitalize="none" keyboardType="url" />
        <Text style={s.fieldHelp}>{activeProvider.baseHelp}</Text>
      </View>
      <View style={s.field}>
        <FieldLabel>{activeProvider.tokenLabel}</FieldLabel>
        <TextInput style={s.input} value={config.apiToken} onChangeText={(v) => update("apiToken", v)} placeholder={hasToken ? "Saved token hidden" : "Provider token"} placeholderTextColor="#9ca3af" secureTextEntry autoCapitalize="none" />
      </View>
      <View style={s.field}>
        <FieldLabel>Webhook Secret</FieldLabel>
        <TextInput style={s.input} value={config.webhookSecret} onChangeText={(v) => update("webhookSecret", v)} placeholder={hasWebhookSecret ? "Saved secret hidden" : "Optional callback verification secret"} placeholderTextColor="#9ca3af" secureTextEntry autoCapitalize="none" />
      </View>
      <View style={s.field}>
        <FieldLabel>{activeProvider.callerLabel}</FieldLabel>
        <TextInput style={s.input} value={config.callerId} onChangeText={(v) => update("callerId", v)} placeholder="+91…" placeholderTextColor="#9ca3af" keyboardType="phone-pad" />
      </View>
      <View style={s.field}>
        <FieldLabel>{activeProvider.inboundLabel}</FieldLabel>
        <TextInput style={s.input} value={config.inboundNumber} onChangeText={(v) => update("inboundNumber", v)} placeholder="+91…" placeholderTextColor="#9ca3af" keyboardType="phone-pad" />
      </View>

      <View style={s.switchRow}>
        <Text style={s.switchLabel}>Provider active</Text>
        <Switch value={config.active} onValueChange={(v) => update("active", v)} trackColor={{ true: "#0f766e" }} />
      </View>
      <View style={s.switchRow}>
        <Text style={s.switchLabel}>Enable click-to-call</Text>
        <Switch value={config.clickToCallEnabled} onValueChange={(v) => update("clickToCallEnabled", v)} trackColor={{ true: "#0f766e" }} />
      </View>

      <View style={s.field}>
        <FieldLabel>Internal notes</FieldLabel>
        <TextInput style={[s.input, s.inputMultiline]} value={config.notes} onChangeText={(v) => update("notes", v)} placeholder="Example: Exotel number, support contact, provider account owner." placeholderTextColor="#9ca3af" multiline textAlignVertical="top" />
      </View>

      {!!config.inboundWebhookUrl && (() => {
        const webhookUrl = providerWebhookUrl(config.inboundWebhookUrl, config.provider);
        const voiceUrl = providerVoiceUrl(config.inboundWebhookUrl, config.provider);
        const needsVoiceUrl = config.provider === "TWILIO" || config.provider === "PLIVO";
        return (
          <View style={s.webhookBox}>
            <Text style={s.webhookLabel}>{activeProvider.webhookTitle}</Text>
            <Text style={s.webhookHelp}>{activeProvider.webhookHelp}</Text>

            {needsVoiceUrl && (
              <>
                <Text style={s.webhookSubLabel}>Voice URL — for "A call comes in" (returns TwiML)</Text>
                <Text style={s.webhookUrl} selectable>{voiceUrl}</Text>
              </>
            )}

            <Text style={s.webhookSubLabel}>
              {needsVoiceUrl ? "Status Callback URL — call status, completed calls, recordings" : "Base webhook URL"}
            </Text>
            <Text style={s.webhookUrl} selectable>{webhookUrl}</Text>

            <Text style={s.webhookSubLabel}>Missed / No Answer branch</Text>
            <Text style={s.webhookUrl} selectable>{`${webhookUrl}?Status=NO_ANSWER`}</Text>

            <Text style={s.webhookSubLabel}>Answered / Completed branch</Text>
            <Text style={s.webhookUrl} selectable>{`${webhookUrl}?Status=COMPLETED`}</Text>

            <Text style={s.webhookHelp}>
              Long-press any URL to copy. Incoming calls appear in Call Logs, unknown numbers become
              phone leads, and missed calls create follow-up tasks automatically.
            </Text>
          </View>
        );
      })()}

      <TouchableOpacity style={[s.primaryBtn, saving && { opacity: 0.6 }]} onPress={save} disabled={saving} activeOpacity={0.85}>
        {saving ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <>
            <Ionicons name="save-outline" size={16} color="#fff" />
            <Text style={s.primaryBtnText}>Save telephony settings</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
}

// ─── Agent phone mapping (mirrors web Agent Phone Mapping card) ───────────────

function AgentMappingForm({ onInfo }: { onInfo: (msg: string) => void }) {
  const [users, setUsers] = useState<CrmUser[]>([]);
  const [mappings, setMappings] = useState<AgentMapping[]>([]);
  const [userId, setUserId] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [active, setActive] = useState(true);
  const [userPickerOpen, setUserPickerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const [usersRes, mappingsRes] = await Promise.all([
        api.get("/api/users"),
        api.get("/api/telephony/agent-mappings"),
      ]);
      const u = usersRes.data;
      setUsers(Array.isArray(u) ? u : u?.items ?? u?.content ?? []);
      const m = mappingsRes.data;
      setMappings(Array.isArray(m) ? m : m?.items ?? m?.content ?? []);
    } catch (err: any) {
      setError(apiErrorMessage(err, "Failed to load agent phone mappings."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const selectedUser = users.find((u) => String(u.id) === userId);

  function pickUser(u: CrmUser) {
    const existing = mappings.find((m) => String(m.userId) === String(u.id));
    setUserId(String(u.id));
    setPhoneNumber(existing?.phoneNumber || "");
    setActive(existing?.active !== false);
    setUserPickerOpen(false);
  }

  async function save() {
    if (!userId || !phoneNumber.trim()) {
      setError("Select an agent and enter a phone number before saving.");
      return;
    }
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      await api.post("/api/telephony/agent-mappings", {
        userId: Number(userId),
        phoneNumber: phoneNumber.trim(),
        active,
      });
      onInfo("Agent phone mapping saved.");
      setUserId("");
      setPhoneNumber("");
      setActive(true);
      await load();
    } catch (err: any) {
      setError(apiErrorMessage(err, "Failed to save agent phone mapping."));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <ActivityIndicator color="#0f766e" style={{ marginVertical: 16 }} />;

  return (
    <View style={{ gap: 12 }}>
      <Text style={s.sheetHint}>
        Map each CRM user to their calling number once. Contact, Opportunity and Chat call buttons use it automatically.
      </Text>
      {!!error && (
        <View style={s.errorBox}><Text style={s.errorBoxText}>{error}</Text></View>
      )}

      <View style={s.field}>
        <FieldLabel>User / Agent</FieldLabel>
        <TouchableOpacity style={s.selectBox} onPress={() => setUserPickerOpen(true)} activeOpacity={0.7}>
          <Text style={[s.selectText, !selectedUser && { color: "#9ca3af" }]}>
            {selectedUser ? (selectedUser.email || selectedUser.name || `User #${selectedUser.id}`) : "Select user"}
          </Text>
          <Ionicons name="chevron-down" size={16} color="#9ca3af" />
        </TouchableOpacity>
      </View>

      <View style={s.field}>
        <FieldLabel>Calling number</FieldLabel>
        <TextInput style={s.input} value={phoneNumber} onChangeText={setPhoneNumber} placeholder="+91…" placeholderTextColor="#9ca3af" keyboardType="phone-pad" />
      </View>

      <View style={s.switchRow}>
        <Text style={s.switchLabel}>Active</Text>
        <Switch value={active} onValueChange={setActive} trackColor={{ true: "#0f766e" }} />
      </View>

      <TouchableOpacity style={[s.primaryBtn, saving && { opacity: 0.6 }]} onPress={save} disabled={saving} activeOpacity={0.85}>
        {saving ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <>
            <Ionicons name="save-outline" size={16} color="#fff" />
            <Text style={s.primaryBtnText}>Save mapping</Text>
          </>
        )}
      </TouchableOpacity>

      {mappings.length === 0 ? (
        <Text style={s.emptyMappingText}>No agent numbers mapped yet.</Text>
      ) : (
        <View style={{ gap: 8 }}>
          {mappings.map((m) => (
            <TouchableOpacity
              key={String(m.id ?? m.userId)}
              style={s.mappingCard}
              onPress={() => {
                setUserId(String(m.userId));
                setPhoneNumber(m.phoneNumber || "");
                setActive(m.active !== false);
              }}
              activeOpacity={0.7}
            >
              <View style={{ flex: 1 }}>
                <Text style={s.mappingEmail} numberOfLines={1}>
                  {m.userEmail || `User #${m.userId}`}
                </Text>
                <Text style={s.mappingPhone}>{m.phoneNumber}</Text>
              </View>
              <Badge
                label={m.active === false ? "Inactive" : "Active"}
                bg={m.active === false ? "#f3f4f6" : "#ecfdf5"}
                text={m.active === false ? "#6b7280" : "#047857"}
              />
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* User picker sheet */}
      <Modal visible={userPickerOpen} transparent animationType="fade" onRequestClose={() => setUserPickerOpen(false)}>
        <TouchableOpacity style={s.pickerOverlay} activeOpacity={1} onPress={() => setUserPickerOpen(false)}>
          <View style={s.pickerSheet}>
            <Text style={s.pickerTitle}>Select user</Text>
            <ScrollView style={{ maxHeight: 380 }}>
              {users.map((u) => (
                <TouchableOpacity key={String(u.id)} style={s.pickerItem} onPress={() => pickUser(u)}>
                  <Text style={s.pickerItemText} numberOfLines={1}>
                    {u.email || u.name || `User #${u.id}`}
                    {u.role ? `  (${u.role})` : ""}
                  </Text>
                  {String(u.id) === userId && <Ionicons name="checkmark" size={18} color="#0f766e" />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

// ─── Click-to-call sheet ──────────────────────────────────────────────────────

function NewCallSheet({
  visible, onClose, onDone,
}: {
  visible: boolean;
  onClose: () => void;
  onDone: (msg: string) => void;
}) {
  const [contactId, setContactId] = useState("");
  const [customerNumber, setCustomerNumber] = useState("");
  const [agentNumber, setAgentNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [calling, setCalling] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (visible) { setError(""); setNotes(""); }
  }, [visible]);

  async function startCall() {
    if (calling) return;
    if (!contactId.trim() && !customerNumber.trim()) {
      setError("Enter a contact ID or a customer number.");
      return;
    }
    setCalling(true);
    setError("");
    try {
      // Respect the telephony toggle: CRM click-to-call only when the
      // provider is active AND click-to-call is enabled; otherwise use the
      // phone's native dialer.
      const toggles = await getTelephonyToggles();
      if (!isCrmCallingOn(toggles)) {
        const number = customerNumber.trim();
        if (!number) {
          setError(
            "CRM calling is off (enable the provider + click-to-call in Telephony Settings). To dial from the phone, enter the customer number."
          );
          return;
        }
        await Linking.openURL(`tel:${number}`);
        onDone("CRM calling is off — dialed from the phone instead.");
        setContactId(""); setCustomerNumber(""); setAgentNumber(""); setNotes("");
        onClose();
        return;
      }

      const res = await api.post("/api/telephony/calls/click-to-call", {
        contactId: contactId.trim() ? Number(contactId.trim()) : null,
        customerNumber: customerNumber.trim() || null,
        agentNumber: agentNumber.trim() || null,
        notes: notes.trim() || null,
      });
      const result = res.data || {};
      if (String(result.status || "").toUpperCase() === "FAILED") {
        setError(result.failureReason || "Call could not be started.");
      } else {
        onDone(`Call logged as ${result.status || "REQUESTED"}.`);
        setContactId(""); setCustomerNumber(""); setAgentNumber(""); setNotes("");
        onClose();
      }
    } catch (err: any) {
      setError(apiErrorMessage(err, "Failed to start call."));
    } finally {
      setCalling(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: "#f8f9fb" }}>
        <View style={s.sheetHeader}>
          <Text style={s.sheetTitle}>New Call</Text>
          <TouchableOpacity onPress={onClose} style={s.sheetClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close" size={22} color="#6b7280" />
          </TouchableOpacity>
        </View>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScrollView contentContainerStyle={s.sheetBody} keyboardShouldPersistTaps="handled">
            <Text style={s.sheetHint}>
              Use a contact ID or a direct customer number. Leave agent number blank to use your mapped calling number.
            </Text>
            {!!error && (
              <View style={s.errorBox}><Text style={s.errorBoxText}>{error}</Text></View>
            )}
            <View style={s.field}>
              <FieldLabel>Contact ID (optional)</FieldLabel>
              <TextInput
                style={s.input}
                value={contactId}
                onChangeText={setContactId}
                keyboardType="numeric"
                placeholder="e.g. 1024"
                placeholderTextColor="#9ca3af"
              />
            </View>
            <View style={s.field}>
              <FieldLabel>Customer number to connect after agent answers</FieldLabel>
              <TextInput
                style={s.input}
                value={customerNumber}
                onChangeText={setCustomerNumber}
                keyboardType="phone-pad"
                placeholder="+91 customer number"
                placeholderTextColor="#9ca3af"
              />
            </View>
            <View style={s.field}>
              <FieldLabel>Agent number that rings first (optional)</FieldLabel>
              <TextInput
                style={s.input}
                value={agentNumber}
                onChangeText={setAgentNumber}
                keyboardType="phone-pad"
                placeholder="Uses your mapping if blank"
                placeholderTextColor="#9ca3af"
              />
              <Text style={s.fieldHelp}>
                Do not enter the customer number here — this should be your agent phone. The provider
                rings the agent first, then bridges the customer.
              </Text>
            </View>
            <View style={s.field}>
              <FieldLabel>Notes</FieldLabel>
              <TextInput
                style={[s.input, s.inputMultiline]}
                value={notes}
                onChangeText={setNotes}
                placeholder="Purpose of call"
                placeholderTextColor="#9ca3af"
                multiline
                textAlignVertical="top"
              />
            </View>
          </ScrollView>
          <View style={s.sheetFooter}>
            <TouchableOpacity
              style={[s.primaryBtn, calling && { opacity: 0.6 }]}
              onPress={startCall}
              disabled={calling}
              activeOpacity={0.85}
            >
              {calling ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Ionicons name="call" size={17} color="#fff" />
                  <Text style={s.primaryBtnText}>Start tracked call</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

// ─── Outcome (disposition) sheet ──────────────────────────────────────────────

function OutcomeSheet({
  call, onClose, onDone,
}: {
  call: CallLog | null;
  onClose: () => void;
  onDone: (msg: string) => void;
}) {
  const [disposition, setDisposition] = useState("INTERESTED");
  const [notes, setNotes] = useState("");
  const [followUpAt, setFollowUpAt] = useState("");
  const [followUpTitle, setFollowUpTitle] = useState("Call back lead");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (call) {
      setDisposition(call.disposition || "INTERESTED");
      setNotes(call.notes || "");
      setFollowUpAt("");
      setFollowUpTitle("Call back lead");
      setError("");
    }
  }, [call]);

  function addNoteChip(chip: string) {
    setNotes((cur) => [cur, chip].filter(Boolean).join(cur ? "\n" : ""));
  }

  async function save() {
    if (!call || saving) return;
    setSaving(true);
    setError("");
    try {
      let followUpIso: string | null = null;
      if (disposition === "CALL_BACK_LATER" && followUpAt.trim()) {
        const parsed = new Date(followUpAt.trim().replace(" ", "T"));
        if (Number.isNaN(parsed.getTime())) {
          setError("Follow-up must look like 2026-07-15 14:30");
          setSaving(false);
          return;
        }
        followUpIso = parsed.toISOString();
      }
      await api.post(`/api/telephony/calls/${call.id}/disposition`, {
        disposition,
        notes: notes.trim() || null,
        followUpAt: followUpIso,
        followUpTitle: followUpTitle.trim() || "Call back lead",
      });
      onDone(`Call outcome saved as ${dispositionLabel(disposition)}.`);
      onClose();
    } catch (err: any) {
      setError(apiErrorMessage(err, "Failed to save call outcome."));
    } finally {
      setSaving(false);
    }
  }

  const guidance = outcomeGuidance(disposition);

  return (
    <Modal visible={!!call} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: "#f8f9fb" }}>
        <View style={s.sheetHeader}>
          <Text style={s.sheetTitle}>Call Outcome</Text>
          <TouchableOpacity onPress={onClose} style={s.sheetClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close" size={22} color="#6b7280" />
          </TouchableOpacity>
        </View>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScrollView contentContainerStyle={s.sheetBody} keyboardShouldPersistTaps="handled">
            {!!error && (
              <View style={s.errorBox}><Text style={s.errorBoxText}>{error}</Text></View>
            )}

            <FieldLabel>Outcome</FieldLabel>
            <View style={s.chipWrap}>
              {DISPOSITION_OPTIONS.map((o) => {
                const active = disposition === o.value;
                return (
                  <TouchableOpacity
                    key={o.value}
                    style={[s.chip, active && s.chipActive]}
                    onPress={() => setDisposition(o.value)}
                  >
                    <Text style={[s.chipText, active && s.chipTextActive]}>{o.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={[s.guidanceBox, { backgroundColor: guidance.bg }]}>
              <Text style={[s.guidanceTitle, { color: guidance.text }]}>{guidance.title}</Text>
              <Text style={[s.guidanceBody, { color: guidance.text }]}>{guidance.body}</Text>
            </View>

            <FieldLabel>Quick notes</FieldLabel>
            <View style={s.chipWrap}>
              {CALL_NOTE_CHIPS.map((chip) => (
                <TouchableOpacity key={chip} style={s.chip} onPress={() => addNoteChip(chip)}>
                  <Text style={s.chipText}>+ {chip}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={s.field}>
              <FieldLabel>Call notes</FieldLabel>
              <TextInput
                style={[s.input, s.inputMultiline]}
                value={notes}
                onChangeText={setNotes}
                placeholder="Example: Customer asked for pricing, wants callback tomorrow."
                placeholderTextColor="#9ca3af"
                multiline
                textAlignVertical="top"
              />
            </View>

            {disposition === "CALL_BACK_LATER" && (
              <>
                <View style={s.field}>
                  <FieldLabel>Follow-up date & time (YYYY-MM-DD HH:mm)</FieldLabel>
                  <TextInput
                    style={s.input}
                    value={followUpAt}
                    onChangeText={setFollowUpAt}
                    placeholder="2026-07-15 14:30"
                    placeholderTextColor="#9ca3af"
                    autoCapitalize="none"
                  />
                </View>
                <View style={s.field}>
                  <FieldLabel>Task title</FieldLabel>
                  <TextInput
                    style={s.input}
                    value={followUpTitle}
                    onChangeText={setFollowUpTitle}
                    placeholder="Call back lead"
                    placeholderTextColor="#9ca3af"
                  />
                </View>
              </>
            )}
          </ScrollView>
          <View style={s.sheetFooter}>
            <TouchableOpacity
              style={[s.primaryBtn, saving && { opacity: 0.6 }]}
              onPress={save}
              disabled={saving}
              activeOpacity={0.85}
            >
              {saving ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Ionicons name="checkmark" size={17} color="#fff" />
                  <Text style={s.primaryBtnText}>Save outcome</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

// ─── Create-lead-from-call sheet ──────────────────────────────────────────────

function CreateLeadSheet({
  call, onClose, onDone,
}: {
  call: CallLog | null;
  onClose: () => void;
  onDone: (msg: string) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [city, setCity] = useState("");
  const [tags, setTags] = useState("Phone Call");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (call) {
      const caller = call.customerNumber || call.fromNumber || "";
      setName(`Phone Lead ${caller}`.trim());
      setEmail("");
      setCity("");
      setTags("Phone Call");
      setError("");
    }
  }, [call]);

  async function create() {
    if (!call || creating) return;
    setCreating(true);
    setError("");
    try {
      await api.post("/api/telephony/calls/create-lead", {
        callLogId: call.id,
        name: name.trim() || null,
        email: email.trim() || null,
        city: city.trim() || null,
        tags: tags.trim() || null,
      });
      onDone("Lead created and linked to this call.");
      onClose();
    } catch (err: any) {
      setError(apiErrorMessage(err, "Failed to create lead from call."));
    } finally {
      setCreating(false);
    }
  }

  return (
    <Modal visible={!!call} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: "#f8f9fb" }}>
        <View style={s.sheetHeader}>
          <Text style={s.sheetTitle}>Create Lead from Call</Text>
          <TouchableOpacity onPress={onClose} style={s.sheetClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close" size={22} color="#6b7280" />
          </TouchableOpacity>
        </View>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScrollView contentContainerStyle={s.sheetBody} keyboardShouldPersistTaps="handled">
            <Text style={s.sheetHint}>
              Creates a contact with source Phone Call and links this call's history to it.
            </Text>
            {!!error && (
              <View style={s.errorBox}><Text style={s.errorBoxText}>{error}</Text></View>
            )}
            <View style={s.field}>
              <FieldLabel>Lead name</FieldLabel>
              <TextInput style={s.input} value={name} onChangeText={setName} placeholder="Lead name" placeholderTextColor="#9ca3af" />
            </View>
            <View style={s.field}>
              <FieldLabel>Email (optional)</FieldLabel>
              <TextInput style={s.input} value={email} onChangeText={setEmail} placeholder="name@example.com" placeholderTextColor="#9ca3af" keyboardType="email-address" autoCapitalize="none" />
            </View>
            <View style={s.field}>
              <FieldLabel>City (optional)</FieldLabel>
              <TextInput style={s.input} value={city} onChangeText={setCity} placeholder="Mumbai" placeholderTextColor="#9ca3af" />
            </View>
            <View style={s.field}>
              <FieldLabel>Tags</FieldLabel>
              <TextInput style={s.input} value={tags} onChangeText={setTags} placeholder="Phone Call" placeholderTextColor="#9ca3af" />
            </View>
          </ScrollView>
          <View style={s.sheetFooter}>
            <TouchableOpacity
              style={[s.primaryBtn, creating && { opacity: 0.6 }]}
              onPress={create}
              disabled={creating}
              activeOpacity={0.85}
            >
              {creating ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Ionicons name="person-add" size={16} color="#fff" />
                  <Text style={s.primaryBtnText}>Create lead</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

// ─── Call card ────────────────────────────────────────────────────────────────

function CallCard({
  call, onOutcome, onCreateLead, onInfo, onRefresh,
}: {
  call: CallLog;
  onOutcome: (c: CallLog) => void;
  onCreateLead: (c: CallLog) => void;
  onInfo: (msg: string) => void;
  onRefresh: () => void;
}) {
  const [aiOpen, setAiOpen] = useState(false);
  const sc = statusColors(call.status);
  const rec = recordingBadge(call);
  const direction = String(call.direction || "").toUpperCase();
  const isInbound = direction === "INBOUND";
  const unknownInbound = isInbound && !call.contactId;

  return (
    <View style={s.card}>
      <View style={s.cardTop}>
        <View style={s.cardTopLeft}>
          <Ionicons
            name={isInbound ? "arrow-down-circle" : "arrow-up-circle"}
            size={18}
            color={isInbound ? "#0e7490" : "#0f766e"}
          />
          <Text style={s.cardNumber} numberOfLines={1}>
            {call.customerNumber || call.toNumber || "Unknown number"}
          </Text>
        </View>
        <Badge label={String(call.status || "REQUESTED").replace("_", " ")} bg={sc.bg} text={sc.text} />
      </View>

      <View style={s.metaRow}>
        {!!call.provider && <Text style={s.metaText}>{call.provider}</Text>}
        <Text style={s.metaText}>{call.durationSeconds ? `${call.durationSeconds}s` : "—"}</Text>
        <Text style={s.metaText}>{formatDateTime(call.createdAt)}</Text>
      </View>

      <View style={s.badgeRow}>
        <Badge
          label={dispositionLabel(call.disposition)}
          bg={call.disposition ? "#eef2ff" : "#f9fafb"}
          text={call.disposition ? "#4338ca" : "#6b7280"}
        />
        {call.recordingUrl ? (
          <TouchableOpacity
            style={s.recordingBtn}
            onPress={() => Linking.openURL(call.recordingUrl!)}
            activeOpacity={0.7}
          >
            <Ionicons name="play-circle-outline" size={15} color="#047857" />
            <Text style={s.recordingBtnText}>Play recording</Text>
          </TouchableOpacity>
        ) : (
          <Badge label={rec.label} bg={rec.bg} text={rec.text} />
        )}
        {!!call.contactId && (
          <Badge label={`Contact #${call.contactId}`} bg="#f0fdfa" text="#0f766e" />
        )}
      </View>

      {!!call.failureReason && <Text style={s.failureText}>{call.failureReason}</Text>}
      {!!call.notes && <Text style={s.notesText} numberOfLines={2}>{call.notes}</Text>}
      {!!call.nextActionHint && (
        <View style={s.hintBox}>
          <Ionicons name="bulb-outline" size={13} color="#0369a1" />
          <Text style={s.hintText}>{call.nextActionHint}</Text>
        </View>
      )}
      {unknownInbound && (
        <Text style={s.unknownText}>Unknown inbound caller — create or link a lead</Text>
      )}

      <View style={s.cardActions}>
        {unknownInbound && (
          <TouchableOpacity style={s.leadBtn} onPress={() => onCreateLead(call)} activeOpacity={0.8}>
            <Ionicons name="person-add-outline" size={14} color="#0f766e" />
            <Text style={s.leadBtnText}>Create lead</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={s.outcomeBtn} onPress={() => onOutcome(call)} activeOpacity={0.8}>
          <Ionicons name="create-outline" size={14} color="#374151" />
          <Text style={s.outcomeBtnText}>Outcome</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.outcomeBtn, aiOpen && s.aiToggleBtnActive]}
          onPress={() => setAiOpen((v) => !v)}
          activeOpacity={0.8}
        >
          <Ionicons name="sparkles-outline" size={14} color={aiOpen ? "#7c3aed" : "#374151"} />
          <Text style={[s.outcomeBtnText, aiOpen && { color: "#7c3aed" }]}>AI</Text>
        </TouchableOpacity>
      </View>

      {aiOpen && <CallAiPanel call={call} onInfo={onInfo} onRefresh={onRefresh} />}
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function TelephonyScreen() {
  const { user } = useAuth();
  const isPrivileged = ["ADMIN", "OWNER"].includes(String(user?.role || "").toUpperCase());
  const [calls, setCalls] = useState<CallLog[]>([]);
  const [report, setReport] = useState<CallReport | null>(null);
  const [status, setStatus] = useState("ALL");
  const [disposition, setDisposition] = useState("ALL");
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [newCallOpen, setNewCallOpen] = useState(false);
  const [outcomeCall, setOutcomeCall] = useState<CallLog | null>(null);
  const [leadCall, setLeadCall] = useState<CallLog | null>(null);
  // Dropdown sections — call logs open by default, admin setup collapsed.
  const [logsOpen, setLogsOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mappingOpen, setMappingOpen] = useState(false);

  const loadCalls = useCallback(
    async (p = 0, st = status, disp = disposition) => {
      if (p === 0) setLoading(true);
      else setLoadingMore(true);
      setError("");
      try {
        const res = await api.get("/api/telephony/calls", {
          params: {
            status: st,
            disposition: disp,
            page: p,
            size: 25,
          },
        });
        const items: CallLog[] = res.data?.items || res.data?.content || [];
        setCalls((prev) => (p === 0 ? items : [...prev, ...items]));
        setPage(res.data?.page ?? p);
        setTotalPages(res.data?.totalPages ?? 0);
        setTotalElements(res.data?.totalElements ?? items.length);
      } catch (err: any) {
        setError(apiErrorMessage(err, "Failed to load call logs."));
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [status, disposition]
  );

  const loadReport = useCallback(async () => {
    try {
      const res = await api.get("/api/telephony/report");
      setReport(res.data || null);
    } catch {
      // Report is decorative — don't surface an error over the call list.
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadCalls(0);
      loadReport();
    }, [loadCalls, loadReport])
  );

  function refreshAll() {
    loadCalls(0);
    loadReport();
  }

  function handleDone(msg: string) {
    setInfo(msg);
    refreshAll();
    setTimeout(() => setInfo(""), 4000);
  }

  const reportTiles = useMemo(
    () => [
      { label: "Total", value: report?.totalCalls ?? 0, icon: "call-outline" as const },
      { label: "Answered", value: report?.answeredCalls ?? 0, icon: "checkmark-circle-outline" as const },
      { label: "Missed", value: report?.missedCalls ?? 0, icon: "close-circle-outline" as const },
      { label: "Inbound", value: report?.inboundCalls ?? 0, icon: "arrow-down-outline" as const },
      { label: "Outbound", value: report?.outboundCalls ?? 0, icon: "arrow-up-outline" as const },
      { label: "Avg sec", value: Math.round(report?.averageDurationSeconds || 0), icon: "time-outline" as const },
    ],
    [report]
  );

  if (loading && calls.length === 0) return <LoadingSpinner message="Loading calls…" />;

  return (
    <SafeAreaView edges={[]} style={s.root}>
      {!!error && <ErrorBanner message={error} onRetry={refreshAll} />}
      {!!info && (
        <View style={s.infoBar}>
          <Ionicons name="checkmark-circle" size={15} color="#047857" />
          <Text style={s.infoBarText}>{info}</Text>
        </View>
      )}

      <FlatList
        data={logsOpen ? calls : []}
        keyExtractor={(c) => String(c.id)}
        renderItem={({ item }) => (
          <CallCard
            call={item}
            onOutcome={setOutcomeCall}
            onCreateLead={setLeadCall}
            onInfo={handleDone}
            onRefresh={refreshAll}
          />
        )}
        onEndReached={() => {
          if (logsOpen && !loadingMore && page + 1 < totalPages) loadCalls(page + 1);
        }}
        onEndReachedThreshold={0.4}
        contentContainerStyle={{ padding: 14, gap: 10, paddingBottom: 96 }}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View style={s.headerWrap}>
            {/* Report tiles */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tilesRow}>
              {reportTiles.map((t) => (
                <View key={t.label} style={s.tile}>
                  <Ionicons name={t.icon} size={15} color="#0f766e" />
                  <Text style={s.tileValue}>{t.value}</Text>
                  <Text style={s.tileLabel}>{t.label}</Text>
                </View>
              ))}
            </ScrollView>

            {/* Settings — full provider setup for admins, just the CRM-calling
                on/off toggle for agents. */}
            <Section
              title="Telephony Settings"
              icon="settings-outline"
              subtitle={isPrivileged ? "Provider, credentials, caller ID" : "Enable or disable CRM calling"}
              open={settingsOpen}
              onToggle={() => setSettingsOpen((v) => !v)}
            >
              <SettingsForm onInfo={handleDone} />
            </Section>

            {/* Agent Phone Mapping is admin-only. */}
            {isPrivileged && (
              <Section
                title="Agent Phone Mapping"
                icon="people-outline"
                subtitle="Map CRM users to their calling numbers"
                open={mappingOpen}
                onToggle={() => setMappingOpen((v) => !v)}
              >
                <AgentMappingForm onInfo={handleDone} />
              </Section>
            )}

            {/* Call logs dropdown — filters + list only when open */}
            <Section
              title="Call Logs"
              icon="list-outline"
              subtitle={`${totalElements} tracked call${totalElements === 1 ? "" : "s"}`}
              open={logsOpen}
              onToggle={() => setLogsOpen((v) => !v)}
            >
              <View style={{ gap: 10 }}>
                {/* Status filter */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterRow}>
                  {STATUS_OPTIONS.map((st) => {
                    const active = status === st;
                    return (
                      <TouchableOpacity
                        key={st}
                        style={[s.filterChip, active && s.filterChipActive]}
                        onPress={() => { setStatus(st); loadCalls(0, st, disposition); }}
                      >
                        <Text style={[s.filterChipText, active && s.filterChipTextActive]}>
                          {st.replace("_", " ")}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                {/* Outcome filter */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterRow}>
                  {[{ value: "ALL", label: "All outcomes" }, ...DISPOSITION_OPTIONS].map((o) => {
                    const active = disposition === o.value;
                    return (
                      <TouchableOpacity
                        key={o.value}
                        style={[s.filterChip, active && s.filterChipActive]}
                        onPress={() => { setDisposition(o.value); loadCalls(0, status, o.value); }}
                      >
                        <Text style={[s.filterChipText, active && s.filterChipTextActive]}>{o.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            </Section>
          </View>
        }
        ListEmptyComponent={
          logsOpen ? (
            <View style={s.emptyWrap}>
              <View style={s.emptyIconWrap}>
                <Ionicons name="call-outline" size={30} color="#0f766e" />
              </View>
              <Text style={s.emptyTitle}>No call logs yet</Text>
              <Text style={s.emptySub}>
                Configure a telephony provider above, then start a tracked call with the + button.
              </Text>
            </View>
          ) : null
        }
        ListFooterComponent={
          logsOpen && loadingMore ? <ActivityIndicator color="#0f766e" style={{ marginVertical: 12 }} /> : null
        }
      />

      {/* FAB: click-to-call */}
      <TouchableOpacity style={s.fab} onPress={() => setNewCallOpen(true)} activeOpacity={0.85}>
        <Ionicons name="call" size={24} color="#fff" />
      </TouchableOpacity>

      <NewCallSheet visible={newCallOpen} onClose={() => setNewCallOpen(false)} onDone={handleDone} />
      <OutcomeSheet call={outcomeCall} onClose={() => setOutcomeCall(null)} onDone={handleDone} />
      <CreateLeadSheet call={leadCall} onClose={() => setLeadCall(null)} onDone={handleDone} />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const mediumFont = Platform.OS === "android" ? "sans-serif-medium" : undefined;
const iosTight = Platform.OS === "ios" ? -0.32 : 0;

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f8f9fb" },
  infoBar: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#ecfdf5", paddingHorizontal: 14, paddingVertical: 9,
  },
  infoBarText: { flex: 1, fontSize: 12.5, color: "#047857", fontWeight: "600" },

  headerWrap: { gap: 10, marginBottom: 4 },
  tilesRow: { gap: 8, paddingVertical: 2 },
  tile: {
    backgroundColor: "#fff", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
    alignItems: "center", gap: 2, minWidth: 74,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  tileValue: {
    fontSize: 17, fontWeight: "700", color: "#111827",
    fontFamily: mediumFont, letterSpacing: iosTight,
  },
  tileLabel: { fontSize: 10.5, color: "#6b7280", fontWeight: "600" },

  filterRow: { gap: 6 },
  filterChip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 99,
    backgroundColor: "rgba(118,118,128,0.08)",
  },
  filterChipActive: { backgroundColor: "#0f766e" },
  filterChipText: { fontSize: 12, fontWeight: "600", color: "#4b5563" },
  filterChipTextActive: { color: "#fff" },
  countText: { fontSize: 12, color: "#9ca3af", fontWeight: "600" },

  card: {
    backgroundColor: "#fff", borderRadius: 14, padding: 13, gap: 8,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  cardTopLeft: { flexDirection: "row", alignItems: "center", gap: 7, flex: 1 },
  cardNumber: {
    fontSize: 14.5, fontWeight: "600", color: "#111827", flexShrink: 1,
    fontFamily: mediumFont, letterSpacing: iosTight,
  },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  metaText: { fontSize: 11.5, color: "#6b7280" },
  badgeRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  badge: { borderRadius: 99, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 10.5, fontWeight: "700" },
  recordingBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "#ecfdf5", borderRadius: 99, paddingHorizontal: 8, paddingVertical: 3,
  },
  recordingBtnText: { fontSize: 10.5, fontWeight: "700", color: "#047857" },
  failureText: { fontSize: 12, color: "#dc2626" },
  notesText: { fontSize: 12.5, color: "#6b7280", lineHeight: 17 },
  hintBox: {
    flexDirection: "row", alignItems: "flex-start", gap: 6,
    backgroundColor: "#f0f9ff", borderRadius: 8, padding: 8,
  },
  hintText: { flex: 1, fontSize: 11.5, color: "#0369a1", lineHeight: 16, fontWeight: "600" },
  unknownText: { fontSize: 11.5, color: "#b45309", fontWeight: "700" },
  cardActions: {
    flexDirection: "row", gap: 8, paddingTop: 9,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(60,60,67,0.12)",
  },
  leadBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5,
    backgroundColor: "rgba(15,118,110,0.08)", borderRadius: 10, minHeight: 36,
  },
  leadBtnText: { fontSize: 12.5, fontWeight: "600", color: "#0f766e", fontFamily: mediumFont },
  outcomeBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5,
    backgroundColor: "rgba(118,118,128,0.08)", borderRadius: 10, minHeight: 36,
  },
  outcomeBtnText: { fontSize: 12.5, fontWeight: "600", color: "#374151", fontFamily: mediumFont },

  emptyWrap: { alignItems: "center", justifyContent: "center", paddingVertical: 60, gap: 10, paddingHorizontal: 32 },
  emptyIconWrap: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: "rgba(15,118,110,0.08)",
    alignItems: "center", justifyContent: "center", marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 16, fontWeight: "600", color: "#111827",
    fontFamily: mediumFont, letterSpacing: iosTight,
  },
  emptySub: { fontSize: 13, color: "#9ca3af", textAlign: "center", lineHeight: 19 },

  fab: {
    position: "absolute", bottom: 16, right: 16,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: "#0f766e", alignItems: "center", justifyContent: "center",
    shadowColor: "#0f766e", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
  },

  // Sheets
  sheetHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 18, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "rgba(60,60,67,0.15)",
    backgroundColor: "#fff",
  },
  sheetTitle: {
    fontSize: 16, fontWeight: "600", color: "#111827",
    fontFamily: mediumFont, letterSpacing: iosTight,
  },
  sheetClose: { padding: 4 },
  sheetBody: { padding: 16, gap: 12, paddingBottom: 120 },
  sheetHint: { fontSize: 12.5, color: "#6b7280", lineHeight: 18 },
  sheetFooter: {
    padding: 14, borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(60,60,67,0.15)", backgroundColor: "#fff",
  },
  primaryBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: "#0f766e", borderRadius: 12, minHeight: 48,
  },
  primaryBtnText: {
    fontSize: 15, fontWeight: "600", color: "#fff",
    fontFamily: mediumFont, letterSpacing: iosTight,
  },
  field: { gap: 6 },
  fieldLabel: {
    fontSize: 13, fontWeight: "600", color: "#374151",
    fontFamily: mediumFont,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(60,60,67,0.2)", borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15,
    color: "#111827", backgroundColor: "rgba(118,118,128,0.06)",
  },
  inputMultiline: { minHeight: 88 },
  errorBox: { backgroundColor: "rgba(220,38,38,0.06)", borderRadius: 12, padding: 12 },
  errorBoxText: { color: "#dc2626", fontSize: 13 },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 99,
    backgroundColor: "rgba(118,118,128,0.08)",
  },
  chipActive: { backgroundColor: "#0f766e" },
  chipText: { fontSize: 12.5, fontWeight: "600", color: "#4b5563" },
  chipTextActive: { color: "#fff" },
  guidanceBox: { borderRadius: 12, padding: 12, gap: 3 },
  guidanceTitle: { fontSize: 13, fontWeight: "700" },
  guidanceBody: { fontSize: 12.5, lineHeight: 18 },

  // Collapsible sections
  section: {
    backgroundColor: "#fff", borderRadius: 14, overflow: "hidden",
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  sectionHeader: {
    flexDirection: "row", alignItems: "center", gap: 11,
    paddingHorizontal: 13, paddingVertical: 12,
  },
  sectionIconWrap: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: "rgba(15,118,110,0.08)",
    alignItems: "center", justifyContent: "center",
  },
  sectionTitle: {
    fontSize: 14.5, fontWeight: "600", color: "#111827",
    fontFamily: mediumFont, letterSpacing: iosTight,
  },
  sectionSubtitle: { fontSize: 11.5, color: "#9ca3af", marginTop: 1 },
  sectionBody: {
    paddingHorizontal: 13, paddingBottom: 14, paddingTop: 2,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(60,60,67,0.1)",
  },

  // Settings form
  statusRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 },
  providerHint: { flex: 1, fontSize: 11.5, color: "#6b7280" },
  switchRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: "rgba(118,118,128,0.05)", borderRadius: 12,
    paddingHorizontal: 13, paddingVertical: 8,
  },
  switchLabel: {
    fontSize: 13.5, fontWeight: "600", color: "#374151",
    fontFamily: mediumFont,
  },
  webhookBox: { backgroundColor: "#eff6ff", borderRadius: 12, padding: 12, gap: 5 },
  webhookLabel: { fontSize: 12.5, fontWeight: "700", color: "#1e40af" },
  webhookHelp: { fontSize: 11.5, color: "#1e40af", lineHeight: 16 },
  webhookSubLabel: { fontSize: 10.5, fontWeight: "700", color: "#6b7280", marginTop: 6, textTransform: "uppercase", letterSpacing: 0.3 },
  webhookUrl: {
    fontSize: 11.5, color: "#1f2937", backgroundColor: "#fff",
    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6,
  },
  providerLockHint: { fontSize: 11.5, color: "#6b7280", lineHeight: 16 },
  fieldHelp: { fontSize: 11.5, color: "#9ca3af", lineHeight: 16 },

  // Agent mapping
  selectBox: {
    borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(60,60,67,0.2)", borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 13, backgroundColor: "rgba(118,118,128,0.06)",
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  selectText: { fontSize: 15, color: "#111827", flex: 1 },
  emptyMappingText: { fontSize: 12.5, color: "#9ca3af", textAlign: "center", paddingVertical: 8 },
  mappingCard: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: "rgba(118,118,128,0.05)", borderRadius: 12, padding: 11,
  },
  mappingEmail: { fontSize: 13, fontWeight: "600", color: "#111827", fontFamily: mediumFont },
  mappingPhone: { fontSize: 12, color: "#6b7280", marginTop: 2 },
  pickerOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  pickerSheet: {
    backgroundColor: "#fff", borderTopLeftRadius: 18, borderTopRightRadius: 18,
    padding: 16, paddingBottom: 30, gap: 2,
  },
  pickerTitle: {
    fontSize: 15, fontWeight: "600", color: "#111827", marginBottom: 8,
    fontFamily: mediumFont, letterSpacing: iosTight,
  },
  pickerItem: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingVertical: 13, paddingHorizontal: 10, borderRadius: 10,
  },
  pickerItemText: { fontSize: 14, color: "#374151", flex: 1 },

  // Per-call AI panel
  aiToggleBtnActive: { backgroundColor: "rgba(124,58,237,0.08)" },
  aiPanel: {
    gap: 8, paddingTop: 9,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(60,60,67,0.12)",
  },
  aiBtnRow: { flexDirection: "row", alignItems: "center", gap: 7, flexWrap: "wrap" },
  aiBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    borderRadius: 9, paddingHorizontal: 10, paddingVertical: 6,
  },
  aiBtnSummary: { backgroundColor: "rgba(124,58,237,0.08)" },
  aiBtnSummaryText: { fontSize: 12, fontWeight: "700", color: "#7c3aed" },
  aiBtnTranscript: { backgroundColor: "rgba(3,105,161,0.08)" },
  aiBtnTranscriptText: { fontSize: 12, fontWeight: "700", color: "#0369a1" },
  aiMetaText: { fontSize: 11, fontWeight: "600", color: "#0369a1" },
  aiResultBox: {
    backgroundColor: "rgba(118,118,128,0.05)", borderRadius: 10, padding: 11, gap: 8,
  },
  aiResultText: { fontSize: 12.5, color: "#374151", lineHeight: 18 },
  aiErrorText: { fontSize: 12.5, color: "#dc2626", lineHeight: 18 },
  aiSaveNoteBtn: {
    alignSelf: "flex-start", backgroundColor: "#fff", borderRadius: 8,
    paddingHorizontal: 11, paddingVertical: 6,
    borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(60,60,67,0.2)",
  },
  aiSaveNoteText: { fontSize: 11.5, fontWeight: "700", color: "#374151" },
  aiToggleText: { fontSize: 12, fontWeight: "700", color: "#0369a1" },
});
