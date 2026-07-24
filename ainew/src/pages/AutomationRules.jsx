import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock3, Filter, MousePointerClick, PlusCircle, Save, Sparkles } from "lucide-react";
import {
  Background,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import api from "../api/axios";
import { LEAD_SOURCE_OPTIONS } from "../config/leadSources";

const emptyForm = {
  name: "",
  triggerType: "CONTACT_CREATED",
  conditionStage: "",
  conditionPipelineId: "",
  conditionLeadSource: "",
  conditionIndustryKey: "",
  conditionCallStatus: "",
  conditionCallDisposition: "",
  conditionCallDirection: "",
  conditionAgentUserId: "",
  actionType: "CREATE_TASK",
  taskTitle: "Follow up with {{contactName}}",
  taskDescription: "Automation triggered from {{emailSubject}}{{opportunityTitle}}",
  dueInHours: 24,
  targetStage: "",
  targetPipelineId: "",
  opportunityTitle: "{{contactName}} enquiry",
  emailTemplateId: "",
  emailSubject: "Following up with {{contactName}}",
  emailBody: "Hi {{contactName}},\n\nThanks for your interest. I wanted to follow up and help with the next step.",
  whatsappTemplateId: "",
  notificationTitle: "Automation alert: {{contactName}}",
  notificationBody: "{{contactName}} needs attention. Source: {{leadSource}}",
  delayInHours: "",
  requireNoResponse: false,
  active: true,
};

const inputClass = "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100";

const normalizeList = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.content)) return payload.content;
  return [];
};

const normalizePage = (payload, fallbackPage = 0, fallbackSize = 10) => {
  const content = normalizeList(payload);
  return {
    content,
    number: Number.isFinite(payload?.number) ? payload.number : fallbackPage,
    size: Number.isFinite(payload?.size) ? payload.size : fallbackSize,
    totalElements: Number.isFinite(payload?.totalElements) ? payload.totalElements : content.length,
    totalPages: Number.isFinite(payload?.totalPages) ? payload.totalPages : (content.length ? 1 : 0),
    first: payload?.first ?? fallbackPage <= 0,
    last: payload?.last ?? true,
  };
};

const labelFor = (value) => String(value || "").replaceAll("_", " ");

const triggerLabels = {
  CONTACT_CREATED: "New lead",
  EMAIL_RECEIVED: "Email received",
  WHATSAPP_RECEIVED: "WhatsApp received",
  WHATSAPP_FLOW_SUBMITTED: "WhatsApp Flow submitted",
  OPPORTUNITY_STAGE_CHANGED: "Stage changed",
  CALL_OUTCOME_UPDATED: "Call outcome updated",
};

const CALL_STATUS_OPTIONS = ["REQUESTED", "RINGING", "IN_PROGRESS", "COMPLETED", "NO_ANSWER", "BUSY", "FAILED", "CANCELLED"];
const CALL_DISPOSITION_OPTIONS = ["INTERESTED", "NOT_INTERESTED", "CALL_BACK_LATER", "FOLLOW_UP_REQUIRED", "WRONG_NUMBER", "NO_ANSWER", "CONVERTED"];
const CALL_DIRECTION_OPTIONS = ["OUTBOUND", "INBOUND"];

const actionLabels = {
  CREATE_TASK: "Create task",
  CREATE_OPPORTUNITY: "Create opportunity",
  MOVE_OPPORTUNITY_STAGE: "Move stage",
  SEND_EMAIL: "Send email",
  SEND_WHATSAPP_TEMPLATE: "Send WhatsApp template",
  NOTIFY_AGENT: "Notify agent",
  AI_LEAD_SCORE: "AI lead score",
};

const panelIcons = {
  trigger: MousePointerClick,
  filters: Filter,
  action: PlusCircle,
  details: CheckCircle2,
  timing: Clock3,
};
const workflowPanelOrder = ["trigger", "filters", "action", "details", "timing"];

const nodeTypes = {
  workflow: WorkflowNode,
};

export default function AutomationRules() {
  const [rules, setRules] = useState([]);
  const [pipelines, setPipelines] = useState([]);
  const [stages, setStages] = useState([]);
  const [users, setUsers] = useState([]);
  const [emailTemplates, setEmailTemplates] = useState([]);
  const [whatsappTemplates, setWhatsappTemplates] = useState([]);
  const [queue, setQueue] = useState([]);
  const [logs, setLogs] = useState([]);
  const [queueMeta, setQueueMeta] = useState(() => normalizePage([], 0, 10));
  const [logsMeta, setLogsMeta] = useState(() => normalizePage([], 0, 10));
  const [queuePage, setQueuePage] = useState(0);
  const [logsPage, setLogsPage] = useState(0);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [selectedPanel, setSelectedPanel] = useState("trigger");
  const [nodePositions, setNodePositions] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeToggleId, setActiveToggleId] = useState(null);
  const [message, setMessage] = useState("");
  const executionPageSize = 10;

  const stageOptions = useMemo(
    () => stages.filter((stage) => stage.active !== false).map((stage) => ({
      key: stage.stageKey || stage.key,
      label: stage.label || stage.stageKey || stage.key,
    })),
    [stages]
  );

  const nodes = useMemo(() => buildNodes(form, stageOptions, pipelines, users, selectedPanel, nodePositions), [form, stageOptions, pipelines, users, selectedPanel, nodePositions]);
  const edges = useMemo(() => buildEdges(nodes), [nodes]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [rulesResponse, pipelinesResponse, usersResponse, emailTemplatesResponse, whatsappTemplatesResponse, queueResponse, logsResponse] = await Promise.all([
        api.get("/api/automation-rules"),
        api.get("/api/pipelines"),
        api.get("/api/users").catch(() => ({ data: [] })),
        api.get("/api/crm-config/communication-templates", { params: { channel: "EMAIL" } }),
        api.get("/api/templates"),
        api.get("/api/automation-rules/queue", { params: { page: queuePage, size: executionPageSize } }),
        api.get("/api/automation-rules/logs", { params: { page: logsPage, size: executionPageSize } }),
      ]);
      const nextQueue = normalizePage(queueResponse.data, queuePage, executionPageSize);
      const nextLogs = normalizePage(logsResponse.data, logsPage, executionPageSize);
      setRules(normalizeList(rulesResponse.data));
      setPipelines(normalizeList(pipelinesResponse.data));
      setUsers(normalizeList(usersResponse.data));
      setEmailTemplates(normalizeList(emailTemplatesResponse.data));
      setWhatsappTemplates(normalizeList(whatsappTemplatesResponse.data));
      setQueue(nextQueue.content);
      setLogs(nextLogs.content);
      setQueueMeta(nextQueue);
      setLogsMeta(nextLogs);
    } catch (error) {
      setMessage(readError(error, "Failed to load automation rules"));
    } finally {
      setLoading(false);
    }
  }, [logsPage, queuePage]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const selectedStagePipelineId = form.targetPipelineId
    || form.conditionPipelineId
    || String(pipelines.find((pipeline) => pipeline.defaultPipeline)?.id || pipelines[0]?.id || "");

  useEffect(() => {
    let cancelled = false;
    const loadStages = async () => {
      if (!selectedStagePipelineId) {
        setStages([]);
        return;
      }
      try {
        const response = await api.get("/api/crm-config/pipeline-stages", { params: { pipelineId: selectedStagePipelineId } });
        if (!cancelled) {
          setStages(normalizeList(response.data));
        }
      } catch {
        if (!cancelled) setStages([]);
      }
    };
    loadStages();
    return () => {
      cancelled = true;
    };
  }, [selectedStagePipelineId]);

  const setValue = (field, value) => {
    setForm((current) => {
      const next = { ...current, [field]: value };
      if (field === "triggerType" && value !== "OPPORTUNITY_STAGE_CHANGED") {
        next.conditionStage = "";
        next.conditionPipelineId = "";
        if (current.actionType === "MOVE_OPPORTUNITY_STAGE" && value !== "CALL_OUTCOME_UPDATED") {
          next.actionType = "CREATE_TASK";
        }
      }
      if (field === "triggerType" && value !== "CALL_OUTCOME_UPDATED") {
        next.conditionCallStatus = "";
        next.conditionCallDisposition = "";
        next.conditionCallDirection = "";
        next.conditionAgentUserId = "";
      }
      if (field === "triggerType" && value === "OPPORTUNITY_STAGE_CHANGED") {
        next.conditionLeadSource = "";
        next.conditionIndustryKey = "";
      }
      if (field === "conditionLeadSource") {
        next.conditionIndustryKey = "";
      }
      if (field === "conditionPipelineId") {
        next.conditionStage = "";
        if (!next.targetPipelineId && next.actionType === "MOVE_OPPORTUNITY_STAGE") {
          next.targetPipelineId = value;
        }
      }
      if (field === "targetPipelineId") {
        next.targetStage = "";
      }
      if (field === "conditionStage" && value && !next.conditionPipelineId && selectedStagePipelineId) {
        next.conditionPipelineId = String(selectedStagePipelineId);
      }
      if (field === "targetStage" && value && !next.targetPipelineId && selectedStagePipelineId && next.actionType === "CREATE_OPPORTUNITY") {
        next.targetPipelineId = String(selectedStagePipelineId);
      }
      return next;
    });
  };

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setSelectedPanel("trigger");
  };

  const saveRule = async (event) => {
    event.preventDefault();
    if (!form.name.trim()) return;

    setSaving(true);
    setMessage("");
    const payload = {
      ...form,
      name: form.name.trim(),
      conditionStage: form.conditionStage || null,
      conditionPipelineId: form.conditionPipelineId ? Number(form.conditionPipelineId) : null,
      conditionLeadSource: form.conditionLeadSource || null,
      conditionIndustryKey: null,
      conditionCallStatus: form.conditionCallStatus || null,
      conditionCallDisposition: form.conditionCallDisposition || null,
      conditionCallDirection: form.conditionCallDirection || null,
      conditionAgentUserId: form.conditionAgentUserId ? Number(form.conditionAgentUserId) : null,
      targetStage: form.targetStage || null,
      targetPipelineId: form.targetPipelineId ? Number(form.targetPipelineId) : null,
      opportunityTitle: form.opportunityTitle || null,
      emailTemplateId: form.emailTemplateId ? Number(form.emailTemplateId) : null,
      emailSubject: form.emailSubject || null,
      emailBody: form.emailBody || null,
      whatsappTemplateId: form.whatsappTemplateId ? Number(form.whatsappTemplateId) : null,
      notificationTitle: form.notificationTitle || null,
      notificationBody: form.notificationBody || null,
      delayInHours: form.delayInHours === "" ? null : Number(form.delayInHours),
      requireNoResponse: Boolean(form.requireNoResponse),
      dueInHours: form.dueInHours === "" ? null : Number(form.dueInHours),
    };

    try {
      if (editingId) {
        await api.put(`/api/automation-rules/${editingId}`, payload);
        setMessage("Automation rule updated.");
      } else {
        await api.post("/api/automation-rules", payload);
        setMessage("Automation rule created.");
      }
      resetForm();
      await loadData();
    } catch (error) {
      setMessage(readError(error, "Save failed"));
    } finally {
      setSaving(false);
    }
  };

  const editRule = (rule) => {
    setEditingId(rule.id);
    setSelectedPanel("trigger");
    setForm({
      name: rule.name || "",
      triggerType: rule.triggerType || "CONTACT_CREATED",
      conditionStage: rule.conditionStage || "",
      conditionPipelineId: rule.conditionPipelineId ? String(rule.conditionPipelineId) : "",
      conditionLeadSource: rule.conditionLeadSource || "",
      conditionIndustryKey: "",
      conditionCallStatus: rule.conditionCallStatus || "",
      conditionCallDisposition: rule.conditionCallDisposition || "",
      conditionCallDirection: rule.conditionCallDirection || "",
      conditionAgentUserId: rule.conditionAgentUserId ? String(rule.conditionAgentUserId) : "",
      actionType: rule.actionType || "CREATE_TASK",
      taskTitle: rule.taskTitle || "",
      taskDescription: rule.taskDescription || "",
      dueInHours: rule.dueInHours ?? "",
      targetStage: rule.targetStage || "",
      targetPipelineId: rule.targetPipelineId ? String(rule.targetPipelineId) : "",
      opportunityTitle: rule.opportunityTitle || "",
      emailTemplateId: rule.emailTemplateId || "",
      emailSubject: rule.emailSubject || "",
      emailBody: rule.emailBody || "",
      whatsappTemplateId: rule.whatsappTemplateId || "",
      notificationTitle: rule.notificationTitle || "",
      notificationBody: rule.notificationBody || "",
      delayInHours: rule.delayInHours ?? "",
      requireNoResponse: Boolean(rule.requireNoResponse),
      active: rule.active !== false,
    });
  };

  const deleteRule = async (rule) => {
    const confirmed = window.confirm(
      `Delete automation rule "${rule.name}"?\n\n` +
      "Existing contacts, opportunities, tasks, and execution history will stay. " +
      "Pending delayed actions for this rule will be cancelled, and future matching leads will no longer be processed.\n\n" +
      "Use Pause instead if you may need this rule again."
    );
    if (!confirmed) return;

    setMessage("");
    try {
      await api.delete(`/api/automation-rules/${rule.id}`);
      setMessage("Automation rule deleted. Existing CRM records were kept; future triggers have stopped.");
      await loadData();
    } catch (error) {
      setMessage(readError(error, "Delete failed"));
    }
  };

  const toggleRuleActive = async (rule) => {
    setActiveToggleId(rule.id);
    setMessage("");
    try {
      await api.put(`/api/automation-rules/${rule.id}`, toRulePayload({ ...rule, active: rule.active === false }));
      setMessage(rule.active === false ? "Automation rule activated." : "Automation rule paused.");
      await loadData();
    } catch (error) {
      setMessage(readError(error, "Status update failed"));
    } finally {
      setActiveToggleId(null);
    }
  };

  return (
    <div className="min-h-screen min-w-0 max-w-full overflow-x-hidden bg-slate-50 p-3 text-gray-900 sm:p-6">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-2xl font-extrabold text-gray-950">Automation Rules</h1>
            <p className="mt-1 text-sm text-gray-500">Build automatic follow-ups and pipeline actions from lead events.</p>
          </div>
          <button type="button" onClick={resetForm} className="w-fit rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">
            New rule
          </button>
        </header>

        <form onSubmit={saveRule} className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_460px]">
          <section className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-100 px-5 py-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-lg font-bold text-gray-950">{editingId ? "Edit Workflow" : "New Workflow"}</h2>
                  <p className="text-sm text-gray-500">{form.name.trim() || "Untitled automation"}</p>
                </div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <input type="checkbox" checked={form.active} onChange={(event) => setValue("active", event.target.checked)} />
                  Active
                </label>
              </div>
            </div>
            <div className="h-[360px] bg-slate-100 sm:h-[440px]">
              <ReactFlow
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                fitView
                proOptions={{ hideAttribution: true }}
                nodesDraggable
                nodesConnectable={false}
                elementsSelectable
                onNodeClick={(_, node) => setSelectedPanel(node.data.panel)}
                onNodeDragStop={(_, node) => {
                  setNodePositions((current) => ({ ...current, [node.id]: node.position }));
                }}
              >
                <Background color="#cbd5e1" gap={18} />
                <MiniMap pannable zoomable nodeStrokeWidth={3} />
                <Controls showInteractive={false} />
              </ReactFlow>
            </div>
            <div className="border-t border-gray-100 bg-white px-5 py-4">
              <div className="grid gap-3 md:grid-cols-3">
                <WorkflowHint title="1. Pick trigger" text={triggerLabels[form.triggerType] || labelFor(form.triggerType)} active={selectedPanel === "trigger"} onClick={() => setSelectedPanel("trigger")} />
                <WorkflowHint title="2. Filter leads" text={conditionSummary(form, stageOptions, pipelines, users)} active={selectedPanel === "filters"} onClick={() => setSelectedPanel("filters")} />
                <WorkflowHint title="3. Run action" text={actionLabels[form.actionType] || labelFor(form.actionType)} active={["action", "details", "timing"].includes(selectedPanel)} onClick={() => setSelectedPanel("action")} />
              </div>
            </div>
          </section>

          <aside className="xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)] xl:self-start xl:overflow-y-auto">
            <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
              <div className="border-b border-gray-100 p-5">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-gray-950">Workflow Editor</h2>
                    <p className="text-sm text-gray-500">Click a canvas node or step below to edit that part only.</p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${form.active ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-600"}`}>
                    {form.active ? "Active" : "Paused"}
                  </span>
                </div>

                <Field label="Rule name">
                  <input value={form.name} onChange={(event) => setValue("name", event.target.value)} className={inputClass} />
                </Field>

                <label className="mt-4 flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm font-medium text-gray-700">
                  <input type="checkbox" checked={form.active} onChange={(event) => setValue("active", event.target.checked)} />
                  Rule is active
                </label>
              </div>

              <StepRail
                form={form}
                selectedPanel={selectedPanel}
                stageOptions={stageOptions}
                pipelines={pipelines}
                users={users}
                onSelect={setSelectedPanel}
              />

              <div className="space-y-4 p-5">
                <PanelHeader id={selectedPanel} form={form} stageOptions={stageOptions} pipelines={pipelines} users={users} />
                <PanelFields
                  panel={selectedPanel}
                  form={form}
                  setValue={setValue}
                  stageOptions={stageOptions}
                  pipelines={pipelines}
                  users={users}
                  emailTemplates={emailTemplates}
                  whatsappTemplates={whatsappTemplates}
                />
                <PanelNavFooter selectedPanel={selectedPanel} onSelect={setSelectedPanel} />
              </div>

              <div className="border-t border-gray-100 bg-slate-50 p-4">
                <div className="mb-3 grid grid-cols-2 gap-2 text-xs">
                  <StepSummary label="Trigger" value={triggerLabels[form.triggerType] || labelFor(form.triggerType)} />
                  <StepSummary label="Condition" value={conditionSummary(form, stageOptions, pipelines, users)} />
                  <StepSummary label="Action" value={actionLabels[form.actionType] || labelFor(form.actionType)} />
                  <StepSummary label="Timing" value={timingSummary(form)} />
                </div>
                <div className="grid grid-cols-3 gap-2 sm:flex">
                  <button disabled={saving || !isFormValid(form)} className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60">
                    <Save size={16} />
                    {saving ? "Saving..." : editingId ? "Update Rule" : "Create Rule"}
                  </button>
                  {editingId && (
                    <button type="button" onClick={resetForm} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">
                      Cancel
                    </button>
                  )}
                </div>
                {message && <p className="mt-3 text-sm text-gray-600">{message}</p>}
              </div>
            </section>
          </aside>
        </form>

        <section className="mt-6 rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-5 py-4">
            <h2 className="text-lg font-bold text-gray-950">Saved Rules</h2>
            <p className="text-sm text-gray-500">{loading ? "Loading..." : `${rules.length} configured`}</p>
          </div>
          <div className="divide-y divide-gray-100">
            {rules.map((rule) => (
              <article key={rule.id} className="flex flex-col gap-3 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-bold text-gray-950">{rule.name}</h3>
                    <span className="rounded-full bg-teal-50 px-2 py-0.5 text-xs font-semibold text-teal-700">{labelFor(rule.triggerType)}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${rule.active ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-600"}`}>
                      {rule.active ? "Active" : "Paused"}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-gray-500">
                    {labelFor(rule.actionType)}
                    {rule.conditionStage ? ` when ${labelFor(rule.conditionStage)}` : ""}
                    {rule.conditionPipelineId ? ` in ${pipelineName(pipelines, rule.conditionPipelineId)}` : ""}
                    {rule.conditionLeadSource ? ` from ${labelFor(rule.conditionLeadSource)}` : ""}
                    {rule.conditionCallDisposition ? ` outcome ${labelFor(rule.conditionCallDisposition)}` : ""}
                    {rule.conditionCallStatus ? ` status ${labelFor(rule.conditionCallStatus)}` : ""}
                    {rule.conditionCallDirection ? ` ${labelFor(rule.conditionCallDirection)}` : ""}
                    {rule.conditionAgentUserId ? ` by ${userLabel(users, rule.conditionAgentUserId)}` : ""}
                    {rule.targetPipelineId ? ` pipeline ${pipelineName(pipelines, rule.targetPipelineId)}` : ""}
                    {rule.targetStage ? ` to ${labelFor(rule.targetStage)}` : ""}
                    {rule.delayInHours ? ` after ${rule.delayInHours}h` : ""}
                    {rule.requireNoResponse ? " if no response" : ""}
                  </p>
                  {(rule.taskTitle || rule.opportunityTitle || rule.emailSubject || rule.notificationTitle) && (
                    <p className="mt-1 text-sm text-gray-600">{rule.taskTitle || rule.opportunityTitle || rule.emailSubject || rule.notificationTitle}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => toggleRuleActive(rule)}
                    disabled={activeToggleId === rule.id}
                    className={`rounded-lg border px-3 py-2 text-sm font-semibold ${
                      rule.active
                        ? "border-amber-200 text-amber-700 hover:bg-amber-50"
                        : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                    } disabled:opacity-60`}
                  >
                    {activeToggleId === rule.id ? "Saving..." : rule.active ? "Pause" : "Activate"}
                  </button>
                  <button type="button" onClick={() => editRule(rule)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">Edit</button>
                  <button type="button" onClick={() => deleteRule(rule)} className="rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50">Delete Rule</button>
                </div>
              </article>
            ))}
            {rules.length === 0 && <div className="px-5 py-12 text-center text-sm text-gray-500">No automation rules yet.</div>}
          </div>
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-2">
          <AutomationTable
            title="Pending Queue"
            emptyText="No delayed automations waiting."
            rows={queue}
            columns={["status", "ruleId", "contactId", "dueAt"]}
            pageMeta={queueMeta}
            onPageChange={setQueuePage}
          />
          <AutomationTable
            title="Execution Logs"
            emptyText="No automation executions logged yet."
            rows={logs}
            columns={["status", "ruleName", "actionType", "createdAt"]}
            pageMeta={logsMeta}
            onPageChange={setLogsPage}
          />
        </section>
      </div>
    </div>
  );
}

function buildNodes(form, stageOptions, pipelines, users, selectedPanel, nodePositions = {}) {
  const filterText = form.triggerType === "OPPORTUNITY_STAGE_CHANGED"
    ? [
        form.conditionPipelineId ? `Pipeline: ${pipelineName(pipelines, form.conditionPipelineId)}` : "Any pipeline",
        form.conditionStage ? `Stage: ${stageLabel(stageOptions, form.conditionStage)}` : "Any stage",
      ].join(" / ")
    : form.triggerType === "CALL_OUTCOME_UPDATED"
      ? conditionSummary(form, stageOptions, pipelines, users)
    : [
        form.conditionLeadSource ? `Source: ${labelFor(form.conditionLeadSource)}` : "Any source",
      ].join(" / ");

  const detailText = detailSummary(form, stageOptions, pipelines);

  return [
    flowNode("trigger", "Trigger", triggerLabels[form.triggerType] || labelFor(form.triggerType), 40, 160, selectedPanel, 1, nodePositions),
    flowNode("filters", "Conditions", filterText, 300, 160, selectedPanel, 2, nodePositions),
    flowNode("action", "Action", actionLabels[form.actionType] || labelFor(form.actionType), 560, 160, selectedPanel, 3, nodePositions),
    flowNode("details", "Configure", detailText, 820, 160, selectedPanel, 4, nodePositions),
    flowNode("timing", "Timing", timingSummary(form), 1080, 160, selectedPanel, 5, nodePositions),
  ];
}

function flowNode(id, title, subtitle, x, y, selectedPanel, step, nodePositions = {}) {
  return {
    id,
    type: "workflow",
    position: nodePositions[id] || { x, y },
    data: {
      panel: id,
      title,
      subtitle,
      selected: selectedPanel === id,
      step,
    },
  };
}

function buildEdges(nodes) {
  return nodes.slice(0, -1).map((node, index) => ({
    id: `${node.id}-${nodes[index + 1].id}`,
    source: node.id,
    target: nodes[index + 1].id,
    animated: true,
    style: { stroke: "#0f766e", strokeWidth: 2 },
  }));
}

function WorkflowNode({ data }) {
  return (
    <button
      type="button"
      className={`group w-[225px] rounded-xl border bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-teal-500 hover:shadow-lg ${data.selected ? "border-teal-600 ring-4 ring-teal-100" : "border-gray-200"}`}
    >
      <Handle type="target" position={Position.Left} className="!bg-teal-700" />
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className={`inline-flex h-7 w-7 items-center justify-center rounded-lg text-xs font-extrabold ${data.selected ? "bg-teal-700 text-white" : "bg-slate-100 text-slate-600"}`}>
          {data.step}
        </span>
        <span className="rounded-full bg-slate-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500 group-hover:bg-teal-50 group-hover:text-teal-700">
          Edit
        </span>
      </div>
      <p className="text-xs font-bold uppercase tracking-wide text-gray-500">{data.title}</p>
      <p className="mt-1 break-words text-sm font-bold leading-5 text-gray-950">{data.subtitle}</p>
      <Handle type="source" position={Position.Right} className="!bg-teal-700" />
    </button>
  );
}

function workflowSteps(form, stageOptions, pipelines, users = []) {
  return [
    {
      id: "trigger",
      title: "Trigger",
      value: triggerLabels[form.triggerType] || labelFor(form.triggerType),
    },
    {
      id: "filters",
      title: "Conditions",
      value: conditionSummary(form, stageOptions, pipelines, users),
    },
    {
      id: "action",
      title: "Action",
      value: actionLabels[form.actionType] || labelFor(form.actionType),
    },
    {
      id: "details",
      title: "Configure",
      value: detailSummary(form, stageOptions, pipelines),
    },
    {
      id: "timing",
      title: "Timing",
      value: timingSummary(form),
    },
  ];
}

function StepRail({ form, selectedPanel, stageOptions, pipelines, users, onSelect }) {
  return (
    <div className="grid grid-cols-2 border-b border-gray-100 bg-white sm:grid-cols-5">
      {workflowSteps(form, stageOptions, pipelines, users).map((step, index) => {
        const selected = selectedPanel === step.id;
        return (
          <button
            key={step.id}
            type="button"
            onClick={() => onSelect(step.id)}
            className={`min-w-0 border-r border-gray-100 px-2 py-3 text-left last:border-r-0 ${selected ? "bg-teal-50" : "hover:bg-slate-50"}`}
            title={`${step.title}: ${step.value}`}
          >
            <span className={`mb-1 inline-flex h-6 w-6 items-center justify-center rounded-md text-xs font-extrabold ${selected ? "bg-teal-700 text-white" : "bg-slate-100 text-slate-500"}`}>
              {index + 1}
            </span>
            <span className={`block truncate text-[11px] font-extrabold uppercase tracking-wide ${selected ? "text-teal-800" : "text-gray-500"}`}>{step.title}</span>
            <span className="mt-0.5 block truncate text-xs font-semibold text-gray-700">{step.value}</span>
          </button>
        );
      })}
    </div>
  );
}

function WorkflowHint({ title, text, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-w-0 rounded-xl border p-3 text-left transition ${
        active ? "border-teal-300 bg-teal-50 text-teal-950" : "border-gray-200 bg-white text-gray-700 hover:border-teal-200 hover:bg-slate-50"
      }`}
    >
      <span className="text-[11px] font-extrabold uppercase tracking-wide text-gray-500">{title}</span>
      <span className="mt-1 block truncate text-sm font-bold">{text}</span>
    </button>
  );
}

function PanelNavFooter({ selectedPanel, onSelect }) {
  const index = workflowPanelOrder.indexOf(selectedPanel);
  const previous = index > 0 ? workflowPanelOrder[index - 1] : null;
  const next = index >= 0 && index < workflowPanelOrder.length - 1 ? workflowPanelOrder[index + 1] : null;
  return (
    <div className="flex items-center justify-between gap-3 border-t border-gray-100 pt-4">
      <button
        type="button"
        disabled={!previous}
        onClick={() => previous && onSelect(previous)}
        className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Previous
      </button>
      <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">
        Step {Math.max(index + 1, 1)} of {workflowPanelOrder.length}
      </div>
      <button
        type="button"
        disabled={!next}
        onClick={() => next && onSelect(next)}
        className="rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-sm font-semibold text-teal-700 hover:bg-teal-100 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Next
      </button>
    </div>
  );
}

function PanelHeader({ id, form, stageOptions, pipelines, users }) {
  const steps = workflowSteps(form, stageOptions, pipelines, users);
  const step = steps.find((item) => item.id === id) || steps[0];
  const Icon = panelIcons[id] || Sparkles;
  return (
    <div className="flex items-start gap-3 rounded-xl border border-teal-100 bg-teal-50 p-4">
      <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-700 text-white">
        <Icon size={20} />
      </span>
      <div className="min-w-0">
        <h3 className="text-base font-extrabold text-gray-950">{step.title}</h3>
        <p className="mt-1 text-sm leading-5 text-teal-800">{step.value}</p>
      </div>
    </div>
  );
}

function PanelFields({ panel, form, setValue, stageOptions, pipelines, users, emailTemplates, whatsappTemplates }) {
  if (panel === "trigger") {
    return (
      <div className="space-y-4">
        <Field label="Trigger">
          <select value={form.triggerType} onChange={(event) => setValue("triggerType", event.target.value)} className={inputClass}>
            <option value="CONTACT_CREATED">New lead/contact created</option>
            <option value="EMAIL_RECEIVED">Email received</option>
            <option value="WHATSAPP_RECEIVED">WhatsApp message received</option>
            <option value="WHATSAPP_FLOW_SUBMITTED">WhatsApp Flow submitted</option>
            <option value="OPPORTUNITY_STAGE_CHANGED">Opportunity stage changed</option>
            <option value="CALL_OUTCOME_UPDATED">Call outcome updated</option>
          </select>
        </Field>
        <p className="rounded-lg bg-slate-50 p-3 text-xs leading-5 text-gray-500">
          Pick the event that starts this workflow. After choosing the trigger, move to Conditions for filtering.
        </p>
      </div>
    );
  }

  if (panel === "filters") {
    return (
      <div className="space-y-4">
        {form.triggerType === "CALL_OUTCOME_UPDATED" ? (
          <>
            <Field label="Call status">
              <select value={form.conditionCallStatus} onChange={(event) => setValue("conditionCallStatus", event.target.value)} className={inputClass}>
                <option value="">Any status</option>
                {CALL_STATUS_OPTIONS.map((status) => <option key={status} value={status}>{labelFor(status)}</option>)}
              </select>
            </Field>
            <Field label="Call outcome">
              <select value={form.conditionCallDisposition} onChange={(event) => setValue("conditionCallDisposition", event.target.value)} className={inputClass}>
                <option value="">Any outcome</option>
                {CALL_DISPOSITION_OPTIONS.map((outcome) => <option key={outcome} value={outcome}>{labelFor(outcome)}</option>)}
              </select>
            </Field>
            <Field label="Direction">
              <select value={form.conditionCallDirection} onChange={(event) => setValue("conditionCallDirection", event.target.value)} className={inputClass}>
                <option value="">Any direction</option>
                {CALL_DIRECTION_OPTIONS.map((direction) => <option key={direction} value={direction}>{labelFor(direction)}</option>)}
              </select>
            </Field>
            <Field label="Agent">
              <select value={form.conditionAgentUserId} onChange={(event) => setValue("conditionAgentUserId", event.target.value)} className={inputClass}>
                <option value="">Any agent</option>
                {users.map((user) => <option key={user.id} value={user.id}>{userName(user)}</option>)}
              </select>
            </Field>
            <Field label="Contact source">
              <select value={form.conditionLeadSource} onChange={(event) => setValue("conditionLeadSource", event.target.value)} className={inputClass}>
                <option value="">Any source</option>
                {LEAD_SOURCE_OPTIONS.map((source) => <option key={source.value} value={source.value}>{source.label}</option>)}
              </select>
            </Field>
          </>
        ) : form.triggerType !== "OPPORTUNITY_STAGE_CHANGED" ? (
          <>
            <Field label="Lead source filter">
              <select value={form.conditionLeadSource} onChange={(event) => setValue("conditionLeadSource", event.target.value)} className={inputClass}>
                <option value="">Any source</option>
                {LEAD_SOURCE_OPTIONS.map((source) => <option key={source.value} value={source.value}>{source.label}</option>)}
              </select>
            </Field>
            <p className="rounded-lg border border-dashed border-gray-200 bg-white p-3 text-xs leading-5 text-gray-500">
              Industry filter was removed from this builder. Use lead source, pipeline, and stage because those match the current CRM setup model.
            </p>
          </>
        ) : (
          <>
            <Field label="Pipeline">
              <select value={form.conditionPipelineId} onChange={(event) => setValue("conditionPipelineId", event.target.value)} className={inputClass}>
                <option value="">Any pipeline</option>
                {pipelines.map((pipeline) => <option key={pipeline.id} value={pipeline.id}>{pipeline.name}</option>)}
              </select>
            </Field>
            <Field label="When stage becomes">
              <select value={form.conditionStage} onChange={(event) => setValue("conditionStage", event.target.value)} className={inputClass}>
                <option value="">Any stage</option>
                {stageOptions.map((stage) => <option key={stage.key} value={stage.key}>{stage.label}</option>)}
              </select>
            </Field>
          </>
        )}
      </div>
    );
  }

  if (panel === "action") {
    return (
      <div className="space-y-4">
        <Field label="Action">
          <select value={form.actionType} onChange={(event) => setValue("actionType", event.target.value)} className={inputClass}>
            <option value="CREATE_TASK">Create task</option>
            <option value="CREATE_OPPORTUNITY">Create opportunity in pipeline</option>
            <option value="SEND_EMAIL">Send email</option>
            <option value="SEND_WHATSAPP_TEMPLATE">Send WhatsApp template</option>
            <option value="NOTIFY_AGENT">Notify agent</option>
            <option value="AI_LEAD_SCORE">Run AI lead score</option>
            {(form.triggerType === "OPPORTUNITY_STAGE_CHANGED" || form.triggerType === "CALL_OUTCOME_UPDATED") && (
              <option value="MOVE_OPPORTUNITY_STAGE">Move opportunity stage</option>
            )}
          </select>
        </Field>
        <ActionQuickPicks form={form} setValue={setValue} />
      </div>
    );
  }

  if (panel === "details") {
    return (
      <ActionDetailFields
        form={form}
        setValue={setValue}
        stageOptions={stageOptions}
        pipelines={pipelines}
        emailTemplates={emailTemplates}
        whatsappTemplates={whatsappTemplates}
      />
    );
  }

  return (
    <div className="space-y-4">
      <Field label="Delay in hours">
        <input
          type="number"
          min="0"
          value={form.delayInHours}
          onChange={(event) => setValue("delayInHours", event.target.value)}
          placeholder="0 = run immediately"
          className={inputClass}
        />
      </Field>
      <label className="flex items-start gap-3 rounded-lg border border-gray-200 bg-slate-50 p-3 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={form.requireNoResponse}
          onChange={(event) => setValue("requireNoResponse", event.target.checked)}
          className="mt-1"
        />
        <span>
          <span className="block font-semibold text-gray-900">Only if no lead response</span>
          <span className="mt-1 block text-xs leading-5 text-gray-500">For delayed rules, skip the action if an inbound WhatsApp message or email arrives before the delay ends.</span>
        </span>
      </label>
    </div>
  );
}

function ActionQuickPicks({ form, setValue }) {
  const actions = [
    ["CREATE_TASK", "Task"],
    ["CREATE_OPPORTUNITY", "Opportunity"],
    ["SEND_EMAIL", "Email"],
    ["SEND_WHATSAPP_TEMPLATE", "WhatsApp"],
    ["NOTIFY_AGENT", "Notify"],
    ["AI_LEAD_SCORE", "AI score"],
  ];
  if (form.triggerType === "OPPORTUNITY_STAGE_CHANGED" || form.triggerType === "CALL_OUTCOME_UPDATED") actions.push(["MOVE_OPPORTUNITY_STAGE", "Move stage"]);

  return (
    <div className="grid grid-cols-2 gap-2">
      {actions.map(([value, label]) => (
        <button
          key={value}
          type="button"
          onClick={() => setValue("actionType", value)}
          className={`rounded-lg border px-3 py-2 text-sm font-semibold ${form.actionType === value ? "border-teal-600 bg-teal-50 text-teal-800" : "border-gray-200 bg-white text-gray-700 hover:bg-slate-50"}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function ActionDetailFields({ form, setValue, stageOptions, pipelines, emailTemplates, whatsappTemplates }) {
  if (form.actionType === "CREATE_TASK") {
    return (
      <div className="space-y-4">
        <Field label="Task title">
          <input value={form.taskTitle} onChange={(event) => setValue("taskTitle", event.target.value)} className={inputClass} />
        </Field>
        <Field label="Task description">
          <textarea rows={4} value={form.taskDescription} onChange={(event) => setValue("taskDescription", event.target.value)} className={inputClass} />
        </Field>
        <Field label="Due in hours">
          <input type="number" min="0" value={form.dueInHours} onChange={(event) => setValue("dueInHours", event.target.value)} className={inputClass} />
        </Field>
      </div>
    );
  }

  if (form.actionType === "CREATE_OPPORTUNITY") {
    return (
      <div className="space-y-4">
        <Field label="Opportunity title">
          <input value={form.opportunityTitle} onChange={(event) => setValue("opportunityTitle", event.target.value)} className={inputClass} />
        </Field>
        <Field label="Pipeline">
          <select value={form.targetPipelineId} onChange={(event) => setValue("targetPipelineId", event.target.value)} className={inputClass}>
            <option value="">Select pipeline</option>
            {pipelines.map((pipeline) => <option key={pipeline.id} value={pipeline.id}>{pipeline.name}</option>)}
          </select>
        </Field>
        <Field label="Pipeline stage">
          <select value={form.targetStage} onChange={(event) => setValue("targetStage", event.target.value)} className={inputClass}>
            <option value="">First active stage</option>
            {stageOptions.map((stage) => <option key={stage.key} value={stage.key}>{stage.label}</option>)}
          </select>
        </Field>
        {!form.targetPipelineId && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs font-medium leading-5 text-amber-800">
            Select the exact pipeline. Automation will create the new opportunity only in that pipeline.
          </p>
        )}
      </div>
    );
  }

  if (form.actionType === "MOVE_OPPORTUNITY_STAGE") {
    return (
      <div className="space-y-4">
        <Field label="Pipeline">
          <select value={form.conditionPipelineId} onChange={(event) => setValue("conditionPipelineId", event.target.value)} className={inputClass}>
            <option value="">Use trigger opportunity pipeline</option>
            {pipelines.map((pipeline) => <option key={pipeline.id} value={pipeline.id}>{pipeline.name}</option>)}
          </select>
        </Field>
        <Field label="Target stage">
          <select value={form.targetStage} onChange={(event) => setValue("targetStage", event.target.value)} className={inputClass}>
            <option value="">Select stage</option>
            {stageOptions.map((stage) => <option key={stage.key} value={stage.key}>{stage.label}</option>)}
          </select>
        </Field>
      </div>
    );
  }

  if (form.actionType === "SEND_EMAIL") {
    return (
      <div className="space-y-4">
        <Field label="Email template">
          <select value={form.emailTemplateId} onChange={(event) => setValue("emailTemplateId", event.target.value)} className={inputClass}>
            <option value="">No template / manual content</option>
            {emailTemplates.map((template) => (
              <option key={template.id} value={template.id}>{template.name || template.subject || `Template #${template.id}`}</option>
            ))}
          </select>
        </Field>
        <Field label="Subject">
          <input value={form.emailSubject} onChange={(event) => setValue("emailSubject", event.target.value)} className={inputClass} />
        </Field>
        <Field label="Body">
          <textarea rows={5} value={form.emailBody} onChange={(event) => setValue("emailBody", event.target.value)} className={inputClass} />
        </Field>
      </div>
    );
  }

  if (form.actionType === "SEND_WHATSAPP_TEMPLATE") {
    return (
      <Field label="WhatsApp template">
        <select value={form.whatsappTemplateId} onChange={(event) => setValue("whatsappTemplateId", event.target.value)} className={inputClass}>
          <option value="">Select template</option>
          {whatsappTemplates.map((template) => (
            <option key={template.id} value={template.id}>
              {template.metaTemplateName || template.name || `Template #${template.id}`} {template.languageCode ? `(${template.languageCode})` : ""}
            </option>
          ))}
        </select>
      </Field>
    );
  }

  if (form.actionType === "AI_LEAD_SCORE") {
    return (
      <div className="space-y-3">
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4">
          <h4 className="text-sm font-extrabold text-indigo-950">AI lead scoring automation</h4>
          <p className="mt-2 text-sm leading-6 text-indigo-800">
            When this rule runs, Vistaar Flow sends the contact context to the configured AI provider, saves a 0-100 lead score, adds an AI note to the contact timeline, and notifies the owner.
          </p>
        </div>
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs font-semibold leading-5 text-amber-800">
          Requires Growth plan or higher, active AI settings, and available AI credits. Failed setup or low credits will appear in execution logs.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Field label="Notification title">
        <input value={form.notificationTitle} onChange={(event) => setValue("notificationTitle", event.target.value)} className={inputClass} />
      </Field>
      <Field label="Notification body">
        <textarea rows={4} value={form.notificationBody} onChange={(event) => setValue("notificationBody", event.target.value)} className={inputClass} />
      </Field>
    </div>
  );
}

function detailSummary(form, stageOptions, pipelines = []) {
  if (form.actionType === "CREATE_TASK") {
    return form.dueInHours ? `Task due in ${form.dueInHours}h` : "Task due anytime";
  }
  if (form.actionType === "CREATE_OPPORTUNITY") {
    return `${form.targetPipelineId ? pipelineName(pipelines, form.targetPipelineId) : "Select pipeline"} / ${form.targetStage ? stageLabel(stageOptions, form.targetStage) : "First stage"}`;
  }
  if (form.actionType === "MOVE_OPPORTUNITY_STAGE") {
    return `Move to ${form.targetStage ? stageLabel(stageOptions, form.targetStage) : "stage"}`;
  }
  if (form.actionType === "SEND_EMAIL") {
    return form.emailTemplateId ? "Email template" : (form.emailSubject || "Manual email");
  }
  if (form.actionType === "SEND_WHATSAPP_TEMPLATE") {
    return form.whatsappTemplateId ? "WhatsApp template" : "Select WhatsApp template";
  }
  if (form.actionType === "NOTIFY_AGENT") {
    return form.notificationTitle || "Notify owner";
  }
  if (form.actionType === "AI_LEAD_SCORE") {
    return "Score lead and save reason";
  }
  return labelFor(form.actionType);
}

function isFormValid(form) {
  if (!form.name.trim()) return false;
  if (form.requireNoResponse && (!form.delayInHours || Number(form.delayInHours) <= 0)) return false;
  if (form.actionType === "CREATE_OPPORTUNITY") return Boolean(form.targetPipelineId);
  if (form.actionType === "MOVE_OPPORTUNITY_STAGE") return Boolean(form.targetStage);
  if (form.actionType === "SEND_EMAIL") {
    return Boolean(form.emailTemplateId || (form.emailSubject.trim() && form.emailBody.trim()));
  }
  if (form.actionType === "SEND_WHATSAPP_TEMPLATE") return Boolean(form.whatsappTemplateId);
  if (form.actionType === "NOTIFY_AGENT") return Boolean(form.notificationTitle.trim() || form.notificationBody.trim());
  if (form.actionType === "AI_LEAD_SCORE") return true;
  return true;
}

function timingSummary(form) {
  const delay = Number(form.delayInHours || 0);
  if (delay > 0 && form.requireNoResponse) return `Wait ${delay}h, skip if response`;
  if (delay > 0) return `Wait ${delay}h`;
  return "Run immediately";
}

function conditionSummary(form, stageOptions, pipelines = [], users = []) {
  if (form.triggerType === "OPPORTUNITY_STAGE_CHANGED") {
    const pipeline = form.conditionPipelineId ? pipelineName(pipelines, form.conditionPipelineId) : "Any pipeline";
    const stage = form.conditionStage ? stageLabel(stageOptions, form.conditionStage) : "Any stage";
    return `${pipeline} / ${stage}`;
  }
  if (form.triggerType === "CALL_OUTCOME_UPDATED") {
    const parts = [];
    parts.push(form.conditionCallDisposition ? `Outcome: ${labelFor(form.conditionCallDisposition)}` : "Any outcome");
    parts.push(form.conditionCallStatus ? `Status: ${labelFor(form.conditionCallStatus)}` : "Any status");
    if (form.conditionCallDirection) parts.push(`Direction: ${labelFor(form.conditionCallDirection)}`);
    if (form.conditionAgentUserId) parts.push(`Agent: ${userLabel(users, form.conditionAgentUserId)}`);
    if (form.conditionLeadSource) parts.push(`Source: ${labelFor(form.conditionLeadSource)}`);
    return parts.join(" / ");
  }
  const parts = [];
  parts.push(form.conditionLeadSource ? `Source: ${labelFor(form.conditionLeadSource)}` : "Any source");
  return parts.join(" / ");
}

function stageLabel(stageOptions, key) {
  return stageOptions.find((stage) => stage.key === key)?.label || labelFor(key);
}

function pipelineName(pipelines, pipelineId) {
  return pipelines.find((pipeline) => String(pipeline.id) === String(pipelineId))?.name || `Pipeline #${pipelineId}`;
}

function userName(user) {
  return user?.name || user?.fullName || user?.email || `User #${user?.id}`;
}

function userLabel(users, userId) {
  return userName(users.find((user) => String(user.id) === String(userId))) || `User #${userId}`;
}

function WorkflowPanel({ id, title, subtitle, selectedPanel, onSelect, children }) {
  const Icon = panelIcons[id] || CheckCircle2;
  const selected = selectedPanel === id;
  return (
    <section className={`rounded-lg border bg-white shadow-sm transition ${
      selected ? "border-teal-300 ring-2 ring-teal-100" : "border-gray-200"
    }`}>
      <button
        type="button"
        onClick={() => onSelect(id)}
        className={`flex w-full items-start gap-3 p-4 text-left ${selected ? "pb-3" : ""}`}
      >
        <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
          selected ? "bg-teal-700 text-white" : "bg-slate-100 text-slate-600"
        }`}>
          <Icon size={19} />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-extrabold text-gray-950">{title}</span>
          <span className="mt-1 block text-xs leading-5 text-gray-500">{subtitle}</span>
        </span>
      </button>
      {selected && <div className="space-y-4 border-t border-gray-100 p-4">{children}</div>}
    </section>
  );
}

function StepSummary({ label, value }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <p className="font-bold uppercase tracking-wide text-gray-400">{label}</p>
      <p className="mt-1 line-clamp-2 font-semibold text-gray-700">{value || "Not set"}</p>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</span>
      {children}
    </label>
  );
}

function AutomationTable({ title, emptyText, rows, columns, pageMeta, onPageChange }) {
  const currentPage = pageMeta?.number || 0;
  const totalPages = pageMeta?.totalPages || 0;
  const totalElements = pageMeta?.totalElements ?? rows.length;
  const canPrevious = currentPage > 0;
  const canNext = totalPages > 0 && currentPage < totalPages - 1;

  return (
    <section className="rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-gray-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-950">{title}</h2>
          <p className="text-sm text-gray-500">
            {totalElements} record{totalElements === 1 ? "" : "s"}
            {totalPages > 1 ? ` / page ${currentPage + 1} of ${totalPages}` : ""}
          </p>
        </div>
        {onPageChange && totalPages > 1 && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={!canPrevious}
              onClick={() => onPageChange(Math.max(currentPage - 1, 0))}
              className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Prev
            </button>
            <button
              type="button"
              disabled={!canNext}
              onClick={() => onPageChange(currentPage + 1)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        )}
      </div>
      {rows.length === 0 ? (
        <div className="px-5 py-10 text-center text-sm text-gray-500">{emptyText}</div>
      ) : (
        <div className="max-h-[420px] overflow-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-gray-100 bg-slate-50">
                {columns.map((column) => (
                  <th key={column} className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500">{labelFor(column)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-gray-100 last:border-0">
                  {columns.map((column) => (
                    <td key={column} className="px-4 py-3 text-gray-700">{formatCell(row[column])}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function formatCell(value) {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "string" && value.includes("T")) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.toLocaleString();
  }
  return String(value).replaceAll("_", " ");
}

function toRulePayload(rule) {
  return {
    name: rule.name || "",
    triggerType: rule.triggerType || "CONTACT_CREATED",
    conditionStage: rule.conditionStage || null,
    conditionPipelineId: rule.conditionPipelineId || null,
    conditionLeadSource: rule.conditionLeadSource || null,
    conditionIndustryKey: null,
    conditionCallStatus: rule.conditionCallStatus || null,
    conditionCallDisposition: rule.conditionCallDisposition || null,
    conditionCallDirection: rule.conditionCallDirection || null,
    conditionAgentUserId: rule.conditionAgentUserId || null,
    actionType: rule.actionType || "CREATE_TASK",
    taskTitle: rule.taskTitle || null,
    taskDescription: rule.taskDescription || null,
    dueInHours: rule.dueInHours ?? null,
    targetStage: rule.targetStage || null,
    targetPipelineId: rule.targetPipelineId || null,
    opportunityTitle: rule.opportunityTitle || null,
    emailTemplateId: rule.emailTemplateId || null,
    emailSubject: rule.emailSubject || null,
    emailBody: rule.emailBody || null,
    whatsappTemplateId: rule.whatsappTemplateId || null,
    notificationTitle: rule.notificationTitle || null,
    notificationBody: rule.notificationBody || null,
    delayInHours: rule.delayInHours ?? null,
    requireNoResponse: Boolean(rule.requireNoResponse),
    active: rule.active !== false,
  };
}

function readError(error, fallback) {
  const data = error?.response?.data;
  return data?.message || data?.error || (typeof data === "string" ? data : null) || error.message || fallback;
}
