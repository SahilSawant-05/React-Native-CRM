import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  Clock3,
  MessageSquareText,
  RefreshCw,
  Target,
  UserPlus,
} from "lucide-react";
import api from "../api/axios";

const sectionMeta = {
  OVERDUE_TASKS: { icon: AlertCircle, accent: "text-red-700 bg-red-50 border-red-100" },
  UNREAD_CHATS: { icon: MessageSquareText, accent: "text-teal-700 bg-teal-50 border-teal-100" },
  TODAY_TASKS: { icon: Clock3, accent: "text-blue-700 bg-blue-50 border-blue-100" },
  TODAY_APPOINTMENTS: { icon: CalendarClock, accent: "text-amber-700 bg-amber-50 border-amber-100" },
  NEW_LEADS: { icon: UserPlus, accent: "text-emerald-700 bg-emerald-50 border-emerald-100" },
  STALE_OPPORTUNITIES: { icon: Target, accent: "text-violet-700 bg-violet-50 border-violet-100" },
};

function formatIndustry(value) {
  return String(value || "All industries").replaceAll("_", " ");
}

function formatDateTime(value) {
  if (!value) return "No time set";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function priorityClass(priority) {
  if (priority === "HIGH") return "bg-red-50 text-red-700";
  if (priority === "MEDIUM") return "bg-amber-50 text-amber-700";
  return "bg-slate-100 text-slate-600";
}

function WorkItem({ item }) {
  return (
    <article className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-extrabold text-gray-950">{item.title || item.contactName}</h3>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${priorityClass(item.priority)}`}>
              {item.priority || "LOW"}
            </span>
          </div>
          <p className="mt-1 line-clamp-2 text-sm text-gray-500">{item.description || item.contactPhone || "No details yet"}</p>
        </div>
        {item.targetPath && (
          <Link
            to={item.targetPath}
            className="shrink-0 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-bold text-gray-700 hover:border-teal-300 hover:bg-teal-50 hover:text-teal-800"
          >
            Open
          </Link>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-gray-500">
        {item.contactName && <span className="rounded-full bg-slate-100 px-2 py-1">{item.contactName}</span>}
        {item.status && <span className="rounded-full bg-slate-100 px-2 py-1">{item.status}</span>}
        {(item.dueAt || item.occurredAt) && (
          <span className="rounded-full bg-slate-100 px-2 py-1">{formatDateTime(item.dueAt || item.occurredAt)}</span>
        )}
      </div>
    </article>
  );
}

function WorkSection({ section }) {
  const meta = sectionMeta[section.key] || {};
  const Icon = meta.icon || CheckCircle2;

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className={`rounded-lg border p-2 ${meta.accent || "border-slate-100 bg-slate-50 text-slate-700"}`}>
            <Icon size={20} />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-gray-950">{section.label}</h2>
            <p className="mt-1 text-sm text-gray-500">{section.description}</p>
          </div>
        </div>
        <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-extrabold text-gray-700">
          {section.count}
        </span>
      </div>

      {section.items?.length ? (
        <div className="space-y-3">
          {section.items.map((item, index) => (
            <WorkItem key={`${section.key}-${item.id || item.contactId || index}`} item={item} />
          ))}
          {section.count > section.items.length && (
            <p className="text-xs font-semibold text-gray-500">Showing first {section.items.length} of {section.count}.</p>
          )}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-7 text-center text-sm text-gray-500">
          Nothing pending here.
        </div>
      )}
    </section>
  );
}

export default function WorkQueue() {
  const [queue, setQueue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  async function loadQueue(silent = false) {
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const response = await api.get("/api/work-queue/today");
      setQueue(response.data);
    } catch (err) {
      setError(err?.response?.data?.message || err.message || "Failed to load work queue");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadQueue();
  }, []);

  const orderedSections = useMemo(() => queue?.sections || [], [queue]);

  if (loading) {
    return <div className="min-h-screen bg-slate-50 p-6 text-sm text-gray-500">Loading work queue...</div>;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 text-gray-900">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-teal-700">Work Queue</p>
              <h1 className="mt-2 text-2xl font-extrabold text-gray-950">Today View</h1>
              <p className="mt-1 text-sm text-gray-500">
                {queue?.recommendedFocus || "Review the highest priority CRM work first."}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-bold text-slate-700">
                {formatIndustry(queue?.activeIndustryKey)}
              </span>
              <span className="rounded-lg bg-teal-50 px-3 py-2 text-sm font-extrabold text-teal-800">
                {queue?.totalCount || 0} pending
              </span>
              <button
                type="button"
                onClick={() => loadQueue(true)}
                disabled={refreshing}
                className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-sm font-bold text-white hover:bg-teal-800 disabled:opacity-60"
              >
                <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
                Refresh
              </button>
            </div>
          </div>
        </header>

        <div className="grid gap-5 xl:grid-cols-2">
          {orderedSections.map((section) => (
            <WorkSection key={section.key} section={section} />
          ))}
        </div>
      </div>
    </div>
  );
}
