import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowRight,
  Bot,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Flame,
  Inbox,
  Loader2,
  RefreshCcw,
  Sparkles,
  Target,
} from "lucide-react";
import api from "../api/axios";
import AiAssistPanel from "../components/ai/AiAssistPanel";

const GROUPS = [
  {
    key: "URGENT",
    label: "Urgent",
    helper: "Start here. These need same-day attention.",
    icon: AlertCircle,
    tone: "border-rose-200 bg-rose-50 text-rose-800",
  },
  {
    key: "TODAY",
    label: "Today",
    helper: "Good opportunities for a timely follow-up.",
    icon: CalendarClock,
    tone: "border-amber-200 bg-amber-50 text-amber-800",
  },
  {
    key: "WATCH",
    label: "Watch",
    helper: "Review these when urgent work is cleared.",
    icon: Target,
    tone: "border-teal-200 bg-teal-50 text-teal-800",
  },
];

const INBOX_GROUPS = [
  { key: "1_HOT", label: "Hot Leads", helper: "Score 80+ and ready for fast follow-up.", tone: "border-rose-200 bg-rose-50 text-rose-800", icon: Flame },
  { key: "2_WARM", label: "Warm Leads", helper: "Score 50-79. Keep the conversation moving.", tone: "border-amber-200 bg-amber-50 text-amber-800", icon: Target },
  { key: "3_FOLLOW_UP", label: "Needs Follow-up", helper: "Scored leads without open task or opportunity.", tone: "border-indigo-200 bg-indigo-50 text-indigo-800", icon: CheckCircle2 },
  { key: "4_NEWLY_SCORED", label: "Newly Scored", helper: "Scores updated in the last 7 days.", tone: "border-teal-200 bg-teal-50 text-teal-800", icon: Sparkles },
  { key: "5_NURTURE", label: "Nurture Later", helper: "Lower-score leads for later campaigns.", tone: "border-slate-200 bg-slate-100 text-slate-700", icon: Inbox },
];

function formatDateTime(value) {
  if (!value) return "";
  try {
    return new Intl.DateTimeFormat("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
      hour12: true,
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function errorMessage(error) {
  const data = error?.response?.data;
  if (typeof data === "string") return data;
  return data?.message || data?.error || error?.message || "Something went wrong";
}

function recommendationPrompt(item) {
  return [
    "Act as a CRM sales coach. Give the next best action for this record.",
    "",
    `Reason: ${item.reasonLabel || item.reasonKey || "CRM follow-up"}`,
    `Contact: ${item.contactName || "Unknown"}`,
    item.contactPhone ? `Phone: ${item.contactPhone}` : "",
    item.opportunityTitle ? `Opportunity: ${item.opportunityTitle}` : "",
    item.pipelineName ? `Pipeline: ${item.pipelineName}` : "",
    item.stage ? `Stage: ${item.stage}` : "",
    item.leadScore != null ? `Lead score: ${item.leadScore}` : "",
    item.dueAt ? `Due at: ${formatDateTime(item.dueAt)}` : "",
    item.lastActivityAt ? `Last activity: ${formatDateTime(item.lastActivityAt)}` : "",
    item.summary ? `CRM context: ${item.summary}` : "",
    "",
    "Return: 1 short summary, 3 action bullets, and one ready-to-send WhatsApp/email follow-up message.",
  ].filter(Boolean).join("\n");
}

function replyPrompt(item) {
  return [
    "Write a concise customer follow-up message for this CRM record.",
    item.summary || "",
    item.opportunityTitle ? `Opportunity: ${item.opportunityTitle}` : "",
    item.stage ? `Stage: ${item.stage}` : "",
    "Make it polite, practical, and ask one clear next-step question.",
  ].filter(Boolean).join("\n");
}

function QueueCard({ item, selected, onSelect, onOpen, onCreateTask, taskCreating }) {
  return (
    <article className={`rounded-xl border bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:p-4 ${
      selected ? "border-teal-400 ring-2 ring-teal-100" : "border-slate-200"
    }`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-black uppercase tracking-wide text-slate-700">
              {item.reasonLabel || item.reasonKey}
            </span>
            <span className="rounded-full bg-teal-50 px-2.5 py-1 text-[11px] font-black text-teal-700">
              Priority {item.priority || 0}
            </span>
            {item.leadScore != null && (
              <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-black text-indigo-700">
                Score {item.leadScore}
              </span>
            )}
          </div>
          <h3 className="mt-3 truncate text-base font-black text-slate-950">
            {item.opportunityTitle || item.contactName || "CRM record"}
          </h3>
          <p className="mt-1 text-sm font-semibold text-slate-600">
            {item.contactName || "Unknown contact"}
            {item.pipelineName ? ` · ${item.pipelineName}` : ""}
            {item.stage ? ` · ${item.stage}` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onSelect(item)}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-teal-700 px-3 py-2 text-sm font-black text-white hover:bg-teal-800"
        >
          <Sparkles size={16} />
          Get AI recommendation
        </button>
      </div>

      <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">
        {item.summary || "Ask AI to recommend the next best action for this CRM record."}
      </p>

      <div className="mt-4 grid gap-2 text-xs font-bold text-slate-500 sm:grid-cols-2">
        {item.dueAt && (
          <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2">
            <Clock3 size={14} />
            Due {formatDateTime(item.dueAt)}
          </div>
        )}
        {item.lastActivityAt && (
          <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2">
            <CalendarClock size={14} />
            Activity {formatDateTime(item.lastActivityAt)}
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={() => onOpen(item)}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-black text-slate-700 hover:border-teal-300 hover:bg-teal-50"
        >
          Open Record
          <ArrowRight size={16} />
        </button>
        {item.contactId && (
          <button
            type="button"
            onClick={() => onCreateTask(item)}
            disabled={taskCreating === item.id}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-black text-slate-700 hover:border-amber-300 hover:bg-amber-50 disabled:opacity-60"
          >
            {taskCreating === item.id ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
            Create Follow-up
          </button>
        )}
      </div>
    </article>
  );
}

function LeadInboxCard({ item, selected, onSelect, onOpen, onCreateTask, taskCreating }) {
  return (
    <article className={`rounded-xl border bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
      selected ? "border-teal-400 ring-2 ring-teal-100" : "border-slate-200"
    }`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-black text-indigo-700">
              Score {item.leadScore ?? "-"}
            </span>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-black uppercase tracking-wide text-slate-700">
              {item.leadSource || "Unknown source"}
            </span>
            {item.hasOpenTask && <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-black text-emerald-700">Task open</span>}
            {item.hasOpenOpportunity && <span className="rounded-full bg-teal-50 px-2.5 py-1 text-[11px] font-black text-teal-700">Opportunity open</span>}
          </div>
          <h3 className="mt-3 truncate text-base font-black text-slate-950">{item.contactName || "Unknown contact"}</h3>
          <p className="mt-1 truncate text-sm font-semibold text-slate-600">
            {item.contactPhone || item.contactEmail || "No contact detail"}
            {item.city ? ` · ${item.city}` : ""}
            {item.openOpportunityStage ? ` · ${item.openOpportunityStage}` : item.stage ? ` · ${item.stage}` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onSelect(toAiContext(item))}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-teal-700 px-3 py-2 text-sm font-black text-white hover:bg-teal-800 sm:w-auto"
        >
          <Sparkles size={16} />
          Get AI recommendation
        </button>
      </div>
      <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">{item.summary}</p>
      {item.leadScoreUpdatedAt && (
        <p className="mt-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">
          Score updated {formatDateTime(item.leadScoreUpdatedAt)}
        </p>
      )}
      {item.leadScoreReason && (
        <p className="mt-3 line-clamp-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs font-semibold leading-5 text-slate-600">
          {item.leadScoreReason}
        </p>
      )}
      {item.openOpportunityTitle && (
        <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700">
          {item.openOpportunityTitle}
        </p>
      )}
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={() => onOpen(item)}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-black text-slate-700 hover:border-teal-300 hover:bg-teal-50"
        >
          Open Record
          <ArrowRight size={16} />
        </button>
        {item.contactId && (
          <button
            type="button"
            onClick={() => onCreateTask(item)}
            disabled={taskCreating === item.id}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-black text-slate-700 hover:border-amber-300 hover:bg-amber-50 disabled:opacity-60"
          >
            {taskCreating === item.id ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
            Create Follow-up
          </button>
        )}
      </div>
    </article>
  );
}

function toAiContext(item) {
  if (!item) return null;
  if (item.reasonKey) return item;
  return {
    id: item.id,
    reasonKey: item.sectionKey,
    reasonLabel: item.sectionLabel,
    priority: item.leadScore,
    contactId: item.contactId,
    contactName: item.contactName,
    contactPhone: item.contactPhone,
    opportunityId: item.openOpportunityId,
    opportunityTitle: item.openOpportunityTitle,
    stage: item.openOpportunityStage || item.stage,
    targetPath: item.targetPath,
    summary: item.summary,
    leadScore: item.leadScore,
  };
}

function AiHelpModal({ item, onClose }) {
  const title = item.opportunityTitle || item.contactName || "Selected CRM record";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-3 sm:p-6">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="border-b border-slate-200 px-4 py-4 sm:px-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-teal-700">AI help for this record</p>
              <h2 className="mt-1 truncate text-xl font-black text-slate-950">{title}</h2>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
                Choose what you want AI to do. Summary explains the record, Reply drafts a customer message, and Recommendation gives the next best sales action.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-200 px-4 py-2 text-sm font-black text-slate-700 hover:bg-slate-50"
            >
              Close
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold text-slate-600">
            {item.contactName && <span className="rounded-full bg-slate-100 px-2.5 py-1">Contact: {item.contactName}</span>}
            {item.stage && <span className="rounded-full bg-slate-100 px-2.5 py-1">Stage: {item.stage}</span>}
            {item.leadScore != null && <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-indigo-700">Score: {item.leadScore}</span>}
            {item.reasonLabel && <span className="rounded-full bg-teal-50 px-2.5 py-1 text-teal-700">{item.reasonLabel}</span>}
          </div>
        </div>
        <div className="overflow-y-auto p-4 sm:p-5">
          <AiAssistPanel
            contactId={item.contactId}
            opportunityId={item.opportunityId}
            title={title}
            contextPrompt={recommendationPrompt(item)}
            replyPrompt={replyPrompt(item)}
          />
        </div>
      </div>
    </div>
  );
}

export default function AiWorkQueue() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("queue");
  const [items, setItems] = useState([]);
  const [leadInbox, setLeadInbox] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inboxLoading, setInboxLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [selectedItem, setSelectedItem] = useState(null);
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [taskCreating, setTaskCreating] = useState("");

  const grouped = useMemo(() => {
    const byGroup = new Map(GROUPS.map((group) => [group.key, []]));
    for (const item of items) {
      const key = byGroup.has(item.groupKey) ? item.groupKey : "WATCH";
      byGroup.get(key).push(item);
    }
    return GROUPS.map((group) => ({ ...group, items: byGroup.get(group.key) || [] }));
  }, [items]);

  const inboxGrouped = useMemo(() => {
    const byGroup = new Map(INBOX_GROUPS.map((group) => [group.key, []]));
    for (const item of leadInbox) {
      const key = byGroup.has(item.sectionKey) ? item.sectionKey : "5_NURTURE";
      byGroup.get(key).push(item);
    }
    return INBOX_GROUPS.map((group) => ({ ...group, items: byGroup.get(group.key) || [] }));
  }, [leadInbox]);

  const loadQueue = async () => {
    setLoading(true);
    setMessage("");
    try {
      const response = await api.get("/api/ai/work-queue");
      const nextItems = Array.isArray(response.data) ? response.data : [];
      setItems(nextItems);
      setSelectedItem((current) => {
        if (!current) return nextItems[0] || null;
        return nextItems.find((item) => item.id === current.id) || nextItems[0] || null;
      });
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const loadLeadInbox = async () => {
    setInboxLoading(true);
    setMessage("");
    try {
      const response = await api.get("/api/ai/lead-inbox");
      const nextItems = Array.isArray(response.data) ? response.data : [];
      setLeadInbox(nextItems);
      setSelectedItem((current) => current || toAiContext(nextItems[0]) || null);
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setInboxLoading(false);
    }
  };

  useEffect(() => {
    loadQueue();
    loadLeadInbox();
  }, []);

  const openRecord = (item) => {
    const opportunityId = item.opportunityId || item.openOpportunityId;
    navigate(item.targetPath || (opportunityId ? `/dashboard/opportunities/${opportunityId}` : "/dashboard/contacts"));
  };

  const openAiHelp = (item) => {
    setSelectedItem(item);
    setAiModalOpen(true);
  };

  const createTask = async (item) => {
    if (!item.contactId) return;
    setTaskCreating(item.id);
    setMessage("");
    try {
      const dueAt = new Date();
      dueAt.setDate(dueAt.getDate() + 1);
      dueAt.setHours(10, 0, 0, 0);
      await api.post(`/api/contacts/${item.contactId}/tasks`, {
        title: `Follow up: ${item.reasonLabel || item.sectionLabel || "AI Work Queue"}`,
        description: item.summary || "Follow up from AI Work Queue.",
        priority: item.priority >= 80 ? "HIGH" : item.priority >= 50 ? "MEDIUM" : "LOW",
        dueAt: dueAt.toISOString(),
      });
      setMessage("Follow-up task created for tomorrow at 10:00.");
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setTaskCreating("");
    }
  };

  const urgentCount = items.filter((item) => item.groupKey === "URGENT").length;
  const hotCount = leadInbox.filter((item) => item.sectionKey === "1_HOT").length;

  return (
    <div className="min-h-screen bg-slate-50 p-4 text-slate-950 sm:p-6">
      <div className="mx-auto max-w-7xl space-y-5">
        <header className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-teal-700">AI Work Queue</p>
              <h1 className="mt-2 text-2xl font-black tracking-tight">AI-prioritized leads and opportunities</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
                This queue finds records that deserve attention: overdue follow-ups, stale opportunities, close-soon deals, appointments, and high-score leads. Loading this page does not use AI credits.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-black text-rose-800">
                {urgentCount} urgent
              </div>
              <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm font-black text-indigo-800">
                {hotCount} hot leads
              </div>
              <button
                type="button"
                onClick={() => {
                  loadQueue();
                  loadLeadInbox();
                }}
                disabled={loading || inboxLoading}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white hover:bg-teal-700 disabled:opacity-60"
              >
                {loading || inboxLoading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCcw size={16} />}
                Refresh
              </button>
            </div>
          </div>
        </header>

        <div className="flex gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
          <button
            type="button"
            onClick={() => setActiveTab("queue")}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-black ${activeTab === "queue" ? "bg-slate-950 text-white" : "text-slate-600 hover:bg-slate-50"}`}
          >
            Work Queue
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("inbox")}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-black ${activeTab === "inbox" ? "bg-slate-950 text-white" : "text-slate-600 hover:bg-slate-50"}`}
          >
            Lead Inbox
          </button>
        </div>

        {message && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900">
            {message}
          </div>
        )}

        <div className="space-y-5">
          <section className="space-y-5">
            {activeTab === "queue" && loading ? (
              <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
                <Loader2 className="mx-auto animate-spin text-teal-700" size={28} />
                <p className="mt-3 text-sm font-bold text-slate-500">Finding the best CRM work to focus on...</p>
              </div>
            ) : activeTab === "queue" && items.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
                <Bot className="mx-auto text-teal-700" size={34} />
                <h2 className="mt-3 text-lg font-black">No AI-priority work found</h2>
                <p className="mt-2 text-sm text-slate-500">You are clear for now. New overdue tasks, stale deals, or high-score leads will appear here.</p>
              </div>
            ) : activeTab === "queue" ? (
              grouped.map((group) => {
                const Icon = group.icon;
                return (
                  <section key={group.key} className="space-y-3">
                    <div className={`flex flex-col gap-2 rounded-xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${group.tone}`}>
                      <div className="flex items-center gap-3">
                        <Icon size={18} />
                        <div>
                          <h2 className="text-sm font-black uppercase tracking-wide">{group.label}</h2>
                          <p className="text-xs font-semibold opacity-80">{group.helper}</p>
                        </div>
                      </div>
                      <span className="text-sm font-black">{group.items.length} item{group.items.length === 1 ? "" : "s"}</span>
                    </div>
                    {group.items.length > 0 && (
                      <div className="grid gap-3 lg:grid-cols-2">
                        {group.items.map((item) => (
                          <QueueCard
                            key={item.id}
                            item={item}
                            selected={selectedItem?.id === item.id}
                            onSelect={openAiHelp}
                            onOpen={openRecord}
                            onCreateTask={createTask}
                            taskCreating={taskCreating}
                          />
                        ))}
                      </div>
                    )}
                  </section>
                );
              })
            ) : inboxLoading ? (
              <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
                <Loader2 className="mx-auto animate-spin text-teal-700" size={28} />
                <p className="mt-3 text-sm font-bold text-slate-500">Loading scored leads...</p>
              </div>
            ) : leadInbox.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
                <Inbox className="mx-auto text-teal-700" size={34} />
                <h2 className="mt-3 text-lg font-black">No scored leads yet</h2>
                <p className="mt-2 text-sm text-slate-500">Run AI lead scoring manually or from automation rules, then scored leads will appear here.</p>
              </div>
            ) : (
              inboxGrouped.map((group) => {
                const Icon = group.icon;
                return (
                  <section key={group.key} className="space-y-3">
                    <div className={`flex flex-col gap-2 rounded-xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${group.tone}`}>
                      <div className="flex items-center gap-3">
                        <Icon size={18} />
                        <div>
                          <h2 className="text-sm font-black uppercase tracking-wide">{group.label}</h2>
                          <p className="text-xs font-semibold opacity-80">{group.helper}</p>
                        </div>
                      </div>
                      <span className="text-sm font-black">{group.items.length} lead{group.items.length === 1 ? "" : "s"}</span>
                    </div>
                    {group.items.length > 0 && (
                      <div className="grid gap-3 lg:grid-cols-2">
                        {group.items.map((item) => (
                          <LeadInboxCard
                            key={item.id}
                            item={item}
                            selected={selectedItem?.id === item.id}
                            onSelect={openAiHelp}
                            onOpen={openRecord}
                            onCreateTask={createTask}
                            taskCreating={taskCreating}
                          />
                        ))}
                      </div>
                    )}
                  </section>
                );
              })
            )}
          </section>
        </div>

        {aiModalOpen && selectedItem && (
          <AiHelpModal
            item={selectedItem}
            onClose={() => setAiModalOpen(false)}
          />
        )}
      </div>
    </div>
  );
}
