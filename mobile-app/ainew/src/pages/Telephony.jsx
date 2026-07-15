import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Clipboard,
  Headphones,
  ListChecks,
  Phone,
  PhoneCall,
  RefreshCw,
  Save,
  Settings,
  X,
  UserPlus,
} from "lucide-react";
import api from "../api/axios";
import { dateRangeParams, presetDateRange } from "../components/common/DateRangeFilter";
import CallRecordingPlayer from "../components/common/CallRecordingPlayer";
import AiCallActionPanel from "../components/ai/AiCallActionPanel";
import AiCallSummaryButton from "../components/ai/AiCallSummaryButton";
import CallTranscriptButton from "../components/ai/CallTranscriptButton";

const providerOptions = [
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
    logoType: "word",
    logoText: "exo",
    logoClass: "bg-gradient-to-br from-orange-500 to-rose-500 text-white",
    logoRing: "ring-orange-100",
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
    logoType: "twilio",
    logoText: "Tw",
    logoClass: "bg-red-600 text-white",
    logoRing: "ring-red-100",
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
    logoType: "word",
    logoText: "plivo",
    logoClass: "bg-gradient-to-br from-cyan-500 to-blue-600 text-white",
    logoRing: "ring-cyan-100",
  },
];

const statusOptions = ["ALL", "REQUESTED", "QUEUED", "RINGING", "ANSWERED", "COMPLETED", "MISSED", "FAILED", "BUSY", "NO_ANSWER"];
const dispositionOptions = [
  { value: "INTERESTED", label: "Interested" },
  { value: "NOT_INTERESTED", label: "Not Interested" },
  { value: "CALL_BACK_LATER", label: "Call Back Later" },
  { value: "WRONG_NUMBER", label: "Wrong Number" },
  { value: "CONVERTED", label: "Converted" },
  { value: "NOT_REACHABLE", label: "Not Reachable" },
];
const callNoteChips = ["Interested", "Asked for pricing", "Wants callback", "Wrong number", "Not reachable"];

function defaultRegionForProvider(provider) {
  if (provider === "TWILIO") return "CA";
  if (provider === "EXOTEL") return "IN";
  return "";
}

function providerWebhookUrl(baseUrl, provider) {
  if (!baseUrl) return "";
  return baseUrl.replace(/\/webhook\/(\d+)\/[^/?#]+/i, `/webhook/$1/${String(provider || "exotel").toLowerCase()}`);
}

function providerVoiceUrl(baseUrl, provider) {
  if (!baseUrl) return "";
  return providerWebhookUrl(baseUrl, provider).replace(/\/webhook\//i, "/voice/");
}

function emptyProviderFields(provider) {
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

const defaultConfig = {
  tenantId: null,
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

function ProviderLogo({ provider, selected }) {
  if (provider.logoType === "twilio") {
    return (
      <span className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl shadow-sm ring-4 ${
        selected ? provider.logoRing : "ring-gray-100"
      } ${provider.logoClass}`}>
        <span className="grid grid-cols-2 gap-1">
          <span className="h-2 w-2 rounded-full bg-white" />
          <span className="h-2 w-2 rounded-full bg-white" />
          <span className="h-2 w-2 rounded-full bg-white" />
          <span className="h-2 w-2 rounded-full bg-white" />
        </span>
      </span>
    );
  }

  return (
    <span className={`inline-flex h-12 min-w-12 items-center justify-center rounded-2xl px-2.5 text-sm font-black tracking-tight shadow-sm ring-4 ${
      selected ? provider.logoRing : "ring-gray-100"
    } ${provider.logoClass}`}>
      {provider.logoText}
    </span>
  );
}

function apiErrorMessage(error, fallback) {
  const data = error?.response?.data;
  if (typeof data === "string") return data;
  return data?.message || data?.error || error?.message || fallback;
}

function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

function statusMeta(status) {
  const normalized = String(status || "REQUESTED").toUpperCase();
  if (["COMPLETED", "ANSWERED"].includes(normalized)) {
    return { label: "Completed", tone: "border-emerald-200 bg-emerald-50 text-emerald-700", icon: "OK" };
  }
  if (normalized === "RINGING") {
    return { label: "Ringing", tone: "border-amber-200 bg-amber-50 text-amber-700", icon: "R" };
  }
  if (["NO_ANSWER", "MISSED", "BUSY"].includes(normalized)) {
    return { label: normalized === "NO_ANSWER" ? "No Answer" : normalized.replace("_", " "), tone: "border-red-200 bg-red-50 text-red-700", icon: "X" };
  }
  if (normalized === "VOICEMAIL") {
    return { label: "Voicemail", tone: "border-blue-200 bg-blue-50 text-blue-700", icon: "VM" };
  }
  return { label: normalized.replace("_", " "), tone: "border-slate-200 bg-slate-50 text-slate-700", icon: "-" };
}

function callStats(calls, report, totalElements) {
  const visible = Array.isArray(calls) ? calls : [];
  const total = Number(report?.totalCalls ?? totalElements ?? visible.length ?? 0);
  const visibleCount = (predicate) => visible.filter(predicate).length;
  const completed = Number(report?.answeredCalls ?? visibleCount((call) => ["COMPLETED", "ANSWERED"].includes(String(call.status || "").toUpperCase())));
  const noAnswer = Number(report?.missedCalls ?? visibleCount((call) => ["NO_ANSWER", "MISSED", "BUSY"].includes(String(call.status || "").toUpperCase())));
  const ringing = visibleCount((call) => ["REQUESTED", "QUEUED", "RINGING"].includes(String(call.status || "").toUpperCase()));
  const voicemail = visibleCount((call) => String(call.status || "").toUpperCase() === "VOICEMAIL" || String(call.disposition || "").toUpperCase() === "VOICEMAIL");
  const pending = visibleCount((call) => !call.recordingUrl && !["NO_ANSWER", "MISSED", "BUSY", "FAILED"].includes(String(call.status || "").toUpperCase()));
  const percent = (value) => total > 0 ? `${Math.round((Number(value || 0) / total) * 1000) / 10}%` : "0%";
  return { total, completed, noAnswer, ringing, voicemail, pending, percent };
}

function CallStatCard({ tone, icon, label, value, percent, helper, action }) {
  const tones = {
    emerald: "border-emerald-100 bg-emerald-50/40 text-emerald-700",
    amber: "border-amber-100 bg-amber-50/40 text-amber-700",
    red: "border-red-100 bg-red-50/40 text-red-700",
    blue: "border-blue-100 bg-blue-50/40 text-blue-700",
    slate: "border-slate-200 bg-white text-slate-700",
  };
  const iconTones = {
    emerald: "bg-emerald-100 text-emerald-700",
    amber: "bg-amber-100 text-amber-700",
    red: "bg-red-100 text-red-700",
    blue: "bg-blue-100 text-blue-700",
    slate: "bg-slate-100 text-slate-700",
  };
  return (
    <article className={`rounded-2xl border p-4 shadow-sm ${tones[tone] || tones.slate}`}>
      <div className="flex items-center gap-4">
        <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-2xl font-black ${iconTones[tone] || iconTones.slate}`}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-black">{label}</p>
          <div className="mt-1 flex flex-wrap items-end gap-3">
            <span className="text-3xl font-black leading-none">{value}</span>
            {percent && <span className="rounded-full bg-white/80 px-2.5 py-1 text-xs font-black">{percent}</span>}
          </div>
          {helper && <p className="mt-2 text-xs font-semibold leading-5 opacity-80">{helper}</p>}
          {action && <div className="mt-2">{action}</div>}
        </div>
      </div>
    </article>
  );
}

function pageNumbers(page, totalPages) {
  const total = Math.max(0, Number(totalPages || 0));
  const current = Number(page || 0);
  if (total <= 7) return Array.from({ length: total }, (_, index) => index);
  const pages = new Set([0, total - 1, current, current - 1, current + 1]);
  if (current < 3) [0, 1, 2, 3].forEach((item) => pages.add(item));
  if (current > total - 4) [total - 4, total - 3, total - 2, total - 1].forEach((item) => pages.add(item));
  return Array.from(pages).filter((item) => item >= 0 && item < total).sort((a, b) => a - b);
}

function dispositionLabel(value) {
  return dispositionOptions.find((option) => option.value === value)?.label || "No outcome";
}

function recordingBadge(call) {
  const status = String(call.recordingStatus || (call.recordingUrl ? "AVAILABLE" : "PENDING")).toUpperCase();
  if (status === "AVAILABLE") {
    return { label: "Recording available", tone: "border-emerald-100 bg-emerald-50 text-emerald-700" };
  }
  if (status === "UNAVAILABLE") {
    return { label: "Recording unavailable", tone: "border-red-100 bg-red-50 text-red-700" };
  }
  return { label: "Recording pending", tone: "border-amber-100 bg-amber-50 text-amber-700" };
}

function healthTone(status) {
  const value = String(status || "").toUpperCase();
  if (value === "HEALTHY") return "border-emerald-100 bg-emerald-50 text-emerald-800";
  if (value === "NEEDS_ATTENTION") return "border-red-100 bg-red-50 text-red-800";
  if (value === "RECORDING_PENDING" || value === "WAITING_FOR_WEBHOOK") return "border-amber-100 bg-amber-50 text-amber-800";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function outcomeGuidance(disposition) {
  switch (disposition) {
    case "INTERESTED":
      return {
        title: "Recommended next step",
        body: "Save this outcome, then open the linked opportunity to schedule a site visit, demo, counselling session, or test ride.",
        tone: "border-emerald-100 bg-emerald-50 text-emerald-800",
      };
    case "CALL_BACK_LATER":
      return {
        title: "Create a callback task",
        body: "Select a follow-up date and time. CRM will create a task for the contact owner so this call is not missed.",
        tone: "border-blue-100 bg-blue-50 text-blue-800",
      };
    case "CONVERTED":
      return {
        title: "Converted from call",
        body: "Save this outcome, then update the opportunity stage/revenue from Pipeline or Opportunity Detail.",
        tone: "border-teal-100 bg-teal-50 text-teal-800",
      };
    case "NOT_INTERESTED":
    case "WRONG_NUMBER":
    case "NOT_REACHABLE":
      return {
        title: "Low intent outcome",
        body: "Save the reason clearly in notes. Use Automation Rules later if you want these outcomes to pause campaigns or mark leads cold.",
        tone: "border-amber-100 bg-amber-50 text-amber-800",
      };
    default:
      return {
        title: "Call outcome",
        body: "Capture what happened and choose a next action if follow-up is needed.",
        tone: "border-gray-200 bg-gray-50 text-gray-700",
      };
  }
}

function toDateTimeInput(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function prettyPayload(value) {
  if (!value) return "No payload";
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return String(value);
  }
}

function webhookHealth(events, totalElements) {
  if (!totalElements) {
    return {
      label: "No callbacks received",
      tone: "border-amber-100 bg-amber-50 text-amber-800",
      message: "Run an inbound call test. If this stays zero, Exotel is not calling the CRM webhook URL.",
    };
  }
  if (events.some((event) => event.status === "FAILED")) {
    return {
      label: "Action needed",
      tone: "border-red-100 bg-red-50 text-red-800",
      message: "CRM received callbacks but at least one failed. Open the latest payload and check the failed reason.",
    };
  }
  if (events.some((event) => event.status === "PROCESSED")) {
    return {
      label: "Healthy",
      tone: "border-emerald-100 bg-emerald-50 text-emerald-800",
      message: "CRM is receiving and processing telephony callbacks.",
    };
  }
  return {
    label: "Callbacks received",
    tone: "border-blue-100 bg-blue-50 text-blue-800",
    message: "CRM received callbacks. Refresh after a few seconds to confirm processing.",
  };
}

export default function Telephony() {
  const [config, setConfig] = useState(defaultConfig);
  const [hasToken, setHasToken] = useState(false);
  const [hasWebhookSecret, setHasWebhookSecret] = useState(false);
  const [calls, setCalls] = useState([]);
  const [users, setUsers] = useState([]);
  const [agentMappings, setAgentMappings] = useState([]);
  const [mappingForm, setMappingForm] = useState({ userId: "", phoneNumber: "", active: true });
  const [pageInfo, setPageInfo] = useState({ page: 0, size: 25, totalElements: 0, totalPages: 0 });
  const [status, setStatus] = useState("ALL");
  const [disposition, setDisposition] = useState("ALL");
  const [agentUserId, setAgentUserId] = useState("");
  const [callDatePreset, setCallDatePreset] = useState("30D");
  const [dateRange, setDateRange] = useState(() => presetDateRange("30D"));
  const [callForm, setCallForm] = useState({ contactId: "", customerNumber: "", agentNumber: "", notes: "" });
  const [leadForm, setLeadForm] = useState({ callLogId: null, name: "", email: "", city: "", tags: "Phone Call" });
  const [dispositionForm, setDispositionForm] = useState({
    callId: null,
    disposition: "INTERESTED",
    notes: "",
    followUpAt: "",
    followUpTitle: "Call back lead",
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingMapping, setSavingMapping] = useState(false);
  const [calling, setCalling] = useState(false);
  const [creatingLead, setCreatingLead] = useState(false);
  const [savingDisposition, setSavingDisposition] = useState(false);
  const [installingTemplates, setInstallingTemplates] = useState(false);
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [webhookInstructionsOpen, setWebhookInstructionsOpen] = useState(false);
  const [testCallOpen, setTestCallOpen] = useState(false);
  const [automationOpen, setAutomationOpen] = useState(false);
  const [automationInstallResult, setAutomationInstallResult] = useState(null);
  const [webhookEvents, setWebhookEvents] = useState([]);
  const [webhookPageInfo, setWebhookPageInfo] = useState({ totalElements: 0 });
  const [webhookLoading, setWebhookLoading] = useState(false);
  const [health, setHealth] = useState(null);
  const [report, setReport] = useState(null);
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const activeProvider = useMemo(
    () => providerOptions.find((provider) => provider.value === config.provider) || providerOptions[0],
    [config.provider]
  );
  const selectedWebhookUrl = providerWebhookUrl(config.inboundWebhookUrl, config.provider);
  const selectedVoiceUrl = providerVoiceUrl(config.inboundWebhookUrl, config.provider);
  const needsSeparateVoiceUrl = config.provider === "TWILIO" || config.provider === "PLIVO";
  const activeProviderLocked = Boolean(config.active);
  const noAnswerWebhookUrl = selectedWebhookUrl ? `${selectedWebhookUrl}?Status=NO_ANSWER` : "";
  const completedWebhookUrl = selectedWebhookUrl ? `${selectedWebhookUrl}?Status=COMPLETED` : "";
  const webhookStatus = useMemo(
    () => webhookHealth(webhookEvents, webhookPageInfo.totalElements),
    [webhookEvents, webhookPageInfo.totalElements]
  );
  const callLogStats = useMemo(() => callStats(calls, report, pageInfo.totalElements), [calls, report, pageInfo.totalElements]);

  const loadConfig = async () => {
    try {
      const response = await api.get("/api/telephony/config");
      const data = response.data || {};
      setConfig({
        tenantId: data.tenantId || null,
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
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to load telephony settings."));
    }
  };

  const loadCalls = async (nextPage = pageInfo.page) => {
    setLoading(true);
    setError("");
    try {
      const response = await api.get("/api/telephony/calls", {
        params: {
          status,
          disposition,
          userId: agentUserId || undefined,
          page: nextPage,
          size: pageInfo.size,
          ...dateRangeParams(dateRange),
        },
      });
      setCalls(response.data?.items || []);
      setPageInfo({
        page: response.data?.page ?? nextPage,
        size: response.data?.size ?? pageInfo.size,
        totalElements: response.data?.totalElements ?? 0,
        totalPages: response.data?.totalPages ?? 0,
      });
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to load call logs."));
    } finally {
      setLoading(false);
    }
  };

  const changeCallPageSize = (size) => {
    const nextSize = Number(size);
    setPageInfo((current) => ({ ...current, page: 0, size: nextSize }));
    setLoading(true);
    setError("");
    api.get("/api/telephony/calls", {
      params: {
        status,
        disposition,
        userId: agentUserId || undefined,
        page: 0,
        size: nextSize,
        ...dateRangeParams(dateRange),
      },
    }).then((response) => {
      setCalls(response.data?.items || []);
      setPageInfo({
        page: response.data?.page ?? 0,
        size: response.data?.size ?? nextSize,
        totalElements: response.data?.totalElements ?? 0,
        totalPages: response.data?.totalPages ?? 0,
      });
    }).catch((err) => {
      setError(apiErrorMessage(err, "Failed to load call logs."));
    }).finally(() => {
      setLoading(false);
    });
  };

  const loadTelephonySummary = async () => {
    try {
      const [healthResponse, reportResponse] = await Promise.all([
        api.get("/api/telephony/health"),
        api.get("/api/telephony/report", {
          params: {
            userId: agentUserId || undefined,
            ...dateRangeParams(dateRange),
          },
        }),
      ]);
      setHealth(healthResponse.data || null);
      setReport(reportResponse.data || null);
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to load telephony summary."));
    }
  };

  const loadAgentMappings = async () => {
    try {
      const [usersResponse, mappingsResponse] = await Promise.all([
        api.get("/api/users"),
        api.get("/api/telephony/agent-mappings"),
      ]);
      setUsers(Array.isArray(usersResponse.data) ? usersResponse.data : []);
      setAgentMappings(Array.isArray(mappingsResponse.data) ? mappingsResponse.data : []);
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to load agent phone mappings."));
    }
  };

  const loadWebhookDiagnostics = async () => {
    setWebhookLoading(true);
    try {
      const response = await api.get("/api/webhook-events", {
        params: {
          provider: `TELEPHONY_${config.provider || "EXOTEL"}`,
          page: 0,
          size: 8,
        },
      });
      setWebhookEvents(response.data?.items || []);
      setWebhookPageInfo({
        totalElements: response.data?.totalElements ?? 0,
      });
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to load telephony webhook diagnostics."));
    } finally {
      setWebhookLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
    loadAgentMappings();
    loadTelephonySummary();
  }, []);

  useEffect(() => {
    if (diagnosticsOpen) {
      loadWebhookDiagnostics();
    }
  }, [diagnosticsOpen, config.provider]);

  useEffect(() => {
    loadCalls(0);
    loadTelephonySummary();
  }, [status, disposition, agentUserId, dateRange.fromDate, dateRange.toDate]);

  const updateConfig = (field, value) => {
    setConfig((current) => {
      if (field === "provider") {
        if (current.active && value !== current.provider) {
          setInfo("Deactivate the current provider before switching to another provider.");
          return current;
        }
        setHasToken(false);
        setHasWebhookSecret(false);
        return {
          ...current,
          ...emptyProviderFields(value),
          tenantId: current.tenantId,
          inboundWebhookUrl: current.inboundWebhookUrl,
        };
      }
      return { ...current, [field]: value };
    });
  };

  const saveConfig = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setInfo("");
    try {
      const { inboundWebhookUrl, ...editableConfig } = config;
      const payload = {
        ...editableConfig,
        apiToken: config.apiToken === "********" ? null : config.apiToken,
        webhookSecret: config.webhookSecret === "********" ? null : config.webhookSecret,
      };
      await api.post("/api/telephony/config", payload);
      setInfo("Telephony settings saved.");
      await loadConfig();
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to save telephony settings."));
    } finally {
      setSaving(false);
    }
  };

  const startCall = async (event) => {
    event.preventDefault();
    setCalling(true);
    setError("");
    setInfo("");
    try {
      const payload = {
        contactId: callForm.contactId ? Number(callForm.contactId) : null,
        customerNumber: callForm.customerNumber || null,
        agentNumber: callForm.agentNumber || null,
        notes: callForm.notes || null,
      };
      const response = await api.post("/api/telephony/calls/click-to-call", payload);
      const result = response.data || {};
      if (String(result.status || "").toUpperCase() === "FAILED") {
        setError(result.failureReason || "Call could not be started.");
      } else {
        setInfo(`Call logged as ${result.status || "REQUESTED"}. Provider live bridge can update status through webhook.`);
      }
      setCallForm((current) => ({ ...current, notes: "" }));
      await loadCalls(0);
      setTestCallOpen(false);
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to start call."));
    } finally {
      setCalling(false);
    }
  };

  const saveAgentMapping = async (event) => {
    event.preventDefault();
    if (!mappingForm.userId || !mappingForm.phoneNumber.trim()) {
      setError("Select an agent and enter phone number before saving mapping.");
      return;
    }
    setSavingMapping(true);
    setError("");
    setInfo("");
    try {
      await api.post("/api/telephony/agent-mappings", {
        userId: Number(mappingForm.userId),
        phoneNumber: mappingForm.phoneNumber.trim(),
        active: mappingForm.active,
      });
      setInfo("Agent phone mapping saved.");
      setMappingForm({ userId: "", phoneNumber: "", active: true });
      await loadAgentMappings();
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to save agent phone mapping."));
    } finally {
      setSavingMapping(false);
    }
  };

  const copyWebhookUrl = async (url, message = "Webhook URL copied.") => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedWebhook(true);
      setInfo(message);
      window.setTimeout(() => setCopiedWebhook(false), 1800);
    } catch (err) {
      setError("Could not copy webhook URL. Select and copy it manually.");
    }
  };

  const openLeadForm = (call) => {
    const caller = call.customerNumber || call.fromNumber || "";
    setLeadForm({
      callLogId: call.id,
      name: `Phone Lead ${caller}`.trim(),
      email: "",
      city: "",
      tags: "Phone Call",
    });
  };

  const createLeadFromCall = async (event) => {
    event.preventDefault();
    if (!leadForm.callLogId) return;
    setCreatingLead(true);
    setError("");
    setInfo("");
    try {
      await api.post("/api/telephony/calls/create-lead", {
        callLogId: leadForm.callLogId,
        name: leadForm.name || null,
        email: leadForm.email || null,
        city: leadForm.city || null,
        tags: leadForm.tags || null,
      });
      setInfo("Lead created and linked to this call.");
      setLeadForm({ callLogId: null, name: "", email: "", city: "", tags: "Phone Call" });
      await loadCalls(0);
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to create lead from call."));
    } finally {
      setCreatingLead(false);
    }
  };

  const openDispositionForm = (call) => {
    setDispositionForm({
      callId: call.id,
      disposition: call.disposition || "INTERESTED",
      notes: call.notes || "",
      followUpAt: "",
      followUpTitle: "Call back lead",
    });
  };

  const saveDisposition = async (event) => {
    event.preventDefault();
    if (!dispositionForm.callId) return;
    setSavingDisposition(true);
    setError("");
    setInfo("");
    try {
      await api.post(`/api/telephony/calls/${dispositionForm.callId}/disposition`, {
        disposition: dispositionForm.disposition,
        notes: dispositionForm.notes || null,
        followUpAt: dispositionForm.disposition === "CALL_BACK_LATER" && dispositionForm.followUpAt
          ? new Date(dispositionForm.followUpAt).toISOString()
          : null,
        followUpTitle: dispositionForm.followUpTitle || "Call back lead",
      });
      const savedOutcome = dispositionLabel(dispositionForm.disposition);
      setInfo(dispositionForm.disposition === "CALL_BACK_LATER"
        ? `Call outcome saved as ${savedOutcome}. Follow-up task created if a date was selected.`
        : dispositionForm.disposition === "INTERESTED"
          ? "Call outcome saved as Interested. Open the linked opportunity to schedule the next appointment."
          : dispositionForm.disposition === "CONVERTED"
            ? "Call outcome saved as Converted. Update opportunity stage/revenue if needed."
            : `Call outcome saved as ${savedOutcome}.`);
      setDispositionForm({ callId: null, disposition: "INTERESTED", notes: "", followUpAt: "", followUpTitle: "Call back lead" });
      await loadCalls(0);
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to save call outcome."));
    } finally {
      setSavingDisposition(false);
    }
  };

  const addDispositionNote = (note) => {
    setDispositionForm((current) => ({
      ...current,
      notes: [current.notes, note].filter(Boolean).join(current.notes ? "\n" : ""),
    }));
  };

  const installCallAutomationTemplates = async () => {
    setInstallingTemplates(true);
    setError("");
    setInfo("");
    setAutomationInstallResult(null);
    try {
      const response = await api.post("/api/telephony/automation-templates/call-outcomes");
      const createdCount = response.data?.createdCount ?? 0;
      const message = createdCount > 0
        ? `${createdCount} starter rule${createdCount === 1 ? "" : "s"} created.`
        : response.data?.message || "Starter rules already exist.";
      setInfo(`${message} Open Automation Rules to review, activate, pause, or edit them.`);
      setAutomationInstallResult({
        createdCount,
        message,
      });
      setAutomationOpen(true);
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to install call automation templates."));
    } finally {
      setInstallingTemplates(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-5 text-gray-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-teal-700">
              <Headphones size={16} />
              Phase 3 Telephony
            </div>
            <h1 className="mt-2 text-2xl font-extrabold text-gray-950">Calls, missed-call follow-up, and call history</h1>
            <p className="mt-1 max-w-3xl text-sm text-gray-600">
              Configure Exotel, Twilio, or Plivo once. Every call should become part of the same CRM history as WhatsApp, email, tasks, and opportunities.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              loadCalls(0);
              loadTelephonySummary();
              if (diagnosticsOpen) loadWebhookDiagnostics();
            }}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>

        {(error || info) && (
          <div className={`flex items-start gap-2 rounded-xl border px-4 py-3 text-sm ${
            error ? "border-red-100 bg-red-50 text-red-700" : "border-emerald-100 bg-emerald-50 text-emerald-700"
          }`}>
            {error ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
            <span>{error || info}</span>
          </div>
        )}

        <div className="space-y-5">
          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-sm font-extrabold text-gray-950">
                  <Settings size={18} />
                  Telephony Settings
                </div>
                <p className="mt-1 text-sm text-gray-500">{activeProvider.hint}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setTestCallOpen(true)}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-xs font-black text-teal-700 hover:bg-teal-100"
                >
                  <Phone size={14} />
                  Test call
                </button>
                <span className={`rounded-full px-3 py-1 text-xs font-extrabold ${
                  config.active ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-600"
                }`}>
                  {config.active ? "Active" : "Not active"}
                </span>
              </div>
            </div>

            <form onSubmit={saveConfig} className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <div className="grid gap-3 md:grid-cols-3">
                  {providerOptions.map((provider) => {
                    const selected = config.provider === provider.value;
                    const disabled = activeProviderLocked && !selected;
                    return (
                      <button
                        key={provider.value}
                        type="button"
                        onClick={() => updateConfig("provider", provider.value)}
                        disabled={disabled}
                        className={`rounded-2xl border p-4 text-left transition ${
                          selected
                            ? "border-teal-300 bg-teal-50 shadow-sm"
                            : disabled
                              ? "cursor-not-allowed border-gray-100 bg-gray-50 opacity-60"
                              : "border-gray-200 bg-white hover:border-teal-200 hover:bg-teal-50/50"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <ProviderLogo provider={provider} selected={selected} />
                          {selected && (
                            <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase ${
                              config.active ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                            }`}>
                              {config.active ? "Active" : "Selected"}
                            </span>
                          )}
                          {disabled && (
                            <span className="rounded-full bg-gray-100 px-2 py-1 text-[10px] font-black uppercase text-gray-500">
                              Locked
                            </span>
                          )}
                        </div>
                        <div className="mt-4 flex items-center gap-2">
                          <p className="text-base font-black text-gray-950">{provider.label}</p>
                          <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-black uppercase text-gray-500 ring-1 ring-gray-100">
                            {provider.value}
                          </span>
                        </div>
                        <p className="mt-1 text-xs font-semibold leading-5 text-gray-500">{provider.hint}</p>
                        {disabled && (
                          <p className="mt-3 rounded-lg bg-white px-2 py-2 text-xs font-bold text-gray-600">
                            Deactivate {activeProvider.label} before switching.
                          </p>
                        )}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-3 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-800">
                  Only one telephony provider can be active at a time. Switching to another inactive provider starts with blank credentials so Exotel, Twilio, and Plivo data do not mix.
                </p>
              </div>

              <label className="space-y-1 text-sm font-semibold text-gray-700">
                Region
                <input
                  value={config.region}
                  onChange={(event) => updateConfig("region", event.target.value)}
                  placeholder="IN, CA, US"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </label>

              <label className="space-y-1 text-sm font-semibold text-gray-700">
                {activeProvider.accountLabel || "Account SID / App ID"}
                <input
                  value={config.accountSid}
                  onChange={(event) => updateConfig("accountSid", event.target.value)}
                  placeholder="Provider account identifier"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </label>

              <label className="space-y-1 text-sm font-semibold text-gray-700">
                {activeProvider.apiKeyLabel || "API Key"}
                <input
                  value={config.apiKey}
                  onChange={(event) => updateConfig("apiKey", event.target.value)}
                  placeholder="Provider API key"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </label>

              <label className="space-y-1 text-sm font-semibold text-gray-700 md:col-span-2">
                API Base URL
                <input
                  value={config.apiBaseUrl}
                  onChange={(event) => updateConfig("apiBaseUrl", event.target.value)}
                  placeholder={activeProvider.basePlaceholder || "https://api.exotel.com"}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
                <span className="block text-xs font-normal text-gray-500">
                  {activeProvider.baseHelp || "Leave blank to use the provider default API URL."}
                </span>
              </label>

              <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 md:col-span-2">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-sm font-extrabold text-blue-950">{activeProvider.webhookTitle || "Inbound call webhook"}</p>
                    <p className="mt-1 text-sm text-blue-800">
                      {activeProvider.webhookHelp || "Add these URLs in your provider callback settings. This is required for incoming and missed calls to appear in CRM."}
                    </p>
                    <p className="mt-2 text-xs font-bold text-blue-700">
                      {needsSeparateVoiceUrl
                        ? `Setup the Voice URL and Status Callback URL in ${activeProvider.label} so inbound calls, missed calls, recordings, and completed calls update automatically in CRM.`
                        : `Setup this webhook in ${activeProvider.label} so inbound, missed, answered, and completed calls update automatically in CRM.`}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setWebhookInstructionsOpen((current) => !current)}
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm font-extrabold text-blue-700 hover:bg-blue-50"
                    >
                      {webhookInstructionsOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                      {webhookInstructionsOpen ? "Hide setup" : "Setup instructions"}
                    </button>
                    <button
                      type="button"
                      onClick={() => copyWebhookUrl(needsSeparateVoiceUrl ? selectedVoiceUrl : selectedWebhookUrl, needsSeparateVoiceUrl ? "Voice URL copied." : "Base inbound webhook URL copied.")}
                      disabled={!(needsSeparateVoiceUrl ? selectedVoiceUrl : selectedWebhookUrl)}
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm font-extrabold text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Clipboard size={15} />
                      {copiedWebhook ? "Copied" : needsSeparateVoiceUrl ? "Copy Voice URL" : "Copy URL"}
                    </button>
                  </div>
                </div>

                {webhookInstructionsOpen && (
                  <div className="mt-4 space-y-3">
                    <div className="rounded-xl border border-blue-100 bg-white p-3">
                      <p className="text-xs font-extrabold uppercase tracking-wide text-blue-700">{activeProvider.label} setup steps</p>
                      <ol className="mt-2 space-y-1 text-sm font-semibold text-gray-700">
                        <li>1. Open the provider phone number or voice application.</li>
                        {needsSeparateVoiceUrl ? (
                          <>
                            <li>2. In “A call comes in”, choose Webhook, method POST, and paste the Voice URL.</li>
                            <li>3. In status callback / recording callback, use POST and paste the Status Callback URL.</li>
                          </>
                        ) : (
                          <>
                            <li>2. Add a webhook, status callback, or HTTP callback step.</li>
                            <li>3. Use GET or POST and paste the correct URL based on the branch.</li>
                          </>
                        )}
                        <li>4. Save and publish the provider call flow.</li>
                      </ol>
                    </div>

                    {needsSeparateVoiceUrl && (
                      <div className="rounded-lg border border-blue-100 bg-white px-3 py-2">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="mb-1 text-xs font-extrabold uppercase tracking-wide text-gray-500">Voice URL for “A call comes in”</p>
                            <p className="text-xs font-semibold text-gray-500">Returns TwiML XML. Do not use the status callback URL here.</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => copyWebhookUrl(selectedVoiceUrl, "Voice URL copied.")}
                            disabled={!selectedVoiceUrl}
                            className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-blue-200 bg-white px-2.5 py-1.5 text-xs font-extrabold text-blue-700 disabled:opacity-60"
                          >
                            <Clipboard size={13} />
                            Copy
                          </button>
                        </div>
                        <code className="mt-2 block break-all rounded-lg bg-slate-50 px-2 py-2 text-xs font-bold text-gray-800">
                          {selectedVoiceUrl || "Save telephony settings to generate voice URL"}
                        </code>
                      </div>
                    )}

                    <div className="rounded-lg border border-blue-100 bg-white px-3 py-2">
                      <p className="mb-1 text-xs font-extrabold uppercase tracking-wide text-gray-500">
                        {needsSeparateVoiceUrl ? "Status callback URL" : "Base webhook URL"}
                      </p>
                      {needsSeparateVoiceUrl && (
                        <p className="mb-2 text-xs font-semibold text-gray-500">Use this for call status, completed call, and recording callbacks. It returns CRM status JSON, not TwiML.</p>
                      )}
                      <code className="block break-all text-xs font-bold text-gray-800">
                        {selectedWebhookUrl || "Save telephony settings to generate webhook URL"}
                      </code>
                    </div>

                    <div className="grid gap-3 lg:grid-cols-2">
                      <div className="rounded-xl border border-red-100 bg-red-50 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-extrabold text-red-800">Missed / No Answer branch</p>
                            <p className="mt-1 text-xs font-semibold text-red-700">Use this when {activeProvider.label} says no user answered, agent busy, or call not connected.</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => copyWebhookUrl(noAnswerWebhookUrl, "No-answer webhook URL copied.")}
                            disabled={!noAnswerWebhookUrl}
                            className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-xs font-extrabold text-red-700 disabled:opacity-60"
                          >
                            <Clipboard size={13} />
                            Copy
                          </button>
                        </div>
                        <code className="mt-2 block break-all rounded-lg bg-white px-2 py-2 text-xs font-bold text-gray-800">
                          {noAnswerWebhookUrl || "Webhook URL will appear after settings load"}
                        </code>
                      </div>

                      <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-extrabold text-emerald-800">Answered / Completed branch</p>
                            <p className="mt-1 text-xs font-semibold text-emerald-700">Use this when the call is answered or completed successfully.</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => copyWebhookUrl(completedWebhookUrl, "Completed-call webhook URL copied.")}
                            disabled={!completedWebhookUrl}
                            className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-emerald-200 bg-white px-2.5 py-1.5 text-xs font-extrabold text-emerald-700 disabled:opacity-60"
                          >
                            <Clipboard size={13} />
                            Copy
                          </button>
                        </div>
                        <code className="mt-2 block break-all rounded-lg bg-white px-2 py-2 text-xs font-bold text-gray-800">
                          {completedWebhookUrl || "Webhook URL will appear after settings load"}
                        </code>
                      </div>
                    </div>

                    <div className="rounded-xl border border-blue-100 bg-white p-3 text-xs font-semibold text-blue-900">
                      <p className="font-extrabold">After setup</p>
                      <p className="mt-1">Incoming calls appear in Call Logs, unknown numbers become phone leads, existing contacts are linked automatically, and missed/no-answer calls create follow-up task and notification.</p>
                      <p className="mt-2 text-blue-700">Outbound click-to-call callbacks are sent automatically by CRM. These URLs are mainly for incoming calls on the provider number.</p>
                    </div>
                  </div>
                )}
              </div>

              <label className="space-y-1 text-sm font-semibold text-gray-700">
                {activeProvider.tokenLabel || "API Token"}
                <input
                  type="password"
                  value={config.apiToken}
                  onChange={(event) => updateConfig("apiToken", event.target.value)}
                  placeholder={hasToken ? "Saved token hidden" : "Provider API token"}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </label>

              <label className="space-y-1 text-sm font-semibold text-gray-700">
                Webhook Secret
                <input
                  type="password"
                  value={config.webhookSecret}
                  onChange={(event) => updateConfig("webhookSecret", event.target.value)}
                  placeholder={hasWebhookSecret ? "Saved secret hidden" : "Optional callback verification secret"}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </label>

              <label className="space-y-1 text-sm font-semibold text-gray-700">
                {activeProvider.callerLabel || "Caller ID"}
                <input
                  value={config.callerId}
                  onChange={(event) => updateConfig("callerId", event.target.value)}
                  placeholder="+91..."
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </label>

              <label className="space-y-1 text-sm font-semibold text-gray-700">
                {activeProvider.inboundLabel || "Inbound Number"}
                <input
                  value={config.inboundNumber}
                  onChange={(event) => updateConfig("inboundNumber", event.target.value)}
                  placeholder="+91..."
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </label>

              <div className={`rounded-xl border p-4 ${
                config.active ? "border-emerald-100 bg-emerald-50" : "border-gray-200 bg-gray-50"
              }`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-gray-950">Provider status</p>
                    <p className="mt-1 text-xs font-semibold text-gray-500">
                      {config.active
                        ? `${activeProvider.label} is active. Deactivate it before switching provider.`
                        : "Inactive. You can switch provider or save this provider as active."}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => updateConfig("active", !config.active)}
                    className={`shrink-0 rounded-lg px-3 py-2 text-xs font-black ${
                      config.active
                        ? "bg-red-100 text-red-700 hover:bg-red-200"
                        : "bg-emerald-600 text-white hover:bg-emerald-700"
                    }`}
                  >
                    {config.active ? "Deactivate" : "Make active"}
                  </button>
                </div>
              </div>

              <div className={`rounded-xl border p-4 ${
                config.clickToCallEnabled ? "border-blue-100 bg-blue-50" : "border-gray-200 bg-gray-50"
              }`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-gray-950">Click-to-call</p>
                    <p className="mt-1 text-xs font-semibold text-gray-500">
                      {config.clickToCallEnabled
                        ? "Agents can start calls from Contact, Chat, Opportunity, and Telephony."
                        : "Keep off while credentials are incomplete."}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => updateConfig("clickToCallEnabled", !config.clickToCallEnabled)}
                    className={`shrink-0 rounded-lg px-3 py-2 text-xs font-black ${
                      config.clickToCallEnabled
                        ? "bg-blue-600 text-white hover:bg-blue-700"
                        : "bg-white text-gray-700 ring-1 ring-gray-200 hover:bg-gray-100"
                    }`}
                  >
                    {config.clickToCallEnabled ? "Enabled" : "Enable"}
                  </button>
                </div>
              </div>

              <label className="space-y-1 text-sm font-semibold text-gray-700 md:col-span-2">
                Internal notes
                <textarea
                  value={config.notes}
                  onChange={(event) => updateConfig("notes", event.target.value)}
                  rows={3}
                  placeholder="Example: Exotel number, support contact, provider account owner."
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </label>

              <div className="md:col-span-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-extrabold text-white hover:bg-teal-700 disabled:opacity-60"
                >
                  <Save size={16} />
                  {saving ? "Saving..." : "Save telephony settings"}
                </button>
              </div>
            </form>
          </section>

        </div>

        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <button
            type="button"
            onClick={() => setReportOpen((current) => !current)}
            className="flex w-full items-center justify-between gap-3 text-left"
          >
            <div>
              <div className="flex items-center gap-2 text-sm font-extrabold text-gray-950">
                <Headphones size={18} />
                Health & Call Report
              </div>
              <p className="mt-1 text-sm text-gray-500">
                View webhook health, call performance, recordings, transcripts, and tracked minutes only when needed.
              </p>
            </div>
            <span className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-black ${healthTone(health?.status)}`}>
              {String(health?.status || "Loading").replaceAll("_", " ")}
              {reportOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            </span>
          </button>

          {reportOpen && (
            <div className="mt-5 grid gap-4 lg:grid-cols-[1.2fr_2fr]">
              <div className={`rounded-2xl border p-5 ${healthTone(health?.status)}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-extrabold uppercase tracking-wide">Telephony health</p>
                    <h2 className="mt-2 text-xl font-black">{String(health?.status || "Loading").replaceAll("_", " ")}</h2>
                  </div>
                  <Headphones size={22} />
                </div>
                <p className="mt-3 text-sm font-semibold leading-6">{health?.recommendation || "Checking provider callbacks and recording status..."}</p>
                <div className="mt-4 grid grid-cols-2 gap-2 text-xs font-bold">
                  <div className="rounded-lg bg-white/70 p-3">
                    <p className="text-gray-500">Webhook events</p>
                    <p className="mt-1 text-lg text-gray-950">{health?.totalWebhookEvents ?? 0}</p>
                  </div>
                  <div className="rounded-lg bg-white/70 p-3">
                    <p className="text-gray-500">Failed callbacks</p>
                    <p className="mt-1 text-lg text-gray-950">{health?.failedWebhookEvents ?? 0}</p>
                  </div>
                  <div className="rounded-lg bg-white/70 p-3">
                    <p className="text-gray-500">Recordings</p>
                    <p className="mt-1 text-lg text-gray-950">{health?.recordingAvailableCount ?? 0}</p>
                  </div>
                  <div className="rounded-lg bg-white/70 p-3">
                    <p className="text-gray-500">Missing rec.</p>
                    <p className="mt-1 text-lg text-gray-950">{health?.recordingMissingTerminalCount ?? 0}</p>
                  </div>
                </div>
                {health?.lastWebhookFailure && (
                  <p className="mt-3 rounded-lg bg-white/70 p-3 text-xs font-semibold leading-5 text-red-700">
                    Last failure: {health.lastWebhookFailure}
                  </p>
                )}
              </div>

              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-extrabold uppercase tracking-wide text-gray-500">Call report</p>
                    <h2 className="mt-1 text-xl font-black text-gray-950">Current filter performance</h2>
                  </div>
                  <p className="text-xs font-semibold text-gray-500">Uses selected agent and date range</p>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {[
                    ["Total calls", report?.totalCalls ?? 0],
                    ["Answered", report?.answeredCalls ?? 0],
                    ["Missed / busy", report?.missedCalls ?? 0],
                    ["Failed", report?.failedCalls ?? 0],
                    ["Inbound", report?.inboundCalls ?? 0],
                    ["Outbound", report?.outboundCalls ?? 0],
                    ["Transcripts", report?.transcriptsGenerated ?? 0],
                    ["Follow-up tasks", report?.followUpTasksCreated ?? 0],
                    ["Call minutes", report?.callMinutesUsedThisMonth ?? 0],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-xl border border-gray-100 bg-white p-3">
                      <p className="text-xs font-bold text-gray-500">{label}</p>
                      <p className="mt-1 text-2xl font-black text-gray-950">{value}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-3 rounded-xl border border-violet-100 bg-violet-50 p-3 text-violet-800">
                  <p className="text-xs font-bold">Tracked call minutes</p>
                  <p className="mt-1 text-lg font-black">
                    {report?.callMinutesLimit
                      ? `${report.callMinutesUsedThisMonth || 0} / ${report.callMinutesLimit} minutes used`
                      : `${report?.callMinutesUsedThisMonth || 0} minutes used`}
                  </p>
                  <p className="mt-1 text-xs font-semibold">
                    Reporting only. Exotel, Twilio, or Plivo charges are billed separately by the provider.
                  </p>
                </div>
              </div>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-extrabold text-gray-950">
                <ListChecks size={18} />
                Optional Call Automation Starters
              </div>
              <p className="mt-1 max-w-3xl text-sm text-gray-500">
                This creates editable Automation Rules for common call outcomes. Nothing runs until the rules are created and active.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setAutomationOpen((current) => !current)}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-extrabold text-gray-700 hover:bg-gray-50"
              >
                {automationOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                {automationOpen ? "Hide details" : "View starters"}
              </button>
              <button
                type="button"
                onClick={installCallAutomationTemplates}
                disabled={installingTemplates}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-gray-950 px-4 py-2 text-sm font-extrabold text-white hover:bg-gray-800 disabled:opacity-60"
              >
                <ListChecks size={16} />
                {installingTemplates ? "Creating rules..." : "Create starter rules"}
              </button>
            </div>
          </div>

          {automationInstallResult && (
            <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-800">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="font-black">{automationInstallResult.message}</p>
                  <p className="mt-1 font-semibold">
                    Go to Automation Rules to check the new call rules. From there you can activate, pause, edit actions, or delete rules.
                  </p>
                </div>
                <Link
                  to="/dashboard/automation-rules"
                  className="inline-flex shrink-0 items-center justify-center rounded-lg bg-emerald-700 px-4 py-2 text-sm font-black text-white hover:bg-emerald-800"
                >
                  Open Automation Rules
                </Link>
              </div>
            </div>
          )}

          {automationOpen && (
            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <div className="rounded-xl border border-red-100 bg-red-50 p-4">
                <p className="text-sm font-extrabold text-red-800">Missed / no-answer call</p>
                <p className="mt-1 text-sm text-red-700">Creates a callback task due in 2 hours when call status becomes No Answer.</p>
              </div>
              <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4">
                <p className="text-sm font-extrabold text-emerald-800">Interested call</p>
                <p className="mt-1 text-sm text-emerald-700">Creates a sales follow-up task due in 4 hours when outcome is Interested.</p>
              </div>
              <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
                <p className="text-sm font-extrabold text-blue-800">Call back later</p>
                <p className="mt-1 text-sm text-blue-700">Notifies the assigned agent when a call is marked Call Back Later.</p>
              </div>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-lg font-extrabold text-gray-950">Agent Phone Mapping</h2>
              <p className="mt-1 text-sm text-gray-500">
                Map each CRM user to their calling number once. Contact, Opportunity, and Chat call buttons will use this automatically.
              </p>
            </div>
            <button
              type="button"
              onClick={loadAgentMappings}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50"
            >
              <RefreshCw size={15} />
              Refresh agents
            </button>
          </div>

          <form onSubmit={saveAgentMapping} className="grid gap-3 rounded-xl border border-gray-100 bg-gray-50 p-3 lg:grid-cols-[minmax(0,1fr)_220px_110px_auto] lg:items-end">
            <label className="space-y-1 text-sm font-semibold text-gray-700">
              User / Agent
              <select
                value={mappingForm.userId}
                onChange={(event) => {
                  const existing = agentMappings.find((mapping) => String(mapping.userId) === event.target.value);
                  setMappingForm({
                    userId: event.target.value,
                    phoneNumber: existing?.phoneNumber || "",
                    active: existing?.active ?? true,
                  });
                }}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">Select user</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.email} ({user.role})
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm font-semibold text-gray-700">
              Calling Number
              <input
                value={mappingForm.phoneNumber}
                onChange={(event) => setMappingForm((current) => ({ ...current, phoneNumber: event.target.value }))}
                placeholder="+91..."
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700">
              <input
                type="checkbox"
                checked={mappingForm.active}
                onChange={(event) => setMappingForm((current) => ({ ...current, active: event.target.checked }))}
                className="h-4 w-4"
              />
              Active
            </label>
            <button
              type="submit"
              disabled={savingMapping}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-extrabold text-white hover:bg-teal-700 disabled:opacity-60"
            >
              <Save size={15} />
              {savingMapping ? "Saving..." : "Save mapping"}
            </button>
          </form>

          <div className="mt-4 overflow-hidden rounded-xl border border-gray-200">
            <div className="hidden grid-cols-[minmax(0,1fr)_160px_90px_90px] gap-3 bg-gray-50 px-4 py-2 text-xs font-extrabold uppercase tracking-wide text-gray-500 md:grid">
              <span>Agent</span>
              <span>Calling number</span>
              <span>Status</span>
              <span>Action</span>
            </div>
            {agentMappings.length === 0 ? (
              <div className="p-5 text-sm text-gray-500">
                No agent numbers mapped yet.
              </div>
            ) : (
              agentMappings.map((mapping) => (
                <button
                  key={mapping.id || mapping.userId}
                  type="button"
                  onClick={() => setMappingForm({
                    userId: String(mapping.userId),
                    phoneNumber: mapping.phoneNumber || "",
                    active: mapping.active !== false,
                  })}
                  className="grid w-full gap-2 border-t border-gray-100 px-4 py-3 text-left text-sm hover:bg-teal-50 md:grid-cols-[minmax(0,1fr)_160px_90px_90px] md:items-center"
                >
                  <div className="min-w-0">
                    <p className="truncate font-extrabold text-gray-950">{mapping.userEmail || `User #${mapping.userId}`}</p>
                    <p className="text-xs font-semibold uppercase text-gray-500">{mapping.userRole || "USER"}</p>
                  </div>
                  <p className="font-bold text-gray-800">{mapping.phoneNumber || "Not mapped"}</p>
                  <span className={`w-fit rounded-full px-2 py-1 text-[10px] font-extrabold ${
                    mapping.active === false ? "bg-gray-200 text-gray-600" : "bg-emerald-50 text-emerald-700"
                  }`}>
                    {mapping.active === false ? "Inactive" : "Active"}
                  </span>
                  <span className="text-xs font-extrabold text-teal-700">Edit</span>
                </button>
              ))
            )}
          </div>
        </section>

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-5">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-50 text-violet-700">
                  <PhoneCall size={24} />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-slate-950">Call Logs</h2>
                  <p className="mt-1 text-sm font-semibold text-slate-500">Showing {pageInfo.totalElements} tracked calls.</p>
                </div>
              </div>

              <div className="flex flex-col gap-3 xl:items-end">
                <div className="flex flex-wrap gap-2">
                  {["7D", "30D", "90D", "ALL"].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => {
                        setCallDatePreset(preset);
                        setDateRange(presetDateRange(preset));
                      }}
                      className={`rounded-lg border px-4 py-2 text-sm font-black ${
                        callDatePreset === preset
                          ? "border-violet-300 bg-violet-50 text-violet-700"
                          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {preset === "ALL" ? "All" : preset}
                    </button>
                  ))}
                </div>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <label className="block text-xs font-black uppercase tracking-wide text-slate-500">
                    From
                    <input
                      type="date"
                      value={dateRange.fromDate || ""}
                      onChange={(event) => {
                        setCallDatePreset("CUSTOM");
                        setDateRange((current) => ({ ...current, fromDate: event.target.value }));
                      }}
                      className="mt-1 block min-h-11 rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold normal-case tracking-normal text-slate-800 outline-none focus:border-violet-400"
                    />
                  </label>
                  <label className="block text-xs font-black uppercase tracking-wide text-slate-500">
                    To
                    <input
                      type="date"
                      value={dateRange.toDate || ""}
                      onChange={(event) => {
                        setCallDatePreset("CUSTOM");
                        setDateRange((current) => ({ ...current, toDate: event.target.value }));
                      }}
                      className="mt-1 block min-h-11 rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold normal-case tracking-normal text-slate-800 outline-none focus:border-violet-400"
                    />
                  </label>
                </div>
              </div>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <CallStatCard tone="emerald" icon="OK" label="Completed" value={callLogStats.completed} percent={callLogStats.percent(callLogStats.completed)} />
              <CallStatCard tone="amber" icon="R" label="Ringing" value={callLogStats.ringing} percent={callLogStats.percent(callLogStats.ringing)} />
              <CallStatCard tone="red" icon="X" label="No Answer" value={callLogStats.noAnswer} percent={callLogStats.percent(callLogStats.noAnswer)} />
              <CallStatCard tone="blue" icon="VM" label="Voicemail" value={callLogStats.voicemail} percent={callLogStats.percent(callLogStats.voicemail)} />
              <CallStatCard
                tone={callLogStats.pending ? "red" : "slate"}
                icon="!"
                label={`${callLogStats.pending} recordings pending`}
                value=""
                helper={callLogStats.pending ? "Recordings are being processed." : "No pending recordings in this view."}
                action={callLogStats.pending ? (
                  <button type="button" onClick={() => setStatus("RINGING")} className="text-xs font-black text-violet-700 hover:text-violet-800">
                    View pending
                  </button>
                ) : null}
              />
            </div>

            <div className="mt-5 grid gap-3 lg:grid-cols-[170px_190px_minmax(180px,1fr)_120px]">
              <label className="space-y-1 text-sm font-semibold text-slate-700">
                Status
                <select
                  value={status}
                  onChange={(event) => setStatus(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold outline-none focus:border-violet-400"
                >
                  {statusOptions.map((option) => (
                    <option key={option} value={option}>{option.replace("_", " ")}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-sm font-semibold text-slate-700">
                Outcome
                <select
                  value={disposition}
                  onChange={(event) => setDisposition(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold outline-none focus:border-violet-400"
                >
                  <option value="ALL">All outcomes</option>
                  {dispositionOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-sm font-semibold text-slate-700">
                Agent
                <select
                  value={agentUserId}
                  onChange={(event) => setAgentUserId(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold outline-none focus:border-violet-400"
                >
                  <option value="">All agents</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.email || user.name || `User #${user.id}`}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-sm font-semibold text-slate-700">
                Per page
                <select
                  value={pageInfo.size}
                  onChange={(event) => changeCallPageSize(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold outline-none focus:border-violet-400"
                >
                  {[10, 25, 50, 100].map((size) => (
                    <option key={size} value={size}>{size}</option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <div className="overflow-x-auto">
            <div className="min-w-[1420px]">
              <div className="grid grid-cols-[140px_150px_190px_180px_100px_230px_150px_120px_210px] gap-4 border-b border-slate-100 bg-slate-50 px-4 py-4 text-xs font-black uppercase tracking-wide text-slate-500">
                <span>Status</span>
                <span>Provider</span>
                <span>Customer</span>
                <span>Agent</span>
                <span>Duration</span>
                <span>Recording</span>
                <span>Outcome</span>
                <span>Created</span>
                <span>Action</span>
              </div>

            {loading ? (
              <div className="p-6 text-sm text-gray-500">Loading calls...</div>
            ) : calls.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-500">
                No call logs yet. Start with a test click-to-call after saving provider settings.
              </div>
            ) : (
              calls.map((call) => {
                const meta = statusMeta(call.status);
                return (
                <div key={call.id} className="grid min-h-[126px] grid-cols-[140px_150px_190px_180px_100px_230px_150px_120px_210px] gap-4 border-b border-slate-100 px-4 py-5 text-sm last:border-b-0">
                  <div>
                    <span className={`inline-flex items-center gap-2 rounded-lg border px-2.5 py-2 text-xs font-black uppercase ${meta.tone}`}>
                      <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-white/80 text-[10px]">{meta.icon}</span>
                      {meta.label}
                    </span>
                    {call.failureReason && <p className="mt-2 text-xs text-red-600">{call.failureReason}</p>}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 font-black text-slate-900">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-50 text-[11px] font-black text-red-600">
                        {String(call.provider || "?").slice(0, 1)}
                      </span>
                      {call.provider || "-"}
                    </div>
                    <p className="mt-1 text-xs font-semibold text-slate-500">{call.fromNumber || call.toNumber || "-"}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-black text-slate-950">{call.customerNumber || call.toNumber || "-"}</p>
                    {call.contactId && (
                      <p className="mt-1 text-xs font-bold text-emerald-700">
                        {String(call.direction || "").toUpperCase() === "INBOUND" ? "Phone lead linked" : "Contact"} #{call.contactId}
                      </p>
                    )}
                    {!call.contactId && String(call.direction || "").toUpperCase() === "INBOUND" && (
                      <p className="mt-1 rounded-lg bg-amber-50 px-2 py-1 text-xs font-bold leading-5 text-amber-700">Unknown inbound caller - create or link lead</p>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-black text-slate-950">{call.agentNumber || call.fromNumber || "-"}</p>
                    {call.userId && <p className="mt-1 text-xs font-semibold text-slate-500">User #{call.userId}</p>}
                  </div>
                  <div>
                    <p className="font-black text-slate-800">{call.durationSeconds ? `${call.durationSeconds}s` : "-"}</p>
                  </div>
                  <div>
                    {call.recordingUrl ? (
                      <CallRecordingPlayer recordingUrl={call.recordingUrl} callId={call.id} compact />
                    ) : (
                      <div className={`rounded-xl border p-3 ${recordingBadge(call).tone}`}>
                        <p className="text-sm font-black">{recordingBadge(call).label}</p>
                        <p className="mt-2 text-xs font-semibold leading-5">
                          {["NO_ANSWER", "MISSED", "BUSY", "FAILED"].includes(String(call.status || "").toUpperCase())
                            ? "Call was not answered."
                            : "Please wait while we process the recording."}
                        </p>
                      </div>
                    )}
                  </div>
                  <div>
                    <span className={`inline-flex rounded-full border px-3 py-1.5 text-xs font-black ${
                      call.disposition ? "border-indigo-100 bg-indigo-50 text-indigo-700" : "border-gray-100 bg-gray-50 text-gray-500"
                    }`}>
                      {dispositionLabel(call.disposition)}
                    </span>
                    {call.followUpTaskId && <p className="mt-1 text-xs text-gray-500">Task #{call.followUpTaskId}</p>}
                    {call.notes && <p className="mt-1 line-clamp-2 text-xs text-gray-500">{call.notes}</p>}
                    {call.nextActionHint && (
                      <p className="mt-2 rounded-lg bg-sky-50 px-2 py-1 text-xs font-semibold leading-5 text-sky-700">
                        {call.nextActionHint}
                      </p>
                    )}
                  </div>
                  <div className="text-xs font-semibold leading-5 text-slate-500">{formatDateTime(call.createdAt)}</div>
                  <div>
                    <div className="space-y-2">
                      {!call.contactId && String(call.direction || "").toUpperCase() === "INBOUND" && (
                        <button
                          type="button"
                          onClick={() => openLeadForm(call)}
                          className="inline-flex min-h-8 w-full items-center justify-center gap-1.5 rounded-lg border border-teal-200 bg-teal-50 px-2.5 py-1.5 text-xs font-black text-teal-700 hover:bg-teal-100"
                        >
                          <UserPlus size={14} />
                          Create lead
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => openDispositionForm(call)}
                        className="inline-flex min-h-8 w-full items-center justify-center rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-black text-slate-700 hover:bg-slate-50"
                      >
                        Outcome
                      </button>
                    </div>
                    <AiCallSummaryButton
                      callId={call.id}
                      contactId={call.contactId}
                      opportunityId={call.opportunityId}
                      compact
                      onSaved={() => setInfo("AI call summary saved as a CRM note.")}
                    />
                    <CallTranscriptButton
                      callId={call.id}
                      recordingUrl={call.recordingUrl}
                      transcriptText={call.transcriptText}
                      transcriptStatus={call.transcriptStatus}
                      transcriptError={call.transcriptError}
                      transcriptProvider={call.transcriptProvider}
                      transcriptModel={call.transcriptModel}
                      compact
                      onDone={() => {
                        setInfo("Call transcript generated.");
                        loadCalls(pageInfo.page);
                      }}
                    />
                    <AiCallActionPanel
                      callId={call.id}
                      contactId={call.contactId}
                      opportunityId={call.opportunityId}
                      compact
                      onSaved={() => {
                        setInfo("AI call note/task saved.");
                        loadCalls(pageInfo.page);
                      }}
                    />
                  </div>
                </div>
                );
              })
            )}
            </div>
          </div>

          <div className="flex flex-col gap-4 border-t border-slate-100 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
            <p className="text-sm font-semibold text-slate-500">
              Showing {pageInfo.totalElements === 0 ? 0 : pageInfo.page * pageInfo.size + 1}
              -{Math.min((pageInfo.page + 1) * pageInfo.size, pageInfo.totalElements)} of {pageInfo.totalElements} calls
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={pageInfo.page <= 0 || loading}
                onClick={() => loadCalls(pageInfo.page - 1)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-700 disabled:opacity-50"
              >
                &lt;
              </button>
              {pageNumbers(pageInfo.page, pageInfo.totalPages).map((pageNumber, index, pages) => (
                <div key={pageNumber} className="flex items-center gap-2">
                  {index > 0 && pageNumber - pages[index - 1] > 1 && <span className="px-1 text-sm font-black text-slate-400">...</span>}
                  <button
                    type="button"
                    onClick={() => loadCalls(pageNumber)}
                    disabled={loading}
                    className={`min-w-10 rounded-lg border px-3 py-2 text-sm font-black ${
                      pageInfo.page === pageNumber
                        ? "border-violet-300 bg-violet-50 text-violet-700"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    } disabled:opacity-50`}
                  >
                    {pageNumber + 1}
                  </button>
                </div>
              ))}
              <button
                type="button"
                disabled={pageInfo.page + 1 >= pageInfo.totalPages || loading}
                onClick={() => loadCalls(pageInfo.page + 1)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-700 disabled:opacity-50"
              >
                &gt;
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-lg font-extrabold text-gray-950">{activeProvider.label} Webhook Diagnostics</h2>
              <p className="mt-1 text-sm text-gray-500">
                Use this when incoming calls are visible in Exotel but not syncing correctly in CRM.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setDiagnosticsOpen((current) => !current)}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-extrabold text-gray-700 hover:bg-gray-50"
              >
                {diagnosticsOpen ? "Hide diagnostics" : "Show diagnostics"}
              </button>
              {diagnosticsOpen && (
                <button
                  type="button"
                  onClick={loadWebhookDiagnostics}
                  disabled={webhookLoading}
                  className="inline-flex items-center gap-2 rounded-lg bg-gray-950 px-3 py-2 text-sm font-extrabold text-white hover:bg-gray-800 disabled:opacity-60"
                >
                  <RefreshCw size={15} />
                  {webhookLoading ? "Refreshing..." : "Refresh"}
                </button>
              )}
            </div>
          </div>

          {diagnosticsOpen && (
            <div className="mt-4">
              <div className={`mb-3 rounded-xl border p-4 ${webhookStatus.tone}`}>
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-sm font-extrabold">{webhookStatus.label}</p>
                    <p className="mt-1 text-sm font-semibold">{webhookStatus.message}</p>
                  </div>
                  <div className="rounded-lg bg-white/70 px-3 py-2 text-sm font-extrabold">
                    {webhookPageInfo.totalElements} total callback{webhookPageInfo.totalElements === 1 ? "" : "s"}
                  </div>
                </div>
              </div>

              <div className="mb-3 grid gap-3 md:grid-cols-3">
                <div className="rounded-xl border border-gray-200 bg-white p-3">
                  <p className="text-xs font-extrabold uppercase tracking-wide text-gray-500">Latest Callback</p>
                  <p className="mt-1 text-sm font-bold text-gray-900">{formatDateTime(webhookEvents[0]?.createdAt)}</p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-white p-3">
                  <p className="text-xs font-extrabold uppercase tracking-wide text-gray-500">Latest Status</p>
                  <p className="mt-1 text-sm font-bold text-gray-900">{webhookEvents[0]?.status || "No callback"}</p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-white p-3">
                  <p className="text-xs font-extrabold uppercase tracking-wide text-gray-500">Latest Failure</p>
                  <p className="mt-1 line-clamp-2 text-sm font-bold text-gray-900">
                    {webhookEvents.find((event) => event.status === "FAILED")?.errorMessage || "No recent failure"}
                  </p>
                </div>
              </div>

              <div className="mb-3 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
                <p className="font-extrabold text-gray-950">Test checklist</p>
                <div className="mt-2 grid gap-2 md:grid-cols-3">
                  <span className="rounded-lg bg-white px-3 py-2 font-semibold">1. Call the {activeProvider.label} inbound number.</span>
                  <span className="rounded-lg bg-white px-3 py-2 font-semibold">2. Refresh diagnostics after 5-10 seconds.</span>
                  <span className="rounded-lg bg-white px-3 py-2 font-semibold">3. Confirm status becomes Processed.</span>
                </div>
              </div>

              {webhookLoading ? (
                <div className="rounded-xl border border-dashed border-gray-200 p-6 text-sm text-gray-500">Loading webhook callbacks...</div>
              ) : webhookEvents.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-200 p-6 text-center text-sm text-gray-500">
                  No {activeProvider.label} webhook callbacks received yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {webhookEvents.map((event) => (
                    <div key={event.id} className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`rounded-full px-2.5 py-1 text-xs font-extrabold ${
                              event.status === "PROCESSED" ? "bg-emerald-50 text-emerald-700" : event.status === "FAILED" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"
                            }`}>
                              {event.status || "RECEIVED"}
                            </span>
                            <span className="text-xs font-bold text-gray-500">{event.provider}</span>
                            <span className="text-xs text-gray-400">#{event.id}</span>
                          </div>
                          <p className="mt-2 text-sm font-semibold text-gray-800">{formatDateTime(event.createdAt)}</p>
                          {event.errorMessage && <p className="mt-2 text-sm text-red-600">{event.errorMessage}</p>}
                        </div>
                        <div className="text-xs text-gray-500">
                          Processed: {formatDateTime(event.processedAt)}
                        </div>
                      </div>
                      <details className="mt-3">
                        <summary className="cursor-pointer text-xs font-extrabold uppercase tracking-wide text-gray-500">
                          View callback payload
                        </summary>
                        <pre className="mt-2 max-h-72 overflow-auto rounded-lg bg-gray-950 p-3 text-xs leading-5 text-gray-100">
                          {prettyPayload(event.payload)}
                        </pre>
                      </details>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      {testCallOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-gray-950/40 px-4 py-4 sm:items-center">
          <form
            onSubmit={startCall}
            className="w-full max-w-lg rounded-2xl border border-gray-200 bg-white p-5 shadow-xl"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-sm font-extrabold text-gray-950">
                  <PhoneCall size={18} />
                  Test Click-to-Call
                </div>
                <p className="mt-1 text-sm text-gray-500">
                  Twilio first rings the agent, then bridges the customer. Leave agent number blank to use the logged-in user's mapped number.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setTestCallOpen(false)}
                className="rounded-lg border border-gray-200 bg-white p-2 text-gray-500 hover:bg-gray-50"
              >
                <X size={16} />
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1 text-sm font-semibold text-gray-700">
                Contact ID
                <input
                  value={callForm.contactId}
                  onChange={(event) => setCallForm((current) => ({ ...current, contactId: event.target.value }))}
                  inputMode="numeric"
                  placeholder="Optional"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="space-y-1 text-sm font-semibold text-gray-700">
                Customer number to connect after agent answers
                <input
                  value={callForm.customerNumber}
                  onChange={(event) => setCallForm((current) => ({ ...current, customerNumber: event.target.value }))}
                  placeholder="+91 customer number"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="space-y-1 text-sm font-semibold text-gray-700">
                Agent number that rings first
                <input
                  value={callForm.agentNumber}
                  onChange={(event) => setCallForm((current) => ({ ...current, agentNumber: event.target.value }))}
                  placeholder="Optional if mapped, e.g. +919867310179"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
                <span className="block text-xs font-normal leading-5 text-gray-500">
                  Do not enter the customer number here. This should be your agent phone.
                </span>
              </label>
              <label className="space-y-1 text-sm font-semibold text-gray-700 sm:col-span-2">
                Notes
                <textarea
                  value={callForm.notes}
                  onChange={(event) => setCallForm((current) => ({ ...current, notes: event.target.value }))}
                  rows={3}
                  placeholder="Purpose of test call"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </label>
            </div>

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setTestCallOpen(false)}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={calling}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-gray-950 px-4 py-2 text-sm font-extrabold text-white hover:bg-gray-800 disabled:opacity-60"
              >
                <Phone size={16} />
                {calling ? "Starting..." : "Start tracked call"}
              </button>
            </div>
          </form>
        </div>
      )}

      {leadForm.callLogId && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-gray-950/40 px-4 py-4 sm:items-center">
          <form
            onSubmit={createLeadFromCall}
            className="w-full max-w-lg rounded-2xl border border-gray-200 bg-white p-5 shadow-xl"
          >
            <div className="mb-4">
              <h2 className="text-lg font-extrabold text-gray-950">Create lead from call</h2>
              <p className="mt-1 text-sm text-gray-500">
                This will create a contact, mark the source as Phone Call, and link the call history to that contact.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1 text-sm font-semibold text-gray-700 sm:col-span-2">
                Lead name
                <input
                  value={leadForm.name}
                  onChange={(event) => setLeadForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder="Lead name"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="space-y-1 text-sm font-semibold text-gray-700">
                Email
                <input
                  type="email"
                  value={leadForm.email}
                  onChange={(event) => setLeadForm((current) => ({ ...current, email: event.target.value }))}
                  placeholder="Optional"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="space-y-1 text-sm font-semibold text-gray-700">
                City
                <input
                  value={leadForm.city}
                  onChange={(event) => setLeadForm((current) => ({ ...current, city: event.target.value }))}
                  placeholder="Optional"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="space-y-1 text-sm font-semibold text-gray-700 sm:col-span-2">
                Tags
                <input
                  value={leadForm.tags}
                  onChange={(event) => setLeadForm((current) => ({ ...current, tags: event.target.value }))}
                  placeholder="Phone Call"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </label>
            </div>

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setLeadForm({ callLogId: null, name: "", email: "", city: "", tags: "Phone Call" })}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creatingLead}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-extrabold text-white hover:bg-teal-700 disabled:opacity-60"
              >
                <UserPlus size={16} />
                {creatingLead ? "Creating..." : "Create lead"}
              </button>
            </div>
          </form>
        </div>
      )}

      {dispositionForm.callId && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-gray-950/40 px-4 py-4 sm:items-center">
          <form
            onSubmit={saveDisposition}
            className="w-full max-w-xl rounded-2xl border border-gray-200 bg-white p-5 shadow-xl"
          >
            <div className="mb-4">
              <h2 className="text-lg font-extrabold text-gray-950">Update call outcome</h2>
              <p className="mt-1 text-sm text-gray-500">
                Capture what happened on the call and create a follow-up task when needed.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1 text-sm font-semibold text-gray-700 sm:col-span-2">
                Outcome
                <select
                  value={dispositionForm.disposition}
                  onChange={(event) => setDispositionForm((current) => ({ ...current, disposition: event.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                >
                  {dispositionOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>

              <div className={`rounded-xl border p-3 text-sm font-semibold leading-6 sm:col-span-2 ${outcomeGuidance(dispositionForm.disposition).tone}`}>
                <p className="font-extrabold">{outcomeGuidance(dispositionForm.disposition).title}</p>
                <p className="mt-1">{outcomeGuidance(dispositionForm.disposition).body}</p>
              </div>

              <label className="space-y-1 text-sm font-semibold text-gray-700 sm:col-span-2">
                Call notes
                <div className="mb-2 flex flex-wrap gap-2">
                  {callNoteChips.map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => addDispositionNote(chip)}
                      className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-bold text-gray-700 hover:border-teal-200 hover:bg-teal-50 hover:text-teal-700"
                    >
                      {chip}
                    </button>
                  ))}
                </div>
                <textarea
                  value={dispositionForm.notes}
                  onChange={(event) => setDispositionForm((current) => ({ ...current, notes: event.target.value }))}
                  rows={4}
                  placeholder="Example: Customer asked for pricing, wants callback tomorrow."
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </label>

              {dispositionForm.disposition === "CALL_BACK_LATER" && (
                <>
                  <label className="space-y-1 text-sm font-semibold text-gray-700">
                    Follow-up date and time
                    <input
                      type="datetime-local"
                      value={toDateTimeInput(dispositionForm.followUpAt)}
                      onChange={(event) => setDispositionForm((current) => ({ ...current, followUpAt: event.target.value }))}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="space-y-1 text-sm font-semibold text-gray-700">
                    Task title
                    <input
                      value={dispositionForm.followUpTitle}
                      onChange={(event) => setDispositionForm((current) => ({ ...current, followUpTitle: event.target.value }))}
                      placeholder="Call back lead"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    />
                  </label>
                </>
              )}
            </div>

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setDispositionForm({ callId: null, disposition: "INTERESTED", notes: "", followUpAt: "", followUpTitle: "Call back lead" })}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingDisposition}
                className="inline-flex items-center justify-center rounded-lg bg-gray-950 px-4 py-2 text-sm font-extrabold text-white hover:bg-gray-800 disabled:opacity-60"
              >
                {savingDisposition ? "Saving..." : "Save outcome"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
