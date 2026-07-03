import { useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, DownloadCloud, FileText, FormInput, RefreshCw, Save, Wand2, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";

const DEFAULT_LIMIT = 100;

export default function FacebookLeads() {
  const navigate = useNavigate();
  const [pages, setPages] = useState([]);
  const [forms, setForms] = useState([]);
  const [mappings, setMappings] = useState([]);
  const [imports, setImports] = useState([]);
  const [importPage, setImportPage] = useState({ page: 0, size: 10, totalElements: 0, totalPages: 0, hasNext: false, hasPrevious: false });
  const [historyFormId, setHistoryFormId] = useState("");
  const [pipelines, setPipelines] = useState([]);
  const [stages, setStages] = useState([]);
  const [users, setUsers] = useState([]);
  const [pageId, setPageId] = useState("");
  const [limit, setLimit] = useState(DEFAULT_LIMIT);
  const [savingFormId, setSavingFormId] = useState("");
  const [syncingKey, setSyncingKey] = useState("");
  const [subscribingPage, setSubscribingPage] = useState(false);
  const [retryingEventId, setRetryingEventId] = useState("");
  const [aiLoadingFormId, setAiLoadingFormId] = useState("");
  const [aiSuggestions, setAiSuggestions] = useState({});
  const [subscribedPageIds, setSubscribedPageIds] = useState(new Set());
  const [loadingPages, setLoadingPages] = useState(false);
  const [loadingForms, setLoadingForms] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [result, setResult] = useState(null);

  const selectedPage = useMemo(
    () => pages.find((page) => String(page.id) === String(pageId)) || null,
    [pages, pageId]
  );
  const mappingByFormId = useMemo(() => {
    const map = new Map();
    mappings.forEach((mapping) => map.set(String(mapping.formId), mapping));
    return map;
  }, [mappings]);

  const activePipelines = pipelines.filter((pipeline) => pipeline.status === "ACTIVE");
  const checklist = useMemo(() => {
    const pageConnected = Boolean(pageId);
    const formsLoaded = forms.length > 0;
    const webhookActive = Boolean(selectedPage?.leadgenSubscribedAt)
      || subscribedPageIds.has(String(pageId))
      || mappings.some((mapping) => mapping.pageSubscribedAt || mapping.lastWebhookReceivedAt);
    return [
      { label: "Permissions OK", done: pages.length > 0 && !error },
      { label: "Page connected", done: pageConnected },
      { label: "Forms loaded", done: formsLoaded },
      { label: "Webhook active", done: webhookActive },
    ];
  }, [error, forms.length, mappings, pageId, pages.length, selectedPage?.leadgenSubscribedAt, subscribedPageIds]);

  const loadReferenceData = async () => {
    const requests = [
      api.get("/api/pipelines").catch(() => ({ data: [] })),
      api.get("/api/users").catch(() => ({ data: [] })),
    ];
    const [pipelineResponse, userResponse] = await Promise.all(requests);
    setPipelines(Array.isArray(pipelineResponse.data) ? pipelineResponse.data : []);
    setUsers(Array.isArray(userResponse.data) ? userResponse.data : []);
  };

  const loadPages = async () => {
    setError("");
    setSuccess("");
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

  const loadMappings = async (nextPageId = pageId) => {
    try {
      const response = await api.get("/api/facebook-leads/mappings", {
        params: nextPageId ? { pageId: nextPageId } : undefined,
      });
      setMappings(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      setError(errorMessage(err, "Unable to load form mappings."));
    }
  };

  const loadForms = async (nextPageId = pageId) => {
    if (!nextPageId) {
      setForms([]);
      setMappings([]);
      return;
    }
    setError("");
    setSuccess("");
    setLoadingForms(true);
    try {
      const [formsResponse] = await Promise.all([
        api.get("/api/facebook-leads/forms", { params: { pageId: nextPageId } }),
        loadMappings(nextPageId),
      ]);
      setForms(Array.isArray(formsResponse.data) ? formsResponse.data : []);
      setHistoryFormId("");
      loadImportHistory(nextPageId, "", 0);
    } catch (err) {
      setForms([]);
      setError(errorMessage(err, "Unable to load lead forms for this page. Check pages_manage_ads and leads_retrieval permissions."));
    } finally {
      setLoadingForms(false);
    }
  };

  const loadImportHistory = async (nextPageId = pageId, nextFormId = historyFormId, nextPage = importPage.page) => {
    try {
      const response = await api.get("/api/facebook-leads/imports", {
        params: {
          pageId: nextPageId || undefined,
          formId: nextFormId || undefined,
          page: nextPage,
          size: importPage.size || 10,
        },
      });
      setImports(Array.isArray(response.data?.items) ? response.data.items : []);
      setImportPage({
        page: response.data?.page ?? 0,
        size: response.data?.size ?? 10,
        totalElements: response.data?.totalElements ?? 0,
        totalPages: response.data?.totalPages ?? 0,
        hasNext: Boolean(response.data?.hasNext),
        hasPrevious: Boolean(response.data?.hasPrevious),
      });
    } catch {
      setImports([]);
      setImportPage({ page: 0, size: 10, totalElements: 0, totalPages: 0, hasNext: false, hasPrevious: false });
    }
  };

  const loadStages = async (pipelineId) => {
    if (!pipelineId) {
      setStages([]);
      return;
    }
    try {
      const response = await api.get("/api/crm-config/pipeline-stages", { params: { pipelineId } });
      setStages(Array.isArray(response.data) ? response.data : []);
    } catch {
      setStages([]);
    }
  };

  const saveMapping = async (form, draft) => {
    if (!pageId) return;
    setError("");
    setSuccess("");
    setSavingFormId(form.id);
    try {
      const response = await api.post("/api/facebook-leads/mappings", {
        pageId,
        pageName: selectedPage?.name || "",
        formId: form.id,
        formName: form.name,
        tag: draft.tag || "",
        ownerUserId: draft.ownerUserId || null,
        pipelineId: draft.pipelineId || null,
        stage: draft.stage || "",
        createOpportunity: Boolean(draft.createOpportunity),
        active: draft.active !== false,
      });
      setMappings((current) => upsertByFormId(current, response.data));
      setSuccess(`Mapping saved for ${form.name || form.id}.`);
    } catch (err) {
      setError(errorMessage(err, "Could not save form mapping."));
    } finally {
      setSavingFormId("");
    }
  };

  const syncSelectedForm = async (form) => {
    setError("");
    setSuccess("");
    setResult(null);
    setSyncingKey(form.id);
    try {
      const response = await api.post("/api/facebook-leads/sync", null, {
        params: { pageId, formId: form.id, limit },
      });
      setResult(response.data);
      await loadMappings(pageId);
      await loadImportHistory(pageId, historyFormId, 0);
      setSuccess(`Synced ${form.name || form.id}.`);
    } catch (err) {
      setError(errorMessage(err, "Facebook lead sync failed."));
    } finally {
      setSyncingKey("");
    }
  };

  const syncAllForms = async () => {
    setError("");
    setSuccess("");
    setResult(null);
    setSyncingKey("all");
    try {
      const response = await api.post("/api/facebook-leads/sync-all", null, { params: { limit } });
      setResult(response.data);
      await loadMappings(pageId);
      await loadImportHistory(pageId, historyFormId, 0);
      setSuccess(`Synced ${response.data?.forms ?? 0} forms across ${response.data?.pages ?? 0} pages.`);
    } catch (err) {
      setError(errorMessage(err, "Facebook sync all failed."));
    } finally {
      setSyncingKey("");
    }
  };

  const subscribeSelectedPage = async () => {
    if (!pageId) return;
    setError("");
    setSuccess("");
    setSubscribingPage(true);
    try {
      const response = await api.post(`/api/facebook-leads/pages/${pageId}/subscribe`);
      setSubscribedPageIds((current) => new Set([...current, String(pageId)]));
      setPages((current) => current.map((page) => (
        String(page.id) === String(pageId)
          ? { ...page, leadgenSubscribedAt: new Date().toISOString(), leadgenSubscribeError: "" }
          : page
      )));
      await loadMappings(pageId);
      setSuccess(response.data?.message || "Facebook Page subscribed to leadgen webhook.");
    } catch (err) {
      setError(errorMessage(err, "Could not subscribe this Page to Facebook leadgen webhook."));
    } finally {
      setSubscribingPage(false);
    }
  };

  const retryWebhook = async (eventId) => {
    if (!eventId) return;
    setError("");
    setSuccess("");
    setRetryingEventId(eventId);
    try {
      const response = await api.post(`/api/webhook-events/${eventId}/replay`);
      await loadMappings(pageId);
      await loadImportHistory(pageId, historyFormId, 0);
      setSuccess(response.data?.message || "Webhook retry completed.");
    } catch (err) {
      setError(errorMessage(err, "Could not retry failed Facebook lead import."));
    } finally {
      setRetryingEventId("");
    }
  };

  const suggestMapping = async (form, draft) => {
    setError("");
    setAiLoadingFormId(form.id);
    try {
      const response = await api.post("/api/ai/facebook-lead-mapping-suggestion", {
        page: selectedPage,
        form,
        currentMapping: draft,
        availableUsers: users.map((user) => ({ id: user.id, email: user.email, role: user.role })),
        availablePipelines: activePipelines.map((pipeline) => ({ id: pipeline.id, name: pipeline.name, typeKey: pipeline.typeKey || pipeline.industryKey })),
        availableStages: stages.map((stage) => ({ key: stage.stageKey, label: stage.label })),
      });
      setAiSuggestions((current) => ({ ...current, [form.id]: response.data?.text || "No AI suggestion returned." }));
    } catch (err) {
      setError(errorMessage(err, "AI mapping suggestion failed. Check AI settings and plan access."));
    } finally {
      setAiLoadingFormId("");
    }
  };

  useEffect(() => {
    loadReferenceData();
    loadPages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (pageId) loadForms(pageId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageId]);

  useEffect(() => {
    if (pageId) loadImportHistory(pageId, historyFormId, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyFormId]);

  return (
    <main className="min-h-screen bg-slate-50 p-3 sm:p-6">
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-700">Meta Lead Ads</p>
              <h1 className="mt-1 text-2xl font-black text-slate-950">Facebook Lead Forms</h1>
              <p className="mt-1 max-w-3xl text-sm font-semibold leading-6 text-slate-500">
                Sync every connected form, map leads by form, add tags, assign owners, and optionally create pipeline opportunities.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={loadPages}
                disabled={loadingPages}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-extrabold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                <RefreshCw size={16} className={loadingPages ? "animate-spin" : ""} />
                Refresh pages
              </button>
              <button
                type="button"
                onClick={syncAllForms}
                disabled={syncingKey === "all"}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-2 text-sm font-extrabold text-white hover:bg-blue-800 disabled:opacity-60"
              >
                <DownloadCloud size={16} />
                {syncingKey === "all" ? "Syncing all..." : "Sync all forms"}
              </button>
            </div>
          </div>
        </div>

        {error && <Notice tone="red" icon={<AlertCircle size={18} />}>{error}</Notice>}
        {success && <Notice tone="emerald" icon={<CheckCircle2 size={18} />}>{success}</Notice>}

        <section className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div>
              <label className="block text-sm font-bold text-slate-700">
                Facebook Page
                <select
                  value={pageId}
                  onChange={(event) => setPageId(event.target.value)}
                  className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-400"
                >
                  <option value="">Select page</option>
                  {pages.map((page) => (
                    <option key={page.id} value={page.id}>{page.name || page.id}</option>
                  ))}
                </select>
              </label>
            </div>
            <label className="block text-sm font-bold text-slate-700">
              Per-form sync limit
              <input
                type="number"
                min="1"
                max="500"
                value={limit}
                onChange={(event) => setLimit(event.target.value)}
                className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-400"
              />
            </label>
            <SetupChecklist items={checklist} />
            {selectedPage?.leadgenSubscribedAt || subscribedPageIds.has(String(pageId)) ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-800">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} />
                  Lead webhook active
                </div>
                <p className="mt-1 text-xs font-semibold text-emerald-700">
                  New Facebook leads from this Page will come automatically.
                </p>
              </div>
            ) : (
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <button
                  type="button"
                  onClick={subscribeSelectedPage}
                  disabled={!pageId || subscribingPage}
                  className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-sm font-extrabold text-white hover:bg-blue-800 disabled:opacity-60"
                >
                  <Zap size={16} />
                  {subscribingPage ? "Subscribing..." : "Activate lead webhook"}
                </button>
                <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">
                  After activation, new leads from your Facebook forms will automatically come into the CRM. Use Sync Forms only when you want to import old leads or refresh past form submissions.
                </p>
              </div>
            )}
            {selectedPage?.leadgenSubscribeError && (
              <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-xs font-semibold leading-5 text-red-700">
                Last activation failed: {selectedPage.leadgenSubscribeError}
              </div>
            )}
            <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
              <div className="flex items-center gap-2 text-sm font-black text-blue-900">
                <FormInput size={17} />
                Auto-sync behavior
              </div>
              <p className="mt-2 text-sm font-semibold leading-6 text-blue-800">
                Unmapped form leads still import and go to assignment rules or owner. Save a mapping when you want automatic tags, pipeline, and opportunity creation.
              </p>
            </div>
          </aside>

          <div className="space-y-4">
            {loadingForms ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm font-bold text-slate-500 shadow-sm">
                Loading Facebook forms...
              </div>
            ) : forms.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm font-bold text-slate-500 shadow-sm">
                No forms found for this page yet.
              </div>
            ) : (
              forms.map((form) => (
                <FormMappingCard
                  key={form.id}
                  form={form}
                  mapping={mappingByFormId.get(String(form.id))}
                  pipelines={activePipelines}
                  stages={stages}
                  users={users}
                  onPipelineFocus={loadStages}
                  onSave={saveMapping}
                  onSync={syncSelectedForm}
                  onRetryWebhook={retryWebhook}
                  onSuggestMapping={suggestMapping}
                  aiSuggestion={aiSuggestions[form.id]}
                  aiLoading={aiLoadingFormId === form.id}
                  retrying={retryingEventId && String(retryingEventId) === String(mappingByFormId.get(String(form.id))?.lastWebhookEventId)}
                  saving={savingFormId === form.id}
                  syncing={syncingKey === form.id}
                />
              ))
            )}
          </div>
        </section>

        {result && (
          <section className="rounded-2xl border border-emerald-200 bg-white p-4 shadow-sm">
            <h2 className="text-lg font-black text-slate-950">Sync result</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-4">
              <Metric label="Fetched" value={result.fetched} />
              <Metric label="Created" value={result.created} />
              <Metric label="Updated" value={result.updated} />
              <Metric label="Skipped" value={result.skipped} />
            </div>
            {Array.isArray(result.warnings) && result.warnings.length > 0 && (
              <div className="mt-4 max-h-48 overflow-y-auto rounded-xl bg-amber-50 p-3 text-sm font-semibold leading-6 text-amber-800">
                {result.warnings.map((warning, index) => <div key={`${warning}-${index}`}>{warning}</div>)}
              </div>
            )}
          </section>
        )}

        <ImportHistory
          forms={forms}
          selectedFormId={historyFormId}
          onFormChange={setHistoryFormId}
          imports={imports}
          pageInfo={importPage}
          onPage={(nextPage) => loadImportHistory(pageId, historyFormId, nextPage)}
          onOpenContact={(contactId) => navigate(`/dashboard/contacts?contactId=${contactId}`)}
        />
      </div>
    </main>
  );
}

function SetupChecklist({ items }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Setup checklist</p>
      <div className="mt-3 space-y-2">
        {items.map((item) => (
          <div key={item.label} className="flex items-center gap-2 text-sm font-bold text-slate-700">
            <span className={`flex h-5 w-5 items-center justify-center rounded-full ${item.done ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-500"}`}>
              {item.done ? <CheckCircle2 size={14} /> : <span className="h-2 w-2 rounded-full bg-current" />}
            </span>
            {item.label}
          </div>
        ))}
      </div>
    </div>
  );
}

function ImportHistory({ forms, selectedFormId, onFormChange, imports, pageInfo, onPage, onOpenContact }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Import history</p>
          <h2 className="mt-1 text-lg font-black text-slate-950">Recent Facebook leads</h2>
          <p className="mt-1 text-sm font-semibold text-slate-500">
            {pageInfo.totalElements || 0} imported lead{pageInfo.totalElements === 1 ? "" : "s"} found.
          </p>
        </div>
        <select
          value={selectedFormId}
          onChange={(event) => onFormChange(event.target.value)}
          className="min-h-10 rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-400"
        >
          <option value="">All forms on this page</option>
          {forms.map((form) => (
            <option key={form.id} value={form.id}>{form.name || form.id}</option>
          ))}
        </select>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-3 py-2 text-left">Lead</th>
              <th className="px-3 py-2 text-left">Form</th>
              <th className="px-3 py-2 text-left">Owner</th>
              <th className="px-3 py-2 text-left">Imported</th>
              <th className="px-3 py-2 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {imports.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center font-semibold text-slate-400">
                  No imported leads yet.
                </td>
              </tr>
            ) : imports.map((item) => (
              <tr key={item.id} className="align-top">
                <td className="px-3 py-3">
                  <p className="font-black text-slate-900">{item.contactName || item.contactPhone || item.contactEmail || "Facebook Lead"}</p>
                  {item.matchedExistingContact && (
                    <span className="mt-1 inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-black uppercase text-amber-700">
                      Existing contact updated
                    </span>
                  )}
                  <p className="mt-1 text-xs font-semibold text-slate-500">
                    {[item.contactPhone, item.contactEmail].filter(Boolean).join(" | ") || item.metaLeadId}
                  </p>
                </td>
                <td className="px-3 py-3">
                  <p className="font-bold text-slate-700">{item.formName || item.formId || "Unknown form"}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-400">{item.pageName || item.pageId}</p>
                </td>
                <td className="px-3 py-3 font-semibold text-slate-600">{item.ownerEmail || "Owner / rules"}</td>
                <td className="px-3 py-3 font-semibold text-slate-500">{formatDate(item.importedAt)}</td>
                <td className="px-3 py-3 text-right">
                  {item.contactId ? (
                    <button
                      type="button"
                      onClick={() => onOpenContact(item.contactId)}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-extrabold text-slate-700 hover:bg-slate-50"
                    >
                      Open contact
                    </button>
                  ) : (
                    <span className="text-xs font-semibold text-slate-400">No contact</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs font-bold text-slate-400">
          Page {(pageInfo.page || 0) + 1} of {Math.max(pageInfo.totalPages || 1, 1)}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={!pageInfo.hasPrevious}
            onClick={() => onPage(Math.max(0, (pageInfo.page || 0) - 1))}
            className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-extrabold text-slate-600 disabled:opacity-50"
          >
            Previous
          </button>
          <button
            type="button"
            disabled={!pageInfo.hasNext}
            onClick={() => onPage((pageInfo.page || 0) + 1)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-extrabold text-slate-600 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </section>
  );
}

function FormMappingCard({
  form,
  mapping,
  pipelines,
  stages,
  users,
  onPipelineFocus,
  onSave,
  onSync,
  onRetryWebhook,
  onSuggestMapping,
  aiSuggestion,
  aiLoading,
  retrying,
  saving,
  syncing,
}) {
  const recommendedTag = slugify(form.name || `form-${form.id}`);
  const [draft, setDraft] = useState(() => draftFromMapping(mapping, recommendedTag));
  const [quickFilled, setQuickFilled] = useState(false);

  useEffect(() => {
    setDraft(draftFromMapping(mapping, recommendedTag));
    setQuickFilled(false);
  }, [mapping, recommendedTag]);

  useEffect(() => {
    if (draft.pipelineId) onPipelineFocus?.(draft.pipelineId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.pipelineId]);

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-black uppercase text-blue-700">
              {form.status || "FORM"}
            </span>
            {mapping?.active !== false && mapping && (
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-black uppercase text-emerald-700">Mapped</span>
            )}
            {!mapping && (
              <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-black uppercase text-amber-700">Imports to owner</span>
            )}
          </div>
          <h2 className="mt-2 truncate text-lg font-black text-slate-950">{form.name || form.id}</h2>
          <p className="mt-1 text-xs font-semibold text-slate-500">Form ID: {form.id}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <StatusPill label="Imported" value={mapping?.importedCount ?? 0} />
            <StatusPill label="Last import" value={mapping?.lastImportedAt ? formatDate(mapping.lastImportedAt) : "Never"} />
            <StatusPill label="Last sync" value={mapping?.lastSyncedAt ? formatDate(mapping.lastSyncedAt) : "Not yet"} />
            <StatusPill label="Webhook" value={mapping?.lastWebhookReceivedAt ? formatDate(mapping.lastWebhookReceivedAt) : mapping?.pageSubscribedAt ? "Subscribed" : "Not active"} />
          </div>
        </div>
        <button
          type="button"
          onClick={() => onSync(form)}
          disabled={syncing}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-extrabold text-blue-700 hover:bg-blue-100 disabled:opacity-60"
        >
          <DownloadCloud size={16} />
          {syncing ? "Syncing..." : "Sync form"}
        </button>
      </div>

      {!mapping && (
        <div className="mt-4 rounded-xl border border-amber-100 bg-amber-50 p-3 text-sm font-semibold leading-6 text-amber-800">
          Leads from this form will still import and assign to your rules or owner. Save the recommended setup to also tag and route them automatically.
        </div>
      )}

      {mapping?.lastWebhookError && (
        <div className="mt-4 rounded-xl border border-red-100 bg-red-50 p-3 text-sm font-semibold leading-6 text-red-800">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="font-black">Last webhook failed</p>
              <p className="mt-1 break-words">{mapping.lastWebhookError}</p>
            </div>
            {mapping.lastWebhookEventId && (
              <button
                type="button"
                onClick={() => onRetryWebhook(mapping.lastWebhookEventId)}
                disabled={retrying}
                className="inline-flex min-h-9 shrink-0 items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-extrabold text-red-700 hover:bg-red-100 disabled:opacity-60"
              >
                <RefreshCw size={14} className={retrying ? "animate-spin" : ""} />
                {retrying ? "Retrying..." : "Retry failed import"}
              </button>
            )}
          </div>
        </div>
      )}

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Field label="Tag">
          <input
            value={draft.tag}
            onChange={(event) => setDraft((current) => ({ ...current, tag: event.target.value }))}
            placeholder="maple-woods"
            className="field-input"
          />
        </Field>
        <Field label="Owner">
          <select
            value={draft.ownerUserId}
            onChange={(event) => setDraft((current) => ({ ...current, ownerUserId: event.target.value }))}
            className="field-input"
          >
            <option value="">Use assignment rules</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>{user.email}</option>
            ))}
          </select>
        </Field>
        <Field label="Pipeline">
          <select
            value={draft.pipelineId}
            onChange={(event) => setDraft((current) => ({ ...current, pipelineId: event.target.value, stage: "" }))}
            className="field-input"
          >
            <option value="">Import as contact only</option>
            {pipelines.map((pipeline) => (
              <option key={pipeline.id} value={pipeline.id}>{pipeline.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Stage">
          <select
            value={draft.stage}
            onChange={(event) => setDraft((current) => ({ ...current, stage: event.target.value }))}
            disabled={!draft.pipelineId}
            className="field-input disabled:bg-slate-100"
          >
            <option value="">First stage</option>
            {stages.map((stage) => (
              <option key={stage.id || stage.stageKey} value={stage.stageKey}>{stage.label || stage.stageKey}</option>
            ))}
          </select>
        </Field>
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
          <input
            type="checkbox"
            checked={draft.createOpportunity}
            onChange={(event) => setDraft((current) => ({ ...current, createOpportunity: event.target.checked }))}
          />
          Create opportunity when lead imports
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          {!mapping && (
            <button
              type="button"
              onClick={() => {
                setDraft((current) => ({
                  ...current,
                  tag: current.tag || recommendedTag,
                  active: true,
                }));
                setQuickFilled(true);
              }}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-extrabold text-amber-800 hover:bg-amber-100"
            >
              <Wand2 size={16} />
              Quick fill this form
            </button>
          )}
          <button
            type="button"
            onClick={() => onSuggestMapping(form, draft)}
            disabled={aiLoading}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-purple-200 bg-purple-50 px-4 py-2 text-sm font-extrabold text-purple-800 hover:bg-purple-100 disabled:opacity-60"
          >
            <Wand2 size={16} />
            {aiLoading ? "Thinking..." : "AI suggest mapping"}
          </button>
          <label className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-600">
            <input
              type="checkbox"
              checked={draft.active}
              onChange={(event) => setDraft((current) => ({ ...current, active: event.target.checked }))}
            />
            Active
          </label>
          <button
            type="button"
            onClick={() => onSave(form, draft)}
            disabled={saving}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-sm font-extrabold text-white hover:bg-blue-800 disabled:opacity-60"
          >
            <Save size={16} />
            {saving ? "Saving..." : "Save mapping"}
          </button>
        </div>
      </div>
      {aiSuggestion && (
        <div className="mt-4 rounded-xl border border-purple-100 bg-purple-50 p-3 text-sm font-semibold leading-6 text-purple-900">
          <p className="font-black">AI suggestion</p>
          <p className="mt-1 whitespace-pre-wrap">{aiSuggestion}</p>
        </div>
      )}
      {quickFilled && !mapping && (
        <p className="mt-3 text-xs font-bold text-amber-700">
          Quick fill changed only this form. Click Save mapping to apply it.
        </p>
      )}
    </article>
  );
}

function StatusPill({ label, value }) {
  return (
    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-black text-slate-600">
      {label}: <span className="text-slate-900">{value}</span>
    </span>
  );
}

function Field({ label, children }) {
  return (
    <label className="block text-sm font-bold text-slate-700">
      {label}
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

function Notice({ tone, icon, children }) {
  const styles = tone === "red"
    ? "border-red-200 bg-red-50 text-red-700"
    : "border-emerald-200 bg-emerald-50 text-emerald-700";
  return (
    <div className={`flex items-start gap-2 rounded-xl border px-4 py-3 text-sm font-semibold ${styles}`}>
      <span className="mt-0.5 shrink-0">{icon}</span>
      <span>{children}</span>
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-black text-slate-950">{value ?? 0}</div>
    </div>
  );
}

function draftFromMapping(mapping, recommendedTag = "") {
  return {
    tag: mapping?.tag || recommendedTag,
    ownerUserId: mapping?.ownerUserId || "",
    pipelineId: mapping?.pipelineId || "",
    stage: mapping?.stage || "",
    createOpportunity: Boolean(mapping?.createOpportunity),
    active: mapping?.active !== false,
  };
}

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "facebook-lead-form";
}

function upsertByFormId(items, next) {
  const list = [...items];
  const index = list.findIndex((item) => String(item.formId) === String(next.formId));
  if (index >= 0) {
    list[index] = next;
  } else {
    list.unshift(next);
  }
  return list;
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

function errorMessage(error, fallback) {
  const data = error?.response?.data;
  if (typeof data === "string") return data;
  return data?.message || data?.error || error?.message || fallback;
}
