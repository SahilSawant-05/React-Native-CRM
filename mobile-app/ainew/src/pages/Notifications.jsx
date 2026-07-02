import { useCallback, useEffect, useMemo, useState } from "react";
import { Bell, CheckCircle2, ChevronLeft, ChevronRight, Inbox, MailOpen, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import DateRangeFilter, { dateRangeParams, presetDateRange } from "../components/common/DateRangeFilter";

const PAGE_SIZE = 20;
const TABS = [
  { key: "ALL", label: "All" },
  { key: "UNREAD", label: "Unread" },
  { key: "READ", label: "Read" },
];

const labelFor = (value) => String(value || "GENERAL").replaceAll("_", " ");

const formatDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const readError = (error, fallback) => {
  const data = error?.response?.data;
  return data?.message || data?.error || (typeof data === "string" ? data : null) || error.message || fallback;
};

export default function Notifications() {
  const navigate = useNavigate();
  const [summary, setSummary] = useState({
    unreadCount: 0,
    readCount: 0,
    totalCount: 0,
    totalElements: 0,
    page: 0,
    size: PAGE_SIZE,
    totalPages: 0,
    items: [],
  });
  const [activeTab, setActiveTab] = useState("ALL");
  const [datePreset, setDatePreset] = useState("30D");
  const [dateRange, setDateRange] = useState(() => presetDateRange("30D"));
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const response = await api.get("/api/notifications", {
        params: { status: activeTab, ...dateRangeParams(dateRange), page, size: PAGE_SIZE },
      });
      const data = response.data || {};
      const items = Array.isArray(data.items) ? data.items : [];
      setSummary({
        unreadCount: data.unreadCount || 0,
        readCount: data.readCount || 0,
        totalCount: data.totalCount ?? items.length,
        totalElements: data.totalElements ?? items.length,
        page: data.page || 0,
        size: data.size || PAGE_SIZE,
        totalPages: data.totalPages || 0,
        items,
      });
    } catch (error) {
      setMessage(readError(error, "Failed to load notifications"));
      setSummary((current) => ({ ...current, items: [] }));
    } finally {
      setLoading(false);
    }
  }, [activeTab, page, dateRange]);

  useEffect(() => {
    load();
  }, [load]);

  const tabCounts = useMemo(() => ({
    ALL: summary.totalCount,
    UNREAD: summary.unreadCount,
    READ: summary.readCount,
  }), [summary.readCount, summary.totalCount, summary.unreadCount]);

  const switchTab = (tab) => {
    setActiveTab(tab);
    setPage(0);
  };

  const markRead = async (notification, read = true) => {
    try {
      await api.post(`/api/notifications/${notification.id}/read`, null, { params: { read } });
      await load();
    } catch (error) {
      setMessage(readError(error, "Failed to update notification"));
    }
  };

  const openNotification = async (notification) => {
    if (!notification.readAt) {
      await markRead(notification, true);
    }
    if (notification.targetPath) {
      navigate(notification.targetPath);
    }
  };

  const markAllRead = async () => {
    try {
      await api.post("/api/notifications/read-all");
      setPage(0);
      await load();
    } catch (error) {
      setMessage(readError(error, "Failed to mark notifications read"));
    }
  };

  const canPrevious = page > 0;
  const canNext = summary.totalPages > 0 && page < summary.totalPages - 1;

  return (
    <main className="min-h-screen bg-slate-50 p-3 text-gray-900 sm:p-6">
      <div className="mx-auto max-w-6xl space-y-5">
        <header className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
                  <Bell size={22} />
                </span>
                <div>
                  <h1 className="text-2xl font-extrabold text-gray-950">Notification Center</h1>
                  <p className="mt-1 text-sm text-gray-500">
                    {summary.unreadCount} unread of {summary.totalCount} total notifications.
                  </p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
              <button
                type="button"
                onClick={load}
                className="inline-flex min-w-0 items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 sm:px-4"
              >
                <RefreshCw size={16} />
                Refresh
              </button>
              <button
                type="button"
                onClick={markAllRead}
                disabled={summary.unreadCount === 0}
                className="inline-flex min-w-0 items-center justify-center gap-2 rounded-lg bg-teal-700 px-3 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50 sm:px-4"
              >
                <CheckCircle2 size={16} />
                Mark All Read
              </button>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <StatCard icon={Inbox} label="Total" value={summary.totalCount} tone="slate" />
            <StatCard icon={Bell} label="Unread" value={summary.unreadCount} tone="teal" />
            <StatCard icon={MailOpen} label="Read" value={summary.readCount} tone="emerald" />
          </div>
        </header>

        {message && (
          <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {message}
          </div>
        )}

        <DateRangeFilter
          value={dateRange}
          preset={datePreset}
          onChange={(nextRange) => {
            setPage(0);
            setDateRange(nextRange);
          }}
          onPresetChange={setDatePreset}
          compact
        />

        <section className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-gray-100 p-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex w-full overflow-x-auto rounded-lg bg-slate-100 p-1 lg:w-fit">
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => switchTab(tab.key)}
                  className={`rounded-md px-4 py-2 text-sm font-bold transition ${
                    activeTab === tab.key
                      ? "bg-white text-teal-700 shadow-sm"
                      : "text-gray-500 hover:text-gray-900"
                  }`}
                >
                  {tab.label}
                  <span className="ml-2 rounded-full bg-slate-200 px-2 py-0.5 text-xs text-gray-600">
                    {tabCounts[tab.key] || 0}
                  </span>
                </button>
              ))}
            </div>

            <Pagination
              page={page}
              totalPages={summary.totalPages}
              totalElements={summary.totalElements}
              canPrevious={canPrevious}
              canNext={canNext}
              onPrevious={() => setPage((current) => Math.max(current - 1, 0))}
              onNext={() => setPage((current) => current + 1)}
            />
          </div>

          {loading ? (
            <div className="p-10 text-center text-sm text-gray-500">Loading notifications...</div>
          ) : summary.items.length === 0 ? (
            <EmptyState activeTab={activeTab} />
          ) : (
            <div className="max-h-[calc(100vh-360px)] min-h-[360px] overflow-y-auto divide-y divide-gray-100">
              {summary.items.map((notification) => (
                <NotificationRow
                  key={notification.id}
                  notification={notification}
                  onOpen={() => openNotification(notification)}
                  onToggleRead={() => markRead(notification, Boolean(notification.readAt) ? false : true)}
                />
              ))}
            </div>
          )}

          <div className="border-t border-gray-100 p-4">
            <Pagination
              page={page}
              totalPages={summary.totalPages}
              totalElements={summary.totalElements}
              canPrevious={canPrevious}
              canNext={canNext}
              onPrevious={() => setPage((current) => Math.max(current - 1, 0))}
              onNext={() => setPage((current) => current + 1)}
            />
          </div>
        </section>
      </div>
    </main>
  );
}

function NotificationRow({ notification, onOpen, onToggleRead }) {
  const unread = !notification.readAt;
  return (
    <article className={`group px-3 py-4 transition hover:bg-slate-50 sm:px-5 ${unread ? "bg-teal-50/50" : "bg-white"}`}>
      <div className="flex min-w-0 gap-3 sm:gap-4">
        <span className={`mt-1 h-2.5 w-2.5 flex-shrink-0 rounded-full ${unread ? "bg-teal-600" : "bg-gray-300"}`} />
        <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-700">
              {labelFor(notification.type)}
            </span>
            {unread && <span className="rounded-full bg-teal-600 px-2 py-0.5 text-xs font-semibold text-white">Unread</span>}
            {notification.targetType && (
              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">
                {labelFor(notification.targetType)}
              </span>
            )}
          </div>
          <h2 className={`mt-2 line-clamp-1 text-sm ${unread ? "font-extrabold text-gray-950" : "font-bold text-gray-800"}`}>
            {notification.title}
          </h2>
          {notification.body && (
            <p className="mt-1 line-clamp-2 text-sm leading-6 text-gray-600">{notification.body}</p>
          )}
          <p className="mt-2 text-xs font-medium text-gray-400">{formatDate(notification.createdAt)}</p>
        </button>
        <button
          type="button"
          onClick={onToggleRead}
          className="h-fit shrink-0 rounded-lg border border-gray-300 px-2 py-2 text-xs font-bold text-gray-700 opacity-100 hover:bg-white sm:px-3 sm:opacity-0 sm:group-hover:opacity-100"
        >
          {unread ? "Mark read" : "Mark unread"}
        </button>
      </div>
    </article>
  );
}

function Pagination({ page, totalPages, totalElements, canPrevious, canNext, onPrevious, onNext }) {
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500">
      <span>
        {totalElements} record{totalElements === 1 ? "" : "s"}
        {totalPages > 1 ? ` / page ${page + 1} of ${totalPages}` : ""}
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={!canPrevious}
          onClick={onPrevious}
          className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ChevronLeft size={14} />
          Prev
        </button>
        <button
          type="button"
          disabled={!canNext}
          onClick={onNext}
          className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Next
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, tone }) {
  const tones = {
    slate: "bg-slate-50 text-slate-700",
    teal: "bg-teal-50 text-teal-700",
    emerald: "bg-emerald-50 text-emerald-700",
  };
  return (
    <div className="rounded-lg border border-gray-100 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <span className={`inline-flex h-10 w-10 items-center justify-center rounded-lg ${tones[tone] || tones.slate}`}>
          <Icon size={18} />
        </span>
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-gray-400">{label}</p>
          <p className="text-xl font-extrabold text-gray-950">{value}</p>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ activeTab }) {
  const label = activeTab === "UNREAD" ? "No unread notifications." : activeTab === "READ" ? "No read notifications yet." : "No notifications yet.";
  return (
    <div className="flex min-h-[360px] flex-col items-center justify-center px-6 py-12 text-center">
      <span className="inline-flex h-14 w-14 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
        <Inbox size={24} />
      </span>
      <h2 className="mt-4 text-base font-extrabold text-gray-950">{label}</h2>
      <p className="mt-1 max-w-md text-sm leading-6 text-gray-500">
        New tasks, email replies, appointments, and automation alerts will appear here.
      </p>
    </div>
  );
}
