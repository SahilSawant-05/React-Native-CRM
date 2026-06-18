import { useEffect, useMemo, useState } from "react";
import { BriefcaseBusiness, CalendarCheck2, IndianRupee, Target, Trophy, UsersRound } from "lucide-react";
import api from "../api/axios";
import DateRangeFilter, { dateRangeParams, presetDateRange } from "../components/common/DateRangeFilter";

function formatCurrency(value) {
  const number = Number(value ?? 0);
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(number) ? number : 0);
}

function formatPercent(value) {
  const number = Number(value ?? 0);
  return `${Number.isFinite(number) ? number.toFixed(2) : "0.00"}%`;
}

function formatLabel(value) {
  return String(value || "Unknown").replaceAll("_", " ");
}

function MetricCard({ label, value, helper, icon: Icon, accent }) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-gray-500">{label}</p>
          <div className="mt-3 text-3xl font-extrabold text-gray-950">{value}</div>
          {helper && <p className="mt-2 text-sm text-gray-500">{helper}</p>}
        </div>
        <div className={`rounded-lg p-3 ${accent}`}>
          <Icon size={22} />
        </div>
      </div>
    </section>
  );
}

function HorizontalBarChart({ items = [], showAmount = false }) {
  const maxCount = Math.max(1, ...items.map((item) => Number(item.count || 0)));

  return (
    <div className="space-y-4">
      {items.map((item) => {
        const count = Number(item.count || 0);
        const width = Math.max(6, Math.round((count / maxCount) * 100));
        return (
          <div key={item.label}>
            <div className="mb-1 flex items-center justify-between gap-3 text-sm">
              <span className="font-semibold text-gray-800">{formatLabel(item.label)}</span>
              <span className="text-right text-gray-500">
                {count}
                {showAmount ? ` · ${formatCurrency(item.amount)}` : ""}
              </span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-gray-100">
              <div className="h-full rounded-full bg-teal-600" style={{ width: `${width}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DonutChart({ items = [] }) {
  const total = items.reduce((sum, item) => sum + Number(item.count || 0), 0);
  let cursor = 0;
  const colors = ["#0f766e", "#2563eb", "#d97706", "#7c3aed", "#059669", "#e11d48"];
  const gradient = total
    ? items
        .map((item, index) => {
          const start = cursor;
          const share = (Number(item.count || 0) / total) * 100;
          cursor += share;
          return `${colors[index % colors.length]} ${start}% ${cursor}%`;
        })
        .join(", ")
    : "#e5e7eb 0% 100%";

  return (
    <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
      <div
        className="relative h-40 w-40 shrink-0 rounded-full"
        style={{ background: `conic-gradient(${gradient})` }}
      >
        <div className="absolute inset-8 flex items-center justify-center rounded-full bg-white text-center">
          <div>
            <div className="text-2xl font-extrabold text-gray-950">{total}</div>
            <div className="text-xs font-semibold text-gray-500">total</div>
          </div>
        </div>
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        {items.map((item, index) => (
          <div key={item.label} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-2 font-semibold text-gray-700">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: colors[index % colors.length] }} />
              <span className="truncate">{formatLabel(item.label)}</span>
            </span>
            <span className="text-gray-500">{item.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function BreakdownPanel({ title, description, items = [], showAmount = false, chart = "bar" }) {
  const totalCount = items.reduce((sum, item) => sum + Number(item.count || 0), 0);

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-gray-950">{title}</h2>
          <p className="mt-1 text-sm text-gray-500">{description}</p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
          {totalCount} total
        </span>
      </div>

      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
          No report data yet.
        </div>
      ) : (
        chart === "donut" ? <DonutChart items={items} /> : <HorizontalBarChart items={items} showAmount={showAmount} />
      )}
    </section>
  );
}

function SourceToWonPanel({ items = [] }) {
  const maxWon = Math.max(1, ...items.map((item) => Number(item.wonOpportunities || 0)));

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-gray-950">Source to Won Analytics</h2>
          <p className="mt-1 text-sm text-gray-500">Which channels are turning opportunities into won deals.</p>
        </div>
        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
          {items.reduce((sum, item) => sum + Number(item.wonOpportunities || 0), 0)} won
        </span>
      </div>
      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
          No source conversion data yet.
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item) => {
            const won = Number(item.wonOpportunities || 0);
            const width = Math.max(6, Math.round((won / maxWon) * 100));
            return (
              <div key={item.source}>
                <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                  <span className="font-semibold text-gray-800">{formatLabel(item.source)}</span>
                  <span className="text-right text-gray-500">
                    {won}/{item.opportunities} · {formatPercent(item.conversionRate)} · {formatCurrency(item.wonValue)}
                  </span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-gray-100">
                  <div className="h-full rounded-full bg-emerald-600" style={{ width: `${width}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function AgentPerformancePanel({ items = [] }) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm xl:col-span-2">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-gray-950">Agent Performance</h2>
          <p className="mt-1 text-sm text-gray-500">Contacts, opportunities, won deals, appointment completion, and conversion rate.</p>
        </div>
        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">{items.length} agents</span>
      </div>
      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
          No agent performance data yet.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Agent</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-700">Contacts</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-700">Opps</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-700">Won</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-700">Won Value</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-700">Appointments</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-700">Completed</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-700">Conversion</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.agentUserId || item.agentEmail} className="border-b border-gray-100 last:border-0">
                  <td className="px-4 py-3 font-semibold text-gray-950">{item.agentEmail}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{item.contacts}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{item.opportunities}</td>
                  <td className="px-4 py-3 text-right font-semibold text-emerald-700">{item.wonOpportunities}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{formatCurrency(item.wonValue)}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{item.appointments}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{item.completedAppointments}</td>
                  <td className="px-4 py-3 text-right font-semibold text-teal-700">{formatPercent(item.conversionRate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default function Reports() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [users, setUsers] = useState([]);
  const [selectedOwnerUserId, setSelectedOwnerUserId] = useState("");
  const [datePreset, setDatePreset] = useState("30D");
  const [dateRange, setDateRange] = useState(() => presetDateRange("30D"));

  useEffect(() => {
    let cancelled = false;
    api
      .get("/api/users")
      .then((response) => {
        if (!cancelled) setUsers(Array.isArray(response.data) ? response.data : []);
      })
      .catch(() => {
        if (!cancelled) setUsers([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadReports() {
      setLoading(true);
      setError("");
      try {
        const response = await api.get("/api/reports/summary", {
          params: {
            ...dateRangeParams(dateRange),
            ownerUserId: selectedOwnerUserId || undefined,
          },
        });
        if (!cancelled) setSummary(response.data);
      } catch (err) {
        if (!cancelled) setError(err?.response?.data?.message || err.message || "Failed to load reports");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadReports();
    return () => {
      cancelled = true;
    };
  }, [dateRange, selectedOwnerUserId]);

  const topStage = useMemo(() => {
    const stages = summary?.opportunitiesByStage || [];
    return stages.reduce((best, item) => (Number(item.count || 0) > Number(best?.count || 0) ? item : best), null);
  }, [summary]);

  if (loading) {
    return <div className="min-h-screen bg-slate-50 p-6 text-sm text-gray-500">Loading reports...</div>;
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
        <header className="mb-6 flex flex-col gap-4 rounded-lg border border-gray-200 bg-white p-5 shadow-sm lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-teal-700">Reports</p>
            <h1 className="mt-2 text-2xl font-extrabold text-gray-950">CRM Performance</h1>
            <p className="mt-1 text-sm text-gray-500">
              Track lead sources, pipeline value, and opportunity movement by date range and user scope.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            {users.length > 0 && (
              <label className="flex flex-col gap-1 text-xs font-bold uppercase tracking-wide text-gray-500">
                User Scope
                <select
                  value={selectedOwnerUserId}
                  onChange={(event) => setSelectedOwnerUserId(event.target.value)}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold normal-case tracking-normal text-gray-800"
                >
                  <option value="">All users</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name || user.email || `User #${user.id}`}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <DateRangeFilter
              value={dateRange}
              preset={datePreset}
              onChange={setDateRange}
              onPresetChange={setDatePreset}
              compact
            />
            <div className="rounded-lg bg-teal-50 px-4 py-3 text-sm font-semibold text-teal-800">
              Top stage: {topStage ? formatLabel(topStage.label) : "No pipeline data"}
            </div>
          </div>
        </header>

        <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Total Contacts"
            value={summary?.totalContacts ?? 0}
            helper="All matched contacts in your report scope"
            icon={UsersRound}
            accent="bg-blue-50 text-blue-700"
          />
          <MetricCard
            label="Opportunities"
            value={summary?.totalOpportunities ?? 0}
            helper="Open and historical opportunities"
            icon={BriefcaseBusiness}
            accent="bg-emerald-50 text-emerald-700"
          />
          <MetricCard
            label="Pipeline Value"
            value={formatCurrency(summary?.totalPipelineValue)}
            helper="Sum of opportunity value"
            icon={IndianRupee}
            accent="bg-amber-50 text-amber-700"
          />
          <MetricCard
            label="Conversion Rate"
            value={formatPercent(summary?.conversionRate)}
            helper={`${summary?.wonOpportunities || 0} won opportunities`}
            icon={Target}
            accent="bg-violet-50 text-violet-700"
          />
          <MetricCard
            label="Won Value"
            value={formatCurrency(summary?.wonValue)}
            helper="Revenue value from won deals"
            icon={Trophy}
            accent="bg-rose-50 text-rose-700"
          />
          <MetricCard
            label="Appointment Outcomes"
            value={(summary?.appointmentOutcomes || []).reduce((sum, item) => sum + Number(item.count || 0), 0)}
            helper="Scheduled, completed, no-show, cancelled"
            icon={CalendarCheck2}
            accent="bg-cyan-50 text-cyan-700"
          />
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <BreakdownPanel
            title="Leads by Source"
            description="Where contacts are coming from, including WhatsApp, email, web, imports, and manual entry."
            items={summary?.contactsByLeadSource || []}
            chart="donut"
          />
          <BreakdownPanel
            title="Opportunities by Stage"
            description="Pipeline movement and value by stage."
            items={summary?.opportunitiesByStage || []}
            showAmount
          />
          <BreakdownPanel
            title="Opportunity Value by Source"
            description="Which lead channels are creating opportunity value."
            items={summary?.opportunitiesBySource || []}
            showAmount
          />
          <BreakdownPanel
            title="Appointment Outcome Report"
            description="Site visits, demos, counseling sessions, and test rides by status."
            items={summary?.appointmentOutcomes || []}
            chart="donut"
          />
          <SourceToWonPanel items={summary?.sourceToWon || []} />
          <AgentPerformancePanel items={summary?.agentPerformance || []} />
          <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold text-gray-950">Recommended Follow-up</h2>
            <div className="mt-4 space-y-3 text-sm text-gray-600">
              <p className="rounded-lg bg-slate-50 p-3">Use lead source performance to tune assignment rules and campaigns.</p>
              <p className="rounded-lg bg-slate-50 p-3">Review stalled stages weekly and create automation tasks for delayed follow-ups.</p>
              <p className="rounded-lg bg-slate-50 p-3">For Real Estate and Education, compare site visits/demo sessions against won stages from opportunity detail.</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
