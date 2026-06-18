import { useEffect, useState } from "react";
import api from "../api/axios";
import DateRangeFilter, { dateRangeParams, presetDateRange } from "../components/common/DateRangeFilter";

function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

function FilterInput({ label, value, onChange, placeholder, type = "text" }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
      />
    </div>
  );
}

export default function AuditLogs() {
  const [filters, setFilters] = useState({
    actionType: "",
    entityType: "",
    entityId: "",
  });
  const [datePreset, setDatePreset] = useState("30D");
  const [dateRange, setDateRange] = useState(() => presetDateRange("30D"));
  const [page, setPage] = useState(0);
  const [result, setResult] = useState({
    items: [],
    totalPages: 0,
    hasNext: false,
    hasPrevious: false,
  });
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let ignore = false;

    async function loadAuditLogs() {
      setLoading(true);
      setError("");
      try {
        const response = await api.get("/api/audit", {
          params: {
            actionType: filters.actionType || undefined,
            entityType: filters.entityType || undefined,
            entityId: filters.entityId || undefined,
            ...dateRangeParams(dateRange),
            page,
            size: 20,
          },
        });

        if (!ignore) {
          setResult(response.data);
        }
      } catch (err) {
        if (!ignore) {
          setError(err?.response?.data?.message || err.message || "Failed to load audit logs");
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    loadAuditLogs();
    return () => {
      ignore = true;
    };
  }, [filters, page, dateRange]);

  const updateFilter = (field, value) => {
    setPage(0);
    setFilters((current) => ({ ...current, [field]: value }));
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="mb-6 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-700">Admin Operations</p>
        <h1 className="mt-2 text-3xl font-bold text-gray-900">Audit Logs</h1>
        <p className="mt-2 text-sm text-gray-500">
          Review tenant-level actions like campaign controls, assignments, role changes, and other tracked events.
        </p>
      </div>

      <div className="mb-6 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-3">
          <FilterInput
            label="Action type"
            value={filters.actionType}
            onChange={(event) => updateFilter("actionType", event.target.value)}
            placeholder="CAMPAIGN_PAUSED"
          />
          <FilterInput
            label="Entity type"
            value={filters.entityType}
            onChange={(event) => updateFilter("entityType", event.target.value)}
            placeholder="CAMPAIGN"
          />
          <FilterInput
            label="Entity ID"
            type="number"
            value={filters.entityId}
            onChange={(event) => updateFilter("entityId", event.target.value)}
            placeholder="12"
          />
        </div>
        <div className="mt-4">
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
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Entries</h2>
            <p className="text-sm text-gray-500">Page {page + 1} of {Math.max(result.totalPages || 1, 1)}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((current) => Math.max(0, current - 1))}
              disabled={!result.hasPrevious}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((current) => current + 1)}
              disabled={!result.hasNext}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>

        {loading ? (
          <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
            Loading audit logs…
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700">
            {error}
          </div>
        ) : result.items?.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
            No audit log entries found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">When</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Action</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Entity</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Actor</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Summary</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700">Details</th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((entry) => (
                  <tr key={entry.id} className="border-b border-gray-100 last:border-0">
                    <td className="px-4 py-3 text-gray-700">{formatDateTime(entry.createdAt)}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-700">
                        {entry.actionType || "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {entry.entityType || "—"}
                      {entry.entityId ? ` #${entry.entityId}` : ""}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{entry.actorUserEmail || "System"}</td>
                    <td className="px-4 py-3 text-gray-700">{entry.summary || "—"}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setSelected(entry)}
                        className="text-sm font-medium text-teal-700 hover:text-teal-800"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setSelected(null)}>
          <div className="w-full max-w-3xl rounded-2xl bg-white p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-gray-900">{selected.actionType}</h3>
                <p className="text-sm text-gray-500">{formatDateTime(selected.createdAt)}</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-sm font-medium text-gray-500 hover:text-gray-700">
                Close
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-xl bg-gray-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Actor</p>
                <p className="mt-2 text-sm text-gray-900">{selected.actorUserEmail || "System"}</p>
              </div>
              <div className="rounded-xl bg-gray-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Entity</p>
                <p className="mt-2 text-sm text-gray-900">
                  {selected.entityType || "—"}{selected.entityId ? ` #${selected.entityId}` : ""}
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-xl bg-gray-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Summary</p>
              <p className="mt-2 text-sm text-gray-900">{selected.summary || "—"}</p>
              {selected.details && <p className="mt-2 text-sm text-gray-700">{selected.details}</p>}
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="rounded-xl bg-gray-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Old value</p>
                <pre className="mt-2 whitespace-pre-wrap text-xs text-gray-700">{selected.oldValue || "—"}</pre>
              </div>
              <div className="rounded-xl bg-gray-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">New value</p>
                <pre className="mt-2 whitespace-pre-wrap text-xs text-gray-700">{selected.newValue || "—"}</pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
