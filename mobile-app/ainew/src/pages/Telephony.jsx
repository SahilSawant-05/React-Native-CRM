import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clipboard,
  Headphones,
  ListChecks,
  Phone,
  PhoneCall,
  RefreshCw,
  Save,
  Settings,
  UserPlus,
} from "lucide-react";
import api from "../api/axios";
import DateRangeFilter, { dateRangeParams, presetDateRange } from "../components/common/DateRangeFilter";
import CallRecordingPlayer from "../components/common/CallRecordingPlayer";
import AiCallActionPanel from "../components/ai/AiCallActionPanel";
import AiCallSummaryButton from "../components/ai/AiCallSummaryButton";
import CallTranscriptButton from "../components/ai/CallTranscriptButton";

const providerOptions = [
  { value: "EXOTEL", label: "Exotel", hint: "Best first choice for India calling." },
  { value: "TWILIO", label: "Twilio", hint: "Good for Canada and international calling." },
  { value: "PLIVO", label: "Plivo", hint: "Flexible provider for international calling." },
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

const defaultConfig = {
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

function statusClass(status) {
  const normalized = String(status || "").toUpperCase();
  if (["COMPLETED", "ANSWERED"].includes(normalized)) return "bg-emerald-50 text-emerald-700 border-emerald-100";
  if (["FAILED", "MISSED", "BUSY", "NO_ANSWER"].includes(normalized)) return "bg-red-50 text-red-700 border-red-100";
  if (["QUEUED", "RINGING", "REQUESTED"].includes(normalized)) return "bg-amber-50 text-amber-700 border-amber-100";
  return "bg-gray-50 text-gray-700 border-gray-100";
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
  const noAnswerWebhookUrl = config.inboundWebhookUrl ? `${config.inboundWebhookUrl}?Status=NO_ANSWER` : "";
  const completedWebhookUrl = config.inboundWebhookUrl ? `${config.inboundWebhookUrl}?Status=COMPLETED` : "";
  const webhookStatus = useMemo(
    () => webhookHealth(webhookEvents, webhookPageInfo.totalElements),
    [webhookEvents, webhookPageInfo.totalElements]
  );

  const loadConfig = async () => {
    try {
      const response = await api.get("/api/telephony/config");
      const data = response.data || {};
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
          provider: "TELEPHONY_EXOTEL",
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
  }, [diagnosticsOpen]);

  useEffect(() => {
    loadCalls(0);
    loadTelephonySummary();
  }, [status, disposition, agentUserId, dateRange.fromDate, dateRange.toDate]);

  const updateConfig = (field, value) => {
    setConfig((current) => ({ ...current, [field]: value }));
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
    try {
      const response = await api.post("/api/telephony/automation-templates/call-outcomes");
      const createdCount = response.data?.createdCount ?? 0;
      setInfo(createdCount > 0
        ? `${createdCount} call automation template${createdCount === 1 ? "" : "s"} installed. You can edit them anytime in Automation Rules.`
        : response.data?.message || "Call automation templates were already installed.");
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

        <section className="grid gap-4 lg:grid-cols-[1.2fr_2fr]">
          <div className={`rounded-2xl border p-5 shadow-sm ${healthTone(health?.status)}`}>
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

          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
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
                <div key={label} className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                  <p className="text-xs font-bold text-gray-500">{label}</p>
                  <p className="mt-1 text-2xl font-black text-gray-950">{value}</p>
                </div>
              ))}
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-blue-800">
                <p className="text-xs font-bold">Avg. duration</p>
                <p className="mt-1 text-lg font-black">{Math.round(report?.averageDurationSeconds || 0)}s</p>
              </div>
              <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-emerald-800">
                <p className="text-xs font-bold">Recording available</p>
                <p className="mt-1 text-lg font-black">{report?.recordingAvailable ?? 0}</p>
              </div>
              <div className="rounded-xl border border-amber-100 bg-amber-50 p-3 text-amber-800">
                <p className="text-xs font-bold">Recording missing</p>
                <p className="mt-1 text-lg font-black">{report?.recordingMissing ?? 0}</p>
              </div>
              <div className="rounded-xl border border-violet-100 bg-violet-50 p-3 text-violet-800 sm:col-span-3">
                <p className="text-xs font-bold">Tracked call minutes</p>
                <p className="mt-1 text-lg font-black">
                  {report?.callMinutesLimit
                    ? `${report.callMinutesUsedThisMonth || 0} / ${report.callMinutesLimit} minutes used`
                    : `${report?.callMinutesUsedThisMonth || 0} minutes used`}
                </p>
                <p className="mt-1 text-xs font-semibold">
                  Reporting only for third-party telephony. Exotel, Twilio, or Plivo charges are billed separately by the provider.
                </p>
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-sm font-extrabold text-gray-950">
                  <Settings size={18} />
                  Telephony Settings
                </div>
                <p className="mt-1 text-sm text-gray-500">{activeProvider.hint}</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-extrabold ${
                config.active ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-600"
              }`}>
                {config.active ? "Active" : "Not active"}
              </span>
            </div>

            <form onSubmit={saveConfig} className="grid gap-4 md:grid-cols-2">
              <label className="space-y-1 text-sm font-semibold text-gray-700">
                Provider
                <select
                  value={config.provider}
                  onChange={(event) => updateConfig("provider", event.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                >
                  {providerOptions.map((provider) => (
                    <option key={provider.value} value={provider.value}>{provider.label}</option>
                  ))}
                </select>
              </label>

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
                Account SID / App ID
                <input
                  value={config.accountSid}
                  onChange={(event) => updateConfig("accountSid", event.target.value)}
                  placeholder="Provider account identifier"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </label>

              <label className="space-y-1 text-sm font-semibold text-gray-700">
                API Key
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
                  placeholder="https://api.exotel.com"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
                <span className="block text-xs font-normal text-gray-500">
                  Leave blank to use https://api.exotel.com. If Exotel gives a region-specific URL, paste it here.
                </span>
              </label>

              <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 md:col-span-2">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-sm font-extrabold text-blue-950">Inbound call webhook for Exotel</p>
                    <p className="mt-1 text-sm text-blue-800">
                      Add these URLs inside the customer's Exotel incoming call Landing Flow. This is required for incoming and missed calls to appear in CRM.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyWebhookUrl(config.inboundWebhookUrl, "Base inbound webhook URL copied.")}
                    disabled={!config.inboundWebhookUrl}
                    className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm font-extrabold text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Clipboard size={15} />
                    {copiedWebhook ? "Copied" : "Copy base URL"}
                  </button>
                </div>

                <div className="mt-4 rounded-xl border border-blue-100 bg-white p-3">
                  <p className="text-xs font-extrabold uppercase tracking-wide text-blue-700">Exotel setup steps</p>
                  <ol className="mt-2 space-y-1 text-sm font-semibold text-gray-700">
                    <li>1. Open Exotel incoming number and its Landing Flow.</li>
                    <li>2. Add an HTTP Call, Passthru, or Webhook step.</li>
                    <li>3. Use GET or POST and paste the correct URL based on the branch.</li>
                    <li>4. Save and publish the Exotel flow.</li>
                  </ol>
                </div>

                <div className="mt-3 rounded-lg border border-blue-100 bg-white px-3 py-2">
                  <p className="mb-1 text-xs font-extrabold uppercase tracking-wide text-gray-500">Base webhook URL</p>
                  <code className="block break-all text-xs font-bold text-gray-800">
                    {config.inboundWebhookUrl || "Save telephony settings to generate webhook URL"}
                  </code>
                </div>

                <div className="mt-3 grid gap-3 lg:grid-cols-2">
                  <div className="rounded-xl border border-red-100 bg-red-50 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-extrabold text-red-800">Missed / No Answer branch</p>
                        <p className="mt-1 text-xs font-semibold text-red-700">Use this when Exotel says no user answered, agent busy, or call not connected.</p>
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

                <div className="mt-3 rounded-xl border border-blue-100 bg-white p-3 text-xs font-semibold text-blue-900">
                  <p className="font-extrabold">After setup</p>
                  <p className="mt-1">Incoming calls appear in Call Logs, unknown numbers become phone leads, existing contacts are linked automatically, and missed/no-answer calls create follow-up task and notification.</p>
                  <p className="mt-2 text-blue-700">Outbound click-to-call callbacks are sent automatically by CRM. These URLs are only for incoming calls on the Exotel number.</p>
                </div>
              </div>

              <label className="space-y-1 text-sm font-semibold text-gray-700">
                API Token
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
                Caller ID
                <input
                  value={config.callerId}
                  onChange={(event) => updateConfig("callerId", event.target.value)}
                  placeholder="+91..."
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </label>

              <label className="space-y-1 text-sm font-semibold text-gray-700">
                Inbound Number
                <input
                  value={config.inboundNumber}
                  onChange={(event) => updateConfig("inboundNumber", event.target.value)}
                  placeholder="+91..."
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </label>

              <label className="flex items-center gap-3 rounded-xl border border-gray-200 p-3 text-sm font-semibold text-gray-700">
                <input
                  type="checkbox"
                  checked={config.active}
                  onChange={(event) => updateConfig("active", event.target.checked)}
                  className="h-4 w-4"
                />
                Provider active
              </label>

              <label className="flex items-center gap-3 rounded-xl border border-gray-200 p-3 text-sm font-semibold text-gray-700">
                <input
                  type="checkbox"
                  checked={config.clickToCallEnabled}
                  onChange={(event) => updateConfig("clickToCallEnabled", event.target.checked)}
                  className="h-4 w-4"
                />
                Enable click-to-call
              </label>

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

          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-5">
              <div className="flex items-center gap-2 text-sm font-extrabold text-gray-950">
                <PhoneCall size={18} />
                Test Click-to-Call
              </div>
              <p className="mt-1 text-sm text-gray-500">
                Use contact ID or a direct customer number. Leave agent number blank to use the logged-in user's mapping.
              </p>
            </div>

            <form onSubmit={startCall} className="space-y-4">
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
                Customer number
                <input
                  value={callForm.customerNumber}
                  onChange={(event) => setCallForm((current) => ({ ...current, customerNumber: event.target.value }))}
                  placeholder="+91..."
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="space-y-1 text-sm font-semibold text-gray-700">
                Agent number
                <input
                  value={callForm.agentNumber}
                  onChange={(event) => setCallForm((current) => ({ ...current, agentNumber: event.target.value }))}
                  placeholder="Optional if your number is mapped"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="space-y-1 text-sm font-semibold text-gray-700">
                Notes
                <textarea
                  value={callForm.notes}
                  onChange={(event) => setCallForm((current) => ({ ...current, notes: event.target.value }))}
                  rows={3}
                  placeholder="Purpose of call"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </label>
              <button
                type="submit"
                disabled={calling}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-gray-950 px-4 py-2 text-sm font-extrabold text-white hover:bg-gray-800 disabled:opacity-60"
              >
                <Phone size={16} />
                {calling ? "Starting..." : "Start tracked call"}
              </button>
            </form>
          </section>
        </div>

        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-extrabold text-gray-950">
                <ListChecks size={18} />
                Ready-Made Call Automations
              </div>
              <p className="mt-1 max-w-3xl text-sm text-gray-500">
                Install starter workflows for missed calls, interested calls, and call-back-later outcomes. These are normal Automation Rules, so you can edit, pause, or delete them later.
              </p>
            </div>
            <button
              type="button"
              onClick={installCallAutomationTemplates}
              disabled={installingTemplates}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-gray-950 px-4 py-2 text-sm font-extrabold text-white hover:bg-gray-800 disabled:opacity-60"
            >
              <ListChecks size={16} />
              {installingTemplates ? "Installing..." : "Install templates"}
            </button>
          </div>

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

          <form onSubmit={saveAgentMapping} className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_120px_auto] lg:items-end">
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

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {agentMappings.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-200 p-5 text-sm text-gray-500">
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
                  className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-left hover:border-teal-200 hover:bg-teal-50"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-extrabold text-gray-950">{mapping.userEmail || `User #${mapping.userId}`}</p>
                      <p className="mt-1 text-xs font-semibold uppercase text-gray-500">{mapping.userRole || "USER"}</p>
                    </div>
                    <span className={`rounded-full px-2 py-1 text-[10px] font-extrabold ${
                      mapping.active === false ? "bg-gray-200 text-gray-600" : "bg-emerald-50 text-emerald-700"
                    }`}>
                      {mapping.active === false ? "Inactive" : "Active"}
                    </span>
                  </div>
                  <p className="mt-3 text-sm font-bold text-gray-800">{mapping.phoneNumber}</p>
                </button>
              ))
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-lg font-extrabold text-gray-950">Call Logs</h2>
              <p className="text-sm text-gray-500">Showing {pageInfo.totalElements} tracked calls.</p>
            </div>
            <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-end md:justify-end">
              <label className="space-y-1 text-sm font-semibold text-gray-700">
                Status
                <select
                  value={status}
                  onChange={(event) => setStatus(event.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm md:w-44"
                >
                  {statusOptions.map((option) => (
                    <option key={option} value={option}>{option.replace("_", " ")}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-sm font-semibold text-gray-700">
                Outcome
                <select
                  value={disposition}
                  onChange={(event) => setDisposition(event.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm md:w-48"
                >
                  <option value="ALL">All outcomes</option>
                  {dispositionOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-sm font-semibold text-gray-700">
                Agent
                <select
                  value={agentUserId}
                  onChange={(event) => setAgentUserId(event.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm md:w-56"
                >
                  <option value="">All agents</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.email || user.name || `User #${user.id}`}
                    </option>
                  ))}
                </select>
              </label>
              <DateRangeFilter value={dateRange} onChange={setDateRange} compact />
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-gray-200">
            <div className="hidden grid-cols-[120px_100px_minmax(0,1fr)_minmax(0,1fr)_90px_120px_120px_110px_130px] gap-3 bg-gray-50 px-4 py-3 text-xs font-extrabold uppercase tracking-wide text-gray-500 lg:grid">
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
              calls.map((call) => (
                <div key={call.id} className="grid gap-3 border-t border-gray-100 px-4 py-4 text-sm lg:grid-cols-[120px_100px_minmax(0,1fr)_minmax(0,1fr)_90px_120px_120px_110px_130px]">
                  <div>
                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-extrabold ${statusClass(call.status)}`}>
                      {String(call.status || "REQUESTED").replace("_", " ")}
                    </span>
                    {call.failureReason && <p className="mt-2 text-xs text-red-600">{call.failureReason}</p>}
                  </div>
                  <div className="font-bold text-gray-800">{call.provider || "—"}</div>
                  <div className="min-w-0">
                    <p className="mb-1 text-[10px] font-extrabold uppercase tracking-wide text-gray-400 lg:hidden">Customer</p>
                    <p className="truncate font-semibold text-gray-900">{call.customerNumber || call.toNumber || "—"}</p>
                    {call.contactId && (
                      <p className="text-xs font-semibold text-emerald-700">
                        {String(call.direction || "").toUpperCase() === "INBOUND" ? "Phone lead linked" : "Contact"} #{call.contactId}
                      </p>
                    )}
                    {!call.contactId && String(call.direction || "").toUpperCase() === "INBOUND" && (
                      <p className="mt-1 text-xs font-bold text-amber-700">Unknown inbound caller - create or link lead</p>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="mb-1 text-[10px] font-extrabold uppercase tracking-wide text-gray-400 lg:hidden">Agent</p>
                    <p className="truncate font-semibold text-gray-900">{call.agentNumber || call.fromNumber || "—"}</p>
                    {call.userId && <p className="text-xs text-gray-500">User #{call.userId}</p>}
                  </div>
                  <div>
                    <p className="mb-1 text-[10px] font-extrabold uppercase tracking-wide text-gray-400 lg:hidden">Duration</p>
                    {call.durationSeconds ? `${call.durationSeconds}s` : "—"}
                  </div>
                  <div>
                    <p className="mb-1 text-[10px] font-extrabold uppercase tracking-wide text-gray-400 lg:hidden">Recording</p>
                    {call.recordingUrl ? (
                      <CallRecordingPlayer recordingUrl={call.recordingUrl} callId={call.id} compact />
                    ) : (
                      <span className={`inline-flex rounded-full border px-2 py-1 text-[11px] font-extrabold ${recordingBadge(call).tone}`}>
                        {recordingBadge(call).label}
                      </span>
                    )}
                  </div>
                  <div>
                    <p className="mb-1 text-[10px] font-extrabold uppercase tracking-wide text-gray-400 lg:hidden">Outcome</p>
                    <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-extrabold ${
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
                  <div className="text-xs text-gray-500">{formatDateTime(call.createdAt)}</div>
                  <div>
                    <p className="mb-1 text-[10px] font-extrabold uppercase tracking-wide text-gray-400 lg:hidden">Action</p>
                    <div className="flex flex-wrap gap-2">
                      {!call.contactId && String(call.direction || "").toUpperCase() === "INBOUND" && (
                        <button
                          type="button"
                          onClick={() => openLeadForm(call)}
                          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-teal-200 bg-teal-50 px-2.5 py-1.5 text-xs font-extrabold text-teal-700 hover:bg-teal-100"
                        >
                          <UserPlus size={14} />
                          Create lead
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => openDispositionForm(call)}
                        className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-extrabold text-gray-700 hover:bg-gray-50"
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
              ))
            )}
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-gray-500">
              Page {pageInfo.totalPages ? pageInfo.page + 1 : 0} of {pageInfo.totalPages || 0}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={pageInfo.page <= 0 || loading}
                onClick={() => loadCalls(pageInfo.page - 1)}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-bold text-gray-700 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={pageInfo.page + 1 >= pageInfo.totalPages || loading}
                onClick={() => loadCalls(pageInfo.page + 1)}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-bold text-gray-700 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-lg font-extrabold text-gray-950">Exotel Webhook Diagnostics</h2>
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
                  <span className="rounded-lg bg-white px-3 py-2 font-semibold">1. Call the Exotel inbound number.</span>
                  <span className="rounded-lg bg-white px-3 py-2 font-semibold">2. Refresh diagnostics after 5-10 seconds.</span>
                  <span className="rounded-lg bg-white px-3 py-2 font-semibold">3. Confirm status becomes Processed.</span>
                </div>
              </div>

              {webhookLoading ? (
                <div className="rounded-xl border border-dashed border-gray-200 p-6 text-sm text-gray-500">Loading webhook callbacks...</div>
              ) : webhookEvents.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-200 p-6 text-center text-sm text-gray-500">
                  No Exotel webhook callbacks received yet.
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
