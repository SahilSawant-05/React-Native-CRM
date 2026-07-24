import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/axios";
import DateRangeFilter, { dateRangeParams, presetDateRange } from "../components/common/DateRangeFilter";

function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

export default function WebhookEvents() {
  const [filters, setFilters] = useState({
    provider: "WHATSAPP",
    status: "",
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
  const [replayingId, setReplayingId] = useState(null);
  const [bulkRetrying, setBulkRetrying] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [health, setHealth] = useState(null);
  const [retryQueue, setRetryQueue] = useState({
    failedWebhooks: [],
    failedOutboundMessages: [],
  });
  const [loading, setLoading] = useState(true);
  const [opsLoading, setOpsLoading] = useState(true);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  useEffect(() => {
    let ignore = false;

    async function loadWebhookEvents() {
      setLoading(true);
      setError("");
      try {
        const response = await api.get("/api/webhook-events", {
          params: {
            provider: filters.provider || undefined,
            status: filters.status || undefined,
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
          setError(err?.response?.data?.message || err.message || "Failed to load webhook events");
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    loadWebhookEvents();
    return () => {
      ignore = true;
    };
  }, [filters, page, refreshKey, dateRange]);

  useEffect(() => {
    let ignore = false;

    async function loadOperations() {
      setOpsLoading(true);
      try {
        const [healthResponse, queueResponse] = await Promise.all([
          api.get("/api/webhook-events/health"),
          api.get("/api/webhook-events/retry-queue", { params: { size: 8 } }),
        ]);

        if (!ignore) {
          setHealth(healthResponse.data);
          setRetryQueue(queueResponse.data || { failedWebhooks: [], failedOutboundMessages: [] });
        }
      } catch (err) {
        if (!ignore) {
          setError(err?.response?.data?.message || err.message || "Failed to load WhatsApp health");
        }
      } finally {
        if (!ignore) {
          setOpsLoading(false);
        }
      }
    }

    loadOperations();
    return () => {
      ignore = true;
    };
  }, [refreshKey]);

  const updateFilter = (field, value) => {
    setPage(0);
    setFilters((current) => ({ ...current, [field]: value }));
  };

  const replayEvent = async (eventId) => {
    setReplayingId(eventId);
    setError("");
    setInfo("");
    try {
      await api.post(`/api/webhook-events/${eventId}/replay`);
      setInfo(`Replay started for event #${eventId}`);
      setRefreshKey((current) => current + 1);
    } catch (err) {
      setError(err?.response?.data?.message || err.message || "Failed to replay webhook event");
    } finally {
      setReplayingId(null);
    }
  };

  const retryFailedWebhooks = async () => {
    setBulkRetrying(true);
    setError("");
    setInfo("");
    try {
      const response = await api.post("/api/webhook-events/retry-failed", null, {
        params: { size: 10 },
      });
      const data = response.data || {};
      setInfo(`Retry completed: ${data.succeeded || 0} succeeded, ${data.failed || 0} failed`);
      setRefreshKey((current) => current + 1);
    } catch (err) {
      setError(err?.response?.data?.message || err.message || "Failed to retry webhook events");
    } finally {
      setBulkRetrying(false);
    }
  };

  const healthCards = [
    { label: "Received", value: health?.totalWebhookEvents ?? 0, tone: "text-gray-900" },
    { label: "Processed", value: health?.processedWebhookEvents ?? 0, tone: "text-emerald-700" },
    { label: "Failed Webhooks", value: health?.failedWebhookEvents ?? 0, tone: "text-red-700" },
    { label: "Replay Attempts", value: health?.webhookReplayAttempts ?? 0, tone: "text-amber-700" },
    { label: "Outbound Failed", value: health?.failedOutboundMessages ?? 0, tone: "text-red-700" },
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="mb-6 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-700">Admin Operations</p>
        <h1 className="mt-2 text-3xl font-bold text-gray-900">Webhook Events</h1>
        <p className="mt-2 text-sm text-gray-500">
          Inspect inbound webhook payloads, failure reasons, and replay events through the backend processor.
        </p>
      </div>

      {(error || info) && (
        <div className={`mb-6 rounded-xl border px-4 py-3 text-sm ${
          error
            ? "border-red-200 bg-red-50 text-red-700"
            : "border-emerald-200 bg-emerald-50 text-emerald-700"
        }`}>
          {error || info}
        </div>
      )}

      <div className="mb-6 grid gap-4 lg:grid-cols-5">
        {healthCards.map((card) => (
          <div key={card.label} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{card.label}</p>
            <p className={`mt-2 text-3xl font-bold ${card.tone}`}>
              {opsLoading ? "…" : card.value}
            </p>
          </div>
        ))}
      </div>

      <div className="mb-6 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Retry Queue</h2>
              <p className="text-sm text-gray-500">Failed webhook payloads can be replayed safely from stored events.</p>
            </div>
            <button
              onClick={retryFailedWebhooks}
              disabled={bulkRetrying || (retryQueue.failedWebhooks || []).length === 0}
              className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {bulkRetrying ? "Retrying..." : "Retry failed webhooks"}
            </button>
          </div>

          {(retryQueue.failedWebhooks || []).length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-sm text-gray-500">
              No failed WhatsApp webhook events waiting for replay.
            </div>
          ) : (
            <div className="space-y-3">
              {retryQueue.failedWebhooks.map((event) => (
                <div key={event.id} className="rounded-xl border border-red-100 bg-red-50/40 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-semibold text-gray-900">Webhook #{event.id}</p>
                      <p className="mt-1 text-xs text-gray-500">{formatDateTime(event.createdAt)} • Replay count {event.replayCount ?? 0}</p>
                      <p className="mt-2 line-clamp-2 text-sm text-red-700">{event.errorMessage || "No error detail returned. Check the raw payload or n8n execution log."}</p>
                    </div>
                    <button
                      onClick={() => replayEvent(event.id)}
                      disabled={replayingId === event.id}
                      className="rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {replayingId === event.id ? "Replaying..." : "Replay"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-gray-900">Last Activity</h2>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex items-center justify-between gap-4">
                <span className="text-gray-500">Received</span>
                <span className="font-medium text-gray-900">{formatDateTime(health?.lastReceivedAt)}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-gray-500">Processed</span>
                <span className="font-medium text-gray-900">{formatDateTime(health?.lastProcessedAt)}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-gray-500">Failed</span>
                <span className="font-medium text-gray-900">{formatDateTime(health?.lastFailedAt)}</span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Template Sync Diagnostics</h2>
                <p className="mt-1 text-sm text-gray-500">Run Meta sync and inspect per-WABA errors from the templates screen.</p>
              </div>
              <Link
                to="/dashboard/templates"
                className="rounded-lg border border-teal-200 px-3 py-2 text-sm font-semibold text-teal-700 hover:bg-teal-50"
              >
                Open
              </Link>
            </div>
          </div>
        </div>
      </div>

      {(retryQueue.failedOutboundMessages || []).length > 0 && (
        <div className="mb-6 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900">Failed Outbound Sends</h2>
          <p className="mt-1 text-sm text-gray-500">These are WhatsApp messages with failed status or stored send errors.</p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Created</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Contact</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Status</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Error</th>
                </tr>
              </thead>
              <tbody>
                {retryQueue.failedOutboundMessages.map((message) => (
                  <tr key={message.messageId} className="border-b border-gray-100 last:border-0">
                    <td className="px-4 py-3 text-gray-700">{formatDateTime(message.createdAt)}</td>
                    <td className="px-4 py-3 text-gray-700">#{message.contactId || "—"}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700">
                        {message.status || "FAILED"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      <span className="line-clamp-2 block max-w-md">{message.errorMessage || "No error detail returned. Check the n8n execution log for this message."}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="mb-6 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Provider</label>
            <select
              value={filters.provider}
              onChange={(event) => updateFilter("provider", event.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="">All providers</option>
              <option value="WHATSAPP">WHATSAPP</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Status</label>
            <select
              value={filters.status}
              onChange={(event) => updateFilter("status", event.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="">All statuses</option>
              <option value="RECEIVED">RECEIVED</option>
              <option value="PROCESSED">PROCESSED</option>
              <option value="FAILED">FAILED</option>
              <option value="REPLAYING">REPLAYING</option>
            </select>
          </div>
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
            <h2 className="text-lg font-bold text-gray-900">Events</h2>
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
            Loading webhook events…
          </div>
        ) : result.items?.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
            No webhook events found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px] text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Created</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Provider</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Status</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Replay count</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Error</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((event) => (
                  <tr key={event.id} className="border-b border-gray-100 last:border-0">
                    <td className="px-4 py-3 text-gray-700">{formatDateTime(event.createdAt)}</td>
                    <td className="px-4 py-3 text-gray-700">{event.provider || "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        event.status === "FAILED"
                          ? "bg-red-50 text-red-700"
                          : event.status === "PROCESSED"
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-gray-100 text-gray-700"
                      }`}>
                        {event.status || "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{event.replayCount ?? 0}</td>
                    <td className="px-4 py-3 text-gray-700">
                      <span className="line-clamp-2 block max-w-xs">{event.errorMessage || "—"}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-3">
                        <button
                          onClick={() => setSelected(event)}
                          className="text-sm font-medium text-teal-700 hover:text-teal-800"
                        >
                          View
                        </button>
                        <button
                          onClick={() => replayEvent(event.id)}
                          disabled={replayingId === event.id}
                          className="text-sm font-medium text-amber-700 hover:text-amber-800 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {replayingId === event.id ? "Replaying..." : "Replay"}
                        </button>
                      </div>
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
          <div className="w-full max-w-4xl rounded-2xl bg-white p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Webhook Event #{selected.id}</h3>
                <p className="text-sm text-gray-500">{selected.provider} • {selected.status}</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-sm font-medium text-gray-500 hover:text-gray-700">
                Close
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-xl bg-gray-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Created</p>
                <p className="mt-2 text-sm text-gray-900">{formatDateTime(selected.createdAt)}</p>
              </div>
              <div className="rounded-xl bg-gray-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Processed</p>
                <p className="mt-2 text-sm text-gray-900">{formatDateTime(selected.processedAt)}</p>
              </div>
              <div className="rounded-xl bg-gray-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Last replayed</p>
                <p className="mt-2 text-sm text-gray-900">{formatDateTime(selected.lastReplayedAt)}</p>
              </div>
            </div>

            <div className="mt-4 rounded-xl bg-gray-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Error</p>
              <p className="mt-2 text-sm text-gray-900">{selected.errorMessage || "No error detail returned. Check the raw payload or n8n execution log."}</p>
            </div>

            <div className="mt-4 rounded-xl bg-gray-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Payload</p>
              <pre className="mt-2 max-h-[24rem] overflow-auto whitespace-pre-wrap text-xs text-gray-700">
                {selected.payload || "—"}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
