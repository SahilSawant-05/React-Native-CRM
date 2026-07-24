import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, CircleAlert, KanbanSquare, Megaphone, Settings2, Upload } from "lucide-react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";

const QUICK_ACTIONS = {
  templates: { action: "CREATE_STARTER_TEMPLATES", label: "Create Starter Templates" },
  assignment: { action: "CREATE_DEFAULT_ASSIGNMENT", label: "Create Default Assignment" },
  automation: { action: "CREATE_FOLLOWUP_AUTOMATION", label: "Create Follow-up Automation" },
};

function SetupCard({ item, onAction, onQuickAction, runningAction }) {
  const quickAction = !item.complete ? QUICK_ACTIONS[item.key] : null;
  const running = quickAction && runningAction === quickAction.action;

  return (
    <article className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {item.complete ? (
              <CheckCircle2 size={18} className="text-emerald-600" />
            ) : (
              <CircleAlert size={18} className="text-amber-600" />
            )}
            <h3 className="font-bold text-gray-950">{item.label}</h3>
          </div>
          <p className="mt-2 text-sm leading-6 text-gray-500">{item.description}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-bold ${item.complete ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
          {item.complete ? "Ready" : "Missing"}
        </span>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-4">
        <span className="text-sm font-semibold text-gray-500">{item.count} configured</span>
        <div className="flex flex-wrap gap-2">
          {quickAction && (
            <button
              type="button"
              onClick={() => onQuickAction(quickAction.action)}
              disabled={Boolean(runningAction)}
              className="rounded-lg bg-teal-700 px-3 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {running ? "Running..." : quickAction.label}
            </button>
          )}
          <button
            type="button"
            onClick={() => onAction(item.actionPath)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            {item.actionLabel}
          </button>
        </div>
      </div>
    </article>
  );
}

function itemComplete(status, key) {
  return Boolean((status?.items || []).find((item) => item.key === key)?.complete);
}

function buildTimelineSteps(status) {
  const setupReady = Number(status?.completionPercent || 0) >= 70;
  const pipelineReady = itemComplete(status, "pipeline");
  const stagesReady = itemComplete(status, "stages");
  const fieldsReady = itemComplete(status, "fields");
  const templatesReady = itemComplete(status, "templates");
  const assignmentReady = itemComplete(status, "assignment");
  const automationReady = itemComplete(status, "automation");
  const coreReady = setupReady && pipelineReady && stagesReady && fieldsReady;
  const campaignReady = templatesReady && assignmentReady;

  return [
    {
      key: "setup",
      label: "Setup",
      description: "Default pipeline, stages, fields, email, and WhatsApp basics.",
      path: "/dashboard/setup",
      icon: Settings2,
      complete: coreReady,
      active: !coreReady,
    },
    {
      key: "import",
      label: "Import Leads",
      description: "Bring contacts from CSV/Excel or create leads manually.",
      path: "/dashboard/upload",
      icon: Upload,
      complete: false,
      active: coreReady,
    },
    {
      key: "pipeline",
      label: "Start Pipeline",
      description: "Create opportunities and move leads through stages.",
      path: "/dashboard/pipeline",
      icon: KanbanSquare,
      complete: pipelineReady && automationReady,
      active: coreReady,
    },
    {
      key: "campaign",
      label: "Run Campaign",
      description: "Use templates and assignment rules before outreach.",
      path: "/dashboard/campaigns/create",
      icon: Megaphone,
      complete: campaignReady,
      active: coreReady && templatesReady,
    },
  ];
}

function TimelineStep({ step, index, total, onNavigate }) {
  const Icon = step.icon;
  const stateLabel = step.complete ? "Ready" : step.active ? "Next" : "Later";
  const accent = step.complete
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : step.active
      ? "border-teal-200 bg-teal-50 text-teal-700"
      : "border-gray-200 bg-gray-50 text-gray-500";

  return (
    <div className="relative min-w-0 flex-1">
      {index < total - 1 && (
        <div className={`absolute left-[calc(50%+24px)] right-[calc(-50%+24px)] top-6 hidden h-0.5 md:block ${
          step.complete ? "bg-emerald-200" : "bg-gray-200"
        }`} />
      )}
      <button
        type="button"
        onClick={() => onNavigate(step.path)}
        className="relative flex w-full flex-col items-center rounded-lg border border-transparent px-3 py-2 text-center hover:border-gray-200 hover:bg-white"
      >
        <span className={`inline-flex h-12 w-12 items-center justify-center rounded-full border ${accent}`}>
          {step.complete ? <CheckCircle2 size={22} /> : <Icon size={22} />}
        </span>
        <span className="mt-3 text-sm font-extrabold text-gray-950">{step.label}</span>
        <span className={`mt-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${step.complete ? "bg-emerald-100 text-emerald-700" : step.active ? "bg-teal-100 text-teal-700" : "bg-gray-100 text-gray-500"}`}>
          {stateLabel}
        </span>
        <span className="mt-2 max-w-48 text-xs leading-5 text-gray-500">{step.description}</span>
      </button>
    </div>
  );
}

function SetupTimeline({ steps, onNavigate }) {
  return (
    <section className="mb-6 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-extrabold text-gray-950">CRM Launch Timeline</h2>
          <p className="mt-1 text-sm text-gray-500">Follow this path to move from setup into live sales activity.</p>
        </div>
      </div>
      <div className="grid gap-3 md:flex md:items-start">
        {steps.map((step, index) => (
          <TimelineStep
            key={step.key}
            step={step}
            index={index}
            total={steps.length}
            onNavigate={onNavigate}
          />
        ))}
      </div>
    </section>
  );
}

export default function SetupStatus() {
  const navigate = useNavigate();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [runningAction, setRunningAction] = useState("");

  const loadStatus = async () => {
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const response = await api.get("/api/setup/status");
      setStatus(response.data);
    } catch (err) {
      setError(err?.response?.data?.message || err.message || "Failed to load setup status");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const runQuickAction = async (action) => {
    setRunningAction(action);
    setError("");
    setSuccess("");
    try {
      const response = await api.post(`/api/setup/actions/${action}`);
      setStatus(response.data);
      setSuccess("Setup action completed.");
    } catch (err) {
      setError(err?.response?.data?.message || err.message || "Setup action failed");
    } finally {
      setRunningAction("");
    }
  };

  const incompleteItems = useMemo(
    () => (status?.items || []).filter((item) => !item.complete),
    [status]
  );
  const timelineSteps = useMemo(() => buildTimelineSteps(status), [status]);

  if (loading) {
    return <div className="min-h-screen bg-slate-50 p-6 text-sm text-gray-500">Loading setup status...</div>;
  }

  if (error && !status) {
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
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-teal-700">CRM Setup</p>
              <h1 className="mt-2 text-2xl font-extrabold text-gray-950">
                {status?.defaultPipelineName || "Pipeline"} Workspace Health
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                Finish the core setup pieces so the CRM works smoothly around your default pipeline.
              </p>
            </div>
            <button
              type="button"
              onClick={loadStatus}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              <Settings2 size={16} />
              Refresh Status
            </button>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
            <div className="rounded-lg bg-teal-50 p-4">
              <div className="text-4xl font-extrabold text-teal-800">{status?.completionPercent || 0}%</div>
              <p className="mt-1 text-sm font-semibold text-teal-800">
                {status?.completedCount || 0} of {status?.totalCount || 0} complete
              </p>
            </div>
            <div className="flex flex-col justify-center">
              <div className="h-3 overflow-hidden rounded-full bg-gray-100">
                <div className="h-full rounded-full bg-teal-600" style={{ width: `${status?.completionPercent || 0}%` }} />
              </div>
              <p className="mt-3 text-sm font-semibold text-gray-700">{status?.recommendedNextAction}</p>
            </div>
          </div>
        </header>

        {(error || success) && (
          <div className={`mb-6 rounded-lg border px-4 py-3 text-sm ${error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
            {error || success}
          </div>
        )}

        <SetupTimeline steps={timelineSteps} onNavigate={navigate} />

        {incompleteItems.length > 0 && (
          <section className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4">
            <h2 className="font-bold text-amber-900">Next Best Actions</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {incompleteItems.slice(0, 3).map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => {
                    const quickAction = QUICK_ACTIONS[item.key];
                    if (quickAction) runQuickAction(quickAction.action);
                    else navigate(item.actionPath);
                  }}
                  className="rounded-lg bg-white px-3 py-2 text-sm font-semibold text-amber-800 shadow-sm hover:bg-amber-100"
                >
                  {(QUICK_ACTIONS[item.key]?.label || item.actionLabel)}: {item.label}
                </button>
              ))}
            </div>
          </section>
        )}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {(status?.items || []).map((item) => (
            <SetupCard
              key={item.key}
              item={item}
              onAction={navigate}
              onQuickAction={runQuickAction}
              runningAction={runningAction}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
