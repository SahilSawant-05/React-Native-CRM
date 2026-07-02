import { useEffect, useMemo, useState } from "react";
import {
  Archive,
  ArrowDown,
  ArrowUp,
  BarChart3,
  CheckCircle2,
  Cloud,
  CloudDownload,
  ClipboardList,
  Eye,
  FileText,
  FormInput,
  GitBranch,
  Image as ImageIcon,
  Layers3,
  ListChecks,
  Loader2,
  Plus,
  Save,
  Send,
  Smartphone,
  Trash2,
  Type,
} from "lucide-react";
import api from "../api/axios";

const FIELD_TYPES = ["TEXT", "PHONE", "EMAIL", "NUMBER", "DATE", "SELECT", "TEXTAREA"];
const CONTENT_BLOCK_TYPES = [
  { value: "HEADING", label: "Heading", icon: Type },
  { value: "PARAGRAPH", label: "Paragraph", icon: FileText },
  { value: "IMAGE", label: "Image", icon: ImageIcon },
];
const CRM_TARGETS = [
  { value: "", label: "Do not map" },
  { value: "contact.name", label: "Contact: Name" },
  { value: "contact.phone", label: "Contact: Phone" },
  { value: "contact.email", label: "Contact: Email" },
  { value: "contact.city", label: "Contact: City" },
  { value: "opportunity.title", label: "Opportunity: Title" },
  { value: "opportunity.amount", label: "Opportunity: Amount" },
  { value: "opportunity.expectedRevenue", label: "Opportunity: Expected Revenue" },
  { value: "opportunity.expectedCloseDate", label: "Opportunity: Expected Close Date" },
  { value: "opportunity.notes", label: "Opportunity: Notes" },
  { value: "custom", label: "Keep as custom detail" },
];

const blankField = (index = 0) => ({
  fieldKey: `field_${index + 1}`,
  label: "New Field",
  type: "TEXT",
  required: false,
  options: [],
  displayOrder: index,
});

const blankContentBlock = (index = 0, type = "PARAGRAPH") => ({
  blockKey: `block_${index + 1}`,
  type,
  text: type === "HEADING" ? "Section heading" : type === "PARAGRAPH" ? "Add helpful text for the customer." : "",
  imageUrl: "",
  altText: "",
  displayOrder: index,
});

const blankScreen = (index = 0) => ({
  screenKey: `screen_${index + 1}`,
  title: `Screen ${index + 1}`,
  body: "",
  buttonText: "Continue",
  terminal: false,
  allowBack: true,
  displayOrder: index,
  contentBlocks: [],
  fields: [blankField(0)],
});

const emptyForm = {
  id: null,
  name: "",
  description: "",
  templateKey: "",
  pipelineId: "",
  stageKey: "",
  screens: [
    {
      screenKey: "basic_info",
      title: "Basic Info",
      body: "Collect the lead contact details.",
      buttonText: "Submit",
      terminal: true,
      allowBack: true,
      displayOrder: 0,
      contentBlocks: [
        { blockKey: "intro", type: "PARAGRAPH", text: "Collect the lead contact details.", imageUrl: "", altText: "", displayOrder: 0 },
      ],
      fields: [
        { fieldKey: "name", label: "Name", type: "TEXT", required: true, options: [], displayOrder: 0 },
        { fieldKey: "phone", label: "Phone", type: "PHONE", required: true, options: [], displayOrder: 1 },
      ],
    },
  ],
  mappings: [
    { fieldKey: "name", target: "contact.name", customKey: "" },
    { fieldKey: "phone", target: "contact.phone", customKey: "" },
  ],
};

function slug(value) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function flattenScreens(screens = []) {
  return screens.flatMap((screen) => screen.fields || []);
}

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
}

function formatValue(value) {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function normalizeScreensFromFlow(flow) {
  if (flow.screens?.length) {
    return flow.screens.map((screen, index) => ({
      ...blankScreen(index),
      ...screen,
      contentBlocks: Array.isArray(screen.contentBlocks) ? screen.contentBlocks : (screen.body ? [{ blockKey: "intro", type: "PARAGRAPH", text: screen.body, imageUrl: "", altText: "", displayOrder: 0 }] : []),
      fields: Array.isArray(screen.fields) && screen.fields.length ? screen.fields : [blankField(0)],
    }));
  }
  if (flow.fields?.length) return [{ ...blankScreen(0), screenKey: "lead_details", title: "Lead Details", body: "Collect lead information.", buttonText: "Submit", terminal: true, contentBlocks: [blankContentBlock(0, "PARAGRAPH")], fields: flow.fields }];
  return emptyForm.screens;
}

function flowStatusStyle(status) {
  const normalized = String(status || "DRAFT").toUpperCase();
  if (normalized === "PUBLISHED") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (normalized === "ARCHIVED") return "bg-gray-100 text-gray-600 border-gray-200";
  if (normalized === "FAILED") return "bg-red-50 text-red-700 border-red-200";
  return "bg-amber-50 text-amber-700 border-amber-200";
}

export default function WhatsAppFlowBuilder() {
  const [activeTab, setActiveTab] = useState("builder");
  const [flows, setFlows] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [metaFlows, setMetaFlows] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [pipelines, setPipelines] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [activeScreenIndex, setActiveScreenIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [retryingSubmissionId, setRetryingSubmissionId] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selectedPipeline = pipelines.find((pipeline) => String(pipeline.id) === String(form.pipelineId));
  const activeScreen = form.screens[activeScreenIndex] || form.screens[0];
  const allFields = useMemo(() => flattenScreens(form.screens), [form.screens]);
  const publishedFlows = flows.filter((flow) => flow.status === "PUBLISHED");
  const savedMetaFlows = useMemo(
    () =>
      flows
        .filter((flow) => flow.metaFlowId && !String(flow.metaFlowId).startsWith("local-flow-"))
        .map((flow) => ({
          id: flow.metaFlowId,
          name: flow.name,
          status: flow.status,
          category: "LEAD_GENERATION",
          imported: true,
          crmFlowId: flow.id,
        })),
    [flows]
  );
  const visibleMetaFlows = useMemo(() => {
    const merged = new Map();
    savedMetaFlows.forEach((flow) => merged.set(String(flow.id), flow));
    metaFlows.forEach((flow) => merged.set(String(flow.id), { ...merged.get(String(flow.id)), ...flow }));
    return Array.from(merged.values());
  }, [metaFlows, savedMetaFlows]);
  const mappingByField = useMemo(() => Object.fromEntries(form.mappings.map((mapping) => [mapping.fieldKey, mapping])), [form.mappings]);

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const [flowsResponse, templatesResponse, submissionsResponse, analyticsResponse, pipelinesResponse] = await Promise.all([
        api.get("/api/whatsapp-flows"),
        api.get("/api/whatsapp-flows/templates"),
        api.get("/api/whatsapp-flows/submissions"),
        api.get("/api/whatsapp-flows/analytics"),
        api.get("/api/pipelines"),
      ]);
      setFlows(Array.isArray(flowsResponse.data) ? flowsResponse.data : []);
      setTemplates(Array.isArray(templatesResponse.data) ? templatesResponse.data : []);
      setSubmissions(Array.isArray(submissionsResponse.data) ? submissionsResponse.data : []);
      setAnalytics(analyticsResponse.data || null);
      setPipelines(Array.isArray(pipelinesResponse.data) ? pipelinesResponse.data : []);
    } catch (err) {
      setError(err?.response?.data?.error || "Could not load WhatsApp flows.");
    } finally {
      setLoading(false);
    }
  };

  const syncMetaFlows = async () => {
    setError("");
    setMessage("");
    try {
      const response = await api.get("/api/whatsapp-flows/meta");
      setMetaFlows(Array.isArray(response.data) ? response.data : []);
      await loadData();
      setMessage("Meta Flows synced and saved in CRM.");
    } catch (err) {
      setError(err?.response?.data?.error || err?.response?.data?.message || "Could not sync Meta Flows.");
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const setScreens = (updater) => {
    setForm((prev) => ({ ...prev, screens: typeof updater === "function" ? updater(prev.screens) : updater }));
  };

  const applyTemplate = (template) => {
    setForm({
      ...emptyForm,
      name: template.name,
      description: template.description,
      templateKey: template.templateKey,
      screens: normalizeScreensFromFlow(template),
      mappings: template.mappings || [],
    });
    setActiveScreenIndex(0);
    setMessage(`Loaded ${template.name} starter.`);
    setActiveTab("builder");
  };

  const editFlow = (flow) => {
    setForm({
      id: flow.id,
      name: flow.name || "",
      description: flow.description || "",
      templateKey: flow.templateKey || "",
      pipelineId: flow.pipelineId || "",
      stageKey: flow.stageKey || "",
      screens: normalizeScreensFromFlow(flow),
      mappings: flow.mappings || [],
    });
    setActiveScreenIndex(0);
    setActiveTab("builder");
  };

  const addScreen = () => {
    setScreens((screens) => screens.map((screen) => ({ ...screen, terminal: false })).concat({ ...blankScreen(screens.length), terminal: true, buttonText: "Submit" }));
    setActiveScreenIndex(form.screens.length);
  };

  const updateScreen = (key, value) => {
    setScreens((screens) =>
      screens.map((screen, index) => {
        if (index !== activeScreenIndex) return screen;
        const next = { ...screen, [key]: value };
        if (key === "title" && (!next.screenKey || next.screenKey.startsWith("screen_"))) next.screenKey = slug(value) || next.screenKey;
        if (key === "screenKey") next.screenKey = slug(value);
        if (key === "terminal" && value) next.buttonText = next.buttonText || "Submit";
        return next;
      })
    );
  };

  const removeScreen = (index) => {
    if (form.screens.length <= 1) return;
    const removedFields = new Set(form.screens[index].fields.map((field) => field.fieldKey));
    setForm((prev) => ({
      ...prev,
      screens: prev.screens.filter((_, i) => i !== index).map((screen, i, list) => ({ ...screen, displayOrder: i, terminal: i === list.length - 1 ? true : screen.terminal })),
      mappings: prev.mappings.filter((mapping) => !removedFields.has(mapping.fieldKey)),
    }));
    setActiveScreenIndex(Math.max(0, index - 1));
  };

  const moveScreen = (index, direction) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= form.screens.length) return;
    setScreens((screens) => {
      const copy = [...screens];
      const [screen] = copy.splice(index, 1);
      copy.splice(nextIndex, 0, screen);
      return copy.map((item, i) => ({ ...item, displayOrder: i }));
    });
    setActiveScreenIndex(nextIndex);
  };

  const addContentBlock = (type = "PARAGRAPH") => {
    setScreens((screens) =>
      screens.map((screen, screenIndex) =>
        screenIndex === activeScreenIndex
          ? { ...screen, contentBlocks: [...(screen.contentBlocks || []), blankContentBlock((screen.contentBlocks || []).length, type)] }
          : screen
      )
    );
  };

  const updateContentBlock = (blockIndex, key, value) => {
    setScreens((screens) =>
      screens.map((screen, screenIndex) => {
        if (screenIndex !== activeScreenIndex) return screen;
        const blocks = [...(screen.contentBlocks || [])];
        const current = { ...blocks[blockIndex], [key]: value };
        if (key === "type") {
          current.text = value === "HEADING" ? (current.text || "Section heading") : value === "PARAGRAPH" ? (current.text || "Add helpful text for the customer.") : "";
        }
        if ((key === "text" || key === "type") && (!current.blockKey || current.blockKey.startsWith("block_"))) {
          current.blockKey = slug(current.text || current.type || `block_${blockIndex + 1}`) || current.blockKey;
        }
        blocks[blockIndex] = current;
        return { ...screen, contentBlocks: blocks };
      })
    );
  };

  const removeContentBlock = (blockIndex) => {
    setScreens((screens) =>
      screens.map((screen, screenIndex) =>
        screenIndex === activeScreenIndex
          ? { ...screen, contentBlocks: (screen.contentBlocks || []).filter((_, i) => i !== blockIndex).map((block, i) => ({ ...block, displayOrder: i })) }
          : screen
      )
    );
  };

  const moveContentBlock = (blockIndex, direction) => {
    const blocks = activeScreen?.contentBlocks || [];
    const nextIndex = blockIndex + direction;
    if (nextIndex < 0 || nextIndex >= blocks.length) return;
    setScreens((screens) =>
      screens.map((screen, screenIndex) => {
        if (screenIndex !== activeScreenIndex) return screen;
        const copy = [...(screen.contentBlocks || [])];
        const [block] = copy.splice(blockIndex, 1);
        copy.splice(nextIndex, 0, block);
        return { ...screen, contentBlocks: copy.map((item, i) => ({ ...item, displayOrder: i })) };
      })
    );
  };

  const updateField = (fieldIndex, key, value) => {
    setScreens((screens) =>
      screens.map((screen, screenIndex) => {
        if (screenIndex !== activeScreenIndex) return screen;
        const fields = [...screen.fields];
        const previousKey = fields[fieldIndex].fieldKey;
        const current = { ...fields[fieldIndex], [key]: value };
        if (key === "label" && (!current.fieldKey || current.fieldKey.startsWith("field_"))) current.fieldKey = slug(value) || current.fieldKey;
        if (key === "fieldKey") current.fieldKey = slug(value);
        fields[fieldIndex] = current;
        if (previousKey !== current.fieldKey) {
          setForm((prev) => ({
            ...prev,
            mappings: prev.mappings.map((mapping) => mapping.fieldKey === previousKey ? { ...mapping, fieldKey: current.fieldKey } : mapping),
          }));
        }
        return { ...screen, fields };
      })
    );
  };

  const addField = () => {
    setScreens((screens) =>
      screens.map((screen, screenIndex) =>
        screenIndex === activeScreenIndex ? { ...screen, fields: [...screen.fields, blankField(screen.fields.length)] } : screen
      )
    );
  };

  const removeField = (fieldIndex) => {
    const removed = activeScreen.fields[fieldIndex];
    setForm((prev) => ({
      ...prev,
      screens: prev.screens.map((screen, screenIndex) =>
        screenIndex === activeScreenIndex
          ? { ...screen, fields: screen.fields.filter((_, i) => i !== fieldIndex).map((field, i) => ({ ...field, displayOrder: i })) }
          : screen
      ),
      mappings: prev.mappings.filter((mapping) => mapping.fieldKey !== removed.fieldKey),
    }));
  };

  const moveField = (fieldIndex, direction) => {
    const nextIndex = fieldIndex + direction;
    if (nextIndex < 0 || nextIndex >= activeScreen.fields.length) return;
    setScreens((screens) =>
      screens.map((screen, screenIndex) => {
        if (screenIndex !== activeScreenIndex) return screen;
        const fields = [...screen.fields];
        const [field] = fields.splice(fieldIndex, 1);
        fields.splice(nextIndex, 0, field);
        return { ...screen, fields: fields.map((item, i) => ({ ...item, displayOrder: i })) };
      })
    );
  };

  const updateMapping = (fieldKey, target) => {
    setForm((prev) => {
      const mappings = prev.mappings.filter((mapping) => mapping.fieldKey !== fieldKey);
      if (!target) return { ...prev, mappings };
      return { ...prev, mappings: [...mappings, { fieldKey, target, customKey: target === "custom" ? fieldKey : "" }] };
    });
  };

  const saveFlow = async () => {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const screens = form.screens.map((screen, screenIndex) => ({
        ...screen,
        screenKey: slug(screen.screenKey || screen.title) || `screen_${screenIndex + 1}`,
        displayOrder: screenIndex,
        terminal: Boolean(screen.terminal) || screenIndex === form.screens.length - 1,
        buttonText: screen.buttonText || (screenIndex === form.screens.length - 1 ? "Submit" : "Continue"),
        contentBlocks: (screen.contentBlocks || []).map((block, blockIndex) => ({
          ...block,
          blockKey: slug(block.blockKey || block.text || block.type) || `block_${blockIndex + 1}`,
          type: block.type || "PARAGRAPH",
          displayOrder: blockIndex,
        })),
        fields: screen.fields.map((field, fieldIndex) => ({
          ...field,
          fieldKey: slug(field.fieldKey || field.label) || `field_${fieldIndex + 1}`,
          displayOrder: fieldIndex,
        })),
      }));
      const payload = {
        name: form.name,
        description: form.description,
        templateKey: form.templateKey,
        pipelineId: form.pipelineId ? Number(form.pipelineId) : null,
        stageKey: form.stageKey || null,
        screens,
        fields: flattenScreens(screens),
        mappings: form.mappings,
      };
      const response = form.id ? await api.put(`/api/whatsapp-flows/${form.id}`, payload) : await api.post("/api/whatsapp-flows", payload);
      setForm((prev) => ({ ...prev, id: response.data.id, screens: response.data.screens || screens }));
      setMessage("WhatsApp Flow saved as draft.");
      await loadData();
    } catch (err) {
      setError(err?.response?.data?.error || "Could not save flow.");
    } finally {
      setSaving(false);
    }
  };

  const publishFlow = async (id) => {
    setError("");
    setMessage("");
    try {
      await api.post(`/api/whatsapp-flows/${id}/publish`);
      setMessage("Flow published inside CRM. Use Publish to Meta when you want to create the real WhatsApp Flow.");
      await loadData();
    } catch (err) {
      setError(err?.response?.data?.error || "Could not publish flow.");
    }
  };

  const linkMetaFlow = async (id, metaFlowId) => {
    setError("");
    setMessage("");
    try {
      await api.post(`/api/whatsapp-flows/${id}/meta-link`, { metaFlowId });
      setMessage("Meta Flow ID linked. This flow can now be sent as a WhatsApp button.");
      await loadData();
    } catch (err) {
      setError(err?.response?.data?.error || "Could not link Meta Flow ID.");
    }
  };

  const publishToMeta = async (id) => {
    setError("");
    setMessage("");
    try {
      const response = await api.post(`/api/whatsapp-flows/${id}/publish-meta`);
      setMessage(response.data?.message || "Flow published to Meta.");
      await loadData();
      await syncMetaFlows();
    } catch (err) {
      setError(err?.response?.data?.error || err?.response?.data?.message || "Could not publish flow to Meta.");
    }
  };

  const importMetaFlow = async (metaFlowId) => {
    setError("");
    setMessage("");
    try {
      const response = await api.post("/api/whatsapp-flows/meta/import", { metaFlowId });
      setMessage(response.data?.message || "Meta Flow is ready in CRM.");
      await loadData();
      await syncMetaFlows();
    } catch (err) {
      setError(err?.response?.data?.error || err?.response?.data?.message || "Could not import Meta Flow.");
    }
  };

  const previewMetaJson = async (id) => {
    setError("");
    setMessage("");
    try {
      const response = await api.get(`/api/whatsapp-flows/${id}/meta-json`);
      setMessage(`Meta JSON preview:\n${JSON.stringify(response.data, null, 2)}`);
    } catch (err) {
      setError(err?.response?.data?.error || err?.response?.data?.message || "Could not preview Meta Flow JSON.");
    }
  };

  const archiveFlow = async (id) => {
    try {
      await api.delete(`/api/whatsapp-flows/${id}`);
      setMessage("Flow archived.");
      await loadData();
    } catch (err) {
      setError(err?.response?.data?.error || "Could not archive flow.");
    }
  };

  const createTestSubmission = async (flow) => {
    const fields = flow.fields || flattenScreens(flow.screens || []);
    const values = {};
    fields.forEach((field) => {
      values[field.fieldKey] = field.type === "NUMBER" ? "500000" : field.type === "DATE" ? new Date().toISOString().slice(0, 10) : `${field.label} test`;
    });
    const phoneField = fields.find((field) => field.type === "PHONE" || field.fieldKey === "phone");
    if (phoneField) values[phoneField.fieldKey] = `91${Math.floor(7000000000 + Math.random() * 999999999)}`;
    try {
      await api.post(`/api/whatsapp-flows/${flow.id}/submissions`, {
        submitterPhone: values[phoneField?.fieldKey] || `91${Math.floor(7000000000 + Math.random() * 999999999)}`,
        submitterName: values.name || "Flow Test Lead",
        sourceMessageId: `test-${Date.now()}`,
        values,
      });
      setMessage("Test submission processed into CRM.");
      await loadData();
      setActiveTab("submissions");
    } catch (err) {
      setError(err?.response?.data?.error || "Could not create test submission.");
    }
  };

  const retrySubmission = async (submissionId) => {
    setRetryingSubmissionId(submissionId);
    setError("");
    setMessage("");
    try {
      const response = await api.post(`/api/whatsapp-flows/submissions/${submissionId}/retry`);
      setMessage(response.data?.status === "PROCESSED" ? "Flow submission retried and processed." : "Flow submission retry completed.");
      await loadData();
    } catch (err) {
      setError(err?.response?.data?.error || err?.response?.data?.message || "Could not retry Flow submission.");
    } finally {
      setRetryingSubmissionId(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="mx-auto max-w-[1500px] space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-950">WhatsApp Flow Builder</h1>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">Build customer-friendly WhatsApp forms, map answers into CRM fields, and convert submissions into Contacts + Opportunities.</p>
          </div>
          <button type="button" onClick={() => { setForm(emptyForm); setActiveScreenIndex(0); setActiveTab("builder"); }} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-teal-800">
            <Plus size={16} /> New Flow
          </button>
        </div>

        <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
          {[["builder", "Flow Builder", FormInput], ["published", "Published Flows", Send], ["meta", "Meta Flows", Cloud], ["submissions", "Submissions", ClipboardList], ["analytics", "Analytics", BarChart3]].map(([key, label, Icon]) => (
            <button key={key} type="button" onClick={() => setActiveTab(key)} className={`inline-flex min-h-10 items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold transition ${activeTab === key ? "bg-teal-950 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"}`}>
              <Icon size={16} /> {label}
            </button>
          ))}
        </div>

        {(message || error) && <div className={`max-h-96 overflow-auto whitespace-pre-wrap rounded-xl border px-4 py-3 text-sm font-semibold ${error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>{error || message}</div>}

        {loading ? (
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-6 text-slate-500"><Loader2 className="animate-spin" size={18} /> Loading WhatsApp flows...</div>
        ) : (
          <>
            {activeTab === "builder" && (
              <div className="grid gap-5 xl:grid-cols-[300px_minmax(0,1fr)_390px]">
                <aside className="space-y-4 xl:sticky xl:top-5 xl:self-start">
                  <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="mb-4 flex items-center justify-between">
                      <div>
                        <h2 className="text-sm font-extrabold text-slate-950">Screens</h2>
                        <p className="text-xs font-semibold text-slate-500">{form.screens.length} step flow</p>
                      </div>
                      <button type="button" onClick={addScreen} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-teal-200 bg-teal-50 px-3 py-2 text-sm font-bold text-teal-800 hover:bg-teal-100" title="Add screen"><Plus size={15} /> Add</button>
                    </div>
                    <div className="space-y-2">
                      {form.screens.map((screen, index) => (
                        <button key={`${screen.screenKey}-${index}`} type="button" onClick={() => setActiveScreenIndex(index)} className={`group w-full rounded-xl border p-3 text-left transition ${activeScreenIndex === index ? "border-teal-300 bg-teal-50 shadow-sm" : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"}`}>
                          <div className="flex items-start gap-3">
                            <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-extrabold ${activeScreenIndex === index ? "bg-teal-700 text-white" : "bg-slate-100 text-slate-600 group-hover:bg-slate-200"}`}>{index + 1}</span>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-2">
                                <span className="truncate text-sm font-extrabold text-slate-900">{screen.title || `Screen ${index + 1}`}</span>
                                {screen.terminal && <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-extrabold text-emerald-700">Submit</span>}
                              </div>
                              <div className="mt-1 text-xs font-semibold text-slate-500">{screen.contentBlocks?.length || 0} content · {screen.fields?.length || 0} fields</div>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </section>
                  <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <h2 className="mb-3 text-sm font-extrabold text-slate-950">Templates</h2>
                    <div className="space-y-2">
                      {templates.map((template) => (
                        <button key={template.templateKey} type="button" onClick={() => applyTemplate(template)} className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-left transition hover:border-teal-300 hover:bg-teal-50">
                          <div className="text-sm font-extrabold text-slate-900">{template.name}</div>
                          <div className="mt-1 line-clamp-2 text-xs text-slate-500">{template.description}</div>
                        </button>
                      ))}
                    </div>
                  </section>
                </aside>

                <main className="space-y-5">
                  <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <SectionHeader icon={FormInput} title="Flow Details" subtitle="Name the flow and choose where new opportunities should start." />
                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      <BuilderStat label="Screens" value={form.screens.length} />
                      <BuilderStat label="Fields" value={allFields.length} />
                      <BuilderStat label="Mapped" value={form.mappings.length} />
                    </div>
                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <Input label="Flow Name" value={form.name} onChange={(value) => setForm((prev) => ({ ...prev, name: value }))} />
                      <label className="block">
                        <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Target Pipeline</span>
                        <select className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={form.pipelineId} onChange={(e) => setForm((prev) => ({ ...prev, pipelineId: e.target.value, stageKey: "" }))}>
                          <option value="">Default pipeline</option>
                          {pipelines.map((pipeline) => <option key={pipeline.id} value={pipeline.id}>{pipeline.name}</option>)}
                        </select>
                      </label>
                      <label className="block md:col-span-2">
                        <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Description</span>
                        <textarea className="mt-1 min-h-20 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} />
                      </label>
                      <label className="block">
                        <span className="text-xs font-bold uppercase tracking-wide text-slate-500">First Opportunity Stage</span>
                        <select className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={form.stageKey} onChange={(e) => setForm((prev) => ({ ...prev, stageKey: e.target.value }))}>
                          <option value="">First stage automatically</option>
                          {(selectedPipeline?.stages || []).map((stage) => <option key={stage.stageKey} value={stage.stageKey}>{stage.label || stage.stageKey}</option>)}
                        </select>
                      </label>
                    </div>
                  </section>

                  {activeScreen && (
                    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                        <SectionHeader icon={Smartphone} title={`Screen ${activeScreenIndex + 1}: ${activeScreen.title || "Untitled"}`} subtitle="Configure screen identity, button behavior, and navigation." />
                        <div className="flex gap-2">
                          <IconButton label="Move screen up" onClick={() => moveScreen(activeScreenIndex, -1)} disabled={activeScreenIndex === 0}><ArrowUp size={15} /></IconButton>
                          <IconButton label="Move screen down" onClick={() => moveScreen(activeScreenIndex, 1)} disabled={activeScreenIndex === form.screens.length - 1}><ArrowDown size={15} /></IconButton>
                          <IconButton label="Delete screen" onClick={() => removeScreen(activeScreenIndex)} tone="danger" disabled={form.screens.length <= 1}><Trash2 size={15} /></IconButton>
                        </div>
                      </div>
                      <div className="grid gap-4 md:grid-cols-2">
                        <Input label="Screen Title" value={activeScreen.title} onChange={(value) => updateScreen("title", value)} />
                        <Input label="Screen Key" value={activeScreen.screenKey} onChange={(value) => updateScreen("screenKey", value)} />
                        <label className="block md:col-span-2">
                          <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Body / Helper Text</span>
                          <textarea className="mt-1 min-h-16 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={activeScreen.body || ""} onChange={(e) => updateScreen("body", e.target.value)} />
                        </label>
                        <Input label="Button Text" value={activeScreen.buttonText || ""} onChange={(value) => updateScreen("buttonText", value)} />
                        <div className="flex items-end gap-2">
                          <button type="button" onClick={() => updateScreen("terminal", !activeScreen.terminal)} className={`min-h-10 rounded-xl border px-3 py-2 text-sm font-bold transition ${activeScreen.terminal ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"}`}>Final Submit</button>
                          <button type="button" onClick={() => updateScreen("allowBack", !activeScreen.allowBack)} className={`min-h-10 rounded-xl border px-3 py-2 text-sm font-bold transition ${activeScreen.allowBack ? "border-blue-300 bg-blue-50 text-blue-700" : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"}`}>Back Allowed</button>
                        </div>
                      </div>
                    </section>
                  )}

                  <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                      <SectionHeader icon={Layers3} title="Screen Content" subtitle="Display-only content shown before the customer answers fields." />
                      <div className="flex flex-wrap gap-2">
                        {CONTENT_BLOCK_TYPES.map((type) => {
                          const Icon = type.icon;
                          return (
                          <button key={type.value} type="button" onClick={() => addContentBlock(type.value)} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50">
                            <Icon size={15} /> {type.label}
                          </button>
                          );
                        })}
                      </div>
                    </div>
                    <div className="space-y-3">
                      {(activeScreen?.contentBlocks || []).map((block, index) => (
                        <div key={`${block.blockKey}-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:border-slate-300">
                          <div className="mb-3 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-xs font-extrabold text-slate-600 ring-1 ring-slate-200">{index + 1}</span>
                              <span className="text-sm font-extrabold text-slate-900">{CONTENT_BLOCK_TYPES.find((type) => type.value === block.type)?.label || "Content"}</span>
                            </div>
                            <div className="flex gap-2">
                              <IconButton label="Move content up" onClick={() => moveContentBlock(index, -1)} disabled={index === 0}><ArrowUp size={15} /></IconButton>
                              <IconButton label="Move content down" onClick={() => moveContentBlock(index, 1)} disabled={index === (activeScreen?.contentBlocks || []).length - 1}><ArrowDown size={15} /></IconButton>
                              <IconButton label="Delete content" onClick={() => removeContentBlock(index)} tone="danger"><Trash2 size={15} /></IconButton>
                            </div>
                          </div>
                          <div className="grid gap-3 lg:grid-cols-[0.8fr_1.4fr_1fr_auto]">
                            <label>
                              <span className="text-xs font-bold text-slate-500">Type</span>
                              <select className="mt-1 min-h-10 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm" value={block.type || "PARAGRAPH"} onChange={(e) => updateContentBlock(index, "type", e.target.value)}>
                                {CONTENT_BLOCK_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
                              </select>
                            </label>
                            {block.type === "IMAGE" ? (
                              <>
                                <Input label="Image URL" value={block.imageUrl || ""} onChange={(value) => updateContentBlock(index, "imageUrl", value)} compact />
                                <Input label="Alt Text" value={block.altText || ""} onChange={(value) => updateContentBlock(index, "altText", value)} compact />
                              </>
                            ) : (
                              <label className="lg:col-span-2">
                                <span className="text-xs font-bold text-slate-500">Text</span>
                                <textarea className="mt-1 min-h-24 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm leading-6" value={block.text || ""} onChange={(e) => updateContentBlock(index, "text", e.target.value)} />
                              </label>
                            )}
                          </div>
                        </div>
                      ))}
                      {(activeScreen?.contentBlocks || []).length === 0 && (
                        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm font-semibold text-slate-500">
                          No display content yet. Add a heading, paragraph, or image if this screen needs context before fields.
                        </div>
                      )}
                    </div>
                  </section>

                  <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                      <SectionHeader icon={ListChecks} title="Fields & CRM Mapping" subtitle="Collect answers on this screen and decide where each answer should go in CRM." />
                      <button type="button" onClick={addField} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-teal-200 bg-teal-50 px-3 py-2 text-sm font-bold text-teal-800 transition hover:bg-teal-100"><Plus size={15} /> Add Field</button>
                    </div>
                    <div className="space-y-3">
                      {(activeScreen?.fields || []).map((field, index) => (
                        <div key={`${field.fieldKey}-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:border-slate-300">
                          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                            <div className="flex min-w-0 items-center gap-2">
                              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-xs font-extrabold text-slate-600 ring-1 ring-slate-200">{index + 1}</span>
                              <div className="min-w-0">
                                <div className="truncate text-sm font-extrabold text-slate-900">{field.label || "Untitled Field"}</div>
                                <div className="text-xs font-semibold text-slate-500">{field.type} · {mappingByField[field.fieldKey]?.target ? "Mapped" : "Not mapped"}</div>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <button type="button" onClick={() => updateField(index, "required", !field.required)} className={`min-h-9 rounded-xl border px-3 py-1.5 text-xs font-extrabold transition ${field.required ? "border-teal-300 bg-teal-50 text-teal-700" : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"}`}>{field.required ? "Required" : "Optional"}</button>
                              <IconButton label="Move field up" onClick={() => moveField(index, -1)} disabled={index === 0}><ArrowUp size={15} /></IconButton>
                              <IconButton label="Move field down" onClick={() => moveField(index, 1)} disabled={index === (activeScreen?.fields || []).length - 1}><ArrowDown size={15} /></IconButton>
                              <IconButton label="Delete field" onClick={() => removeField(index)} tone="danger"><Trash2 size={15} /></IconButton>
                            </div>
                          </div>
                          <div className="grid gap-3 lg:grid-cols-[1.1fr_0.9fr_0.8fr_1.1fr]">
                            <Input label="Label" value={field.label} onChange={(value) => updateField(index, "label", value)} compact />
                            <Input label="Key" value={field.fieldKey} onChange={(value) => updateField(index, "fieldKey", value)} compact />
                            <label><span className="text-xs font-bold text-slate-500">Type</span><select className="mt-1 min-h-10 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm" value={field.type} onChange={(e) => updateField(index, "type", e.target.value)}>{FIELD_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}</select></label>
                            <label><span className="text-xs font-bold text-slate-500">CRM Mapping</span><select className="mt-1 min-h-10 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm" value={mappingByField[field.fieldKey]?.target || ""} onChange={(e) => updateMapping(field.fieldKey, e.target.value)}>{CRM_TARGETS.map((target) => <option key={target.value} value={target.value}>{target.label}</option>)}</select></label>
                          </div>
                          {field.type === "SELECT" && <Input label="Options, comma separated" value={(field.options || []).join(", ")} onChange={(value) => updateField(index, "options", value.split(",").map((option) => option.trim()).filter(Boolean))} />}
                        </div>
                      ))}
                    </div>
                  </section>
                </main>

                <aside>
                  <section className="sticky top-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <SectionHeader icon={Smartphone} title="Live Preview" subtitle="Approximate WhatsApp screen preview for the selected step." />
                    <div className="mt-4 rounded-[30px] border border-slate-200 bg-slate-950 p-3 shadow-inner">
                      <div className="mb-2 flex items-center justify-between px-2 text-[10px] font-bold text-white/70">
                        <span>WhatsApp Flow</span>
                        <span>{activeScreenIndex + 1}/{form.screens.length}</span>
                      </div>
                      <div className="max-h-[560px] overflow-auto rounded-[24px] bg-[#e5ddd5] p-4">
                        <div className="mb-3 rounded-xl bg-white p-3">
                          <div className="text-sm font-bold text-slate-900">{activeScreen?.title || form.name || "Untitled Flow"}</div>
                          {activeScreen?.body && !(activeScreen?.contentBlocks || []).length && <div className="mt-1 text-xs leading-5 text-slate-500">{activeScreen.body}</div>}
                        </div>
                        {(activeScreen?.contentBlocks || []).length > 0 && (
                          <div className="mb-3 space-y-2 rounded-xl bg-white p-3">
                            {(activeScreen?.contentBlocks || []).map((block, index) => (
                              <PreviewContentBlock key={`${block.blockKey}-${index}`} block={block} />
                            ))}
                          </div>
                        )}
                        <div className="space-y-2">
                          {(activeScreen?.fields || []).map((field) => (
                            <div key={field.fieldKey} className="rounded-lg bg-white p-3">
                              <div className="text-xs font-bold text-slate-600">{field.label}{field.required ? " *" : ""}</div>
                              <div className="mt-2 rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-400">{field.type === "SELECT" ? (field.options?.[0] || "Choose option") : `Enter ${field.label}`}</div>
                            </div>
                          ))}
                        </div>
                        <button type="button" className="mt-3 w-full rounded-lg bg-emerald-600 px-3 py-2 text-sm font-extrabold text-white">{activeScreen?.buttonText || "Continue"}</button>
                      </div>
                    </div>
                    <div className="mt-4 grid grid-cols-3 gap-2">
                      <BuilderStat label="Screens" value={form.screens.length} compact />
                      <BuilderStat label="Fields" value={allFields.length} compact />
                      <BuilderStat label="Mapped" value={form.mappings.length} compact />
                    </div>
                    <div className="mt-4 space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                      <button type="button" onClick={saveFlow} disabled={saving} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-teal-800 disabled:opacity-60">{saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />} Save Draft</button>
                      {form.id && <button type="button" onClick={() => publishFlow(form.id)} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-teal-300 bg-white px-4 py-2.5 text-sm font-bold text-teal-800 hover:bg-teal-50"><Send size={16} /> Publish in CRM</button>}
                      {form.id && <button type="button" onClick={() => publishToMeta(form.id)} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-slate-950 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-800"><Cloud size={16} /> Publish to Meta</button>}
                    </div>
                  </section>
                </aside>
              </div>
            )}

            {activeTab === "published" && <PublishedFlows flows={publishedFlows.length ? publishedFlows : flows} onEdit={editFlow} onPublish={publishFlow} onPublishMeta={publishToMeta} onPreviewMeta={previewMetaJson} onTest={createTestSubmission} onArchive={archiveFlow} onLinkMeta={linkMetaFlow} />}
            {activeTab === "meta" && <MetaFlows flows={visibleMetaFlows} crmFlows={flows} onSync={syncMetaFlows} onImport={importMetaFlow} onEdit={editFlow} />}
            {activeTab === "submissions" && <Submissions submissions={submissions} onRetry={retrySubmission} retryingId={retryingSubmissionId} />}
            {activeTab === "analytics" && <Analytics analytics={analytics} />}
          </>
        )}
      </div>
    </div>
  );
}

function Input({ label, value, onChange }) {
  return (
    <label className="block">
      <span className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</span>
      <input className="mt-1 min-h-10 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100" value={value || ""} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function SectionHeader({ icon: Icon, title, subtitle }) {
  return (
    <div className="flex min-w-0 items-start gap-3">
      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700 ring-1 ring-teal-100">
        <Icon size={18} />
      </span>
      <div className="min-w-0">
        <h2 className="truncate text-base font-extrabold text-slate-950">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm leading-5 text-slate-500">{subtitle}</p>}
      </div>
    </div>
  );
}

function IconButton({ children, label, onClick, disabled = false, tone = "slate" }) {
  const toneClass = tone === "danger"
    ? "border-red-200 text-red-600 hover:bg-red-50 disabled:text-red-300"
    : "border-slate-300 text-slate-600 hover:bg-slate-100 disabled:text-slate-300";
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-xl border bg-white transition disabled:cursor-not-allowed disabled:opacity-60 ${toneClass}`}
    >
      {children}
    </button>
  );
}

function BuilderStat({ label, value, compact = false }) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-slate-50 ${compact ? "p-2 text-center" : "p-3"}`}>
      <div className={`${compact ? "text-base" : "text-lg"} font-extrabold text-slate-950`}>{value}</div>
      <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</div>
    </div>
  );
}

function PreviewContentBlock({ block }) {
  if (!block) return null;
  if (block.type === "IMAGE") {
    return block.imageUrl ? (
      <img src={block.imageUrl} alt={block.altText || "Flow content"} className="max-h-40 w-full rounded-lg border border-slate-100 object-cover" />
    ) : (
      <div className="flex h-28 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-xs font-semibold text-slate-400">
        Image URL missing
      </div>
    );
  }
  if (block.type === "HEADING") {
    return <div className="text-sm font-extrabold text-slate-950">{block.text || "Heading"}</div>;
  }
  return <div className="text-xs leading-5 text-slate-600">{block.text || "Paragraph text"}</div>;
}

function PublishedFlows({ flows, onEdit, onPublish, onPublishMeta, onPreviewMeta, onTest, onArchive, onLinkMeta }) {
  if (flows.length === 0) return <EmptyState title="No flows yet" text="Create your first WhatsApp Flow from the builder tab." />;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {flows.map((flow) => (
        <div key={flow.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div><div className="text-lg font-extrabold text-slate-950">{flow.name}</div><p className="mt-1 text-sm text-slate-500">{flow.description || "No description"}</p></div>
            <span className={`rounded-full border px-2.5 py-1 text-xs font-extrabold ${flowStatusStyle(flow.status)}`}>{flow.status}</span>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
            <Metric label="Screens" value={flow.screens?.length || 0} />
            <Metric label="Fields" value={flow.fields?.length || 0} />
            <Metric label="Submissions" value={flow.submissionCount || 0} />
          </div>
          {flow.templateKey === "meta_import" && (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800">
              Imported from Meta. Open Edit and confirm CRM field mapping, pipeline, and stage before using this flow in automation.
            </div>
          )}
          <MetaFlowLink flow={flow} onLinkMeta={onLinkMeta} />
          <div className="mt-4 flex flex-wrap gap-2">
            <Action onClick={() => onEdit(flow)} icon={Eye} label="Edit" />
            {flow.status !== "PUBLISHED" && <Action onClick={() => onPublish(flow.id)} icon={Send} label="Publish" tone="teal" />}
            <Action onClick={() => onPublishMeta(flow.id)} icon={Cloud} label="Publish to Meta" tone="teal" />
            <Action onClick={() => onPreviewMeta(flow.id)} icon={Eye} label="Preview JSON" />
            <Action onClick={() => onTest(flow)} icon={GitBranch} label="Test Submit" tone="blue" />
            <Action onClick={() => onArchive(flow.id)} icon={Archive} label="Archive" />
          </div>
        </div>
      ))}
    </div>
  );
}

function MetaFlowLink({ flow, onLinkMeta }) {
  const [metaFlowId, setMetaFlowId] = useState(flow.metaFlowId?.startsWith("local-flow-") ? "" : flow.metaFlowId || "");
  const ready = flow.metaFlowId && !String(flow.metaFlowId).startsWith("local-flow-");

  return (
    <div className={`mt-4 rounded-xl border p-3 ${ready ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className={`text-sm font-extrabold ${ready ? "text-emerald-800" : "text-amber-800"}`}>
            {ready ? "Ready for WhatsApp" : "Needs Meta Flow ID"}
          </div>
          <div className={`mt-0.5 text-xs ${ready ? "text-emerald-700" : "text-amber-700"}`}>
            {ready ? `Meta Flow ID: ${flow.metaFlowId}` : "Create or publish this flow in WhatsApp Manager, then paste the Meta Flow ID here."}
          </div>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <input
          value={metaFlowId}
          onChange={(event) => setMetaFlowId(event.target.value)}
          placeholder="Paste Meta Flow ID"
          className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={() => onLinkMeta(flow.id, metaFlowId)}
          disabled={!metaFlowId.trim()}
          className="rounded-lg bg-slate-950 px-3 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          Link
        </button>
      </div>
    </div>
  );
}

function MetaFlows({ flows, crmFlows, onSync, onImport, onEdit }) {
  const crmFlowById = Object.fromEntries((crmFlows || []).map((flow) => [String(flow.id), flow]));
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 p-5">
        <div>
          <h2 className="text-base font-extrabold text-slate-950">Meta WhatsApp Flows</h2>
          <p className="mt-1 text-sm text-slate-500">Sync flows created in WhatsApp Manager. Synced flows are saved in CRM and can be mapped to contacts, opportunities, and pipeline stages.</p>
        </div>
        <button type="button" onClick={onSync} className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-800">
          <CloudDownload size={16} /> Sync from Meta
        </button>
      </div>
      <div className="divide-y divide-slate-100">
        {flows.map((flow) => {
          const crmFlow = flow.crmFlowId ? crmFlowById[String(flow.crmFlowId)] : null;
          return (
          <div key={flow.id} className="grid gap-3 p-4 md:grid-cols-[1.4fr_0.7fr_0.7fr_auto] md:items-center">
            <div>
              <div className="font-extrabold text-slate-950">{flow.name || `Meta Flow ${flow.id}`}</div>
              <div className="mt-1 text-xs text-slate-500">Meta ID: {flow.id}</div>
            </div>
            <span className="text-sm font-semibold text-slate-600">{flow.status || "UNKNOWN"}</span>
            <span className={`inline-flex w-fit rounded-full border px-2.5 py-1 text-xs font-extrabold ${flow.imported ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}>
              {flow.imported ? `Ready in CRM #${flow.crmFlowId}` : "Not saved"}
            </span>
            {flow.imported && crmFlow ? (
              <button
                type="button"
                onClick={() => onEdit(crmFlow)}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-teal-300 bg-teal-50 px-3 py-2 text-sm font-bold text-teal-800 hover:bg-teal-100"
              >
                <Eye size={15} /> Edit Mapping
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onImport(flow.id)}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
              >
                <CloudDownload size={15} /> Use in CRM
              </button>
            )}
          </div>
        );})}
        {flows.length === 0 && <EmptyState title="No Meta flows loaded" text="Click Sync from Meta to fetch and save flows from your connected WhatsApp Business Account." />}
      </div>
    </div>
  );
}

function Submissions({ submissions, onRetry, retryingId }) {
  const [selectedId, setSelectedId] = useState(submissions[0]?.id || null);
  const selected = submissions.find((submission) => submission.id === selectedId) || submissions[0] || null;
  const answerEntries = selected?.values ? Object.entries(selected.values) : [];

  return (
    <div className="grid gap-4 xl:grid-cols-[430px_1fr]">
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-5">
          <h2 className="text-base font-extrabold text-slate-950">Flow Submissions</h2>
          <p className="text-sm text-slate-500">Review what customers submitted and confirm CRM conversion.</p>
        </div>
        <div className="max-h-[680px] divide-y divide-slate-100 overflow-auto">
          {submissions.map((submission) => {
            const active = selected?.id === submission.id;
            return (
              <button
                key={submission.id}
                type="button"
                onClick={() => setSelectedId(submission.id)}
                className={`w-full p-4 text-left transition ${active ? "bg-teal-50" : "bg-white hover:bg-slate-50"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate font-bold text-slate-900">{submission.submitterName || submission.values?.name || "Unknown lead"}</div>
                    <div className="mt-1 text-sm text-slate-500">{submission.submitterPhone || submission.values?.phone || "No phone"}</div>
                  </div>
                  <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-extrabold ${submission.status === "PROCESSED" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"}`}>
                    {submission.status}
                  </span>
                </div>
                <div className="mt-3 text-xs font-semibold text-slate-500">{submission.flowName || `Flow #${submission.flowId}`} · {formatDateTime(submission.submittedAt)}</div>
              </button>
            );
          })}
          {submissions.length === 0 && <EmptyState title="No submissions yet" text="Use Test Submit on a published flow to verify CRM conversion." />}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        {selected ? (
          <>
            <div className="border-b border-slate-200 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-extrabold text-slate-950">{selected.submitterName || selected.values?.name || "Unknown lead"}</h2>
                  <p className="mt-1 text-sm text-slate-500">{selected.flowName || `Flow #${selected.flowId}`} · Submission #{selected.id}</p>
                </div>
                <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-extrabold ${selected.status === "PROCESSED" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"}`}>
                  {selected.status === "PROCESSED" && <CheckCircle2 size={13} />} {selected.status}
                </span>
              </div>
              {selected.status === "FAILED" && (
                <button
                  type="button"
                  onClick={() => onRetry(selected.id)}
                  disabled={retryingId === selected.id}
                  className="mt-4 inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {retryingId === selected.id ? <Loader2 className="animate-spin" size={15} /> : <GitBranch size={15} />}
                  {retryingId === selected.id ? "Retrying..." : "Retry processing"}
                </button>
              )}
            </div>

            <div className="grid gap-4 p-5 md:grid-cols-3">
              <Metric label="Contact" value={selected.contactId ? `#${selected.contactId}` : "-"} />
              <Metric label="Opportunity" value={selected.opportunityId ? `#${selected.opportunityId}` : "-"} />
              <Metric label="Submitted" value={formatDateTime(selected.submittedAt)} />
            </div>

            <div className="border-t border-slate-100 p-5">
              <h3 className="text-sm font-extrabold uppercase tracking-wide text-slate-500">Submitted Answers</h3>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {answerEntries.map(([key, value]) => (
                  <div key={key} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="text-xs font-extrabold uppercase tracking-wide text-slate-500">{key}</div>
                    <div className="mt-1 break-words text-sm font-semibold text-slate-900">{formatValue(value)}</div>
                  </div>
                ))}
                {answerEntries.length === 0 && <div className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">No answer payload stored.</div>}
              </div>
            </div>

            <div className="border-t border-slate-100 p-5">
              <h3 className="text-sm font-extrabold uppercase tracking-wide text-slate-500">Processing Details</h3>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <Detail label="Submitter phone" value={selected.submitterPhone || selected.values?.phone} />
                <Detail label="Source message id" value={selected.sourceMessageId} />
                <Detail label="Processed at" value={formatDateTime(selected.processedAt)} />
                <Detail label="Flow id" value={selected.flowId} />
              </div>
              {selected.processingError && (
                <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
                  {selected.processingError}
                </div>
              )}
            </div>
          </>
        ) : (
          <EmptyState title="Select a submission" text="Choose a Flow submission to review answers and CRM conversion." />
        )}
      </div>
    </div>
  );
}

function Detail({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="text-xs font-extrabold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 break-words text-sm font-semibold text-slate-900">{formatValue(value)}</div>
    </div>
  );
}

function Analytics({ analytics }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {[["Total Flows", analytics?.totalFlows || 0], ["Published", analytics?.publishedFlows || 0], ["Submissions", analytics?.totalSubmissions || 0], ["Last 7 Days", analytics?.submissionsLast7Days || 0], ["Processed", analytics?.processedSubmissions || 0], ["Failed", analytics?.failedSubmissions || 0], ["Drafts", analytics?.draftFlows || 0], ["Archived", analytics?.archivedFlows || 0]].map(([label, value]) => (
        <div key={label} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div className="text-3xl font-extrabold text-slate-950">{value}</div><div className="mt-1 text-sm font-semibold text-slate-500">{label}</div></div>
      ))}
    </div>
  );
}

function Metric({ label, value }) {
  return <div className="rounded-lg bg-slate-50 p-3"><div className="font-extrabold text-slate-900">{value}</div><div className="text-xs text-slate-500">{label}</div></div>;
}

function Action({ onClick, icon: Icon, label, tone = "slate" }) {
  const styles = tone === "teal" ? "border-teal-300 bg-teal-50 text-teal-700 hover:bg-teal-100" : tone === "blue" ? "border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100" : "border-slate-300 text-slate-700 hover:bg-slate-50";
  return <button type="button" onClick={onClick} className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-bold ${styles}`}><Icon size={15} /> {label}</button>;
}

function EmptyState({ title, text }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500"><ClipboardList size={22} /></div>
      <div className="font-extrabold text-slate-900">{title}</div>
      <div className="mt-1 text-sm text-slate-500">{text}</div>
    </div>
  );
}
