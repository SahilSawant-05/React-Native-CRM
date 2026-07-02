import { useEffect, useMemo, useState } from "react";
import { RefreshCw, DownloadCloud, FormInput, FileText, AlertCircle } from "lucide-react";
import api from "../api/axios";

export default function FacebookLeads() {
  const [pages, setPages] = useState([]);
  const [forms, setForms] = useState([]);
  const [pageId, setPageId] = useState("");
  const [formId, setFormId] = useState("");
  const [limit, setLimit] = useState(100);
  const [loadingPages, setLoadingPages] = useState(false);
  const [loadingForms, setLoadingForms] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const selectedPage = useMemo(
    () => pages.find((page) => String(page.id) === String(pageId)) || null,
    [pages, pageId]
  );
  const selectedForm = useMemo(
    () => forms.find((form) => String(form.id) === String(formId)) || null,
    [forms, formId]
  );

  const loadPages = async () => {
    setError("");
    setResult(null);
    setLoadingPages(true);
    try {
      const response = await api.get("/api/facebook-leads/pages");
      const nextPages = Array.isArray(response.data) ? response.data : [];
      setPages(nextPages);
      if (!pageId && nextPages.length > 0) {
        setPageId(nextPages[0].id);
      }
    } catch (err) {
      setError(errorMessage(err, "Unable to load Facebook pages. Reconnect Meta with lead permissions."));
    } finally {
      setLoadingPages(false);
    }
  };

  const loadForms = async (nextPageId = pageId) => {
    if (!nextPageId) {
      setForms([]);
      setFormId("");
      return;
    }
    setError("");
    setResult(null);
    setLoadingForms(true);
    try {
      const response = await api.get("/api/facebook-leads/forms", { params: { pageId: nextPageId } });
      const nextForms = Array.isArray(response.data) ? response.data : [];
      setForms(nextForms);
      setFormId(nextForms[0]?.id || "");
    } catch (err) {
      setForms([]);
      setFormId("");
      setError(errorMessage(err, "Unable to load lead forms for this page."));
    } finally {
      setLoadingForms(false);
    }
  };

  const syncLeads = async () => {
    if (!pageId || !formId) {
      setError("Select a Facebook page and lead form first.");
      return;
    }
    setError("");
    setResult(null);
    setSyncing(true);
    try {
      const response = await api.post("/api/facebook-leads/sync", null, {
        params: { pageId, formId, limit },
      });
      setResult(response.data);
    } catch (err) {
      setError(errorMessage(err, "Facebook lead sync failed."));
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    loadPages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (pageId) {
      loadForms(pageId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageId]);

  return (
    <main className="min-h-screen bg-slate-50 p-3 sm:p-6">
      <div className="mx-auto max-w-6xl space-y-5">
        <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-700">Meta Lead Ads</p>
            <h1 className="mt-1 text-2xl font-black text-slate-950">Facebook Leads</h1>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              Pull leads from connected Facebook forms into Contacts with duplicate protection.
            </p>
          </div>
          <button
            type="button"
            onClick={loadPages}
            disabled={loadingPages}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-extrabold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCw size={16} className={loadingPages ? "animate-spin" : ""} />
            Refresh pages
          </button>
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block text-sm font-bold text-slate-700">
                Facebook Page
                <select
                  value={pageId}
                  onChange={(event) => setPageId(event.target.value)}
                  className="mt-1.5 min-h-11 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-400"
                >
                  <option value="">Select page</option>
                  {pages.map((page) => (
                    <option key={page.id} value={page.id}>{page.name || page.id}</option>
                  ))}
                </select>
              </label>

              <label className="block text-sm font-bold text-slate-700">
                Lead Form
                <select
                  value={formId}
                  onChange={(event) => setFormId(event.target.value)}
                  disabled={!pageId || loadingForms}
                  className="mt-1.5 min-h-11 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-400 disabled:bg-slate-100"
                >
                  <option value="">{loadingForms ? "Loading forms..." : "Select form"}</option>
                  {forms.map((form) => (
                    <option key={form.id} value={form.id}>{form.name || form.id}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-[180px_minmax(0,1fr)] md:items-end">
              <label className="block text-sm font-bold text-slate-700">
                Sync limit
                <input
                  type="number"
                  min="1"
                  max="500"
                  value={limit}
                  onChange={(event) => setLimit(event.target.value)}
                  className="mt-1.5 min-h-11 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-400"
                />
              </label>
              <button
                type="button"
                onClick={syncLeads}
                disabled={syncing || !pageId || !formId}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-extrabold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <DownloadCloud size={17} className={syncing ? "animate-bounce" : ""} />
                {syncing ? "Syncing leads..." : "Sync selected form"}
              </button>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center gap-2 text-sm font-black text-slate-900">
                <FileText size={17} />
                Selected source
              </div>
              <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="font-bold text-slate-500">Page</dt>
                  <dd className="mt-1 font-semibold text-slate-900">{selectedPage?.name || "No page selected"}</dd>
                </div>
                <div>
                  <dt className="font-bold text-slate-500">Form</dt>
                  <dd className="mt-1 font-semibold text-slate-900">{selectedForm?.name || "No form selected"}</dd>
                </div>
              </dl>
            </div>
          </div>

          <aside className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
              <FormInput size={22} />
            </div>
            <h2 className="mt-4 text-lg font-black text-slate-950">How sync works</h2>
            <p className="mt-2 text-sm font-medium leading-6 text-slate-600">
              Leads are matched by phone first, then email. New contacts are assigned using your lead assignment rules.
            </p>
            <p className="mt-3 text-sm font-medium leading-6 text-slate-600">
              Re-syncing the same form skips already imported Meta lead IDs.
            </p>
          </aside>
        </section>

        {result && (
          <section className="rounded-xl border border-emerald-200 bg-white p-4 shadow-sm">
            <h2 className="text-lg font-black text-slate-950">Sync result</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-4">
              <Metric label="Fetched" value={result.fetched} />
              <Metric label="Created" value={result.created} />
              <Metric label="Updated" value={result.updated} />
              <Metric label="Skipped" value={result.skipped} />
            </div>
            {Array.isArray(result.warnings) && result.warnings.length > 0 && (
              <div className="mt-4 rounded-lg bg-amber-50 p-3 text-sm font-semibold text-amber-800">
                {result.warnings.map((warning) => <div key={warning}>{warning}</div>)}
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}

function Metric({ label, value }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-black text-slate-950">{value ?? 0}</div>
    </div>
  );
}

function errorMessage(error, fallback) {
  const data = error?.response?.data;
  if (typeof data === "string") return data;
  return data?.message || data?.error || error?.message || fallback;
}
