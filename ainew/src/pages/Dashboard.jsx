import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import useAuth from "../hooks/useAuth";

function SummaryCard({ label, value, accent, helper }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className={`mb-3 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${accent}`}>
        {label}
      </div>
      <div className="text-3xl font-bold text-gray-900">{value}</div>
      {helper && <p className="mt-2 text-sm text-gray-500">{helper}</p>}
    </div>
  );
}

function StatRow({ label, value }) {
  return (
    <div className="flex items-center justify-between border-b border-gray-100 py-3 last:border-0">
      <span className="text-sm text-gray-600">{label}</span>
      <span className="text-sm font-semibold text-gray-900">{value}</span>
    </div>
  );
}

function BreakdownList({ title, items = [], amountLabel = false }) {
  const max = Math.max(1, ...items.map((item) => Number(item.count ?? 0)));

  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-bold text-gray-900">{title}</h2>
      <div className="mt-4 space-y-4">
        {items.length === 0 ? (
          <p className="text-sm text-gray-500">No data yet.</p>
        ) : (
          items.slice(0, 6).map((item) => {
            const count = Number(item.count ?? 0);
            const width = Math.max(8, Math.round((count / max) * 100));
            return (
              <div key={item.label}>
                <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                  <span className="font-medium text-gray-700">{formatLabel(item.label)}</span>
                  <span className="text-gray-500">
                    {count}
                    {amountLabel && Number(item.amount ?? 0) > 0 ? ` · ${formatCurrency(item.amount)}` : ""}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-gray-100">
                  <div className="h-2 rounded-full bg-teal-500" style={{ width: `${width}%` }} />
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}

function TrendCard({ label, value, helper, accent }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className={`mb-3 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${accent}`}>
        {label}
      </div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      <p className="mt-2 text-sm text-gray-500">{helper}</p>
    </div>
  );
}

function ActionButton({ label, helper, onClick, accent = "bg-white" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-2xl border border-gray-200 px-4 py-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-teal-300 hover:shadow ${accent}`}
    >
      <div className="text-sm font-semibold text-gray-900">{label}</div>
      <div className="mt-1 text-xs text-gray-500">{helper}</div>
    </button>
  );
}

function AttentionCard({ title, items }) {
  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-bold text-gray-900">{title}</h2>
      <div className="mt-4 space-y-3">
        {items.map((item) => (
          <div
            key={item.label}
            className="flex items-start justify-between gap-4 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3"
          >
            <div>
              <div className="text-sm font-semibold text-gray-900">{item.label}</div>
              <div className="mt-1 text-xs text-gray-500">{item.helper}</div>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${item.accent}`}>
              {item.value}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function formatDateTime(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return value;
  }
}

function formatCurrency(value) {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0);
}

function formatLabel(value) {
  return String(value || "Unknown").replaceAll("_", " ");
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { isAdmin, role } = useAuth();
  const [summary, setSummary] = useState(null);
  const [reports, setReports] = useState(null);
  const [notifications, setNotifications] = useState({ unreadCount: 0, items: [] });
  const [campaignHistory, setCampaignHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let ignore = false;

    async function loadSummary() {
      setLoading(true);
      setError("");
      try {
        const [summaryResponse, historyResponse] = await Promise.allSettled([
          api.get("/api/dashboard/summary"),
          isAdmin ? api.get("/api/campaigns/history") : Promise.resolve({ data: [] }),
        ]);
        const [reportsResponse, notificationsResponse] = await Promise.all([
          api.get("/api/reports/summary"),
          api.get("/api/notifications"),
        ]);

        if (summaryResponse.status !== "fulfilled") {
          throw summaryResponse.reason;
        }

        if (!ignore) {
          setSummary(summaryResponse.value.data);
          setReports(reportsResponse.data);
          setNotifications({
            unreadCount: notificationsResponse.data?.unreadCount || 0,
            items: Array.isArray(notificationsResponse.data?.items) ? notificationsResponse.data.items.slice(0, 4) : [],
          });
          if (historyResponse.status === "fulfilled") {
            setCampaignHistory(Array.isArray(historyResponse.value.data) ? historyResponse.value.data : []);
          } else {
            setCampaignHistory([]);
          }
        }
      } catch (err) {
        if (!ignore) {
          setError(err?.response?.data?.message || err.message || "Failed to load dashboard summary");
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    loadSummary();
    return () => {
      ignore = true;
    };
  }, []);

  const headlineCards = useMemo(() => {
    if (!summary) return [];

    return [
      {
        label: "Contacts",
        value: summary.contacts?.totalContacts ?? 0,
        helper: `${summary.contacts?.assignedToMeCount ?? 0} assigned to you`,
        accent: "bg-blue-50 text-blue-700",
      },
      {
        label: "Unread Inbox",
        value: summary.inbox?.unreadConversations ?? 0,
        helper: `${summary.inbox?.openConversations ?? 0} open conversations`,
        accent: "bg-amber-50 text-amber-700",
      },
      {
        label: "My Open Tasks",
        value: summary.tasks?.myOpenCount ?? 0,
        helper: `${summary.tasks?.todayCount ?? 0} due today`,
        accent: "bg-emerald-50 text-emerald-700",
      },
      {
        label: "Notifications",
        value: notifications.unreadCount ?? 0,
        helper: "Unread CRM alerts",
        accent: "bg-rose-50 text-rose-700",
      },
      {
        label: "Campaigns",
        value: summary.campaigns?.available ? summary.campaigns?.totalCampaigns ?? 0 : "—",
        helper: summary.campaigns?.available ? `${summary.campaigns?.sendingCount ?? 0} sending now` : "Campaign metrics are admin-only",
        accent: "bg-purple-50 text-purple-700",
      },
      {
        label: "Pipeline",
        value: reports?.totalOpportunities ?? 0,
        helper: `${formatCurrency(reports?.totalPipelineValue ?? 0)} open value captured`,
        accent: "bg-cyan-50 text-cyan-700",
      },
    ];
  }, [summary, reports, notifications]);

  const campaignTrends = useMemo(() => {
    if (!isAdmin || campaignHistory.length === 0) return null;

    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

    const recent = campaignHistory.filter((campaign) => {
      const ts = new Date(campaign.createdAt || campaign.scheduledAt || 0).getTime();
      return ts >= sevenDaysAgo;
    });

    const today = campaignHistory.filter((campaign) => {
      const ts = new Date(campaign.createdAt || campaign.scheduledAt || 0).getTime();
      return ts >= oneDayAgo;
    });

    return {
      campaignsLast7Days: recent.length,
      messagesToday: today.reduce((sum, campaign) => sum + Number(campaign.totalMessages ?? 0), 0),
      deliveredLast7Days: recent.reduce((sum, campaign) => sum + Number(campaign.deliveredMessages ?? 0), 0),
      failedLast7Days: recent.reduce((sum, campaign) => sum + Number(campaign.failedMessages ?? 0), 0),
      readLast7Days: recent.reduce((sum, campaign) => sum + Number(campaign.readMessages ?? 0), 0),
      recentCampaigns: [...campaignHistory]
        .sort((a, b) => new Date(b.createdAt || b.scheduledAt || 0) - new Date(a.createdAt || a.scheduledAt || 0))
        .slice(0, 5),
    };
  }, [campaignHistory, isAdmin]);

  const todayWork = useMemo(() => {
    if (!summary) return [];

    return [
      {
        label: "Unread conversations",
        value: summary.inbox?.unreadConversations ?? 0,
        helper: "Customers waiting for a reply in the inbox.",
        accent: "bg-amber-50 text-amber-700",
      },
      {
        label: "Overdue tasks",
        value: summary.tasks?.overdueCount ?? 0,
        helper: "Follow-ups that already slipped past their due time.",
        accent: "bg-red-50 text-red-700",
      },
      {
        label: "Due today",
        value: summary.tasks?.todayCount ?? 0,
        helper: "Tasks that should be finished before the day ends.",
        accent: "bg-blue-50 text-blue-700",
      },
      {
        label: "My open tasks",
        value: summary.tasks?.myOpenCount ?? 0,
        helper: "Active work currently assigned to you.",
        accent: "bg-emerald-50 text-emerald-700",
      },
    ];
  }, [summary]);

  const quickActions = useMemo(() => {
    const actions = [
      {
        label: "Open Inbox",
        helper: `${summary?.inbox?.unreadConversations ?? 0} unread conversations to review`,
        onClick: () => navigate("/dashboard/chat"),
        accent: "bg-amber-50/60",
      },
      {
        label: "Review Tasks",
        helper: `${summary?.tasks?.overdueCount ?? 0} overdue and ${summary?.tasks?.todayCount ?? 0} due today`,
        onClick: () => navigate("/dashboard/task"),
        accent: "bg-blue-50/60",
      },
      {
        label: "Manage Contacts",
        helper: `${summary?.contacts?.openConversations ?? 0} open conversations across visible contacts`,
        onClick: () => navigate("/dashboard/contacts"),
        accent: "bg-emerald-50/60",
      },
    ];

    if (isAdmin) {
      actions.push({
        label: "Review Campaigns",
        helper: `${summary?.campaigns?.sendingCount ?? 0} sending and ${summary?.campaigns?.failedCount ?? 0} failed`,
        onClick: () => navigate("/dashboard/campaigns/create"),
        accent: "bg-purple-50/60",
      });
    }

    return actions;
  }, [navigate, summary, isAdmin]);

  const operatorAlerts = useMemo(() => {
    if (!summary) return [];

    const alerts = [];

    if ((summary.tasks?.overdueCount ?? 0) > 0) {
      alerts.push({
        label: "Follow-up backlog",
        helper: "Clear overdue tasks first so contact follow-ups do not stall.",
        value: `${summary.tasks.overdueCount} overdue`,
        accent: "bg-red-50 text-red-700",
      });
    }

    if ((summary.inbox?.unreadConversations ?? 0) > 0) {
      alerts.push({
        label: "Inbox waiting",
        helper: "Unread inbound chats usually need the fastest operator response.",
        value: `${summary.inbox.unreadConversations} unread`,
        accent: "bg-amber-50 text-amber-700",
      });
    }

    if ((summary.contacts?.assignedToMeCount ?? 0) > 0) {
      alerts.push({
        label: "Owned conversations",
        helper: "These contacts are already assigned to you and worth checking early.",
        value: `${summary.contacts.assignedToMeCount} owned`,
        accent: "bg-blue-50 text-blue-700",
      });
    }

    if (summary.campaigns?.available && (summary.campaigns?.failedCount ?? 0) > 0) {
      alerts.push({
        label: "Campaign failures",
        helper: "Review failed campaign deliveries before the next audience push.",
        value: `${summary.campaigns.failedCount} failed`,
        accent: "bg-rose-50 text-rose-700",
      });
    }

    return alerts;
  }, [summary]);

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 p-8">
        <div className="rounded-2xl border border-gray-100 bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="mt-2 text-sm text-gray-500">Loading live CRM summary…</p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-gray-50 p-8">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-8 shadow-sm">
          <h1 className="text-2xl font-bold text-red-900">Dashboard</h1>
          <p className="mt-2 text-sm text-red-700">{error}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="mb-6 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-teal-700">Live CRM Summary</p>
        <h1 className="mt-2 text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-2 text-sm text-gray-500">
          Showing real backend data for role <span className="font-semibold text-gray-700">{role || "—"}</span>.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {headlineCards.map((card) => (
          <SummaryCard
            key={card.label}
            label={card.label}
            value={card.value}
            helper={card.helper}
            accent={card.accent}
          />
        ))}
      </div>

      <div className="mt-6 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Reports Snapshot</h2>
            <p className="mt-1 text-sm text-gray-500">
              Lead source and opportunity performance from live CRM data.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl bg-gray-50 px-4 py-3">
              <div className="text-xs font-semibold uppercase text-gray-400">Contacts</div>
              <div className="mt-1 text-xl font-bold text-gray-900">{reports?.totalContacts ?? 0}</div>
            </div>
            <div className="rounded-xl bg-teal-50 px-4 py-3">
              <div className="text-xs font-semibold uppercase text-teal-700">Pipeline Value</div>
              <div className="mt-1 text-xl font-bold text-teal-800">
                {formatCurrency(reports?.totalPipelineValue ?? 0)}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <BreakdownList title="Contacts by Lead Source" items={reports?.contactsByLeadSource || []} />
        <BreakdownList title="Opportunities by Source" items={reports?.opportunitiesBySource || []} amountLabel />
        <BreakdownList title="Opportunities by Stage" items={reports?.opportunitiesByStage || []} amountLabel />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <AttentionCard title="Today’s Work Queue" items={todayWork} />

        <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Quick Actions</h2>
              <p className="mt-1 text-sm text-gray-500">
                Jump into the next likely workflow without hunting through the sidebar.
              </p>
            </div>
            <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-medium text-teal-700">
              Operator mode
            </span>
          </div>
          <div className="mt-4 grid gap-3">
            {quickActions.map((action) => (
              <ActionButton
                key={action.label}
                label={action.label}
                helper={action.helper}
                onClick={action.onClick}
                accent={action.accent}
              />
            ))}
          </div>
        </section>
      </div>

      <div className="mt-6 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Recent Notifications</h2>
            <p className="mt-1 text-sm text-gray-500">Latest CRM alerts from mail, appointments, and automation.</p>
          </div>
          <button onClick={() => navigate("/dashboard/notifications")} className="rounded-full bg-teal-50 px-3 py-1 text-xs font-medium text-teal-700">
            Open center
          </button>
        </div>
        <div className="mt-4 divide-y divide-gray-100">
          {notifications.items.length === 0 ? (
            <div className="py-6 text-sm text-gray-500">No notifications yet.</div>
          ) : (
            notifications.items.map((item) => (
              <button
                key={item.id}
                onClick={() => navigate(item.targetPath || "/dashboard/notifications")}
                className="block w-full py-3 text-left"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold text-gray-900">{item.title}</span>
                  {!item.readAt && <span className="rounded-full bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700">Unread</span>}
                </div>
                {item.body && <p className="mt-1 line-clamp-1 text-sm text-gray-500">{item.body}</p>}
              </button>
            ))
          )}
        </div>
      </div>

      {operatorAlerts.length > 0 && (
        <div className="mt-6 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Attention Needed</h2>
              <p className="mt-1 text-sm text-gray-500">
                The most actionable items surfaced from your live backend summary.
              </p>
            </div>
            <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-700">
              Prioritize these
            </span>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {operatorAlerts.map((alert) => (
              <div
                key={alert.label}
                className="rounded-2xl border border-gray-100 bg-gray-50 p-4"
              >
                <div className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${alert.accent}`}>
                  {alert.value}
                </div>
                <div className="mt-3 text-sm font-semibold text-gray-900">{alert.label}</div>
                <p className="mt-1 text-xs text-gray-500">{alert.helper}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900">Contacts</h2>
          <div className="mt-4">
            <StatRow label="Visible contacts" value={summary?.contacts?.totalContacts ?? 0} />
            <StatRow label="Open conversations" value={summary?.contacts?.openConversations ?? 0} />
            <StatRow label="Closed conversations" value={summary?.contacts?.closedConversations ?? 0} />
            <StatRow label="Assigned to me" value={summary?.contacts?.assignedToMeCount ?? 0} />
          </div>
        </section>

        <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900">Inbox</h2>
          <div className="mt-4">
            <StatRow label="Unread conversations" value={summary?.inbox?.unreadConversations ?? 0} />
            <StatRow label="Open conversations" value={summary?.inbox?.openConversations ?? 0} />
            <StatRow label="Closed conversations" value={summary?.inbox?.closedConversations ?? 0} />
            <StatRow label="Assigned to me" value={summary?.inbox?.assignedToMeCount ?? 0} />
          </div>
        </section>

        <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900">Tasks</h2>
          <div className="mt-4">
            <StatRow label="Overdue" value={summary?.tasks?.overdueCount ?? 0} />
            <StatRow label="Due today" value={summary?.tasks?.todayCount ?? 0} />
            <StatRow label="My open tasks" value={summary?.tasks?.myOpenCount ?? 0} />
            <StatRow label="In progress" value={summary?.tasks?.inProgressCount ?? 0} />
            <StatRow label="Completed" value={summary?.tasks?.completedCount ?? 0} />
          </div>
        </section>
      </div>

      {isAdmin && campaignTrends && (
        <>
          <div className="mt-6 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Recent Trend Snapshot</h2>
                <p className="mt-1 text-sm text-gray-500">
                  Lightweight trend view derived from recent campaign history.
                </p>
              </div>
              <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700">
                Last 7 days
              </span>
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <TrendCard label="Campaigns" value={campaignTrends.campaignsLast7Days} helper="Created in the last 7 days" accent="bg-sky-50 text-sky-700" />
              <TrendCard label="Messages Today" value={campaignTrends.messagesToday} helper="Total audience scheduled or sent in the last 24h" accent="bg-indigo-50 text-indigo-700" />
              <TrendCard label="Delivered" value={campaignTrends.deliveredLast7Days} helper="Delivered in the last 7 days" accent="bg-emerald-50 text-emerald-700" />
              <TrendCard label="Reads" value={campaignTrends.readLast7Days} helper="Read counts in the last 7 days" accent="bg-purple-50 text-purple-700" />
              <TrendCard label="Failures" value={campaignTrends.failedLast7Days} helper="Failed deliveries in the last 7 days" accent="bg-red-50 text-red-700" />
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-gray-900">Recent Campaign Activity</h2>
            <p className="mt-1 text-sm text-gray-500">
              Most recent campaigns across your tenant.
            </p>
            {campaignTrends.recentCampaigns.length === 0 ? (
              <div className="mt-4 rounded-xl border border-dashed border-gray-200 bg-gray-50 p-5 text-sm text-gray-500">
                No recent campaigns available yet.
              </div>
            ) : (
              <div className="mt-4 divide-y divide-gray-100">
                {campaignTrends.recentCampaigns.map((campaign) => (
                  <div key={campaign.campaignId} className="flex items-center justify-between gap-4 py-4">
                    <div>
                      <div className="font-semibold text-gray-900">{campaign.name || `Campaign #${campaign.campaignId}`}</div>
                      <div className="mt-1 text-sm text-gray-500">
                        {formatDateTime(campaign.createdAt || campaign.scheduledAt)}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <span className="rounded-full bg-gray-100 px-3 py-1 font-medium text-gray-700">
                        {campaign.status}
                      </span>
                      <span className="font-semibold text-gray-900">
                        {campaign.totalMessages ?? 0} recipients
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      <div className="mt-6 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Campaign Overview</h2>
            <p className="mt-1 text-sm text-gray-500">
              {summary?.campaigns?.available
                ? "Live campaign counts from backend."
                : "Campaign analytics are only visible to admin roles."}
            </p>
          </div>
          {!isAdmin && (
            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
              Restricted
            </span>
          )}
        </div>

        {summary?.campaigns?.available ? (
          <div className="mt-5 grid gap-4 md:grid-cols-3 xl:grid-cols-6">
            <SummaryCard label="Queued" value={summary.campaigns.queuedCount ?? 0} accent="bg-sky-50 text-sky-700" />
            <SummaryCard label="Sending" value={summary.campaigns.sendingCount ?? 0} accent="bg-amber-50 text-amber-700" />
            <SummaryCard label="Paused" value={summary.campaigns.pausedCount ?? 0} accent="bg-purple-50 text-purple-700" />
            <SummaryCard label="Completed" value={summary.campaigns.completedCount ?? 0} accent="bg-emerald-50 text-emerald-700" />
            <SummaryCard label="Failed" value={summary.campaigns.failedCount ?? 0} accent="bg-red-50 text-red-700" />
            <SummaryCard label="Cancelled" value={summary.campaigns.cancelledCount ?? 0} accent="bg-gray-100 text-gray-700" />
          </div>
        ) : (
          <div className="mt-5 rounded-xl border border-dashed border-gray-200 bg-gray-50 p-5 text-sm text-gray-500">
            Ask an admin account to review campaign analytics from this dashboard.
          </div>
        )}
      </div>
    </main>
  );
}
