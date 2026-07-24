import { useEffect, useMemo, useState } from "react";
import { FileText, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import api from "../../api/axios";

const normalizeList = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.content)) return payload.content;
  return [];
};

const replaceTokens = (value, mergeData = {}) => {
  if (value == null) return "";
  const tokenMap = {
    "{{contactName}}": mergeData.contactName || "",
    "{{contactPhone}}": mergeData.contactPhone || "",
    "{{contactEmail}}": mergeData.contactEmail || "",
    "{{leadSource}}": mergeData.leadSource || "",
    "{{opportunityName}}": mergeData.opportunityName || "",
    "{{pipelineName}}": mergeData.pipelineName || "",
    "{{appointmentDate}}": mergeData.appointmentDate || "",
    "{{agentName}}": mergeData.agentName || "",
  };
  return Object.entries(tokenMap).reduce(
    (next, [token, replacement]) => next.replaceAll(token, replacement),
    String(value)
  );
};

const replaceDeep = (value, mergeData) => {
  if (typeof value === "string") return replaceTokens(value, mergeData);
  if (Array.isArray(value)) return value.map((item) => replaceDeep(item, mergeData));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, replaceDeep(item, mergeData)]));
  }
  return value;
};

const textToHtml = (value) =>
  String(value || "")
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${paragraph.replace(/\n/g, "<br />")}</p>`)
    .join("");

const buildTemplatePayload = (template, mergeData) => {
  const bodyText = replaceTokens(template.bodyText || "", mergeData);
  const bodyHtml = replaceTokens(template.bodyHtml || "", mergeData) || textToHtml(bodyText);
  let designJson = template.designJson || "";
  if (designJson) {
    try {
      designJson = JSON.stringify(replaceDeep(JSON.parse(designJson), mergeData));
    } catch {
      designJson = replaceTokens(designJson, mergeData);
    }
  }

  return {
    template,
    subject: replaceTokens(template.subject || "", mergeData),
    bodyHtml,
    bodyText,
    designJson,
    mjml: replaceTokens(template.mjml || "", mergeData),
  };
};

export default function EmailTemplatePicker({ onApply, mergeData, className = "" }) {
  const [templates, setTemplates] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const activeTemplates = useMemo(
    () => templates.filter((template) => template.active !== false),
    [templates]
  );

  const selectedTemplate = useMemo(
    () => activeTemplates.find((template) => String(template.id) === String(selectedId)) || null,
    [activeTemplates, selectedId]
  );

  const loadTemplates = async () => {
    setLoading(true);
    setMessage("");
    try {
      const response = await api.get("/api/crm-config/communication-templates", {
        params: { channel: "EMAIL" },
      });
      const nextTemplates = normalizeList(response.data);
      setTemplates(nextTemplates);
      setSelectedId((current) => current || (nextTemplates.find((template) => template.active !== false)?.id ?? ""));
    } catch (error) {
      setMessage(error?.response?.data?.message || error.message || "Templates failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  const applyTemplate = () => {
    if (!selectedTemplate) return;
    onApply?.(buildTemplatePayload(selectedTemplate, mergeData));
  };

  return (
    <div className={`rounded-lg border border-gray-200 bg-gray-50 p-3 ${className}`}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-extrabold text-gray-950">
          <FileText size={16} className="text-teal-700" />
          Email Template
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadTemplates}
            disabled={loading}
            className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-100 disabled:opacity-60"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
          <Link to="/dashboard/phase2-settings" className="rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-100">
            Edit Templates
          </Link>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
        <select
          value={selectedId}
          onChange={(event) => setSelectedId(event.target.value)}
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500"
        >
          <option value="">Select saved template</option>
          {activeTemplates.map((template) => (
            <option key={template.id} value={template.id}>
              {template.name} {template.subject ? `- ${template.subject}` : ""}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={applyTemplate}
          disabled={!selectedTemplate}
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-bold text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
        >
          Apply
        </button>
      </div>

      {selectedTemplate && (
        <p className="mt-2 line-clamp-2 text-xs leading-5 text-gray-500">
          {(selectedTemplate.bodyText || selectedTemplate.bodyHtml || "Template has no body yet").replace(/<[^>]+>/g, " ")}
        </p>
      )}
      {message && <p className="mt-2 text-xs font-semibold text-red-600">{message}</p>}
    </div>
  );
}
