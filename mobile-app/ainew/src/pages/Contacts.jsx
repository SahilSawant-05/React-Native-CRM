import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import "../index.css";
import UploadCsv from "./UploadCsv";
import AddContact from "./AddContact";
import DeleteContact from "./DeleteContact";
import EditContact from "./EditContact";
import TaskModal from "./TaskModal";
import DateRangeFilter, { dateRangeParams, presetDateRange } from "../components/common/DateRangeFilter";
import SendWhatsAppFlowModal from "../components/whatsapp/SendWhatsAppFlowModal";
import PlanUpgradePrompt, { errorMessage, isPlanLimitError } from "../components/billing/PlanUpgradePrompt";
import AiAssistPanel from "../components/ai/AiAssistPanel";
import { LEAD_SOURCE_OPTIONS, leadSourceLabel } from "../config/leadSources";

const fmtDate = (raw) => {
  if (!raw) return "—";
  const d = new Date(raw);
  return isNaN(d)
    ? raw
    : d.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
};

const fmtTime = (raw) => {
  if (!raw) return "";
  const d = new Date(raw);
  if (isNaN(d)) return "";
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
};

const TAG_COLORS = {
  Lead: "bg-blue-50 text-blue-600",
  Partner: "bg-purple-50 text-purple-600",
  Existing: "bg-emerald-50 text-emerald-600",
  "Long-term": "bg-amber-50 text-amber-600",
};

const tagColor = (tag) => TAG_COLORS[tag] ?? "bg-gray-100 text-gray-500";

const normTags = (raw) => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
};

const getTokenRole = () => {
  const sessionRole = sessionStorage.getItem("role");
  if (sessionRole) return sessionRole.toLowerCase();
  try {
    const token = sessionStorage.getItem("token");
    if (!token) return null;
    const payload = JSON.parse(atob(token.split(".")[1]));
    return (payload.role || payload.Role || "").toLowerCase();
  } catch {
    return null;
  }
};

const canManageUsers = () => {
  const role = getTokenRole();
  return role === "admin" || role === "owner";
};

const Avatar = ({ name, size = "md" }) => {
  const initials = (name || "?")
    .split(" ")
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("");
  const palette = [
    "bg-teal-500",
    "bg-indigo-500",
    "bg-rose-500",
    "bg-amber-500",
    "bg-sky-500",
    "bg-violet-500",
  ];
  const color = palette[(name?.charCodeAt(0) ?? 0) % palette.length];
  const sizeClass = size === "lg" ? "w-16 h-16 text-xl" : "w-8 h-8 text-xs";

  return (
    <div
      className={`${sizeClass} ${color} rounded-full flex items-center justify-center text-white font-bold flex-shrink-0`}
    >
      {initials}
    </div>
  );
};

const ScoreBadge = ({ score }) => {
  const n = Number(score);
  const cls =
    n >= 75
      ? "bg-emerald-50 text-emerald-600"
      : n >= 40
        ? "bg-amber-50 text-amber-600"
        : "bg-red-50 text-red-500";

  return score ? (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cls}`}>
      {score}
    </span>
  ) : (
    <span className="text-gray-300 text-xs">—</span>
  );
};

const TaskCell = ({ task, onClick }) => {
  if (!task) {
    return (
      <span
        onClick={onClick}
        className="text-teal-400 font-medium cursor-pointer hover:text-teal-600"
      >
        + Add task
      </span>
    );
  }

  const title = task.title ?? task;
  const dueAt = task.dueAt ?? task.due_at ?? null;

  return (
    <div
      onClick={onClick}
      className="cursor-pointer hover:text-teal-600 flex flex-col gap-0.5"
    >
      <span className="text-gray-700 font-medium text-xs truncate max-w-[140px]">
        📋 {title}
      </span>
      {dueAt && (
        <span className="text-gray-400 text-xs">
          {fmtDate(dueAt)} {fmtTime(dueAt)}
        </span>
      )}
    </div>
  );
};

const RoleBadge = ({ role }) => {
  if (!role) return <span className="text-gray-300 text-xs">—</span>;

  const normalized = role.toLowerCase();
  const cls =
    normalized === "admin"
      ? "bg-violet-50 text-violet-600"
      : normalized === "owner"
        ? "bg-rose-50 text-rose-600"
        : normalized === "manager"
          ? "bg-sky-50 text-sky-600"
          : normalized === "agent"
            ? "bg-teal-50 text-teal-600"
            : "bg-gray-100 text-gray-500";

  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${cls}`}>
      {role}
    </span>
  );
};

const STAGE_COLORS = {
  NEW: "bg-slate-100 text-slate-700",
  QUALIFIED: "bg-blue-50 text-blue-700",
  FOLLOW_UP: "bg-amber-50 text-amber-700",
  WON: "bg-emerald-50 text-emerald-700",
  LOST: "bg-rose-50 text-rose-700",
};

const TASK_STATUS_COLORS = {
  OPEN: "bg-slate-100 text-slate-700",
  IN_PROGRESS: "bg-blue-50 text-blue-700",
  COMPLETED: "bg-emerald-50 text-emerald-700",
  CANCELLED: "bg-rose-50 text-rose-700",
};

const CONVERSATION_STATUS_COLORS = {
  OPEN: "bg-emerald-50 text-emerald-700",
  CLOSED: "bg-gray-100 text-gray-600",
};

const SAVED_VIEWS_KEY = "crm_contact_saved_views";
const DEFAULT_FILTERS = {
  query: "",
  tag: "",
  stage: "",
  leadSource: "",
  city: "",
  assignedUserId: "",
  conversationStatus: "",
};
const PAGE_SIZE_OPTIONS = [20, 50, 100];
const LEGACY_STAGE_OPTIONS = ["NEW", "QUALIFIED", "FOLLOW_UP", "WON", "LOST"];
const CONVERSATION_OPTIONS = ["OPEN", "CLOSED"];
const pillColor = (value, palette) => palette[value] ?? "bg-gray-100 text-gray-600";

const SectionTitle = ({ children }) => (
  <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">
    {children}
  </p>
);

const formatMoney = (amount) => {
  if (amount === null || amount === undefined || amount === "") return "";
  const number = Number(amount);
  if (Number.isNaN(number)) return String(amount);
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(number);
};

const TimelineIcon = ({ itemType }) => {
  const icon =
    itemType === "TASK"
      ? "📋"
      : itemType === "NOTE"
        ? "📝"
        : itemType === "MESSAGE"
          ? "💬"
          : itemType === "EMAIL"
            ? "✉️"
            : itemType === "APPOINTMENT"
              ? "📅"
            : itemType === "OPPORTUNITY"
              ? "₹"
              : "•";
  return (
    <span className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-xs flex-shrink-0">
      {icon}
    </span>
  );
};

const ContactSidebar = ({
  contact,
  workspace,
  customFields,
  customFieldValues,
  opportunities,
  leadScoreHistory,
  aiInsights,
  aiInsightLoading,
  onRunAiInsight,
  loading,
  error,
  onClose,
  onEditContact,
  onOpenTask,
  onOpenFlow,
  onContactUpdated,
}) => {
  const navigate = useNavigate();
  const [aiInsightsOpen, setAiInsightsOpen] = useState(false);

  if (!contact) return null;

  const tags = normTags(contact.tags);
  const timeline = workspace?.timeline?.items ?? [];
  const notes = workspace?.notes ?? [];
  const tasks = workspace?.tasks ?? [];
  const timelineMeta = workspace?.timeline ?? null;
  const stage = timelineMeta?.stage || contact.stage;
  const conversationStatus = timelineMeta?.conversationStatus || contact.conversationStatus;
  const assignedUserEmail = timelineMeta?.assignedUserEmail || contact.assignedUserEmail;
  const visibleCustomFields = (customFields || [])
    .filter((field) => field.active !== false && customFieldValues?.[field.fieldKey])
    .sort((a, b) => (a.displayOrder ?? 100) - (b.displayOrder ?? 100));

  const contactActions = [
    {
      icon: "📞",
      label: "Call",
      disabled: !contact.phone,
      unavailableLabel: "No phone number available",
      onClick: () => {
        const phone = String(contact.phone || "").replace(/[^0-9+]/g, "");
        if (phone) window.location.href = `tel:${phone.startsWith("+") ? phone : `+${phone}`}`;
      },
    },
    {
      icon: "✉️",
      label: "Email",
      disabled: !contact.email,
      unavailableLabel: "No email address available",
      onClick: () => navigate("/dashboard/mail", { state: { composeContact: contact } }),
    },
    {
      icon: "💬",
      label: "Chat",
      disabled: !contact.phone,
      unavailableLabel: "No phone number available",
      onClick: () => navigate("/dashboard/chat", { state: { contact } }),
    },
  ];

  return (
    <aside className="flex h-full w-full min-w-0 flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-md sm:w-72 sm:flex-shrink-0">
      <div className="bg-gradient-to-br from-teal-500 to-teal-600 px-5 py-6 text-white relative">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-teal-200 hover:text-white text-lg leading-none"
        >
          ×
        </button>
        <div className="flex flex-col items-center gap-2 text-center">
          <Avatar name={contact.name || contact.email} size="lg" />
          <div>
            <p className="font-bold text-lg leading-tight">
              {contact.name || contact.email || "—"}
            </p>
            <p className="text-teal-100 text-sm">
              {contact.designation || contact.company || ""}
            </p>
          </div>
          <div className="flex gap-3 mt-2">
            {contactActions.map(({ icon, label, disabled, unavailableLabel, onClick }) => (
              <button
                key={label}
                type="button"
                title={disabled ? unavailableLabel : label === "Call" ? "Call using your device or connected dialer" : label}
                aria-label={disabled ? `${label}: ${unavailableLabel}` : label}
                disabled={disabled}
                onClick={onClick}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-sm transition-colors hover:bg-white/30 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {icon}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 text-sm">
        <AiAssistPanel
          contactId={contact.id || contact._id}
          onContactUpdated={onContactUpdated}
          title="AI Contact Assistant"
          contextPrompt={`Write a short, friendly follow-up for this CRM contact.
Name: ${contact.name || ""}
Phone: ${contact.phone || ""}
Email: ${contact.email || ""}
Company: ${contact.company || ""}
Source: ${leadSourceLabel(contact.leadSource) || ""}
Stage: ${stage || ""}
Recent notes: ${notes.slice(0, 3).map((note) => note.note).join(" | ") || "No notes yet"}`}
          replyPrompt={`Draft a concise WhatsApp follow-up for this lead. Keep it natural and ask one clear next-step question.
Contact: ${contact.name || contact.phone || contact.email || "Lead"}
Source: ${leadSourceLabel(contact.leadSource) || "Unknown"}
Stage: ${stage || "Unknown"}
Latest activity: ${timeline.slice(0, 3).map((item) => item.description || item.title || item.body || item.note).filter(Boolean).join(" | ") || "No recent activity"}`}
          compact
        />

        <SectionTitle>Info</SectionTitle>
        {[
          { label: "Company", value: contact.company },
          { label: "Email", value: contact.email },
          { label: "Phone", value: contact.phone },
          { label: "Source", value: leadSourceLabel(contact.leadSource) },
          { label: "Source Detail", value: contact.leadSourceDetail },
          { label: "City", value: contact.city },
        ].map(({ label, value }) => (
          <div key={label} className="flex justify-between gap-2">
            <span className="text-gray-400 flex-shrink-0">{label}</span>
            <span className="text-gray-700 font-medium text-right break-all">
              {value || "—"}
            </span>
          </div>
        ))}

        {stage && (
          <div className="flex justify-between gap-2">
            <span className="text-gray-400 flex-shrink-0">Stage</span>
            <span
              className={`text-xs font-semibold px-2 py-0.5 rounded-full ${pillColor(stage, STAGE_COLORS)}`}
            >
              {stage.replaceAll("_", " ")}
            </span>
          </div>
        )}

        {conversationStatus && (
          <div className="flex justify-between gap-2">
            <span className="text-gray-400 flex-shrink-0">Conversation</span>
            <span
              className={`text-xs font-semibold px-2 py-0.5 rounded-full ${pillColor(conversationStatus, CONVERSATION_STATUS_COLORS)}`}
            >
              {conversationStatus}
            </span>
          </div>
        )}

        <div className="flex justify-between gap-2">
          <span className="text-gray-400 flex-shrink-0">Owner</span>
          <span className="text-gray-700 font-medium text-right break-all">
            {assignedUserEmail || "Unassigned"}
          </span>
        </div>

        <div className="flex justify-between gap-2">
          <span className="text-gray-400 flex-shrink-0">Lead Score</span>
          <ScoreBadge score={contact.lead_score} />
        </div>

        {(contact.lead_score_reason || contact.lead_score_updated_at) && (
          <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold uppercase tracking-wide text-indigo-500">Score Reason</span>
              {contact.lead_score_updated_at && (
                <span className="text-[11px] font-semibold text-indigo-500">
                  {fmtDate(contact.lead_score_updated_at)} {fmtTime(contact.lead_score_updated_at)}
                </span>
              )}
            </div>
            {contact.lead_score_reason && (
              <p className="mt-2 line-clamp-4 text-xs leading-5 text-indigo-800">{contact.lead_score_reason}</p>
            )}
          </div>
        )}

        <div className="flex justify-between gap-2">
          <span className="text-gray-400 flex-shrink-0">Role</span>
          <RoleBadge role={contact.role} />
        </div>

        {tags.length > 0 && (
          <div className="flex justify-between gap-2 flex-wrap">
            <span className="text-gray-400 flex-shrink-0">Tags</span>
            <div className="flex flex-wrap gap-1 justify-end">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${tagColor(tag)}`}
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {contact.last_contacted && (
          <div className="flex justify-between gap-2">
            <span className="text-gray-400 flex-shrink-0">Last Contact</span>
            <span className="text-gray-700 font-medium text-right">
              {fmtDate(contact.last_contacted)}{" "}
              <span className="text-gray-400 text-xs">{fmtTime(contact.last_contacted)}</span>
            </span>
          </div>
        )}

        {contact.task && (
          <div className="flex justify-between gap-2 flex-wrap">
            <span className="text-gray-400 flex-shrink-0">Task</span>
            <div className="text-right">
              <p className="text-gray-700 font-medium text-xs">
                {contact.task.title ?? contact.task}
              </p>
              {(contact.task.dueAt || contact.task.due_at) && (
                <p className="text-gray-400 text-xs">
                  {fmtDate(contact.task.dueAt ?? contact.task.due_at)}{" "}
                  {fmtTime(contact.task.dueAt ?? contact.task.due_at)}
                </p>
              )}
            </div>
          </div>
        )}

        {visibleCustomFields.length > 0 && (
          <div className="border-t border-gray-100 pt-3">
            <SectionTitle>Custom Fields</SectionTitle>
            <div className="space-y-2">
              {visibleCustomFields.map((field) => (
                <div key={field.id || field.fieldKey} className="flex justify-between gap-2">
                  <span className="text-gray-400 flex-shrink-0">{field.label}</span>
                  <span className="text-gray-700 font-medium text-right break-all">
                    {customFieldValues[field.fieldKey]}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {opportunities?.length > 0 && (
          <div className="border-t border-gray-100 pt-3">
            <SectionTitle>Opportunities</SectionTitle>
            <div className="space-y-2">
              {opportunities.slice(0, 5).map((opportunity) => (
                <div key={opportunity.id} className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-gray-700">{opportunity.title}</p>
                      <p className="mt-1 text-[11px] text-gray-400">
                        {opportunity.stage?.replaceAll("_", " ")}
                        {opportunity.amount ? ` · ${formatMoney(opportunity.amount)}` : ""}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate(`/dashboard/opportunities/${opportunity.id}`)}
                      className="text-[11px] font-semibold text-teal-700"
                    >
                      Open
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="pt-1 flex flex-wrap gap-2">
          <button
            onClick={() => navigate("/dashboard/chat", { state: { contact } })}
            className="px-3 py-2 rounded-xl bg-teal-500 hover:bg-teal-600 text-white text-xs font-semibold"
          >
            Open Chat
          </button>
          <button
            onClick={onOpenFlow}
            className="px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold"
          >
            Send Flow
          </button>
          <button
            onClick={onOpenTask}
            className="px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold"
          >
            Add Task
          </button>
          <button
            onClick={onEditContact}
            className="px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold"
          >
            Edit Contact
          </button>
        </div>

        <div className="border-t border-gray-100 pt-3">
          <SectionTitle>Workspace</SectionTitle>
          {loading ? (
            <p className="text-xs text-gray-400">Loading recent activity…</p>
          ) : error ? (
            <p className="text-xs text-rose-500">{error}</p>
          ) : (
            <p className="text-xs text-gray-500">
              Notes, follow-ups, and recent CRM activity for this contact.
            </p>
          )}
        </div>

        <div className="border-t border-gray-100 pt-3">
          <button
            type="button"
            onClick={() => setAiInsightsOpen((open) => !open)}
            className="flex w-full items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-left text-xs font-bold uppercase tracking-wide text-slate-600 hover:bg-slate-100"
          >
            <span>AI Insights</span>
            <span className="text-[11px] normal-case tracking-normal text-slate-400">
              {aiInsightsOpen ? "Hide" : "Show"}
            </span>
          </button>
          {aiInsightsOpen && (
            <div className="mt-3 space-y-3">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => onRunAiInsight?.("bestTime")}
                  disabled={aiInsightLoading === "bestTime"}
                  className="rounded-xl bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 disabled:opacity-60"
                >
                  {aiInsightLoading === "bestTime" ? "Thinking..." : "Best Time"}
                </button>
                <button
                  type="button"
                  onClick={() => onRunAiInsight?.("sentiment")}
                  disabled={aiInsightLoading === "sentiment"}
                  className="rounded-xl bg-teal-50 px-3 py-2 text-xs font-semibold text-teal-700 hover:bg-teal-100 disabled:opacity-60"
                >
                  {aiInsightLoading === "sentiment" ? "Reading..." : "Sentiment"}
                </button>
              </div>
              {(aiInsights?.bestTime || aiInsights?.sentiment) && (
                <div className="space-y-2">
                  {aiInsights.bestTime && (
                    <div className="max-h-44 overflow-y-auto rounded-xl border border-indigo-100 bg-indigo-50 p-3">
                      <p className="text-xs font-bold text-indigo-800">Best follow-up time</p>
                      <p className="mt-1 whitespace-pre-wrap break-words text-xs leading-5 text-indigo-700">{aiInsights.bestTime}</p>
                    </div>
                  )}
                  {aiInsights.sentiment && (
                    <div className="max-h-44 overflow-y-auto rounded-xl border border-teal-100 bg-teal-50 p-3">
                      <p className="text-xs font-bold text-teal-800">Conversation sentiment</p>
                      <p className="mt-1 whitespace-pre-wrap break-words text-xs leading-5 text-teal-700">{aiInsights.sentiment}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {!loading && !error && notes.length > 0 && (
          <div className="border-t border-gray-100 pt-3">
            <SectionTitle>Latest Notes</SectionTitle>
            <div className="space-y-2">
              {notes.slice(0, 3).map((note) => (
                <div key={note.id} className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                  <p className="text-gray-700 text-xs leading-relaxed">{note.note}</p>
                  <p className="mt-1 text-[11px] text-gray-400">
                    {note.createdByUserEmail || "Unknown"} · {fmtDate(note.createdAt)}{" "}
                    {fmtTime(note.createdAt)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {!loading && !error && leadScoreHistory?.length > 0 && (
          <div className="border-t border-gray-100 pt-3">
            <SectionTitle>Lead Score History</SectionTitle>
            <div className="space-y-2">
              {leadScoreHistory.slice(0, 5).map((history) => (
                <div key={history.id} className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-bold text-gray-700">
                      {history.oldScore ?? "—"} → {history.newScore}
                    </p>
                    <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold uppercase text-gray-500">
                      {String(history.source || "MANUAL").replaceAll("_", " ")}
                    </span>
                  </div>
                  {history.reason && <p className="mt-2 line-clamp-3 text-xs leading-5 text-gray-500">{history.reason}</p>}
                  <p className="mt-2 text-[11px] text-gray-400">
                    {history.actorEmail || "System"} · {fmtDate(history.createdAt)} {fmtTime(history.createdAt)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {!loading && !error && tasks.length > 0 && (
          <div className="border-t border-gray-100 pt-3">
            <SectionTitle>Follow-Ups</SectionTitle>
            <div className="space-y-2">
              {tasks.slice(0, 3).map((task) => (
                <div key={task.id} className="rounded-xl border border-gray-100 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-gray-700">{task.title}</p>
                      {task.description && (
                        <p className="mt-1 text-xs text-gray-500 leading-relaxed">
                          {task.description}
                        </p>
                      )}
                    </div>
                    <span
                      className={`text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${pillColor(task.status, TASK_STATUS_COLORS)}`}
                    >
                      {task.status?.replaceAll("_", " ")}
                    </span>
                  </div>
                  <p className="mt-2 text-[11px] text-gray-400">
                    Due {fmtDate(task.dueAt)} {fmtTime(task.dueAt)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {!loading && !error && timeline.length > 0 && (
          <div className="border-t border-gray-100 pt-3">
            <SectionTitle>Recent Activity</SectionTitle>
            <div className="space-y-3">
              {timeline.slice(0, 6).map((item, index) => (
                <div key={`${item.itemType}-${item.emailId || item.opportunityId || item.appointmentId || item.messageId || item.noteId || item.taskId || index}`} className="flex gap-2">
                  <TimelineIcon itemType={item.itemType} />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-gray-700">
                      {item.title || item.description || item.textBody || item.eventType || item.itemType}
                    </p>
                    {(item.description || item.textBody) && item.title && (
                      <p className="mt-0.5 text-xs text-gray-500 leading-relaxed">
                        {item.description || item.textBody}
                      </p>
                    )}
                    <p className="mt-1 text-[11px] text-gray-400">
                      {item.actorUserEmail || "System"} · {fmtDate(item.occurredAt)}{" "}
                      {fmtTime(item.occurredAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};

const listFromPayload = (payload, ...keys) => {
  if (Array.isArray(payload)) return payload;
  for (const key of keys) {
    if (Array.isArray(payload?.[key])) return payload[key];
  }
  return [];
};

const loadSavedViews = () => {
  try {
    const raw = localStorage.getItem(SAVED_VIEWS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const storeSavedViews = (views) => {
  localStorage.setItem(SAVED_VIEWS_KEY, JSON.stringify(views));
};

const fallbackStageOptions = () =>
  LEGACY_STAGE_OPTIONS.map((stage) => ({
    key: stage,
    label: stage.replaceAll("_", " "),
  }));

const normalizeStageOptions = (stages) =>
  listFromPayload(stages, "items", "data", "stages")
    .filter((stage) => stage && stage.active !== false)
    .map((stage) => {
      const key = stage.stageKey || stage.key || stage.value;
      if (!key) return null;
      return {
        key,
        label: stage.label || stage.name || String(key).replaceAll("_", " "),
      };
    })
    .filter(Boolean);

const cleanParams = (params) =>
  Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== "" && value !== null && value !== undefined)
  );

export default function Contacts() {
  const navigate = useNavigate();
  const dialogRef = useRef(null);

  const [contacts, setContacts] = useState([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [contactsError, setContactsError] = useState("");
  const [pageInfo, setPageInfo] = useState({
    page: 0,
    size: 20,
    totalElements: 0,
    totalPages: 0,
    hasNext: false,
    hasPrevious: false,
  });
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [datePreset, setDatePreset] = useState("ALL");
  const [dateRange, setDateRange] = useState(() => presetDateRange("ALL"));
  const [stageOptions, setStageOptions] = useState(() => fallbackStageOptions());
  const [stagePipelineId, setStagePipelineId] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [savedViews, setSavedViews] = useState(() => loadSavedViews());
  const [savedViewName, setSavedViewName] = useState("");
  const [users, setUsers] = useState([]);
  const [checkedIds, setCheckedIds] = useState(new Set());
  const [showSidebar, setShowSidebar] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editContact, setEditContact] = useState(null);
  const [taskModal, setTaskModal] = useState(null);
  const [flowContact, setFlowContact] = useState(null);
  const [flowNotice, setFlowNotice] = useState("");
  const [workspaceReloadKey, setWorkspaceReloadKey] = useState(0);
  const [workspace, setWorkspace] = useState({ timeline: null, notes: [], tasks: [] });
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [workspaceError, setWorkspaceError] = useState("");
  const [leadScoreHistory, setLeadScoreHistory] = useState([]);
  const [aiInsights, setAiInsights] = useState({});
  const [aiInsightLoading, setAiInsightLoading] = useState("");
  const [customFields, setCustomFields] = useState([]);
  const [editCustomFieldValues, setEditCustomFieldValues] = useState({});
  const [selectedCustomFieldValues, setSelectedCustomFieldValues] = useState({});
  const [selectedOpportunities, setSelectedOpportunities] = useState([]);
  const [upgradePrompt, setUpgradePrompt] = useState({ open: false, message: "" });

  const loadContacts = useCallback(async () => {
    setContactsLoading(true);
    setContactsError("");
    try {
      const response = await api.get("/api/contacts/search/page", {
        params: cleanParams({
          ...filters,
          assignedUserId: filters.assignedUserId || undefined,
          pipelineId: filters.stage && stagePipelineId ? stagePipelineId : undefined,
          ...dateRangeParams(dateRange),
          page,
          size: pageSize,
        }),
      });
      const payload = response.data || {};
      setContacts(Array.isArray(payload.items) ? payload.items : []);
      setPageInfo({
        page: payload.page ?? page,
        size: payload.size ?? pageSize,
        totalElements: payload.totalElements ?? 0,
        totalPages: payload.totalPages ?? 0,
        hasNext: Boolean(payload.hasNext),
        hasPrevious: Boolean(payload.hasPrevious),
      });
      setCheckedIds(new Set());
    } catch (error) {
      console.error("Failed to load contacts:", error);
      setContacts([]);
      setContactsError(error?.response?.data?.message || error.message || "Failed to load contacts");
    } finally {
      setContactsLoading(false);
    }
  }, [dateRange, filters, page, pageSize, stagePipelineId]);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  useEffect(() => {
    let cancelled = false;

    const loadPipelineStages = async () => {
      try {
        const pipelineResponse = await api.get("/api/pipelines");
        const pipelines = listFromPayload(pipelineResponse.data, "items", "data");
        const defaultPipeline = pipelines.find((pipeline) => pipeline.defaultPipeline) || pipelines[0];
        const pipelineId = defaultPipeline?.id || "";
        const stageResponse = await api.get(
          "/api/crm-config/pipeline-stages",
          pipelineId ? { params: { pipelineId } } : undefined
        );
        const nextStages = normalizeStageOptions(stageResponse.data);
        if (!cancelled) {
          setStagePipelineId(pipelineId ? String(pipelineId) : "");
          setStageOptions(nextStages.length ? nextStages : fallbackStageOptions());
        }
      } catch (error) {
        console.error("Failed to load contact stage filters:", error);
        if (!cancelled) {
          setStagePipelineId("");
          setStageOptions(fallbackStageOptions());
        }
      }
    };

    loadPipelineStages();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!canManageUsers()) return;
    api
      .get("/api/users")
      .then((response) => setUsers(Array.isArray(response.data) ? response.data : []))
      .catch(() => setUsers([]));
  }, []);

  useEffect(() => {
    api
      .get("/api/crm-config/custom-fields")
      .then((response) => {
        const fields = Array.isArray(response.data) ? response.data : [];
        setCustomFields(fields.filter((field) => field.active !== false));
      })
      .catch((error) => {
        console.error("Failed to load custom fields:", error);
      });
  }, []);

  useEffect(() => {
    if (!showSidebar || !selectedId) {
      setWorkspace({ timeline: null, notes: [], tasks: [] });
      setLeadScoreHistory([]);
      setAiInsights({});
      setSelectedCustomFieldValues({});
      setSelectedOpportunities([]);
      setWorkspaceError("");
      setWorkspaceLoading(false);
      return;
    }

    let cancelled = false;

    const loadWorkspace = async () => {
      setWorkspaceLoading(true);
      setWorkspaceError("");

      const [timelineResult, notesResult, tasksResult, scoreHistoryResult] = await Promise.allSettled([
        api.get(`/api/contacts/${selectedId}/timeline`),
        api.get(`/api/contacts/${selectedId}/notes`),
        api.get(`/api/contacts/${selectedId}/tasks`),
        api.get(`/api/contacts/${selectedId}/lead-score-history`),
      ]);

      if (cancelled) return;

      const nextWorkspace = {
        timeline: timelineResult.status === "fulfilled" ? timelineResult.value.data : null,
        notes:
          notesResult.status === "fulfilled"
            ? listFromPayload(notesResult.value.data, "data", "notes")
            : [],
        tasks:
          tasksResult.status === "fulfilled"
            ? listFromPayload(tasksResult.value.data, "data", "tasks")
            : [],
      };

      setWorkspace(nextWorkspace);
      setLeadScoreHistory(
        scoreHistoryResult.status === "fulfilled"
          ? listFromPayload(scoreHistoryResult.value.data, "data", "history")
          : []
      );

      if (customFields.length > 0) {
        try {
          const valuesResponse = await api.get(`/api/crm-config/contacts/${selectedId}/custom-fields`);
          if (!cancelled) {
            setSelectedCustomFieldValues(customValueMapFromResponse(valuesResponse.data));
          }
        } catch (error) {
          console.error("Failed to load selected contact custom fields:", error);
          if (!cancelled) setSelectedCustomFieldValues({});
        }
      }

      try {
        const opportunitiesResponse = await api.get(`/api/opportunities`, {
          params: { contactId: selectedId },
        });
        if (!cancelled) {
          setSelectedOpportunities(Array.isArray(opportunitiesResponse.data) ? opportunitiesResponse.data : []);
        }
      } catch (error) {
        console.error("Failed to load selected contact opportunities:", error);
        if (!cancelled) setSelectedOpportunities([]);
      }

      if (
        timelineResult.status === "rejected" &&
        notesResult.status === "rejected" &&
        tasksResult.status === "rejected"
      ) {
        setWorkspaceError("Could not load the contact workspace right now.");
      }

      setWorkspaceLoading(false);
    };

    loadWorkspace().catch((error) => {
      if (cancelled) return;
      console.error("Failed to load contact workspace:", error);
      setWorkspace({ timeline: null, notes: [], tasks: [] });
      setLeadScoreHistory([]);
      setWorkspaceError("Could not load the contact workspace right now.");
      setWorkspaceLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [selectedId, showSidebar, customFields, workspaceReloadKey]);

  const selectedContact = contacts.find((contact) => (contact.id || contact._id) === selectedId);
  const totalContacts = pageInfo.totalElements || 0;

  const runContactAiInsight = async (type) => {
    if (!selectedId) return;
    setAiInsightLoading(type);
    try {
      const endpoint = type === "bestTime"
        ? `/api/ai/contacts/${selectedId}/best-follow-up-time`
        : `/api/ai/contacts/${selectedId}/sentiment`;
      const response = await api.post(endpoint);
      setAiInsights((current) => ({ ...current, [type]: response.data?.text || "No AI insight returned." }));
    } catch (error) {
      const message = error.response?.data?.message || error.response?.data?.error || "AI insight failed.";
      setAiInsights((current) => ({ ...current, [type]: message }));
    } finally {
      setAiInsightLoading("");
    }
  };
  const totalPages = pageInfo.totalPages || 0;
  const activeFilterCount = useMemo(
    () => Object.values(filters).filter((value) => value !== "" && value !== null && value !== undefined).length,
    [filters]
  );
  const pageStart = totalContacts === 0 ? 0 : pageInfo.page * pageInfo.size + 1;
  const pageEnd = totalContacts === 0 ? 0 : Math.min(totalContacts, pageInfo.page * pageInfo.size + contacts.length);

  const updateFilter = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(0);
  };

  const clearFilters = () => {
    setFilters(DEFAULT_FILTERS);
    setDatePreset("ALL");
    setDateRange(presetDateRange("ALL"));
    setPage(0);
  };

  const saveCurrentView = () => {
    const name = savedViewName.trim();
    if (!name) return;
    const nextViews = [
      ...savedViews.filter((view) => view.name.toLowerCase() !== name.toLowerCase()),
      { name, filters, pageSize },
    ];
    setSavedViews(nextViews);
    storeSavedViews(nextViews);
    setSavedViewName("");
  };

  const applySavedView = (name) => {
    const view = savedViews.find((item) => item.name === name);
    if (!view) return;
    const supportedFilters = Object.fromEntries(
      Object.entries(view.filters || {}).filter(([key]) => key !== "industryKey")
    );
    setFilters({ ...DEFAULT_FILTERS, ...supportedFilters });
    setPageSize(view.pageSize || 20);
    setPage(0);
  };

  const deleteSavedView = (name) => {
    const nextViews = savedViews.filter((view) => view.name !== name);
    setSavedViews(nextViews);
    storeSavedViews(nextViews);
  };

  const customValueMapFromResponse = (values) => {
    const definitionsById = new Map(customFields.map((field) => [field.id, field.fieldKey]));
    return (Array.isArray(values) ? values : []).reduce((acc, item) => {
      const fieldKey = definitionsById.get(item.fieldDefinitionId);
      if (fieldKey) acc[fieldKey] = item.valueText ?? "";
      return acc;
    }, {});
  };

  const saveCustomFieldValues = async (contactId, values) => {
    if (!contactId || !values || Object.keys(values).length === 0) return;
    await api.post(`/api/crm-config/contacts/${contactId}/custom-fields`, {
      values,
    });
  };

  const openEditContact = async (contact) => {
    const id = contact.id || contact._id;
    setEditContact(contact);
    setEditCustomFieldValues({});
    setShowEditModal(true);

    if (!id || customFields.length === 0) return;

    try {
      const response = await api.get(`/api/crm-config/contacts/${id}/custom-fields`);
      setEditCustomFieldValues(customValueMapFromResponse(response.data));
    } catch (error) {
      console.error("Failed to load contact custom fields:", error);
    }
  };

  const handleAddContact = async (formData) => {
    setShowAddModal(false);
    const { customFieldValues, ...contactPayload } = formData;

    try {
      const response = await api.post("/api/contacts", contactPayload);
      const savedId = response.data?.id || response.data?._id;
      await saveCustomFieldValues(savedId, customFieldValues);
      if (page === 0) {
        await loadContacts();
      } else {
        setPage(0);
      }
    } catch (error) {
      const message = errorMessage(error, "Failed to create contact");
      if (isPlanLimitError(message)) {
        setUpgradePrompt({ open: true, message });
      }
      await loadContacts();
    }
  };

  const handleUpdateContact = async (updatedContact) => {
    const id = updatedContact.id || updatedContact._id;
    const { customFieldValues, ...contactPayload } = updatedContact;

    try {
      const { data } = await api.put(`/api/contacts/${id}`, contactPayload);
      await saveCustomFieldValues(id, customFieldValues);
      if (selectedId === id) {
        setSelectedCustomFieldValues(customFieldValues || {});
      }
      setContacts((prev) =>
        prev.map((contact) =>
          (contact.id || contact._id) === id ? { ...contact, ...data } : contact
        )
      );
      setShowEditModal(false);
      setEditContact(null);
      setEditCustomFieldValues({});
    } catch (error) {
      console.error("Update contact error:", error.response?.data);
    }
  };

  const handleTaskCreated = (createdTask) => {
    const contactId = taskModal?.id || taskModal?._id;
    setContacts((prev) =>
      prev.map((contact) =>
        (contact.id || contact._id) === contactId
          ? { ...contact, task: createdTask }
          : contact
      )
    );
    if (selectedId === contactId) {
      setWorkspace((prev) => ({
        ...prev,
        tasks: [createdTask, ...(prev.tasks || []).filter((task) => task.id !== createdTask.id)],
      }));
    }
    setTaskModal(null);
  };

  const handleFlowSent = () => {
    setFlowNotice("WhatsApp Flow sent. Delivery status will appear in the contact timeline.");
    setFlowContact(null);
    setWorkspaceReloadKey((value) => value + 1);
  };

  const handleMergeSelected = async () => {
    const [targetId, sourceId] = [...checkedIds];
    const target = contacts.find((contact) => (contact.id || contact._id) === targetId);
    const source = contacts.find((contact) => (contact.id || contact._id) === sourceId);
    const targetName = target?.name || target?.phone || `Contact #${targetId}`;
    const sourceName = source?.name || source?.phone || `Contact #${sourceId}`;

    const confirmed = window.confirm(
      `Merge "${sourceName}" into "${targetName}"? This moves chats, emails, tasks, opportunities, appointments, and custom fields into the first selected contact.`
    );
    if (!confirmed) return;

    try {
      const response = await api.post(`/api/contacts/${targetId}/merge`, {
        sourceContactId: sourceId,
      });
      setContacts((prev) =>
        prev
          .filter((contact) => (contact.id || contact._id) !== sourceId)
          .map((contact) =>
            (contact.id || contact._id) === targetId ? { ...contact, ...response.data } : contact
          )
      );
      setCheckedIds(new Set());
      setSelectedId(targetId);
      setShowSidebar(true);
    } catch (error) {
      console.error("Merge contacts error:", error.response?.data || error);
      alert(error.response?.data?.message || error.response?.data?.error || "Could not merge contacts.");
    }
  };

  const toggleCheck = useCallback((id, event) => {
    event.stopPropagation();
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = (event) => {
    if (event.target.checked) {
      setCheckedIds(new Set(contacts.map((contact) => contact.id || contact._id)));
    } else {
      setCheckedIds(new Set());
    }
  };

  const allChecked =
    contacts.length > 0 &&
    contacts.every((contact) => checkedIds.has(contact.id || contact._id));

  const handleRowClick = (contact) => {
    setSelectedId(contact.id || contact._id);
    setShowSidebar(true);
  };

  const closeImportModal = () => dialogRef.current?.close();

  return (
    <div className="p-3 sm:p-4 md:p-6">
      <div className="mb-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div className="grid flex-1 gap-3 md:grid-cols-[minmax(220px,1fr)]">
            <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">
              🔍
            </span>
            <input
              type="text"
              placeholder="Search name, phone, email…"
              value={filters.query}
              onChange={(event) => updateFilter("query", event.target.value)}
              className="w-full pl-8 pr-3 py-2 rounded-xl border-2 bg-white border-gray-200 text-sm focus:outline-none focus:border-teal-400"
            />
          </div>
        </div>

          <div className="flex flex-wrap gap-2 items-center">
          <button
            type="button"
            onClick={() => setShowFilters((value) => !value)}
            className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Filters {activeFilterCount > 0 ? `(${activeFilterCount})` : ""}
          </button>
          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={clearFilters}
              className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-teal-700 hover:bg-teal-50"
            >
              Clear
            </button>
          )}
          {canManageUsers() && (
            <button
              onClick={() => navigate("/dashboard/users")}
              className="bg-white hover:bg-gray-50 border border-gray-200 px-4 py-2 rounded-xl text-sm cursor-pointer"
            >
              Manage Users
            </button>
          )}
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-teal-500 hover:bg-teal-600 text-white px-4 py-2 rounded-xl text-sm cursor-pointer"
          >
            + Add Contact
          </button>
          <button
            onClick={() => dialogRef.current?.showModal()}
            className="bg-white hover:bg-gray-50 border border-gray-200 px-4 py-2 rounded-xl text-sm cursor-pointer"
          >
            Import
          </button>
          {canManageUsers() && checkedIds.size === 2 && (
            <button
              onClick={handleMergeSelected}
              className="bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm cursor-pointer"
            >
              Merge Selected
            </button>
          )}
          {checkedIds.size > 0 && (
            <DeleteContact
              selectedId={[...checkedIds]}
              contacts={contacts}
              setContacts={setContacts}
              setSelectedId={() => setCheckedIds(new Set())}
              api={api}
            />
          )}
          {!checkedIds.size && selectedId && (
            <DeleteContact
              selectedId={selectedId}
              contacts={contacts}
              setContacts={setContacts}
              setSelectedId={setSelectedId}
              api={api}
            />
          )}
        </div>
      </div>

        {showFilters && (
          <div className="mt-4 grid gap-3 border-t border-gray-100 pt-4 md:grid-cols-2 xl:grid-cols-4">
            <select
              value={filters.stage}
              onChange={(event) => updateFilter("stage", event.target.value)}
              className="rounded-xl border-2 border-gray-200 bg-white px-3 py-2 text-sm focus:border-teal-400 focus:outline-none"
            >
              <option value="">All stages</option>
              {stageOptions.map((stage) => (
                <option key={stage.key} value={stage.key}>{stage.label}</option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Tag contains"
              value={filters.tag}
              onChange={(event) => updateFilter("tag", event.target.value)}
              className="rounded-xl border-2 border-gray-200 bg-white px-3 py-2 text-sm focus:border-teal-400 focus:outline-none"
            />
            <select
              value={filters.leadSource}
              onChange={(event) => updateFilter("leadSource", event.target.value)}
              className="rounded-xl border-2 border-gray-200 bg-white px-3 py-2 text-sm focus:border-teal-400 focus:outline-none"
            >
              <option value="">All sources</option>
              {LEAD_SOURCE_OPTIONS.map((source) => (
                <option key={source.value} value={source.value}>{source.label}</option>
              ))}
            </select>
            <input
              type="text"
              placeholder="City contains"
              value={filters.city}
              onChange={(event) => updateFilter("city", event.target.value)}
              className="rounded-xl border-2 border-gray-200 bg-white px-3 py-2 text-sm focus:border-teal-400 focus:outline-none"
            />
            <select
              value={filters.conversationStatus}
              onChange={(event) => updateFilter("conversationStatus", event.target.value)}
              className="rounded-xl border-2 border-gray-200 bg-white px-3 py-2 text-sm focus:border-teal-400 focus:outline-none"
            >
              <option value="">All conversations</option>
              {CONVERSATION_OPTIONS.map((statusOption) => (
                <option key={statusOption} value={statusOption}>{statusOption}</option>
              ))}
            </select>
            {canManageUsers() && (
              <select
                value={filters.assignedUserId}
                onChange={(event) => updateFilter("assignedUserId", event.target.value)}
                className="rounded-xl border-2 border-gray-200 bg-white px-3 py-2 text-sm focus:border-teal-400 focus:outline-none"
              >
                <option value="">All owners</option>
                {users.map((userOption) => (
                  <option key={userOption.id} value={userOption.id}>{userOption.email}</option>
                ))}
              </select>
            )}
            <select
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value));
                setPage(0);
              }}
              className="rounded-xl border-2 border-gray-200 bg-white px-3 py-2 text-sm focus:border-teal-400 focus:outline-none"
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>{size} per page</option>
              ))}
            </select>
            <div className="md:col-span-2 xl:col-span-4">
              <DateRangeFilter
                value={dateRange}
                preset={datePreset}
                onChange={(nextRange) => {
                  setDateRange(nextRange);
                  setPage(0);
                }}
                onPresetChange={setDatePreset}
                compact
              />
            </div>
          </div>
        )}

        <div className="mt-4 flex flex-col gap-3 border-t border-gray-100 pt-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <select
              defaultValue=""
              onChange={(event) => {
                applySavedView(event.target.value);
                event.target.value = "";
              }}
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700"
            >
              <option value="">Apply saved view</option>
              {savedViews.map((view) => (
                <option key={view.name} value={view.name}>{view.name}</option>
              ))}
            </select>
            <input
              type="text"
              placeholder="View name"
              value={savedViewName}
              onChange={(event) => setSavedViewName(event.target.value)}
              className="w-40 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={saveCurrentView}
              disabled={!savedViewName.trim()}
              className="rounded-xl bg-teal-600 px-3 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Save View
            </button>
          </div>
          {savedViews.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {savedViews.slice(0, 4).map((view) => (
                <button
                  key={view.name}
                  type="button"
                  onClick={() => deleteSavedView(view.name)}
                  className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600 hover:bg-red-50 hover:text-red-600"
                  title="Delete saved view"
                >
                  {view.name} ×
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-4 items-start">
        <div className="flex-1 bg-white rounded-2xl shadow-md overflow-hidden hidden sm:block">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-gray-700">Contacts</h2>
              <span className="text-xs px-1.5 py-0.5 rounded-full font-semibold bg-teal-50 text-teal-600">
                {totalContacts}
              </span>
            </div>
            {checkedIds.size > 0 && (
              <span className="text-sm text-teal-700 font-medium">
                {checkedIds.size} contact{checkedIds.size > 1 ? "s" : ""} selected
              </span>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-4 py-3 w-8">
                    <input
                      type="checkbox"
                      checked={allChecked}
                      onChange={toggleAll}
                      className="rounded border-gray-300 text-teal-500 focus:ring-teal-400"
                    />
                  </th>
                  {[
                    "Name",
                    "Company",
                    "Email",
                    "Phone",
                    "Source",
                    "Lead Score",
                    "Role",
                    "Tags",
                    "Last Contacted",
                    "Action",
                    "Task",
                  ].map((heading) => (
                    <th
                      key={heading}
                      className="text-left px-4 py-3 font-semibold text-gray-400 uppercase tracking-wide text-xs whitespace-nowrap"
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {contactsLoading ? (
                  <tr>
                    <td colSpan={11} className="text-center py-14 text-gray-400 text-sm">
                      Loading contacts…
                    </td>
                  </tr>
                ) : contactsError ? (
                  <tr>
                    <td colSpan={11} className="text-center py-14 text-rose-500 text-sm">
                      {contactsError}
                    </td>
                  </tr>
                ) : contacts.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="text-center py-14 text-gray-400 text-sm">
                      No contacts match this view.
                    </td>
                  </tr>
                ) : (
                  contacts.map((contact, index) => {
                    const id = contact.id || contact._id;
                    const isSelected = selectedId === id;
                    const isChecked = checkedIds.has(id);
                    const tags = normTags(contact.tags);

                    return (
                      <tr
                        key={id ?? index}
                        onClick={() => handleRowClick(contact)}
                        className={`cursor-pointer transition-colors ${
                          isSelected
                            ? "bg-teal-50 border-l-2 border-teal-400"
                            : "hover:bg-gray-50"
                        }`}
                      >
                        <td className="px-4 py-3" onClick={(event) => event.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(event) => toggleCheck(id, event)}
                            className="rounded border-gray-300 text-teal-500 focus:ring-teal-400"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <Avatar name={contact.name || contact.email} />
                            <span className="font-medium text-gray-800 whitespace-nowrap">
                              {contact.name || contact.email || "—"}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                          {contact.company || "—"}
                        </td>
                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                          {contact.email || "—"}
                        </td>
                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                          {contact.phone || "—"}
                        </td>
                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                          {contact.leadSource ? leadSourceLabel(contact.leadSource) : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <ScoreBadge score={contact.lead_score} />
                        </td>
                        <td className="px-4 py-3">
                          <RoleBadge role={contact.role} />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {tags.length ? (
                              tags.map((tag) => (
                                <span
                                  key={tag}
                                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${tagColor(tag)}`}
                                >
                                  {tag}
                                </span>
                              ))
                            ) : (
                              <span className="text-gray-300 text-xs">—</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">
                          {contact.last_contacted ? (
                            <>
                              {fmtDate(contact.last_contacted)}{" "}
                              <span className="text-gray-400">
                                {fmtTime(contact.last_contacted)}
                              </span>
                            </>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-4 py-3" onClick={(event) => event.stopPropagation()}>
                          <div className="relative group">
                            <button className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
                              ⋮
                            </button>
                            <div className="absolute right-0 mt-0 w-40 bg-white border border-gray-100 rounded-xl shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-10">
                              <button
                                onClick={() => {
                                  setSelectedId(id);
                                  setShowSidebar(true);
                                }}
                                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                              >
                                View
                              </button>
                          <button
                                onClick={() => {
                                  openEditContact(contact);
                                }}
                                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                              >
                                Edit Contact
                              </button>
                            </div>
                          </div>
                        </td>
                        <td
                          className="px-4 py-3 whitespace-nowrap text-xs"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <TaskCell task={contact.task} onClick={() => setTaskModal(contact)} />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <EditContact
            show={showEditModal}
            contact={editContact}
            onClose={() => {
              setShowEditModal(false);
              setEditContact(null);
              setEditCustomFieldValues({});
            }}
            onSave={handleUpdateContact}
            customFields={customFields}
            customFieldValues={editCustomFieldValues}
          />

          {contacts.length > 0 && (
            <div className="border-t border-gray-100 px-5 py-2.5 text-xs text-gray-500 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <span>
                Showing {pageStart}-{pageEnd} of {totalContacts} contacts
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((value) => Math.max(0, value - 1))}
                  disabled={!pageInfo.hasPrevious}
                  className="rounded-lg border border-gray-200 px-3 py-1.5 font-semibold text-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Previous
                </button>
                <span className="font-semibold text-gray-600">
                  Page {totalPages === 0 ? 0 : pageInfo.page + 1} of {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((value) => value + 1)}
                  disabled={!pageInfo.hasNext}
                  className="rounded-lg border border-gray-200 px-3 py-1.5 font-semibold text-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>

        {showSidebar && selectedContact && (
          <ContactSidebar
            contact={selectedContact}
            workspace={workspace}
            customFields={customFields}
            customFieldValues={selectedCustomFieldValues}
            opportunities={selectedOpportunities}
            leadScoreHistory={leadScoreHistory}
            aiInsights={aiInsights}
            aiInsightLoading={aiInsightLoading}
            onRunAiInsight={runContactAiInsight}
            loading={workspaceLoading}
            error={workspaceError}
            onOpenTask={() => setTaskModal(selectedContact)}
            onOpenFlow={() => setFlowContact(selectedContact)}
            onEditContact={() => {
              openEditContact(selectedContact);
            }}
            onContactUpdated={(updated) => {
              setContacts((current) => current.map((contact) =>
                (contact.id || contact._id) === (updated.id || updated._id) ? { ...contact, ...updated } : contact
              ));
            }}
            onClose={() => {
              setShowSidebar(false);
              setSelectedId(null);
            }}
          />
        )}
      </div>

      {flowNotice && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          <span>{flowNotice}</span>
          <button type="button" onClick={() => setFlowNotice("")} className="text-emerald-600 hover:text-emerald-800">x</button>
        </div>
      )}

      <div className="flex flex-col gap-3 sm:hidden mt-4">
        <div className="bg-white rounded-2xl shadow-md p-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-700">Contacts</p>
            <p className="text-xs text-gray-400">
              Showing {pageStart}-{pageEnd} of {totalContacts}
            </p>
          </div>
          {canManageUsers() && (
            <button
              onClick={() => navigate("/dashboard/users")}
              className="text-sm text-teal-600 font-medium"
            >
              Users
            </button>
          )}
        </div>

        {contactsLoading ? (
          <div className="bg-white rounded-2xl shadow-md p-8 text-center text-gray-400 text-sm">
            Loading contacts…
          </div>
        ) : contactsError ? (
          <div className="bg-white rounded-2xl shadow-md p-8 text-center text-rose-500 text-sm">
            {contactsError}
          </div>
        ) : contacts.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-md p-8 text-center text-gray-400 text-sm">
            No contacts match this view.
          </div>
        ) : (
          contacts.map((contact, index) => {
            const id = contact.id || contact._id;
            const tags = normTags(contact.tags);
            return (
              <div
                key={id ?? index}
                onClick={() => handleRowClick(contact)}
                className={`bg-white rounded-2xl shadow-md p-4 flex flex-col gap-1.5 cursor-pointer transition-all ${
                  selectedId === id ? "ring-2 ring-teal-400" : ""
                }`}
              >
                <div className="flex items-center gap-3">
                  <Avatar name={contact.name || contact.email} />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-800 truncate">
                      {contact.name || contact.email}
                    </p>
                    <p className="text-xs text-gray-400 truncate">
                      {contact.company || contact.email || ""}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <ScoreBadge score={contact.lead_score} />
                    <RoleBadge role={contact.role} />
                  </div>
                </div>
                <p className="text-sm text-gray-500 ml-11">{contact.phone || "—"}</p>
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 ml-11">
                    {tags.map((tag) => (
                      <span
                        key={tag}
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${tagColor(tag)}`}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                <div className="ml-11 mt-1" onClick={(event) => event.stopPropagation()}>
                  <TaskCell task={contact.task} onClick={() => setTaskModal(contact)} />
                </div>
              </div>
            );
          })
        )}

        {contacts.length > 0 && (
          <div className="bg-white rounded-2xl shadow-md p-3 flex items-center justify-between text-xs text-gray-500">
            <button
              type="button"
              onClick={() => setPage((value) => Math.max(0, value - 1))}
              disabled={!pageInfo.hasPrevious}
              className="rounded-lg border border-gray-200 px-3 py-2 font-semibold text-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Previous
            </button>
            <span className="font-semibold text-gray-600">
              Page {totalPages === 0 ? 0 : pageInfo.page + 1} of {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((value) => value + 1)}
              disabled={!pageInfo.hasNext}
              className="rounded-lg border border-gray-200 px-3 py-2 font-semibold text-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {showSidebar && selectedContact && (
        <div className="sm:hidden fixed inset-0 z-50 flex items-end">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => {
              setShowSidebar(false);
              setSelectedId(null);
            }}
          />
          <div className="relative h-[calc(100dvh-4rem)] w-full overflow-y-auto overscroll-contain rounded-t-2xl bg-white shadow-2xl">
            <ContactSidebar
              contact={selectedContact}
              workspace={workspace}
              customFields={customFields}
              customFieldValues={selectedCustomFieldValues}
              opportunities={selectedOpportunities}
              leadScoreHistory={leadScoreHistory}
              aiInsights={aiInsights}
              aiInsightLoading={aiInsightLoading}
              onRunAiInsight={runContactAiInsight}
              loading={workspaceLoading}
              error={workspaceError}
              onOpenTask={() => setTaskModal(selectedContact)}
              onOpenFlow={() => setFlowContact(selectedContact)}
              onEditContact={() => {
                openEditContact(selectedContact);
              }}
              onContactUpdated={(updated) => {
                setContacts((current) => current.map((contact) =>
                  (contact.id || contact._id) === (updated.id || updated._id) ? { ...contact, ...updated } : contact
                ));
              }}
              onClose={() => {
                setShowSidebar(false);
                setSelectedId(null);
              }}
            />
          </div>
        </div>
      )}

      <TaskModal
        show={!!taskModal}
        contact={taskModal}
        onClose={() => setTaskModal(null)}
        onCreated={handleTaskCreated}
        defaultAssignedUserId={taskModal?.ownerUserId || taskModal?.assignedUserId || ""}
      />
      <SendWhatsAppFlowModal
        open={!!flowContact}
        contact={flowContact}
        contextLabel="Contact"
        onClose={() => setFlowContact(null)}
        onSent={handleFlowSent}
      />
      <UploadCsv ref={dialogRef} closemodal={closeImportModal} />
      {showAddModal && (
        <AddContact
          show={showAddModal}
          onClose={() => setShowAddModal(false)}
          onSave={handleAddContact}
          customFields={customFields}
        />
      )}
      <PlanUpgradePrompt
        open={upgradePrompt.open}
        message={upgradePrompt.message}
        onClose={() => setUpgradePrompt({ open: false, message: "" })}
      />
    </div>
  );
}
